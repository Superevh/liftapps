// Lean Coffee session: a JSON document folded from an ordered log of actions (see live.js).
// The reducer is pure: ids derive from the action nonce and time from action.at.

export const PHASES = ['collect', 'vote', 'discuss', 'wrap']
export const THUMBS = ['up', 'side', 'down']
const MIN = 60000

export function newSession({ id, name, votes, timebox, extend, owner, at }) {
  return {
    kind: 'leancoffee', id, name, createdAt: at, ownerId: owner.id,
    settings: { votes, timebox, extend, hostOnly: false },
    phase: 'collect',
    people: { [owner.id]: { ...owner, joinedAt: at } },
    topics: [], currentId: null,
    timer: null,
    decision: null,
    actions: [],
  }
}

const sid = (a, n = 0) => `${a.nonce}${n.toString(36)}`
const present = s => Object.values(s.people).filter(p => !p.left)
export const votesUsed = (s, pid) => s.topics.reduce((n, t) => n + (t.votes[pid] ?? 0), 0)
export const voteCount = t => Object.values(t.votes).reduce((n, v) => n + v, 0)

// Milliseconds left on the shared timer at time `now` (negative once it has run out).
export function timeLeft(timer, now) {
  if (!timer) return null
  return timer.pausedLeft != null ? timer.pausedLeft : timer.endsAt - now
}

const setTopic = (s, id, patch) => ({ ...s, topics: s.topics.map(t => t.id === id ? { ...t, ...patch } : t) })

// Closes the topic under discussion and banks the time spent on it.
function finish(s, at) {
  const t = s.topics.find(x => x.id === s.currentId)
  if (!t) return { ...s, currentId: null, timer: null }
  const spent = (t.spent ?? 0) + Math.max(0, at - (t.startedAt ?? at))
  return { ...setTopic(s, t.id, { status: 'done', spent, startedAt: null, thumbs: {} }), currentId: null, timer: null }
}

function extend(s, at) {
  const t = s.topics.find(x => x.id === s.currentId)
  if (!t) return s
  const length = s.settings.extend * MIN
  return { ...setTopic(s, t.id, { thumbs: {}, rounds: (t.rounds ?? 1) + 1 }), timer: { endsAt: at + length, length, pausedLeft: null, asked: false } }
}

export function tally(thumbs) {
  const n = { up: 0, side: 0, down: 0 }
  for (const v of Object.values(thumbs ?? {})) if (n[v] != null) n[v] += 1
  return n
}

export function reduce(s, a) {
  if (!s) return s
  switch (a.type) {
    case 'JOIN': {
      const prev = s.people[a.person.id]
      return { ...s, people: { ...s.people, [a.person.id]: { ...prev, ...a.person, joinedAt: prev?.joinedAt ?? a.at, left: false } } }
    }
    case 'LEAVE': return s.people[a.pid] ? { ...s, people: { ...s.people, [a.pid]: { ...s.people[a.pid], left: true } } } : s
    // Hands the host role to someone else. Only the creator can still delete the session.
    case 'SET_HOST': return s.people[a.pid] ? { ...s, ownerId: a.pid, creatorId: s.creatorId ?? s.ownerId } : s
    case 'RENAME': return { ...s, name: a.name.slice(0, 80) }
    case 'SETTINGS': return { ...s, settings: { ...s.settings, ...a.patch } }
    case 'PHASE': {
      if (!PHASES.includes(a.phase)) return s
      const next = { ...s, phase: a.phase }
      return a.phase === 'wrap' && s.currentId ? finish(next, a.at) : next
    }
    case 'ADD_TOPIC': {
      const text = a.text.trim().slice(0, 280)
      if (!text || s.phase === 'wrap') return s
      return { ...s, topics: [...s.topics, { id: sid(a), text, by: a.pid, at: a.at, votes: {}, status: 'todo', notes: [], thumbs: {} }] }
    }
    case 'EDIT_TOPIC': return a.text.trim() ? setTopic(s, a.topicId, { text: a.text.trim().slice(0, 280) }) : s
    case 'REMOVE_TOPIC': return { ...s, topics: s.topics.filter(t => t.id !== a.topicId), ...(s.currentId === a.topicId ? { currentId: null, timer: null } : {}) }
    // One dot at a time; a person can stack several dots on one topic up to their allowance.
    case 'VOTE': {
      const t = s.topics.find(x => x.id === a.topicId)
      if (!t || s.phase !== 'vote' || t.status !== 'todo') return s
      const mine = t.votes[a.pid] ?? 0
      if (a.delta > 0 && votesUsed(s, a.pid) >= s.settings.votes) return s
      if (a.delta < 0 && mine === 0) return s
      const votes = { ...t.votes, [a.pid]: mine + (a.delta > 0 ? 1 : -1) }
      if (!votes[a.pid]) delete votes[a.pid]
      return setTopic(s, t.id, { votes })
    }
    // Pulls a topic into "Discussing" and starts the timebox; any topic already there moves to Done.
    case 'START_TOPIC': {
      const t = s.topics.find(x => x.id === a.topicId)
      if (!t || t.id === s.currentId) return s
      const base = s.currentId ? finish(s, a.at) : s
      const length = s.settings.timebox * MIN
      return {
        ...setTopic(base, t.id, { status: 'now', startedAt: a.at, thumbs: {}, rounds: 1 }),
        phase: 'discuss', currentId: t.id, decision: null,
        timer: { endsAt: a.at + length, length, pausedLeft: null, asked: false },
      }
    }
    case 'PAUSE': return s.timer && s.timer.pausedLeft == null ? { ...s, timer: { ...s.timer, pausedLeft: Math.max(0, s.timer.endsAt - a.at) } } : s
    case 'RESUME': return s.timer && s.timer.pausedLeft != null ? { ...s, timer: { ...s.timer, endsAt: a.at + s.timer.pausedLeft, pausedLeft: null } } : s
    case 'ADD_TIME': return s.timer ? { ...s, timer: s.timer.pausedLeft != null ? { ...s.timer, pausedLeft: s.timer.pausedLeft + a.minutes * MIN } : { ...s.timer, endsAt: Math.max(s.timer.endsAt, a.at) + a.minutes * MIN } } : s
    // The host can ask the room before the time is up.
    case 'ASK': return s.timer ? { ...s, timer: { ...s.timer, asked: true } } : s
    // Thumbs vote on carrying on. Once everyone present has voted, a clear majority of thumbs up
    // extends the topic by the shorter timebox; anything else moves it to Done.
    case 'THUMB': {
      const t = s.topics.find(x => x.id === s.currentId)
      if (!t || !THUMBS.includes(a.value)) return s
      const thumbs = { ...t.thumbs, [a.pid]: a.value }
      const next = setTopic(s, t.id, { thumbs })
      const people = present(next)
      if (!people.length || !people.every(p => thumbs[p.id])) return next
      return decide(next, a.at)
    }
    case 'DECIDE': return s.currentId ? decide(s, a.at, a.result) : s
    case 'FINISH_TOPIC': return s.currentId ? { ...finish(s, a.at), decision: null } : s
    case 'REOPEN_TOPIC': return setTopic(s, a.topicId, { status: 'todo' })
    case 'ADD_NOTE': {
      const text = a.text.trim().slice(0, 500)
      const t = s.topics.find(x => x.id === a.topicId)
      return text && t ? setTopic(s, t.id, { notes: [...t.notes, { id: sid(a), text, by: a.pid, at: a.at }] }) : s
    }
    case 'DELETE_NOTE': {
      const t = s.topics.find(x => x.id === a.topicId)
      return t ? setTopic(s, t.id, { notes: t.notes.filter(n => n.id !== a.noteId) }) : s
    }
    case 'ADD_ACTION': {
      const text = a.text.trim().slice(0, 300)
      return text ? { ...s, actions: [...s.actions, { id: sid(a), text, topicId: a.topicId ?? null, owner: a.owner ?? '', done: false, at: a.at }] } : s
    }
    case 'UPDATE_ACTION': return { ...s, actions: s.actions.map(x => x.id === a.actionId ? { ...x, ...a.patch } : x) }
    case 'DELETE_ACTION': return { ...s, actions: s.actions.filter(x => x.id !== a.actionId) }
    default: return s
  }
}

function decide(s, at, forced) {
  const t = s.topics.find(x => x.id === s.currentId)
  const n = tally(t.thumbs)
  const total = n.up + n.side + n.down
  const result = forced ?? (n.up * 2 > total ? 'extend' : 'done')
  const decision = { topicId: t.id, result, tally: n, at }
  return { ...(result === 'extend' ? extend(s, at) : finish(s, at)), decision }
}

// Topics still to discuss: by votes once voting is over, otherwise in the order added
// (so cards don't jump around while people are voting).
export function queue(s) {
  const todo = s.topics.filter(t => t.status === 'todo')
  if (s.phase === 'collect' || s.phase === 'vote') return todo
  return [...todo].sort((a, b) => voteCount(b) - voteCount(a) || a.at - b.at)
}

const minutes = ms => Math.round((ms ?? 0) / MIN)
const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

export function sessionCsv(s) {
  const rows = s.topics.map(t => [t.text, voteCount(t), t.status, minutes(t.spent), t.notes.map(n => n.text).join(' | ')])
  return ['topic,votes,status,minutes,notes', ...rows.map(r => r.map(x => q(String(x))).join(','))].join('\n')
}

export function sessionMarkdown(s, lang) {
  const zh = lang === 'zh'
  const done = s.topics.filter(t => t.status === 'done')
  const rest = s.topics.filter(t => t.status !== 'done')
  const lines = [`# ${s.name}`, '', new Date(s.createdAt).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { dateStyle: 'long' }), '']
  lines.push(`## ${zh ? '已讨论' : 'Discussed'}`, '')
  if (!done.length) lines.push(zh ? '（无）' : '(none)')
  for (const t of done) {
    lines.push(`### ${t.text}`, `${voteCount(t)} ${zh ? '票' : 'votes'} · ${minutes(t.spent)} ${zh ? '分钟' : 'min'}`)
    for (const n of t.notes) lines.push(`- ${n.text}`)
    lines.push('')
  }
  if (rest.length) {
    lines.push(`## ${zh ? '未讨论' : 'Not discussed'}`, '')
    for (const t of rest) lines.push(`- ${t.text} (${voteCount(t)})`)
    lines.push('')
  }
  lines.push(`## ${zh ? '行动项' : 'Actions'}`, '')
  if (!s.actions.length) lines.push(zh ? '（无）' : '(none)')
  for (const x of s.actions) lines.push(`- [${x.done ? 'x' : ' '}] ${x.text}${x.owner ? ` (${x.owner})` : ''}`)
  return lines.join('\n') + '\n'
}
