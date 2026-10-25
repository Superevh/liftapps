// Silent sizing board: a JSON document folded from an ordered log of actions (see live.js).
// The reducer is pure: ids derive from the action nonce and time from action.at.
// A card's `col` is a scale value, or null while it sits in the "Unsized" pile.

import { DECKS } from '../poker/model.js'

const plain = deck => deck.filter(v => v !== '?' && v !== '☕')
export const SCALES = {
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  fib: plain(DECKS.fib),
  modfib: plain(DECKS.modfib),
  pow2: plain(DECKS.pow2),
}
export const SCALE_IDS = ['tshirt', 'fib', 'modfib', 'pow2', 'custom']
export const PHASES = ['sort', 'challenge', 'discuss', 'done']

export function scaleOf(b) {
  return b.scale === 'custom' && b.customScale?.length ? b.customScale : SCALES[b.scale] ?? SCALES.tshirt
}

export function newBoard({ id, name, scale, customScale, titles, owner, at, nonce }) {
  const b = {
    kind: 'sizing', id, name, createdAt: at, ownerId: owner.id,
    scale, customScale: customScale ?? [],
    settings: { hostOnly: false, contestAt: 2 },
    people: { [owner.id]: { ...owner, joinedAt: at } },
    phase: 'sort', timer: { endsAt: null },
    cards: [],
  }
  return reduce(b, { type: 'ADD_CARDS', titles, at, nonce })
}

const cid = (a, n) => `${a.nonce}${n.toString(36)}`

// Cards in one column, in their on-screen order.
export const column = (b, col) => b.cards.filter(c => c.col === col).sort((x, y) => x.order - y.order)

// A card is contested when someone flagged it, or it has been moved between sizes more than the limit.
export const flagCount = c => Object.keys(c.flags ?? {}).length
export const isContested = (b, c) => !c.settled && (flagCount(c) > 0 || c.moveCount > b.settings.contestAt)

function place(b, cardId, col, index) {
  const card = b.cards.find(c => c.id === cardId)
  const list = column(b, col).filter(c => c.id !== cardId)
  list.splice(Math.max(0, Math.min(list.length, index ?? list.length)), 0, { ...card, col })
  const order = new Map(list.map((c, i) => [c.id, i]))
  return b.cards.map(c => c.id === cardId ? { ...card, col, order: order.get(c.id) } : order.has(c.id) ? { ...c, order: order.get(c.id) } : c)
}

export function reduce(b, a) {
  if (!b) return b
  switch (a.type) {
    case 'JOIN': {
      const prev = b.people[a.person.id]
      return { ...b, people: { ...b.people, [a.person.id]: { ...prev, ...a.person, joinedAt: prev?.joinedAt ?? a.at, left: false } } }
    }
    case 'LEAVE': {
      const p = b.people[a.pid]
      return p ? { ...b, people: { ...b.people, [a.pid]: { ...p, left: true } } } : b
    }
    case 'SET_HOST': return b.people[a.pid] ? { ...b, ownerId: a.pid, creatorId: b.creatorId ?? b.ownerId } : b
    case 'RENAME': return { ...b, name: a.name.slice(0, 80) }
    case 'SETTINGS': return { ...b, settings: { ...b.settings, ...a.patch } }
    case 'PHASE': return PHASES.includes(a.phase) ? { ...b, phase: a.phase } : b
    case 'TIMER': return { ...b, timer: { endsAt: a.seconds ? a.at + a.seconds * 1000 : null } }
    case 'SET_SCALE': {
      // Cards on a size the new scale does not have go back to the pile.
      const next = { ...b, scale: a.scale, customScale: a.customScale ?? b.customScale }
      const values = scaleOf(next)
      return { ...next, cards: b.cards.map(c => c.col != null && !values.includes(c.col) ? { ...c, col: null, settled: false } : c) }
    }
    case 'ADD_CARDS': {
      const start = column(b, null).length
      const added = a.titles.slice(0, 200).map((title, i) => ({
        id: cid(a, i), title: title.slice(0, 300), link: '', notes: '', col: null, order: start + i,
        moveCount: 0, moves: [], flags: {}, settled: false, addedAt: a.at,
      }))
      return { ...b, cards: [...b.cards, ...added] }
    }
    case 'EDIT_CARD': return { ...b, cards: b.cards.map(c => c.id === a.cardId ? { ...c, ...pick(a.patch, ['title', 'link', 'notes']) } : c) }
    case 'REMOVE_CARD': return { ...b, cards: b.cards.filter(c => c.id !== a.cardId) }
    // Moving between sizes is logged; first placement from the pile and reordering within a column are not.
    case 'MOVE': {
      const card = b.cards.find(c => c.id === a.cardId)
      if (!card || b.phase === 'done' || (card.settled && b.phase !== 'discuss')) return b
      if (a.col != null && !scaleOf(b).includes(a.col)) return b
      let cards = place(b, a.cardId, a.col, a.index)
      if (card.col !== a.col) {
        const counted = card.col != null && a.col != null
        const entry = { pid: a.pid, from: card.col, to: a.col, at: a.at }
        cards = cards.map(c => c.id === a.cardId ? { ...c, moveCount: c.moveCount + (counted ? 1 : 0), moves: [...c.moves, entry].slice(-20) } : c)
      }
      return { ...b, cards }
    }
    case 'FLAG': {
      return { ...b, cards: b.cards.map(c => {
        if (c.id !== a.cardId) return c
        const { [a.pid]: _, ...flags } = c.flags ?? {}
        return { ...c, flags: a.on ? { ...flags, [a.pid]: a.at } : flags }
      }) }
    }
    // The host decides where a contested card ends up; it then stays put.
    case 'SETTLE': {
      const card = b.cards.find(c => c.id === a.cardId)
      if (!card || (a.col != null && !scaleOf(b).includes(a.col))) return b
      const cards = card.col === a.col ? b.cards : place(b, a.cardId, a.col)
      return { ...b, cards: cards.map(c => c.id === a.cardId ? { ...c, settled: true, flags: {} } : c) }
    }
    case 'UNSETTLE': return { ...b, cards: b.cards.map(c => c.id === a.cardId ? { ...c, settled: false } : c) }
    default: return b
  }
}

const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)))

export const toNumber = v => (v === '½' ? 0.5 : /^\d+(\.\d+)?$/.test(v) ? Number(v) : null)

// Count and points per size. Points only add up on numeric scales.
export function summary(b) {
  const values = scaleOf(b)
  const numeric = values.every(v => toNumber(v) != null)
  const cols = values.map(v => {
    const n = column(b, v).length
    return { value: v, count: n, points: numeric ? n * toNumber(v) : null }
  })
  const total = numeric ? cols.reduce((s, c) => s + c.points, 0) : null
  return { cols, total, numeric, unsized: column(b, null).length }
}

// Story titles from pasted text: one per line, or the title column of a CSV with a header row.
export function parseTitles(text, parseCsv) {
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  if (/[,;\t]/.test(firstLine) && /title|summary|name|story|标题|名称/i.test(firstLine)) {
    const { headers, rows } = parseCsv(text)
    const i = headers.findIndex(h => /title|summary|name|story|标题|名称/i.test(h))
    if (i >= 0) return rows.map(r => (r[i] ?? '').trim()).filter(Boolean)
  }
  return text.split('\n').map(s => s.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean)
}

export function boardCsv(b) {
  const q = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  const values = scaleOf(b)
  const rows = [...values, null].flatMap(v => column(b, v))
  return ['story,size,moves,link,notes', ...rows.map(c => [c.title, c.col ?? '', c.moveCount, c.link ?? '', c.notes ?? ''].map(x => q(String(x))).join(','))].join('\n')
}
