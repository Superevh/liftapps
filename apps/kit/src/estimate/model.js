// Estimation session: a backlog estimated together, as a JSON document folded from an ordered log
// of actions (see core/live.js). The reducer is pure: ids derive from the action nonce, time comes
// only from action.at.
//
// A session is a superset of the planning poker room (poker/model.js): the same fields and the same
// action types mean the same thing, so poker rooms already stored in production open here unchanged.
// Fields a poker room lacks (stage, status, capacity, pre-votes, confidence) have defaults when read.

import { DECKS, THEMES, deckOf, stats, toNumber } from '../poker/model.js'
import { tally } from '../confidence/model.js'
import { parseCsv } from '../core/forecast/csv.js'

export { DECKS, deckOf, stats, toNumber, tally }
export const DECK_IDS = ['fib', 'modfib', 'tshirt', 'pow2', 'hours', 'custom']
export const STAGES = ['prep', 'estimate', 'confidence', 'done']
export const KIND = 'estimate-sessions'
export const POKER_KIND = 'poker-rooms'
const SPECIAL = new Set(['?', '☕'])
// Poker rooms could pick a themed card back with a mascot; sessions use the plain classic back.
export const THEME_EMOJI = theme => (theme && theme !== 'classic' ? THEMES[theme]?.emoji ?? '' : '')

export function newSession({ id, name, deck, customDeck, capacity, async, items, owner, at }) {
  const doc = {
    kind: 'estimate', v: 1, id, name, createdAt: at, ownerId: owner.id,
    deck, customDeck: customDeck ?? [], theme: 'classic',
    settings: { hostOnly: true, autoReveal: false, showAverage: true, specials: true, async: !!async },
    capacity: capacity > 0 ? capacity : null, stage: 'prep',
    people: { [owner.id]: { ...owner, role: 'voter', joinedAt: at } },
    stories: [], currentId: null,
    votes: {}, revealed: false, roundStartedAt: at,
    timer: { endsAt: null },
    history: [], confidence: null, confidenceHistory: [],
  }
  return items?.length ? reduce(doc, { type: 'ADD_STORIES', items, nonce: 's0', at }) : doc
}

// ---------- reading ----------

// Poker rooms have no stage: they were always "estimating".
export const stageOf = d => d.stage ?? 'estimate'
export const statusOf = s => s.status ?? (s.estimate != null ? 'done' : 'open')
export const isOpen = s => statusOf(s) === 'open'
export const numericDeck = d => deckOf(d).filter(v => !SPECIAL.has(v)).every(v => toNumber(v) != null)
export const pointsOf = s => (statusOf(s) === 'done' ? toNumber(String(s.estimate ?? '')) ?? 0 : 0)
export const voters = d => Object.values(d.people).filter(p => p.role === 'voter' && !p.left)
export const activePeople = d => Object.values(d.people).filter(p => !p.left).sort((a, b) => a.joinedAt - b.joinedAt)

// People who skipped the name are shown as "Guest 1", "Guest 2"… in the order they joined.
export function nameOf(d, p, guest = 'Guest') {
  if (!p) return '?'
  if (p.name) return p.name
  const unnamed = Object.values(d.people).filter(x => !x.name).sort((a, b) => a.joinedAt - b.joinedAt)
  const n = unnamed.findIndex(x => x.id === p.id) + 1
  return unnamed.length > 1 ? `${guest} ${n}` : guest
}

// The smaller stories a split story was broken into.
export const childrenOf = (d, s) => d.stories.filter(x => x.parentId === s.id)
// A split story with children is dealt with (they carry the estimate); one without is still a flag.
export const isSplitInto = (d, s) => statusOf(s) === 'split' && childrenOf(d, s).length > 0

export function progress(d) {
  const counts = { open: 0, done: 0, skipped: 0, split: 0, splitInto: 0 }
  for (const s of d.stories) counts[isSplitInto(d, s) ? 'splitInto' : statusOf(s)] += 1
  const points = d.stories.reduce((sum, s) => sum + pointsOf(s), 0)
  const numeric = numericDeck(d)
  const sizes = numeric ? null : deckOf(d).filter(v => !SPECIAL.has(v)).map(v => [v, d.stories.filter(s => statusOf(s) === 'done' && s.estimate === v).length])
  return { ...counts, total: d.stories.length, handled: counts.done + counts.skipped + counts.split + counts.splitInto, points: Math.round(points * 10) / 10, numeric, sizes, capacity: numeric ? d.capacity ?? null : null }
}

// Open stories whose pre-votes (cast before the meeting) already agree.
export function agreedAhead(d, min = 2) {
  return d.stories.filter(s => {
    if (!isOpen(s) || (s.id === d.currentId && stageOf(d) === 'estimate' && Object.keys(d.votes).length)) return false
    const vals = Object.values(s.pre ?? {})
    return vals.length >= min && !SPECIAL.has(vals[0]) && vals.every(v => v === vals[0])
  }).map(s => ({ story: s, value: Object.values(s.pre)[0], n: Object.keys(s.pre).length }))
}

// How the estimating went: voting rounds per estimated story, and how often the first reveal (or
// the votes cast ahead) already agreed.
export function sessionStats(d) {
  const done = d.stories.filter(s => statusOf(s) === 'done')
  const rounds = d.stories.reduce((n, s) => n + (s.rounds ?? 0), 0)
  let agreed = 0
  for (const s of done) {
    const first = (d.history ?? []).find(h => h.storyId === s.id && Object.keys(h.votes ?? {}).length)
    const vals = first ? Object.values(first.votes).filter(v => !SPECIAL.has(v)) : []
    if (first && (first.kind === 'agreed' || (vals.length > 1 && vals.every(v => v === vals[0])))) agreed += 1
  }
  return { rounds, roundsPerStory: done.length ? Math.round((rounds / done.length) * 10) / 10 : null, consensus: done.length ? agreed / done.length : null }
}

// After a reveal: who to ask first. Only when the votes are more than two cards apart.
export function outliers(d, result) {
  if (!result || result.consensus || result.spread <= 2) return null
  const at = v => Object.entries(d.votes).filter(([, x]) => x === v).map(([pid]) => d.people[pid]).filter(Boolean)
  return { low: result.low, high: result.high, lows: at(result.low), highs: at(result.high) }
}

// How many times the current story has been revealed so far, plus the round in progress.
export const roundOf = (d, s) => (s?.rounds ?? 0) + (d.revealed ? 0 : 1)

// ---------- reducer ----------

const sid = (a, n = 0) => `${a.nonce}${n.toString(36)}`
const pick = (o, keys) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => keys.includes(k)))
const mapStory = (d, id, fn) => ({ ...d, stories: d.stories.map(s => (s.id === id ? fn(s) : s)) })

// Votes cast ahead of the meeting become the opening votes when a story comes up.
function seed(d, storyId) {
  const s = d.stories.find(x => x.id === storyId)
  const ok = new Set(voters(d).map(p => p.id))
  return Object.fromEntries(Object.entries(s?.pre ?? {}).filter(([pid]) => ok.has(pid)))
}

function clearRound(d, at, storyId = d.currentId) {
  return { ...d, votes: seed(d, storyId), revealed: false, roundStartedAt: at, timer: { endsAt: null } }
}

function reveal(d, a) {
  const next = { ...d, revealed: true, revealedAt: a.at, timer: { endsAt: null } }
  return d.currentId ? mapStory(next, d.currentId, s => ({ ...s, rounds: (s.rounds ?? 0) + 1 })) : next
}

// The next open story after `fromId`, wrapping round to the start.
function nextOpen(stories, fromId) {
  const idx = stories.findIndex(s => s.id === fromId)
  return stories.slice(idx + 1).find(isOpen) ?? stories.find(isOpen) ?? null
}

// Closes a story (accepted, skipped or set aside to split) and moves on if it was the current one.
function close(d, a, storyId, patch, kind) {
  const story = d.stories.find(s => s.id === storyId)
  if (!story) return d
  const stories = d.stories.map(s => (s.id === storyId ? { ...s, ...patch } : s))
  const entry = { storyId, kind, value: patch.estimate ?? null, votes: storyId === d.currentId ? d.votes : {}, round: story.rounds ?? 0, at: a.at }
  const next = { ...d, stories, history: [...(d.history ?? []), entry].slice(-300) }
  if (storyId !== d.currentId) return next
  const after = nextOpen(stories, storyId)
  return clearRound({ ...next, currentId: after?.id ?? null }, a.at, after?.id)
}

function cleanItem(x, a, i) {
  const item = typeof x === 'string' ? { title: x } : x ?? {}
  const title = String(item.title ?? '').trim().slice(0, 300)
  if (!title) return null
  const est = item.estimate != null && String(item.estimate).trim() !== '' ? String(item.estimate).trim().slice(0, 12) : null
  return {
    id: sid(a, i), key: String(item.key ?? '').trim().slice(0, 40), title, link: String(item.link ?? '').trim().slice(0, 500), notes: '',
    estimate: est, ...(est != null ? { status: 'done' } : {}), addedAt: a.at,
  }
}

export function reduce(d, a) {
  if (!d) return d
  switch (a.type) {
    case 'JOIN': {
      const prev = d.people[a.person.id]
      const person = { ...pick(a.person, ['id', 'name', 'color']), name: String(a.person.name ?? '').slice(0, 40) }
      return { ...d, people: { ...d.people, [person.id]: { ...prev, ...person, role: prev?.role ?? a.role ?? 'voter', joinedAt: prev?.joinedAt ?? a.at, left: false } } }
    }
    case 'LEAVE': {
      const p = d.people[a.pid]
      if (!p) return d
      const { [a.pid]: _, ...votes } = d.votes
      return { ...d, people: { ...d.people, [a.pid]: { ...p, left: true } }, votes }
    }
    case 'SET_ROLE': {
      const p = d.people[a.pid]
      if (!p) return d
      const { [a.pid]: _, ...votes } = d.votes
      return { ...d, people: { ...d.people, [a.pid]: { ...p, role: a.role } }, votes: a.role === 'voter' ? d.votes : votes }
    }
    case 'VOTE': {
      if (d.revealed && !a.afterReveal) return d
      const votes = { ...d.votes }
      if (a.value == null) delete votes[a.pid]
      else votes[a.pid] = String(a.value).slice(0, 12)
      const next = { ...d, votes }
      // Auto-reveal once every voter has picked a card.
      if (d.settings.autoReveal && !d.revealed) {
        const vs = voters(next)
        if (vs.length > 0 && vs.every(p => votes[p.id] != null)) return reveal(next, a)
      }
      return next
    }
    case 'REVEAL': return d.revealed ? d : reveal(d, a)
    case 'HIDE': return { ...d, revealed: false }
    // A fresh round on the same story (re-vote), keeping the revealed round in the history.
    case 'RESET': {
      const entry = d.revealed && Object.keys(d.votes).length ? [{ storyId: d.currentId, kind: 'round', value: null, votes: d.votes, round: d.stories.find(s => s.id === d.currentId)?.rounds ?? 0, at: a.at }] : []
      return { ...clearRound(d, a.at), votes: {}, history: [...(d.history ?? []), ...entry].slice(-300) }
    }
    // `titles` (poker rooms) or `items` ({ key, title, link, estimate }).
    case 'ADD_STORIES': {
      const added = (a.items ?? a.titles ?? []).slice(0, 300).map((x, i) => cleanItem(x, a, i)).filter(Boolean)
      if (!added.length) return d
      const stories = [...d.stories, ...added]
      const currentId = d.currentId ?? added.find(isOpen)?.id ?? null
      return d.currentId ? { ...d, stories } : clearRound({ ...d, stories, currentId }, a.at, currentId)
    }
    case 'EDIT_STORY': return mapStory(d, a.storyId, s => {
      const patch = pick(a.patch, ['title', 'link', 'estimate', 'key', 'notes'])
      for (const k of ['title', 'link', 'key', 'notes']) if (k in patch) patch[k] = String(patch[k] ?? '').slice(0, k === 'notes' ? 2000 : k === 'link' ? 500 : 300)
      if ('title' in patch && !patch.title.trim()) delete patch.title
      // Typing an estimate in closes the story; clearing it reopens it.
      if ('estimate' in patch) {
        patch.estimate = patch.estimate == null || String(patch.estimate).trim() === '' ? null : String(patch.estimate).trim().slice(0, 12)
        patch.status = patch.estimate == null ? 'open' : 'done'
      }
      return { ...s, ...patch }
    })
    case 'REMOVE_STORY': {
      const stories = d.stories.filter(s => s.id !== a.storyId)
      if (d.currentId !== a.storyId) return { ...d, stories }
      return clearRound({ ...d, stories, currentId: null }, a.at, null)
    }
    // Undo for REMOVE_STORY: the client sends the story it removed and where it was.
    case 'RESTORE_STORY': {
      if (!a.story?.id || d.stories.some(s => s.id === a.story.id)) return d
      const stories = [...d.stories]
      stories.splice(Math.max(0, Math.min(stories.length, a.index ?? stories.length)), 0, a.story)
      return { ...d, stories }
    }
    case 'MOVE_STORY': {
      const list = d.stories.filter(s => s.id !== a.storyId)
      const s = d.stories.find(x => x.id === a.storyId)
      if (!s) return d
      list.splice(Math.max(0, Math.min(list.length, a.index)), 0, s)
      return { ...d, stories: list }
    }
    case 'SELECT_STORY': return clearRound({ ...d, currentId: a.storyId }, a.at, a.storyId)
    // Saves the agreed estimate on a story and moves to the next open one.
    case 'ACCEPT': return close(d, a, a.storyId, { estimate: a.value == null ? null : String(a.value).slice(0, 12), status: 'done' }, 'accept')
    case 'SKIP': return close(d, a, a.storyId, { status: 'skipped', estimate: null }, 'skip')
    // Sets a story aside as too big. With `children` (titles), the smaller stories are inserted right
    // after it, keyed after the parent (ABC-1.1, ABC-1.2…), and estimated next in the same session.
    case 'SPLIT': {
      const parent = d.stories.find(s => s.id === a.storyId)
      if (!parent) return d
      const kids = (a.children ?? []).map(x => String(x).trim()).filter(Boolean).slice(0, 20)
        .map((title, i) => ({ ...cleanItem({ title, key: parent.key ? `${parent.key}.${i + 1}` : '' }, a, i), parentId: parent.id }))
      let next = d
      if (kids.length) {
        const stories = [...d.stories]
        stories.splice(stories.indexOf(parent) + 1, 0, ...kids)
        next = { ...d, stories }
      }
      return close(next, a, a.storyId, { status: 'split', estimate: null, splitWasCurrent: d.currentId === a.storyId }, 'split')
    }
    case 'REOPEN': return mapStory(d, a.storyId, s => ({ ...s, status: 'open', estimate: null }))
    // Undo for SPLIT: the story is open again and children nobody has voted on yet go. It becomes the
    // current story again only if it was current when it was split (or the current story was removed),
    // so undoing a split made from the backlog never interrupts the round in progress.
    case 'UNSPLIT': {
      const parent = d.stories.find(s => s.id === a.storyId)
      if (!parent) return d
      const stories = d.stories.filter(s => s.parentId !== a.storyId || s.rounds || Object.keys(s.pre ?? {}).length || !isOpen(s))
        .map(s => (s.id === a.storyId ? { ...s, status: 'open', estimate: null, splitWasCurrent: undefined } : s))
      const lostCurrent = d.currentId && !stories.some(s => s.id === d.currentId)
      if (!parent.splitWasCurrent && !lostCurrent) return { ...d, stories }
      return clearRound({ ...d, stories, currentId: a.storyId }, a.at, a.storyId)
    }
    case 'PREVOTE': {
      const s = d.stories.find(x => x.id === a.storyId)
      if (!s || !isOpen(s)) return d
      const { [a.pid]: _, ...pre } = s.pre ?? {}
      return mapStory(d, a.storyId, x => ({ ...x, pre: a.value == null ? pre : { ...pre, [a.pid]: String(a.value).slice(0, 12) } }))
    }
    // Accepts every open story whose pre-votes already agree.
    case 'ACCEPT_AGREED': {
      const agreed = agreedAhead(d, a.min ?? 2)
      if (!agreed.length) return d
      const values = new Map(agreed.map(x => [x.story.id, x.value]))
      const stories = d.stories.map(s => (values.has(s.id) ? { ...s, estimate: values.get(s.id), status: 'done' } : s))
      const entries = agreed.map(x => ({ storyId: x.story.id, kind: 'agreed', value: x.value, votes: x.story.pre, round: 0, at: a.at }))
      const next = { ...d, stories, history: [...(d.history ?? []), ...entries].slice(-300) }
      if (!values.has(d.currentId)) return next
      const after = nextOpen(stories, d.currentId)
      return clearRound({ ...next, currentId: after?.id ?? null }, a.at, after?.id)
    }
    case 'STAGE': {
      if (!STAGES.includes(a.stage)) return d
      let next = { ...d, stage: a.stage, timer: { endsAt: null } }
      if (a.stage === 'estimate') {
        const cur = d.stories.find(s => s.id === d.currentId)
        if (!cur || !isOpen(cur)) {
          const first = d.stories.find(isOpen)
          next = clearRound({ ...next, currentId: first?.id ?? null }, a.at, first?.id)
        } else if (!d.revealed && !Object.keys(d.votes).length) {
          // The story was picked before anyone voted ahead: bring those votes in now.
          next = clearRound(next, a.at)
        }
      }
      if (a.stage === 'confidence' && !d.confidence) next = { ...next, confidence: confidenceRound(a, a.question) }
      return next
    }
    case 'CAPACITY': return { ...d, capacity: a.points > 0 ? Math.min(9999, Math.round(a.points * 10) / 10) : null }
    case 'SET_DECK': return clearRound({ ...d, deck: a.deck, customDeck: a.customDeck ?? d.customDeck }, a.at)
    // Hands the facilitator role to someone else. Only the creator can still delete the session.
    case 'SET_HOST': return d.people[a.pid] ? { ...d, ownerId: a.pid, creatorId: d.creatorId ?? d.ownerId } : d
    case 'SET_THEME': return { ...d, theme: a.theme }
    case 'RENAME': return { ...d, name: String(a.name).slice(0, 80) }
    // The team the session belongs to (team.js). A null teamId takes it out of its team.
    case 'ATTACH_TEAM': return typeof a.teamId === 'string' ? { ...d, teamId: a.teamId, teamName: String(a.teamName ?? '').slice(0, 60) } : { ...d, teamId: null, teamName: null }
    case 'SETTINGS': return { ...d, settings: { ...d.settings, ...a.patch } }
    case 'TIMER': return { ...d, timer: { endsAt: a.seconds ? a.at + a.seconds * 1000 : null, seconds: a.seconds || null } }
    // Confidence vote on the plan (fist of five). Ballots are keyed by a random per-browser id,
    // never by the person, so the document does not say who voted what.
    case 'CONF_ASK': {
      const prev = d.confidence
      const history = prev && Object.keys(prev.ballots).length ? [...(d.confidenceHistory ?? []), prev].slice(-10) : d.confidenceHistory ?? []
      return { ...d, confidence: confidenceRound(a, a.question ?? prev?.question), confidenceHistory: history }
    }
    case 'CONF_QUESTION': return d.confidence ? { ...d, confidence: { ...d.confidence, question: String(a.question ?? '').slice(0, 200) } } : d
    case 'CONF_VOTE': {
      const c = d.confidence
      if (!c || c.revealed || !a.ballot) return d
      const v = Number.isInteger(a.v) && a.v >= 0 && a.v <= 5 ? a.v : null
      const { [a.ballot]: _, ...rest } = c.ballots
      return { ...d, confidence: { ...c, ballots: v == null ? rest : { ...rest, [a.ballot]: { v } } } }
    }
    case 'CONF_REVEAL': return d.confidence ? { ...d, confidence: { ...d.confidence, revealed: true, revealedAt: a.at } } : d
    case 'CONF_HIDE': return d.confidence ? { ...d, confidence: { ...d.confidence, revealed: false } } : d
    default: return d
  }
}

function confidenceRound(a, question) {
  return { id: `${a.nonce}c`, question: String(question ?? '').slice(0, 200), scale: 'fist', labels: [], threshold: 3, ballots: {}, revealed: false, at: a.at }
}

export const confidenceTally = c => (c ? tally(c) : null)

// ---------- backlog import ----------

const KEY_RE = /^\[?([A-Z][A-Z0-9_]{0,15}-\d{1,7})\]?(?:\s*[:：\-–—|]\s*|\s+)(.+)$/
const URL_RE = /\s*\(?(https?:\/\/[^\s)"'<>]+)\)?\s*/
const HEADERS = {
  key: [/^(issue )?key$/i, /^id$/i, /^issue id$/i, /^work item id$/i, /^ticket$/i, /^编号$/, /^键$/],
  title: [/^summary$/i, /^title$/i, /^name$/i, /^story$/i, /^subject$/i, /^标题$/, /^名称$/, /^概要$/],
  link: [/^url$/i, /^link$/i, /^链接$/],
  estimate: [/story ?points?/i, /^points?$/i, /^estimate$/i, /^size$/i, /^估算$/, /^故事点$/],
}

// One story per line (an optional key like ABC-123 first, an optional link anywhere), tab-separated
// rows pasted from a sheet, or a CSV export with a header row (Jira, Linear, Azure DevOps…).
export function parseBacklog(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!src) return []
  const first = src.split('\n')[0]
  if (/[,;\t]/.test(first)) {
    const { headers, rows } = parseCsv(src)
    const col = Object.fromEntries(Object.entries(HEADERS).map(([k, ps]) => [k, headers.findIndex(h => ps.some(p => p.test(h.trim())))]))
    if (col.title >= 0) {
      return rows.map(r => ({
        key: col.key >= 0 ? (r[col.key] ?? '').trim() : '', title: (r[col.title] ?? '').trim(),
        link: col.link >= 0 ? (r[col.link] ?? '').trim() : '', estimate: col.estimate >= 0 ? (r[col.estimate] ?? '').trim() || null : null,
      })).filter(x => x.title).slice(0, 300)
    }
  }
  return src.split('\n').map(line => {
    let s = line.trim()
    if (!s) return null
    // A row pasted from a sheet: key in the first cell when it looks like one.
    if (s.includes('\t')) {
      const cells = s.split('\t').map(c => c.trim()).filter(Boolean)
      if (cells.length > 1 && /^[A-Z][A-Z0-9_]{0,15}-\d{1,7}$/.test(cells[0])) return { key: cells[0], title: cells[1], link: '', estimate: null }
      s = cells.join(' ')
    }
    s = s.replace(/^(?:[-*•·]|\d{1,3}[.)、])\s+/, '').replace(/^\[[ x]\]\s+/i, '')
    let link = ''
    const u = s.match(URL_RE)
    // A link inside quotes is part of the text (a formula, a quoted message): keep the text whole.
    if (u) { link = u[1]; if (!/["'“”‘’]/.test(s[u.index + u[0].indexOf('http') - 1] ?? '')) s = s.replace(URL_RE, ' ').trim() }
    const k = s.match(KEY_RE)
    const out = k ? { key: k[1], title: k[2].trim(), link, estimate: null } : { key: '', title: s, link, estimate: null }
    if (!out.title && link) out.title = link
    return out.title ? out : null
  }).filter(Boolean).slice(0, 300)
}

// ---------- export ----------

const STATUS_EN = { open: 'Not estimated', done: 'Estimated', skipped: 'Skipped', split: 'Needs split', splitInto: keys => `Split into ${keys}` }

// The status words for a story; a split story with children names them ("Split into ABC-2.1, ABC-2.2").
export function statusText(d, s, labels = STATUS_EN) {
  if (isSplitInto(d, s)) return labels.splitInto(childrenOf(d, s).map(c => c.key || c.title).join(', '))
  return labels[statusOf(s)]
}

function rows(d, nameOfPid) {
  return d.stories.map(s => {
    const st = statusOf(s)
    const last = [...(d.history ?? [])].reverse().find(h => h.storyId === s.id && (h.kind === 'accept' || h.kind === 'agreed'))
    const votes = last ? Object.entries(last.votes ?? {}).map(([pid, v]) => `${nameOfPid(pid)}: ${v}`).join('; ') : ''
    return { key: s.key ?? '', title: s.title, estimate: st === 'done' ? s.estimate ?? '' : '', status: statusText(d, s), rounds: s.rounds ?? 0, votes, notes: s.notes ?? '', link: s.link ?? '' }
  })
}

// Cells that start like a formula are prefixed with ' so spreadsheets show them as text.
const safe = s => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)
const csvCell = x => { const s = safe(x); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// Full export. Column names match Jira's CSV importer ("Issue key", "Summary", "Story Points");
// on a size scale (t-shirt) the column is "Size", so sizes never land in a numeric field.
export function sessionCsv(d, nameOfPid) {
  const head = ['Issue key', 'Summary', numericDeck(d) ? 'Story Points' : 'Size', 'Status', 'Rounds', 'Votes', 'Notes', 'Link']
  return [head.join(','), ...rows(d, nameOfPid).map(r => [r.key, r.title, r.estimate, r.status, r.rounds, r.votes, r.notes, r.link].map(x => csvCell(String(x))).join(','))].join('\n')
}

// The smallest file Jira can use to update estimates in bulk: only stories with a key and a number.
export function jiraUpdateCsv(d) {
  const list = d.stories.filter(s => s.key && statusOf(s) === 'done' && toNumber(String(s.estimate ?? '')) != null)
  return ['Issue key,Story Points', ...list.map(s => [s.key, toNumber(String(s.estimate))].map(x => csvCell(String(x))).join(','))].join('\n')
}
export const jiraUpdateCount = d => d.stories.filter(s => s.key && statusOf(s) === 'done' && toNumber(String(s.estimate ?? '')) != null).length

// Tab-separated: pastes as a table into Sheets, Excel, Confluence and Notion. Always four cells a row.
export function sessionTsv(d, nameOfPid, head, statusLabel = STATUS_EN) {
  const clean = s => safe(String(s ?? '').replace(/[\t\r\n]+/g, ' '))
  return [head.join('\t'), ...rows(d, nameOfPid).map((r, i) => [r.key, r.title, r.estimate, statusText(d, d.stories[i], statusLabel)].map(clean).join('\t'))].join('\n')
}

export function sessionMarkdown(d, nameOfPid, head, statusLabel = STATUS_EN) {
  const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ')
  return [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`, ...rows(d, nameOfPid).map((r, i) => `| ${[r.key, r.title, r.estimate, statusText(d, d.stories[i], statusLabel)].map(cell).join(' | ')} |`)].join('\n')
}

// Plain lines that read well in a Jira comment or a Slack message: "ABC-123 · 5 pts · Title".
export function sessionJiraText(d, unit, statusLabel = STATUS_EN) {
  return d.stories.map(s => {
    const st = statusOf(s)
    const est = st === 'done' ? `${s.estimate}${unit && toNumber(String(s.estimate)) != null ? ` ${unit}` : ''}` : statusText(d, s, statusLabel)
    return [s.key, est, s.title].filter(Boolean).join(' · ')
  }).join('\n')
}
