// Icebreaker room: a JSON document folded from an ordered log of actions (see live.js).
// The reducer is pure: time comes from action.at and ids from action.nonce. Questions and bingo
// words are stored by id, so everyone reads them in their own language.
import { CATEGORIES, QUESTIONS, BINGO_SETS } from './questions.js'

// Seeded random numbers (mulberry32 over a string hash), so a bingo card is the same everywhere.
export function rng(seed) {
  let h = 1779033703
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), h = (h << 13) | (h >>> 19)
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(list, rand) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- questions ----------

export const qidsOf = cat => QUESTIONS[cat].map((_, i) => `${cat}:${i}`)

const lower = s => s.charAt(0).toLowerCase() + s.slice(1)
const PAIR_TEXT = {
  wyr: { en: (a, b) => `Would you rather ${lower(a)} or ${lower(b)}?`, zh: (a, b) => `你更愿意${a}，还是${b}？` },
  tot: { en: (a, b) => `${a} or ${b}?`, zh: (a, b) => `${a}还是${b}？` },
}

// { qid, cat, kind, text, options? } in the reader's language, or null for an unknown id.
export function questionOf(qid, lang) {
  const [cat, n] = String(qid).split(':')
  const row = QUESTIONS[cat]?.[Number(n)]
  if (!row) return null
  const li = lang === 'zh' ? 1 : 0
  if (CATEGORIES.find(c => c.id === cat)?.pair) {
    const [a, b] = row[li]
    return { qid, cat, kind: 'choice', text: PAIR_TEXT[cat][lang === 'zh' ? 'zh' : 'en'](a, b), options: [a, b] }
  }
  return { qid, cat, kind: row[2] ?? 'text', text: row[li] }
}

// Picks a question from the chosen categories that hasn't been asked yet (all of them once used up).
export function drawQuestion(cats, asked, rand = Math.random) {
  const all = cats.flatMap(qidsOf)
  if (!all.length) return null
  const seen = new Set(asked)
  const fresh = all.filter(q => !seen.has(q))
  const pool = fresh.length ? fresh : all
  return pool[Math.floor(rand() * pool.length)]
}

// Fixed answer options for the check-in kinds. Choice questions use their two options (values 0 and 1).
export const WEATHER = [['sun', '☀️'], ['part', '⛅'], ['rain', '🌧️'], ['storm', '⛈️'], ['rainbow', '🌈']]
export const ESVP = [['explorer', '🧭'], ['shopper', '🛍️'], ['vacationer', '🏖️'], ['prisoner', '⛓️']]
export const SCALE = [[1, '😩'], [2, '😕'], [3, '😐'], [4, '🙂'], [5, '🤩']]

export function optionsOf(q) {
  if (q.kind === 'scale') return SCALE.map(([value, emoji]) => ({ value, emoji }))
  if (q.kind === 'weather') return WEATHER.map(([value, emoji]) => ({ value, emoji }))
  if (q.kind === 'esvp') return ESVP.map(([value, emoji]) => ({ value, emoji }))
  if (q.kind === 'choice') return q.options.map((label, value) => ({ value, label }))
  return null
}

// ---------- bingo ----------

export const BINGO_SIZE = 5
export const FREE = 12
export const LINES = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
]

// 25 word indices for one player's card; the centre is free (-1).
export function bingoCard(setId, seed) {
  const set = BINGO_SETS.find(s => s.id === setId) ?? BINGO_SETS[0]
  const picks = shuffle(set.words.map((_, i) => i), rng(seed)).slice(0, 24)
  return [...picks.slice(0, FREE), -1, ...picks.slice(FREE)]
}

export const bingoWord = (setId, i, lang) => {
  const set = BINGO_SETS.find(s => s.id === setId) ?? BINGO_SETS[0]
  return set.words[i]?.[lang === 'zh' ? 1 : 0] ?? ''
}

// The completed lines of a set of marked cells (the free centre always counts).
export function linesDone(marks) {
  const on = new Set([...marks, FREE])
  return LINES.filter(l => l.every(i => on.has(i)))
}

// Fewest cells still needed for a line.
export function cellsToGo(marks) {
  const on = new Set([...marks, FREE])
  return Math.min(...LINES.map(l => l.filter(i => !on.has(i)).length))
}

// ---------- room ----------

export function newRoom({ id, name, owner, at, mode, setId }) {
  return {
    kind: 'icebreakers', id, name, createdAt: at, ownerId: owner.id, startMode: mode,
    people: { [owner.id]: { ...owner, joinedAt: at } },
    cats: ['checkin'], round: null, asked: [], history: [],
    settings: { anonymous: false, open: false },
    bingo: mode === 'bingo' ? newGame(`${id}g`, setId, at) : null,
  }
}

const newGame = (id, setId, at) => ({ id, setId, startedAt: at, marks: {}, winners: [] })

// Keeps the last round (with its answers) when a new question is drawn.
function archive(r) {
  const x = r.round
  if (!x || !Object.keys(x.answers).length) return r.history
  return [{ qid: x.qid, answers: x.answers, at: x.at, anon: x.anon }, ...r.history].slice(0, 40)
}

export function reduce(r, a) {
  if (!r) return r
  switch (a.type) {
    case 'JOIN': {
      const prev = r.people[a.person.id]
      return { ...r, people: { ...r.people, [a.person.id]: { ...prev, ...a.person, joinedAt: prev?.joinedAt ?? a.at, left: false } } }
    }
    case 'LEAVE': {
      const p = r.people[a.pid]
      return p ? { ...r, people: { ...r.people, [a.pid]: { ...p, left: true } } } : r
    }
    case 'RENAME': return { ...r, name: a.name.slice(0, 80) }
    case 'SETTINGS': return { ...r, settings: { ...r.settings, ...a.patch } }
    case 'CATS': return { ...r, cats: a.cats.filter(c => QUESTIONS[c]) }
    case 'DRAW': {
      if (!questionOf(a.qid, 'en')) return r
      return { ...r, history: archive(r), round: { id: a.nonce, qid: a.qid, at: a.at, answers: {}, revealed: false }, asked: [...r.asked, a.qid].slice(-300) }
    }
    case 'ANSWER': {
      if (!r.round || r.round.revealed) return r
      const answers = { ...r.round.answers }
      if (a.value == null || a.value === '') delete answers[a.pid]
      else answers[a.pid] = typeof a.value === 'string' ? a.value.slice(0, 280) : a.value
      return { ...r, round: { ...r.round, answers } }
    }
    // Answers revealed while names were hidden stay hidden, even if the setting is turned off later.
    case 'REVEAL': return r.round ? { ...r, round: { ...r.round, revealed: true, anon: !!r.settings.anonymous } } : r
    case 'BINGO_START': return { ...r, bingo: newGame(a.nonce, a.setId, a.at) }
    case 'BINGO_END': return { ...r, bingo: null }
    // Toggles one cell; the first full line puts the player on the winners list.
    case 'MARK': {
      const g = r.bingo
      if (!g || g.id !== a.gameId || a.cell === FREE || a.cell < 0 || a.cell > 24) return r
      const mine = g.marks[a.pid] ?? []
      const marks = mine.includes(a.cell) ? mine.filter(i => i !== a.cell) : [...mine, a.cell]
      const won = !g.winners.some(w => w.pid === a.pid) && linesDone(marks).length > 0
      return { ...r, bingo: { ...g, marks: { ...g.marks, [a.pid]: marks }, winners: won ? [...g.winners, { pid: a.pid, at: a.at }] : g.winners } }
    }
    default: return r
  }
}
