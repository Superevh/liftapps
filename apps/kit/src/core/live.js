import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createBackend } from './backend.js'
import { newBoardId, uid } from './store.jsx'

// One backend for the whole page.
export const backend = createBackend()

// Poker rooms and health checks reuse the boards tables: a document is a JSON snapshot plus an
// ordered log of actions, exactly like a retro board, but they never appear in the board list.
// Ids carry a prefix so a link always opens the right kind of page.
// 'lf' keeps Lift ids apart from RetroLift's (which are 16 or 18 characters, never 20).
export const newDocId = prefix => 'lf' + prefix + newBoardId()

const SNAPSHOT_EVERY = 40
const POLL_MS = 12000

export function createDoc(id, snapshot, ownerKey) {
  return backend.createBoard(id, snapshot, ownerKey)
}

export function deleteDoc(id, ownerKey) {
  return backend.deleteBoard(id, ownerKey)
}

// Ids of the documents of one kind this browser created or opened, newest first.
export function rememberedDocs(kind) {
  try { return JSON.parse(localStorage.getItem(`lift-${kind}`)) ?? [] } catch { return [] }
}
export function rememberDoc(kind, entry) {
  const list = rememberedDocs(kind).filter(e => e.id !== entry.id)
  try { localStorage.setItem(`lift-${kind}`, JSON.stringify([entry, ...list].slice(0, 50))) } catch { /* storage blocked */ }
}
export function forgetDoc(kind, id) {
  try { localStorage.setItem(`lift-${kind}`, JSON.stringify(rememberedDocs(kind).filter(e => e.id !== id))) } catch { /* storage blocked */ }
}

// Live view of one document. `reduce(doc, action)` must be pure and take time only from
// action.at, so every browser folding the same log reaches the same state.
// Returns { status: 'loading' | 'ready' | 'missing' | 'offline', doc, dispatch, error }.
export function useLiveDoc(id, reduce) {
  const [, bump] = useReducer(x => x + 1, 0)
  const s = useRef(null)
  if (!s.current || s.current.id !== id) s.current = { id, status: backend ? 'loading' : 'offline', doc: null, seq: 0, snapSeq: 0, buffer: new Map(), pending: [], chain: Promise.resolve(), fetching: false, error: null, sub: null }
  const reduceRef = useRef(reduce)
  reduceRef.current = reduce

  const ingest = useCallback(events => {
    const d = s.current
    if (d.status !== 'ready') return
    for (const e of events) if (e.seq > d.seq) d.buffer.set(e.seq, e.action)
    let changed = false
    while (d.buffer.has(d.seq + 1)) {
      const a = d.buffer.get(d.seq + 1)
      d.buffer.delete(d.seq + 1)
      d.doc = reduceRef.current(d.doc, a)
      d.seq += 1
      d.pending = d.pending.filter(p => p.nonce !== a.nonce)
      changed = true
    }
    if (d.buffer.size) catchUp()
    if (!changed) return
    if (d.seq - d.snapSeq >= SNAPSHOT_EVERY) {
      d.snapSeq = d.seq
      backend.saveSnapshot(d.id, d.seq, d.doc).catch(() => { /* another client may have saved it */ })
    }
    bump()
  }, [])

  const catchUp = useCallback(() => {
    const d = s.current
    if (d.status !== 'ready' || d.fetching) return
    d.fetching = true
    backend.eventsSince(d.id, d.seq)
      .then(events => { d.fetching = false; ingest(events) })
      .catch(err => { d.fetching = false; d.error = err.message; bump() })
  }, [ingest])

  useEffect(() => {
    if (!backend) return
    const d = s.current
    let closed = false
    backend.getBoards([id]).then(rows => {
      if (closed) return
      const r = rows[0]
      if (!r) { d.status = 'missing'; bump(); return }
      Object.assign(d, { status: 'ready', doc: r.snapshot, seq: r.seq, snapSeq: r.seq })
      ingest(r.events)
      bump()
    }).catch(err => { d.status = 'missing'; d.error = err.message; bump() })
    d.sub = backend.subscribe(id, e => ingest([e]), catchUp)
    const poll = setInterval(catchUp, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') catchUp() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      closed = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      d.sub.close()
    }
  }, [id, ingest, catchUp])

  const dispatch = useCallback(raw => {
    const d = s.current
    if (d.status !== 'ready') return
    const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
    d.pending = [...d.pending, action]
    bump()
    d.chain = d.chain
      .then(() => backend.append(d.id, action))
      .then(seq => {
        ingest([{ seq, action }])
        d.sub?.send({ seq, action })
        d.error = null
      })
      .catch(err => {
        d.pending = d.pending.filter(p => p.nonce !== action.nonce)
        d.error = err.message
        d.chain = Promise.resolve()
        bump()
        catchUp()
      })
  }, [ingest, catchUp])

  const d = s.current
  const doc = d.status === 'ready' ? d.pending.reduce((x, a) => reduceRef.current(x, a), d.doc) : null
  return { status: d.status, doc, dispatch, error: d.error }
}

// Who has a document open right now: { ready, keys: Set }. `ready` stays false when the backend
// has no presence, so callers can treat everyone as here. Nothing is written to the document.
export function usePresence(id, key) {
  const [state, setState] = useState({ ready: false, keys: new Set() })
  useEffect(() => {
    if (!backend?.presence || !id || !key) return
    const h = backend.presence(id, key, keys => setState({ ready: true, keys: new Set(keys) }))
    return () => h.close()
  }, [id, key])
  return state
}
