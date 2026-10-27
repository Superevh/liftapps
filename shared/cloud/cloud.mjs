// Lift cloud sync for the workspace apps (GoalLift, DiscoveryLift, PlanLift, SketchLift).
//
// Each workspace is one document in the shared Lift backend (see backend.mjs). The app keeps its own
// React state and localStorage cache exactly as before; useCloudSync mirrors that state to the cloud:
//   local edit  -> keyed JSON patch (patch.mjs) -> queued, saved on this device, sent in order
//   remote edit -> folded into the document -> merged under any unsent local edits -> setState
// Unsent edits survive a reload or going offline (the queue lives in localStorage), and patches are
// idempotent, so a resend after a lost reply is harmless.
//
// A workspace is shared by link: ?w=<id>. Anyone with the link can view and edit (ids are ~80 bits).
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createBackend } from './backend.mjs'
import { diff, apply, same } from './patch.mjs'

export const backend = createBackend()

const MAX_ACTION = 60000 // the database refuses actions over 64 KB
const MAX_DOC = 950000 // and snapshots over 1 MB
const FLUSH_MS = 400
const SNAPSHOT_EVERY = 40
const POLL_MS = 12000

const mock = import.meta.env.VITE_BACKEND === 'mock'
// Per tab in mock mode so two tabs can act as two people (matches apps/kit).
const personal = () => (mock ? sessionStorage : localStorage)
const read = (store, key, fallback) => { try { const v = store.getItem(key); return v == null ? fallback : JSON.parse(v) } catch { return fallback } }
const write = (store, key, value) => { try { if (value == null) store.removeItem(key); else store.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ } }

const uid = () => Math.random().toString(36).slice(2, 10)
// Ids double as the share link, so they must be hard to guess (~80 bits).
function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, x => (x % 36).toString(36)).join('')
}
// Same 'lf' + prefix scheme as the kit apps, so ids never collide with RetroLift boards.
export const newDocId = prefix => 'lf' + prefix + randomId()

// The family-wide anonymous identity (same key and shape as apps/kit/src/core/store.jsx).
export function liftIdentity() {
  const saved = read(personal(), 'lift-identity', null)
  if (saved?.id && saved.secret) return saved
  const fresh = { id: uid() + uid(), name: '', color: '#8C613A', secret: randomId() + randomId() }
  write(personal(), 'lift-identity', fresh)
  return fresh
}

export const docSize = v => new Blob([JSON.stringify(v)]).size

function reduceDoc(doc, a) {
  switch (a.type) {
    case 'PATCH': return { ...doc, data: apply(doc.data, a.ops) }
    case 'REPLACE': return { ...doc, data: a.data }
    case 'RENAME': return { ...doc, name: String(a.name ?? '').slice(0, 120) }
    default: return doc
  }
}

// One open workspace document: server state + a persisted queue of our own unconfirmed actions.
class CloudDoc {
  constructor(id, onChange) {
    Object.assign(this, { id, onChange, status: 'loading', doc: null, seq: 0, snapSeq: 0, buffer: new Map(), sending: false, retry: 0, timer: null, error: null, closed: false })
    this.qKey = `lift-cloud-q-${id}`
    this.queue = read(localStorage, this.qKey, [])
  }

  open() {
    backend.getBoards([this.id]).then(rows => {
      if (this.closed) return
      const r = rows[0]
      if (!r) { this.status = 'missing'; this.onChange(); return }
      Object.assign(this, { status: 'ready', doc: r.snapshot, seq: r.seq, snapSeq: r.seq, error: null })
      this.ingest(r.events)
      this.onChange()
      this.pump()
    }).catch(err => {
      if (this.closed) return
      this.status = 'offline'
      this.error = err.message
      this.onChange()
      this.later(() => this.open())
    })
    this.sub = backend.subscribe(this.id, e => this.ingest([e]), () => this.catchUp())
    this.poll = setInterval(() => this.catchUp(), POLL_MS)
    this.wake = () => { if (document.visibilityState === 'visible') { this.catchUp(); this.pump() } }
    document.addEventListener('visibilitychange', this.wake)
    window.addEventListener('online', this.wake)
  }

  close() {
    this.closed = true
    clearInterval(this.poll)
    clearTimeout(this.timer)
    document.removeEventListener('visibilitychange', this.wake)
    window.removeEventListener('online', this.wake)
    this.sub?.close()
  }

  // Retry with backoff: 2s, 4s … 30s.
  later(fn) {
    clearTimeout(this.timer)
    this.retry = Math.min(this.retry + 1, 5)
    this.timer = setTimeout(() => { if (!this.closed) fn() }, Math.min(30000, 1000 * 2 ** this.retry))
  }

  view() {
    return this.doc ? this.queue.reduce(reduceDoc, this.doc) : null
  }

  push(raw) {
    this.queue = [...this.queue, { ...raw, nonce: uid() + uid(), at: Date.now() }]
    write(localStorage, this.qKey, this.queue)
    this.pump()
  }

  pump() {
    if (this.closed || this.status !== 'ready' || this.sending || !this.queue.length) return
    const action = this.queue[0]
    this.sending = true
    backend.append(this.id, action).then(seq => {
      this.sending = false
      this.retry = 0
      this.error = null
      this.ingest([{ seq, action }])
      this.sub?.send({ seq, action })
      this.pump()
    }).catch(err => {
      this.sending = false
      this.error = err.message
      this.onChange()
      // An action the server will never take (too large) is dropped; anything else is retried.
      if (/too large/i.test(err.message)) { this.drop(action.nonce); this.pump() } else this.later(() => { this.catchUp(); this.pump() })
    })
  }

  drop(nonce) {
    this.queue = this.queue.filter(a => a.nonce !== nonce)
    write(localStorage, this.qKey, this.queue.length ? this.queue : null)
  }

  ingest(events) {
    if (this.status !== 'ready') return
    for (const e of events) if (e.seq > this.seq) this.buffer.set(e.seq, e.action)
    let changed = false
    while (this.buffer.has(this.seq + 1)) {
      const a = this.buffer.get(this.seq + 1)
      this.buffer.delete(this.seq + 1)
      this.doc = reduceDoc(this.doc, a)
      this.seq += 1
      if (this.queue.some(q => q.nonce === a.nonce)) this.drop(a.nonce)
      changed = true
    }
    if (this.buffer.size) this.catchUp()
    if (!changed) return
    if (this.seq - this.snapSeq >= SNAPSHOT_EVERY) {
      this.snapSeq = this.seq
      backend.saveSnapshot(this.id, this.seq, this.doc).catch(() => { /* another client may have saved it */ })
    }
    this.onChange()
  }

  catchUp() {
    if (this.status !== 'ready' || this.fetching) return
    this.fetching = true
    backend.eventsSince(this.id, this.seq)
      .then(events => { this.fetching = false; this.ingest(events) })
      .catch(err => { this.fetching = false; this.error = err.message; this.onChange() })
  }
}

// ---------- workspace bookkeeping (per browser) ----------

const currentKey = app => `lift-cloud-${app}`
const listKey = app => `lift-cloud-${app}-list`
export const workspacesOf = app => read(localStorage, listKey(app), [])
function remember(app, entry) {
  const list = workspacesOf(app).filter(w => w.id !== entry.id)
  write(localStorage, listKey(app), [{ ...entry, at: Date.now() }, ...list].slice(0, 30))
}
export function forgetWorkspace(app, id) {
  write(localStorage, listKey(app), workspacesOf(app).filter(w => w.id !== id))
}

const urlDoc = () => new URLSearchParams(location.search).get('w')
export function workspaceUrl(id) {
  const u = new URL(location.href)
  u.search = id ? `?w=${encodeURIComponent(id)}` : ''
  u.hash = ''
  return u.toString()
}
// Switching workspace reloads the page: the app then starts cleanly from the other document.
export function openWorkspace(id) {
  location.assign(workspaceUrl(id) + location.hash)
}

// Creates a cloud workspace from `data` and returns its id (throws when it can't be saved).
export async function createWorkspace(app, prefix, data, name) {
  if (!backend) throw new Error('offline')
  if (docSize(data) > MAX_DOC) throw new Error('too large')
  const id = newDocId(prefix)
  await backend.createBoard(id, { kind: `lift-${app}`, v: 1, name: name ?? '', createdAt: Date.now(), data }, liftIdentity().secret)
  remember(app, { id, name: name ?? '' })
  return id
}

// Splits ops into actions under the size limit; returns { actions, skipped } (ops too big on their own).
// The database measures an action as jsonb text: UTF-8 bytes, with a space after every ',' and ':' (so
// object-heavy ops grow ~15% and CJK text triples). Counting every ',' and ':' errs on the safe side.
const utf8 = new TextEncoder()
function opSize(op) {
  const s = JSON.stringify(op)
  let seps = 0
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c === 44 || c === 58) seps += 1 }
  return utf8.encode(s).length + seps
}
function chunk(ops) {
  const actions = []
  let cur = []
  let size = 0
  let skipped = 0
  for (const op of ops) {
    const n = opSize(op)
    if (n > MAX_ACTION) { skipped += 1; continue }
    if (size + n > MAX_ACTION && cur.length) { actions.push(cur); cur = []; size = 0 }
    cur.push(op)
    size += n
  }
  if (cur.length) actions.push(cur)
  return { actions, skipped }
}

// Mirrors an app's state to its cloud workspace.
//   app        'goal' | 'discovery' | 'plan' | 'sketch' (storage keys, document kind)
//   prefix     two letters for new document ids
//   state      the app's current state (plain JSON)
//   setState   replaces the app's state (called with remote changes)
//   hasLocalData  false when `state` is a fresh example the user never touched (don't upload it when
//                 they arrive through someone else's link)
//   nameOf     state -> workspace name for the switcher
// Returns { mode, status, id, error, tooLarge, shareUrl, workspaces }:
//   mode   'local' (no backend configured) | 'cloud'
//   status 'connecting' | 'synced' | 'saving' | 'offline' | 'missing' | 'local'
export function useCloudSync({ app, prefix, state, setState, hasLocalData = true, nameOf = () => '' }) {
  const [, bump] = useReducer(x => x + 1, 0)
  const stateRef = useRef(state)
  stateRef.current = state
  const setRef = useRef(setState)
  setRef.current = setState
  const nameRef = useRef(nameOf)
  nameRef.current = nameOf
  const known = useRef(undefined) // the data the cloud view is at (undefined = not reconciled yet)
  const docRef = useRef(null)
  const flushTimer = useRef(null)
  const [tooLarge, setTooLarge] = useState(false)
  // Where we started: the workspace in the link, and the one this browser was last using.
  const boot = useRef(null)
  if (!boot.current) boot.current = { fromUrl: urlDoc(), stored: read(localStorage, currentKey(app), null), created: null }
  const [id, setId] = useState(() => (backend ? boot.current.fromUrl || boot.current.stored : null))
  const [createError, setCreateError] = useState(null)

  // First visit (or a local-only workspace from before cloud sync): upload what's on this device.
  // Arriving by someone's link with real local data: upload ours first so it stays in the switcher.
  useEffect(() => {
    if (!backend) return
    const { fromUrl, stored } = boot.current
    const needUpload = !stored && (!fromUrl || hasLocalData)
    if (!needUpload) { if (fromUrl) write(localStorage, currentKey(app), fromUrl); return }
    let gone = false
    const uploaded = stateRef.current
    createWorkspace(app, prefix, uploaded, nameRef.current(uploaded)).then(newId => {
      if (gone) return
      write(localStorage, currentKey(app), fromUrl || newId)
      boot.current.created = newId
      boot.current.uploaded = uploaded
      if (!fromUrl) setId(newId)
    }, err => { if (!gone) setCreateError(err.message) })
    return () => { gone = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    clearTimeout(flushTimer.current)
    flushTimer.current = null
    const d = docRef.current
    if (!d || known.current === undefined) return
    const ops = diff(known.current, stateRef.current)
    if (ops.length) {
      const { actions, skipped } = chunk(ops)
      if (skipped) setTooLarge(true)
      for (const a of actions) d.push({ type: 'PATCH', ops: a })
      // An op too large to send stays "unsent", so it is kept on this device (re-applied over remote
      // changes) instead of vanishing with the next remote update.
      known.current = skipped ? apply(known.current, actions.flat()) : stateRef.current
    } else known.current = stateRef.current
    bump() // the status pill reads the timer and the queue
  }, [])

  // Open the document; fold remote changes under our unsent edits.
  useEffect(() => {
    if (!backend || !id) return
    // The workspace on screen is this one: local state is a valid base (edits made while loading are kept).
    // Another one: wait for the cloud copy and replace whatever is on screen.
    const onScreen = id === boot.current.stored || id === boot.current.created
    // Just created: the cloud copy is what was uploaded, so edits made during the upload still get sent.
    known.current = onScreen ? (id === boot.current.created ? boot.current.uploaded : stateRef.current) : undefined
    const d = new CloudDoc(id, () => {
      const v = d.view()
      if (v) {
        const unsent = known.current === undefined ? [] : diff(known.current, stateRef.current)
        known.current = v.data
        const next = unsent.length ? apply(v.data, unsent) : v.data
        if (!same(next, stateRef.current)) { stateRef.current = next; setRef.current(next) }
        if (unsent.length && !flushTimer.current) flushTimer.current = setTimeout(flush, FLUSH_MS)
      }
      bump()
    })
    docRef.current = d
    remember(app, { id, name: nameRef.current(stateRef.current) })
    d.open()
    return () => { clearTimeout(flushTimer.current); flushTimer.current = null; flush(); d.close(); docRef.current = null }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Local edits: send at most every FLUSH_MS.
  useEffect(() => {
    if (!docRef.current || known.current === undefined || known.current === state) return
    if (!flushTimer.current) flushTimer.current = setTimeout(flush, FLUSH_MS)
  }, [state, flush])

  // Keep the switcher's name current.
  const name = nameOf(state)
  useEffect(() => {
    if (!id || !backend) return
    const t = setTimeout(() => remember(app, { id, name }), 800)
    return () => clearTimeout(t)
  }, [id, name, app])

  // Send what's pending before the tab closes.
  useEffect(() => {
    const out = () => flush()
    window.addEventListener('pagehide', out)
    return () => window.removeEventListener('pagehide', out)
  }, [flush])

  const d = docRef.current
  let status = 'local'
  if (backend) {
    if (!d) status = createError ? 'offline' : 'connecting'
    else if (d.status === 'missing') status = 'missing'
    else if (d.status === 'loading') status = 'connecting'
    else if (d.status === 'offline' || (d.error && d.queue.length)) status = 'offline'
    else status = d.queue.length || flushTimer.current ? 'saving' : 'synced'
  }
  return {
    mode: backend ? 'cloud' : 'local',
    status,
    id,
    error: d?.error ?? createError,
    tooLarge,
    shareUrl: id ? workspaceUrl(id) : null,
    workspaces: workspacesOf(app),
  }
}
