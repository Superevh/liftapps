// Load test: one presenter and N audience members (default 100) running a full session.
//
//   Local dev API:   node scripts/loadtest.mjs                      (needs `npm run dev:api` running)
//   Supabase:        LOADTEST_TARGET=supabase LOADTEST_EMAIL=… LOADTEST_PASSWORD=… node scripts/loadtest.mjs
//                    (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local; the account must exist)
//   Options:         LOADTEST_N=100  LOADTEST_SPREAD_MS=3000 (how long the audience takes to answer)
//
// Every audience member holds its own Realtime connection (a websocket on Supabase, SSE locally), follows
// the presenter's slide changes and answers each question; the presenter polls results once a second
// exactly as the Present screen does. Reports broadcast delivery, answer latency/errors and how long until
// the presenter sees every answer. The test presentation is deleted at the end.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const N = Number(process.env.LOADTEST_N) || 100
const SPREAD = Number(process.env.LOADTEST_SPREAD_MS ?? 3000)
const TARGET = process.env.LOADTEST_TARGET || 'local'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const uuid = () => crypto.randomUUID()
const pct = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const fmt = ms => (Number.isFinite(ms) ? `${Math.round(ms)} ms` : '—')

// ───────── transports ─────────
function env() {
  const out = {}
  for (const f of ['.env', '.env.local']) {
    try { for (const line of fs.readFileSync(path.join(root, f), 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* none */ }
  }
  return { ...out, ...process.env }
}

async function localTransport() {
  const base = process.env.LOADTEST_API || 'http://localhost:54302'
  const post = async (p, body, headers = {}) => {
    const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.message ?? res.statusText)
    return json
  }
  const presenter = await post('/users', { email: 'loadtest@example.com' })
  return {
    name: `local dev API (${base})`,
    presenterRpc: (fn, args) => post(`/rpc/${fn}`, args, { 'x-user': presenter.id }),
    audienceRpc: () => (fn, args) => post(`/rpc/${fn}`, args),
    broadcast: (id, event, payload) => post(`/live/live:${id}`, { event, payload }),
    subscribe(id, onMessage) {
      const ctrl = new AbortController()
      const ready = (async () => {
        const res = await fetch(`${base}/live/live:${id}`, { signal: ctrl.signal })
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        ;(async () => {
          try {
            for (;;) {
              const { value, done } = await reader.read()
              if (done) break
              buf += dec.decode(value, { stream: true })
              let i
              while ((i = buf.indexOf('\n\n')) >= 0) {
                const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
                const data = chunk.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('')
                if (data) { const { event, payload } = JSON.parse(data); onMessage(event, payload) }
              }
            }
          } catch { /* closed */ }
        })()
      })()
      return { ready, close: () => ctrl.abort() }
    },
    close: async () => {},
  }
}

async function supabaseTransport() {
  const e = env()
  if (!e.VITE_SUPABASE_URL || !e.VITE_SUPABASE_ANON_KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing')
  if (!e.LOADTEST_EMAIL || !e.LOADTEST_PASSWORD) throw new Error('Set LOADTEST_EMAIL and LOADTEST_PASSWORD (an existing account) for the presenter')
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }
  const presenter = createClient(e.VITE_SUPABASE_URL, e.VITE_SUPABASE_ANON_KEY, opts)
  const { error } = await presenter.auth.signInWithPassword({ email: e.LOADTEST_EMAIL, password: e.LOADTEST_PASSWORD })
  if (error) throw new Error(`presenter sign-in failed: ${error.message}`)
  const rpcOf = sb => async (fn, args) => { const { data, error: err } = await sb.rpc(fn, args); if (err) throw new Error(err.message); return data }
  const clients = []
  // Audience members share one HTTP client per 10 people (like phones, each has its own websocket below).
  const httpPool = Array.from({ length: Math.ceil(N / 10) }, () => createClient(e.VITE_SUPABASE_URL, e.VITE_SUPABASE_ANON_KEY, opts))
  let next = 0
  const presenterChannels = new Map()
  return {
    name: `Supabase (${new URL(e.VITE_SUPABASE_URL).host})`,
    presenterRpc: rpcOf(presenter),
    audienceRpc: () => rpcOf(httpPool[next++ % httpPool.length]),
    async broadcast(id, event, payload) {
      let ch = presenterChannels.get(id)
      if (!ch) {
        ch = presenter.channel(`live:${id}`, { config: { broadcast: { self: false } } })
        await new Promise(r => ch.subscribe(st => { if (st === 'SUBSCRIBED') r() }))
        presenterChannels.set(id, ch)
      }
      return ch.send({ type: 'broadcast', event, payload })
    },
    subscribe(id, onMessage) {
      const sb = createClient(e.VITE_SUPABASE_URL, e.VITE_SUPABASE_ANON_KEY, opts)
      clients.push(sb)
      const ch = sb.channel(`live:${id}`, { config: { broadcast: { self: false } } })
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => onMessage(event, payload))
      const ready = new Promise((resolve, reject) => ch.subscribe((s, err) => {
        if (s === 'SUBSCRIBED') resolve()
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(err ?? new Error(s))
      }))
      return { ready, close: () => sb.removeAllChannels() }
    },
    close: async () => { await presenter.removeAllChannels(); await presenter.auth.signOut() },
  }
}

// ───────── the session ─────────
const slides = [
  { id: 'mc', type: 'mc', question: 'Load test: pick one', options: ['A', 'B', 'C', 'D'], multiple: false },
  { id: 'words', type: 'wordcloud', question: 'Load test: one word', maxEntries: 3 },
  { id: 'scales', type: 'scales', question: 'Load test: rate', statements: ['Speed', 'Fun'], min: 1, max: 5 },
  { id: 'quiz', type: 'quiz', question: 'Load test: 2 + 2?', options: ['3', '4', '5', '22'], correct: 1, time: 15 },
  { id: 'lb', type: 'leaderboard', question: 'Leaderboard' },
]
const answerFor = (slide, i) => ({
  mc: { choices: [i % 4] },
  words: { text: ['fast', 'fun', 'live', 'team', 'wow'][i % 5] },
  scales: { ratings: [1 + (i % 5), 1 + ((i * 3) % 5)] },
  quiz: { choice: i % 5 === 0 ? 0 : 1 },
})[slide.id]

async function main() {
  const T = TARGET === 'supabase' ? await supabaseTransport() : await localTransport()
  console.log(`\nVoteLift load test → ${T.name}, ${N} participants, answers spread over ${SPREAD} ms\n`)
  const { id, code } = await T.presenterRpc('live_create', { p_title: `Load test ${new Date().toISOString()}`, p_slides: slides, p_settings: {}, p_template: 'loadtest' })
  const stats = { join: [], respond: [], respondErrors: [], deliver: {}, missed: {}, visible: {}, myQuiz: [] }
  let currentSent = 0
  const audience = []

  try {
    // Join: every participant calls live_join and opens its realtime connection.
    const t0 = Date.now()
    await Promise.all(Array.from({ length: N }, async (_, i) => {
      await sleep(Math.random() * 1500) // people don't all scan the QR in the same millisecond
      const rpc = T.audienceRpc()
      const voter = uuid()
      const member = { i, voter, rpc, got: {} }
      const s = Date.now()
      const j = await rpc('live_join', { p_code: code, p_voter: voter, p_name: `Player ${i + 1}` })
      stats.join.push(Date.now() - s)
      member.sub = T.subscribe(j.id, (event, payload) => {
        if (event !== 'state') return
        const slide = payload.state.slide
        if (member.got[slide] === undefined) member.got[slide] = Date.now() - currentSent
        const sl = slides.find(x => x.id === slide)
        if (!sl || !answerFor(sl, i) || member.answered?.[slide]) return
        if (sl.type === 'quiz' && !payload.state.quiz?.[slide]) return
        ;(member.answered ??= {})[slide] = true
        setTimeout(async () => {
          const a = Date.now()
          try { await rpc('live_respond', { p_id: id, p_voter: voter, p_slide: slide, p_value: answerFor(sl, i) }); stats.respond.push(Date.now() - a) } catch (e) { stats.respondErrors.push(e.message) }
        }, Math.random() * SPREAD)
      })
      await member.sub.ready
      audience.push(member)
    }))
    console.log(`joined + subscribed: ${audience.length}/${N} in ${fmt(Date.now() - t0)}  (live_join p50 ${fmt(pct(stats.join, .5))}, p95 ${fmt(pct(stats.join, .95))})`)

    const results = await T.presenterRpc('live_results', { p_id: id, p_slide: 'mc', p_after: 0, p_reaction_after: 0 })
    console.log(`presenter sees ${results.participants} participants\n`)

    for (const slide of slides) {
      let state = await T.presenterRpc('live_set_state', { p_id: id, p_patch: slide.type === 'quiz' ? { slide: slide.id, startQuiz: slide.id } : { slide: slide.id } })
      currentSent = Date.now()
      await T.broadcast(id, 'state', { state, session: 1 })
      // Presenter polls once a second, as Present.jsx does, until every answer is visible.
      const expect = answerFor(slide, 0) ? N : 0
      let seen = 0, after = 0, polls = 0
      const start = Date.now()
      while (Date.now() - start < SPREAD + 15000) {
        await sleep(1000)
        const r = await T.presenterRpc('live_results', { p_id: id, p_slide: slide.id, p_after: after, p_reaction_after: 0 })
        polls++
        seen += r.responses.length
        if (r.responses.length) after = r.responses.at(-1).id
        if (seen >= expect) break
      }
      stats.visible[slide.id] = { seen, expect, ms: Date.now() - start, polls }
      await sleep(300)
      const got = audience.map(m => m.got[slide.id]).filter(v => v !== undefined)
      stats.deliver[slide.id] = got
      stats.missed[slide.id] = N - got.length
      if (slide.type === 'quiz') {
        state = await T.presenterRpc('live_set_state', { p_id: id, p_patch: { reveal: slide.id } })
        await T.broadcast(id, 'state', { state, session: 1 })
        await Promise.all(audience.map(async m => { const a = Date.now(); await m.rpc('live_my_quiz', { p_id: id, p_voter: m.voter }); stats.myQuiz.push(Date.now() - a) }))
      }
      const v = stats.visible[slide.id]
      console.log(`${slide.type.padEnd(12)} broadcast reached ${got.length}/${N} (p50 ${fmt(pct(got, .5))}, p95 ${fmt(pct(got, .95))}, max ${fmt(Math.max(...got))})` +
        (expect ? ` · presenter saw ${v.seen}/${expect} answers after ${fmt(v.ms)} (${v.polls} polls)` : ''))
    }
    const board = await T.presenterRpc('live_results', { p_id: id, p_slide: 'lb', p_after: 0, p_reaction_after: 0 })
    console.log(`\nlive_respond: ${stats.respond.length} ok, ${stats.respondErrors.length} errors, p50 ${fmt(pct(stats.respond, .5))}, p95 ${fmt(pct(stats.respond, .95))}, max ${fmt(Math.max(...stats.respond))}`)
    if (stats.respondErrors.length) console.log('  errors:', [...new Set(stats.respondErrors)].slice(0, 5).join(' | '))
    console.log(`live_my_quiz ×${stats.myQuiz.length}: p50 ${fmt(pct(stats.myQuiz, .5))}, p95 ${fmt(pct(stats.myQuiz, .95))}`)
    console.log(`leaderboard top: ${board.leaderboard.slice(0, 3).map(r => `${r.name} ${r.score}`).join(', ')} (${board.players} players)`)

    const allDelivered = Object.values(stats.missed).every(m => m === 0)
    const allVisible = Object.values(stats.visible).every(v => v.seen >= v.expect)
    const pass = allDelivered && allVisible && stats.respondErrors.length === 0 && audience.length === N
    console.log(`\n${pass ? 'PASS' : 'FAIL'}: ${N} participants, every slide change delivered: ${allDelivered}, every answer recorded: ${allVisible}`)
    process.exitCode = pass ? 0 : 1
  } finally {
    audience.forEach(m => m.sub?.close())
    await T.presenterRpc('live_delete', { p_id: id }).catch(() => {})
    await T.close()
    setTimeout(() => process.exit(process.exitCode ?? 0), 500)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
