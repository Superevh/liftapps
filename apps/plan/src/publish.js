// Live view-only links that don't reveal the edit link.
//
// A workspace's id is also its edit key, so a view link can't simply point at it. Instead, editors publish
// a *mirror*: a separate cloud document with its own id that holds a read-only copy of the roadmaps (and no
// reference to the workspace id). The workspace remembers the mirror id in `publish: { id, on }` so every
// editor knows it; whoever makes an edit publishes the change, as a small patch (diff against what the
// mirror holds), throttled and only when the content changed. Viewers open `?w=<mirror>&view=1`.
// Turning the link off replaces the mirror's content with an "off" marker; turning it on again makes a new id.
import { useEffect, useRef } from 'react'
import { backend, createWorkspace } from '../../../shared/cloud/cloud.mjs'
import { diff, apply } from '../../../shared/cloud/patch.mjs'
import { uid } from './store.js'

const MAX_ACTION = 60000
const DELAY = 1500

// What viewers get: names, roadmaps and recent changes. No workspace id, no publish settings.
export const mirrorOf = ws => ({ v: 2, pub: true, name: ws.name || '', roadmaps: ws.roadmaps, log: ws.log.slice(-150) })
export const OFF = { v: 2, pub: true, off: true, name: '', roadmaps: [], log: [] }

export const viewUrl = (mirrorId, rmId) => {
  const u = new URL(location.href)
  u.search = `?w=${encodeURIComponent(mirrorId)}&view=1`
  u.hash = rmId ? `present=${rmId}` : ''
  return u.toString()
}

export async function createMirror(ws) {
  // Its own bookkeeping key, so mirrors never show up in "Your workspaces".
  return createWorkspace('plan-pub', 'pv', mirrorOf(ws), ws.name || '')
}

// The mirror's current data: snapshot plus the actions logged since.
async function readMirror(id) {
  const [r] = await backend.getBoards([id])
  if (!r) return null
  let data = r.snapshot?.data ?? null, seq = r.seq
  for (const e of r.events) {
    const a = e.action
    if (a.type === 'PATCH') data = apply(data, a.ops)
    else if (a.type === 'REPLACE') data = a.data
    seq = Math.max(seq, e.seq)
  }
  return { data, seq, snapSeq: r.seq, meta: r.snapshot }
}

function chunk(ops) {
  const out = []
  let cur = [], size = 0
  for (const op of ops) {
    const n = JSON.stringify(op).length
    if (n > MAX_ACTION) continue // a single op this large can't be sent; the next full change will carry it
    if (size + n > MAX_ACTION && cur.length) { out.push(cur); cur = []; size = 0 }
    cur.push(op)
    size += n
  }
  if (cur.length) out.push(cur)
  return out
}

// Sends `data` to mirror `id` as patches against what it holds. Keeps a small per-mirror cache.
const cache = new Map()
export async function pushMirror(id, data) {
  if (!backend || !id) return
  let c = cache.get(id)
  if (!c) { c = await readMirror(id); if (!c) return; c.sub = backend.subscribe(id, () => {}, () => {}); cache.set(id, c) }
  const ops = diff(c.data, data)
  if (!ops.length) return
  for (const part of chunk(ops)) {
    const action = { type: 'PATCH', ops: part, nonce: uid() + uid(), at: Date.now() }
    const seq = await backend.append(id, action)
    c.data = apply(c.data, part)
    c.seq = seq
    c.sub?.send({ seq, action }) // live for viewers (they also poll)
  }
  if (c.seq - c.snapSeq >= 40 && c.meta) {
    c.snapSeq = c.seq
    backend.saveSnapshot(id, c.seq, { ...c.meta, data: c.data }).catch(() => {})
  }
}

// Publishes local edits (signalled by `editTick`) to the workspace's mirror, if sharing is on.
export function usePublisher(ws, editTick, enabled) {
  const wsRef = useRef(ws)
  wsRef.current = ws
  const busy = useRef(false), again = useRef(false), timer = useRef(null)
  const id = ws.publish?.on ? ws.publish.id : ''
  useEffect(() => {
    if (!enabled || !id || !editTick) return
    const run = async () => {
      if (busy.current) { again.current = true; return }
      busy.current = true
      try { await pushMirror(id, mirrorOf(wsRef.current)) } catch { cache.delete(id); timer.current = setTimeout(run, 10000) }
      busy.current = false
      if (again.current) { again.current = false; run() }
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(run, DELAY)
    return () => clearTimeout(timer.current)
  }, [editTick, id, enabled])
  // Send anything pending when the tab closes.
  useEffect(() => {
    const out = () => { if (enabled && id && timer.current) { clearTimeout(timer.current); pushMirror(id, mirrorOf(wsRef.current)).catch(() => {}) } }
    window.addEventListener('pagehide', out)
    return () => window.removeEventListener('pagehide', out)
  }, [id, enabled])
}
