import { useCallback, useEffect, useRef, useState } from 'react'
import { backend, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc } from '../core/live.js'
import { uid, personalStorage } from '../core/store.jsx'
import { reduce, migrate, newMeeting, nextOccurrence, status } from './model.js'
import { newTeam, meetingSummary } from './team.js'

// The meetings this browser created or opened, plus loading them in bulk for the home page and
// the action item list. Every meeting is its own live document; nothing is stored centrally.

export const KIND = 'meetings'

export const remembered = () => rememberedDocs(KIND)
export const forget = id => forgetDoc(KIND, id)

export function remember(doc) {
  rememberDoc(KIND, { id: doc.id, name: doc.title, at: doc.createdAt, date: doc.date, time: doc.time, status: status(doc), seen: Date.now() })
}

// Folds a document's snapshot and pending events the same way useLiveDoc does.
export const fold = row => row.events.reduce((d, e) => reduce(d, e.action), migrate(row.snapshot))

// Loads and folds a set of meetings: by default the ones remembered on this device, or the ids a
// team space lists (pass `getIds`). Reloads when the tab becomes visible again.
export function useMeetings(getIds) {
  const [state, setState] = useState({ status: backend ? 'loading' : 'offline', docs: [], error: null })
  const idsRef = useRef(getIds)
  idsRef.current = getIds
  const load = useCallback(() => {
    if (!backend) return
    const own = !idsRef.current
    const ids = own ? remembered().map(x => x.id) : idsRef.current()
    if (!ids.length) { setState({ status: 'ready', docs: [], error: null }); return }
    setState(s => ({ ...s, status: s.docs.length ? 'ready' : 'loading', error: null }))
    backend.getBoards(ids)
      .then(rows => {
        const docs = rows.map(fold).filter(d => d?.kind === 'meeting')
        // Meetings deleted elsewhere drop out of the list.
        const found = new Set(rows.map(r => r.id))
        if (own) for (const id of ids) if (!found.has(id)) forget(id)
        setState({ status: 'ready', docs, error: null })
      })
      .catch(err => setState(s => ({ ...s, status: 'ready', error: err.message })))
  }, [])
  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])
  return { ...state, reload: load, setDocs: fn => setState(s => ({ ...s, docs: fn(s.docs) })) }
}

// Sends one action to a meeting that is not open on this page (e.g. ticking off an action item
// from the home page), then tells any open copies over the realtime channel.
export async function sendTo(id, raw) {
  const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
  const seq = await backend.append(id, action)
  const sub = backend.subscribe(id, () => {}, () => {})
  sub.send({ seq, action })
  setTimeout(() => sub.close(), 2000)
  return action
}

// A name typed into the lazy name prompt a moment ago may not have reached this closure yet.
const fresh = identity => { try { return { ...identity, ...JSON.parse(personalStorage().getItem('lift-identity')) } } catch { return identity } }

export async function createMeeting(fields, who) {
  const identity = fresh(who)
  const id = newDocId('mt')
  const doc = newMeeting({ id, owner: { id: identity.id, name: identity.name, color: identity.color }, at: Date.now(), ...fields })
  await createDoc(id, doc, identity.secret)
  remember(doc)
  if (doc.teamId) await registerInTeam(doc.teamId, doc, identity.id).catch(() => {})
  return doc
}

// ---------- team spaces ----------

export const TEAM_KIND = 'meetingteams'
export const rememberedTeams = () => rememberedDocs(TEAM_KIND)
export const rememberTeam = t => rememberDoc(TEAM_KIND, { id: t.id, name: t.name, at: t.createdAt })
export const forgetTeam = id => forgetDoc(TEAM_KIND, id)

export async function createTeam(name, who) {
  const identity = fresh(who)
  const id = newDocId('ms')
  const doc = newTeam({ id, name, owner: identity, at: Date.now() })
  await createDoc(id, doc, identity.secret)
  rememberTeam(doc)
  return doc
}

// Adds (or refreshes) a meeting in its team's list. Idempotent in the team reducer; this device also
// skips sending a summary it has already sent, so opening a meeting does not write to the team.
const SENT = 'meetinglift-team-sent'
export async function registerInTeam(teamId, d, pid, force = false) {
  const m = meetingSummary(d)
  const key = `${teamId}|${m.id}|${m.title}|${m.date}|${m.seriesId}`
  let sent = []
  try { sent = JSON.parse(localStorage.getItem(SENT)) ?? [] } catch { /* storage blocked */ }
  if (!force && sent.includes(key)) return
  await sendTo(teamId, { type: 'REGISTER', meeting: m, pid })
  try { localStorage.setItem(SENT, JSON.stringify([key, ...sent].slice(0, 300))) } catch { /* storage blocked */ }
}
export const unregisterFromTeam = (teamId, meetingId, pid) => sendTo(teamId, { type: 'UNREGISTER', id: meetingId, pid })

// Creates the next meeting in a series and links it from this one. If two people do this at the same
// time, the server's order decides: the first link wins and the other copy is deleted again.
// Returns the id of the next meeting everyone ends up in.
export async function createNext(prev, who) {
  const identity = fresh(who)
  const id = newDocId('mt')
  const doc = nextOccurrence(prev, { id, owner: { id: identity.id, name: identity.name, color: identity.color }, at: Date.now() })
  await createDoc(id, doc, identity.secret)
  await sendTo(prev.id, { type: 'SET_NEXT', nextId: id, pid: identity.id })
  const [row] = await backend.getBoards([prev.id])
  const winner = (row && fold(row).series.nextId) || id
  if (winner !== id) { await deleteDoc(id, identity.secret).catch(() => {}); return winner }
  remember(doc)
  if (doc.teamId) await registerInTeam(doc.teamId, doc, identity.id).catch(() => {})
  return id
}

// Open action items across meetings. A carried-over item keeps its origin id, so only the copy in
// the newest meeting of a series counts.
export function collectActions(docs) {
  const best = new Map()
  for (const d of docs) {
    for (const a of d.actions) {
      if (a.movedTo) continue // the live copy is in the next meeting
      const key = a.origin ?? a.id
      const prev = best.get(key)
      if (!prev || prev.doc.createdAt < d.createdAt) best.set(key, { ...a, doc: d })
    }
  }
  return [...best.values()]
}
