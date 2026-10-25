// Local development server: the production supabase/live.sql running in PGlite (Postgres in WASM),
// exposed over HTTP so every browser and phone on the network shares one database.
//
//   POST /dev-api/rpc/:fn          JSON args → JSON result   (header x-user: signed-in user's uuid, if any)
//   POST /dev-api/users            { email } → { id, email }
//   GET  /dev-api/live/:channel    Server-Sent Events: broadcasts on that channel
//   POST /dev-api/live/:channel    { event, payload } → broadcast to every subscriber
//
// Data persists in .devdb/ (delete it to start fresh). Vite proxies /dev-api here (see vite.config.js).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.DEV_API_PORT) || 54302
const dataDir = process.env.DEV_DB === 'memory' ? undefined : path.join(root, '.devdb')

const AUTH_STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
`

const db = new PGlite(dataDir)
await db.exec(AUTH_STUB)
await db.exec(fs.readFileSync(path.join(root, 'supabase/live.sql'), 'utf8').replace(/create extension[^;]*;/, ''))

// PGlite runs one query at a time; a queue keeps each RPC's role and auth.uid() settings together.
let queue = Promise.resolve()
const serial = fn => (queue = queue.then(fn, fn))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function rpc(fn, args, user) {
  if (!/^live_[a-z_]+$/.test(fn)) return Promise.reject(new Error('unknown function'))
  const names = Object.keys(args).filter(n => /^p_[a-z_]+$/.test(n))
  const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`
  const params = names.map(n => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]))
  return serial(() => db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user && UUID.test(user) ? user : ''])
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`)
    const { rows } = await tx.query(sql, params)
    return rows[0].r
  }))
}

const channels = new Map() // name -> Set<res>
let messages = 0

function body(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c; if (data.length > 2e6) req.destroy() })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
  })
}
const send = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const parts = url.pathname.replace(/^\/dev-api/, '').split('/').filter(Boolean)
  try {
    if (parts[0] === 'rpc' && req.method === 'POST') {
      const result = await rpc(parts[1], await body(req), req.headers['x-user'])
      return send(res, 200, result ?? null)
    }
    if (parts[0] === 'users' && req.method === 'POST') {
      const email = String((await body(req)).email ?? '').trim().toLowerCase()
      if (!email.includes('@')) return send(res, 400, { message: 'Enter a valid email' })
      const id = crypto.createHash('sha256').update(email).digest('hex').replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12}).*/, '$1-$2-4$3-8$4-$5')
      await serial(() => db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [id, email]))
      return send(res, 200, { id, email })
    }
    if (parts[0] === 'live' && parts[1]) {
      const name = parts[1]
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
        res.write(': connected\n\n')
        if (!channels.has(name)) channels.set(name, new Set())
        channels.get(name).add(res)
        const ping = setInterval(() => res.write(': ping\n\n'), 20000)
        req.on('close', () => { clearInterval(ping); channels.get(name)?.delete(res) })
        return
      }
      if (req.method === 'POST') {
        const msg = `data: ${JSON.stringify(await body(req))}\n\n`
        for (const sub of channels.get(name) ?? []) { sub.write(msg); messages++ }
        return send(res, 200, { delivered: channels.get(name)?.size ?? 0 })
      }
    }
    if (parts[0] === 'stats') {
      return send(res, 200, { channels: Object.fromEntries([...channels].map(([k, v]) => [k, v.size])), messages })
    }
    send(res, 404, { message: 'not found' })
  } catch (e) {
    send(res, 400, { message: e.message })
  }
}).listen(PORT, () => console.log(`VoteLift dev API on http://localhost:${PORT} (data: ${dataDir ?? 'in memory'})`))
