// Estimation team: a small shared document (same store as sessions) that keeps a team's sessions
// and the summary of each finished one, so the team's history is the same on every device.
// Anyone with the link can see it. The reducer is pure; time comes only from action.at.
import { backend } from '../core/live.js'
import { uid } from '../core/store.jsx'

export const TEAM_KIND = 'estimate-teams'
const STAT_KEYS = ['points', 'capacity', 'done', 'total', 'handled', 'rounds', 'rps', 'consensus', 'numeric', 'finishedAt']

export function newTeam({ id, name, owner, at }) {
  return { kind: 'estimate-team', v: 1, id, name: String(name).slice(0, 60), createdAt: at, ownerId: owner.id, sessions: {} }
}

export function reduceTeam(t, a) {
  if (!t) return t
  switch (a.type) {
    case 'RENAME': return String(a.name ?? '').trim() ? { ...t, name: String(a.name).trim().slice(0, 60) } : t
    // A session joins the team (or its name changes).
    case 'SESSION_LINK': {
      if (typeof a.sessionId !== 'string') return t
      const prev = t.sessions[a.sessionId]
      return { ...t, sessions: { ...t.sessions, [a.sessionId]: { ...prev, id: a.sessionId, name: String(a.name ?? prev?.name ?? '').slice(0, 80), base: a.base === 'poker' ? 'poker' : 's', createdAt: prev?.createdAt ?? a.createdAt ?? a.at, linkedAt: prev?.linkedAt ?? a.at } } }
    }
    // The summary of a finished session. Recording again replaces it, so it is safe to repeat.
    case 'SESSION_RECORD': {
      if (typeof a.sessionId !== 'string') return t
      const prev = t.sessions[a.sessionId] ?? { id: a.sessionId, base: 's', createdAt: a.at, linkedAt: a.at }
      const stats = Object.fromEntries(STAT_KEYS.filter(k => a.stats && k in a.stats).map(k => [k, a.stats[k]]))
      return { ...t, sessions: { ...t.sessions, [a.sessionId]: { ...prev, name: String(a.name ?? prev.name ?? '').slice(0, 80), stats: { ...stats, finishedAt: stats.finishedAt ?? a.at } } } }
    }
    case 'SESSION_UNLINK': {
      const { [a.sessionId]: _, ...sessions } = t.sessions
      return { ...t, sessions }
    }
    default: return t
  }
}

// Writes one action to a team document from a page that doesn't have it open (a session page),
// then announces it on the team's realtime channel so open team pages update at once.
// Rejects if the write failed, so callers can try again.
export async function appendToTeam(teamId, raw) {
  if (!backend || !teamId) return
  const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
  const seq = await backend.append(teamId, action)
  try {
    const sub = backend.subscribe(teamId, () => {}, () => {})
    sub.send({ seq, action })
    setTimeout(() => sub.close(), 4000)
  } catch { /* the team page's poll catches up anyway */ }
}

// The bits of a session's summary a team keeps.
export function sessionRecord(entry) {
  return Object.fromEntries(STAT_KEYS.filter(k => entry[k] !== undefined).map(k => [k, entry[k]]))
}

export const teamIdFrom = text => (String(text).match(/#\/t\/(lfet[a-z0-9]+)/i) ?? String(text).trim().match(/^(lfet[a-z0-9]{16})$/i))?.[1] ?? null
