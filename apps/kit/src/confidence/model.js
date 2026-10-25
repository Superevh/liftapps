// Confidence vote: a JSON document folded from an ordered log of actions (see live.js).
// Votes are keyed by a random per-browser ballot id, never by the person's id, so the shared
// document does not say who voted what. The reducer is pure: ids derive from the action nonce
// and time from action.at.

// Each scale is a list of numeric values; the UI looks up its own labels and pictures.
export const SCALES = {
  fist: { values: [0, 1, 2, 3, 4, 5], threshold: 3, pics: ['✊', '☝️', '✌️', '🤟', '🖖', '🖐️'] },
  roti: { values: [1, 2, 3, 4, 5], threshold: 3, pics: ['😩', '😕', '😐', '🙂', '🤩'] },
  thumbs: { values: [1, 2, 3], threshold: 2, pics: ['👎', '👊', '👍'] },
  custom: { values: [], threshold: null, pics: [] },
}
export const SCALE_IDS = ['fist', 'roti', 'thumbs', 'custom']

export function scaleValues(round) {
  return round.scale === 'custom' ? round.labels.map((_, i) => i + 1) : SCALES[round.scale].values
}

// The bar a vote has to reach to count as "on board". Custom scales default to the middle.
export function defaultThreshold(scale, labels = []) {
  return scale === 'custom' ? Math.max(1, Math.ceil((labels.length + 1) / 2)) : SCALES[scale].threshold
}

export function newSession({ id, name, owner, at, firstRound }) {
  const doc = {
    kind: 'confidence', id, name, createdAt: at, ownerId: owner.id,
    people: { [owner.id]: { ...owner, joinedAt: at } },
    rounds: [], currentId: null,
  }
  return firstRound ? reduce(doc, { type: 'ASK', ...firstRound, nonce: 'r0', at }) : doc
}

const current = d => d.rounds.find(r => r.id === d.currentId)
const mapRound = (d, rid, fn) => ({ ...d, rounds: d.rounds.map(r => r.id === rid ? fn(r) : r) })

export function reduce(d, a) {
  if (!d) return d
  switch (a.type) {
    case 'JOIN': return { ...d, people: { ...d.people, [a.person.id]: { ...d.people[a.person.id], ...a.person, joinedAt: d.people[a.person.id]?.joinedAt ?? a.at, left: false } } }
    case 'LEAVE': return d.people[a.pid] ? { ...d, people: { ...d.people, [a.pid]: { ...d.people[a.pid], left: true } } } : d
    // Hands the host role to someone else. Only the creator can still delete the session.
    case 'SET_HOST': return d.people[a.pid] ? { ...d, ownerId: a.pid, creatorId: d.creatorId ?? d.ownerId } : d
    case 'RENAME': return { ...d, name: a.name.slice(0, 80) }
    // A new question. `revoteOf` links a re-vote to the round it repeats, for before/after.
    case 'ASK': {
      const base = a.revoteOf ? d.rounds.find(r => r.id === a.revoteOf) : null
      const scale = base?.scale ?? (SCALES[a.scale] ? a.scale : 'fist')
      const labels = base?.labels ?? (scale === 'custom' ? (a.labels ?? []).map(l => String(l).slice(0, 40)).slice(0, 7) : [])
      if (scale === 'custom' && labels.length < 2) return d
      const round = {
        id: `${a.nonce}q`, question: (base?.question ?? a.question ?? '').slice(0, 200), scale, labels,
        threshold: base?.threshold ?? a.threshold ?? defaultThreshold(scale, labels),
        revoteOf: base?.id ?? null, ballots: {}, revealed: false, at: a.at,
      }
      return { ...d, rounds: [...d.rounds, round].slice(-100), currentId: round.id }
    }
    case 'VOTE': return mapRound(d, a.roundId, r => {
      if (r.revealed) return r
      const prev = r.ballots[a.ballot] ?? {}
      const v = a.v != null && scaleValues(r).includes(a.v) ? a.v : null
      return { ...r, ballots: { ...r.ballots, [a.ballot]: { ...prev, v } } }
    })
    case 'NOTE': return mapRound(d, a.roundId, r => {
      if (r.revealed) return r
      const prev = r.ballots[a.ballot] ?? {}
      return { ...r, ballots: { ...r.ballots, [a.ballot]: { ...prev, note: a.note ? String(a.note).slice(0, 300) : null } } }
    })
    case 'REVEAL': return mapRound(d, a.roundId, r => ({ ...r, revealed: true, revealedAt: a.at }))
    case 'HIDE': return mapRound(d, a.roundId, r => ({ ...r, revealed: false }))
    case 'THRESHOLD': return mapRound(d, a.roundId, r => ({ ...r, threshold: a.threshold }))
    case 'SELECT': return d.rounds.some(r => r.id === a.roundId) ? { ...d, currentId: a.roundId } : d
    case 'DELETE_ROUND': {
      const rounds = d.rounds.filter(r => r.id !== a.roundId)
      return { ...d, rounds, currentId: d.currentId === a.roundId ? rounds[rounds.length - 1]?.id ?? null : d.currentId }
    }
    default: return d
  }
}

export { current as currentRound }

// Tally of one round. The verdict uses the round's threshold:
//   go      everyone is at or above it
//   discuss the average reaches it but some people are below
//   stop    the average is below it, or someone gave a fist (0) which counts as a block
export function tally(r) {
  const values = scaleValues(r)
  const votes = Object.values(r.ballots).map(b => b.v).filter(v => v != null)
  const counts = Object.fromEntries(values.map(v => [v, 0]))
  for (const v of votes) counts[v] += 1
  const n = votes.length
  const average = n ? votes.reduce((s, v) => s + v, 0) / n : null
  const low = n ? Math.min(...votes) : null
  const below = votes.filter(v => v < r.threshold).length
  let verdict = null
  if (n) {
    if (average < r.threshold || (r.scale === 'fist' && low === 0)) verdict = 'stop'
    else if (below === 0) verdict = 'go'
    else verdict = 'discuss'
  }
  // Notes are sorted so their order does not hint at who wrote them.
  const notes = Object.values(r.ballots).map(b => b.note).filter(Boolean).sort((a, b) => a.localeCompare(b))
  return { n, counts, average, low, below, verdict, notes }
}

export const votedCount = r => Object.values(r.ballots).filter(b => b.v != null).length

const q = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s

export function roundsCsv(d, labelOf) {
  const rows = d.rounds.map((r, i) => {
    const s = tally(r)
    const dist = scaleValues(r).map(v => `${labelOf(r, v)}: ${s.counts[v]}`).join('; ')
    return [i + 1, r.question, r.scale, s.n, s.average == null ? '' : s.average.toFixed(2), s.verdict ?? '', r.revoteOf ? d.rounds.findIndex(x => x.id === r.revoteOf) + 1 : '', dist, s.notes.join(' | ')]
  })
  return ['round,question,scale,votes,average,verdict,revote_of,distribution,comments', ...rows.map(r => r.map(x => q(String(x))).join(','))].join('\n')
}
