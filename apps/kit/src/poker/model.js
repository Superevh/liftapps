// Planning poker room: a JSON document folded from an ordered log of actions (see live.js).
// The reducer is pure: ids derive from the action nonce and time from action.at.

export const DECKS = {
  fib: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'],
  modfib: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  pow2: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
  hours: ['1', '2', '4', '8', '12', '16', '24', '32', '40', '?', '☕'],
}
export const DECK_IDS = ['fib', 'modfib', 'tshirt', 'pow2', 'hours', 'custom']

// Card themes are pure decoration: a back pattern, an accent and a mascot per theme.
export const THEMES = {
  classic: { emoji: '♠️', accent: '#8C613A' },
  space: { emoji: '🚀', accent: '#3B4E7A' },
  jungle: { emoji: '🐒', accent: '#3E6E57' },
  bakery: { emoji: '🍩', accent: '#B0643F' },
  arcade: { emoji: '👾', accent: '#6A3E7A' },
  ocean: { emoji: '🐙', accent: '#1F5A6E' },
}

export const TSHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function deckOf(room) {
  const deck = room.deck === 'custom' ? (room.customDeck?.length ? room.customDeck : DECKS.fib) : DECKS[room.deck] ?? DECKS.fib
  // The "?" and coffee cards can be switched off; older rooms have no setting and keep them.
  return room.settings?.specials === false ? deck.filter(v => v !== '?' && v !== '☕') : deck
}

export function newRoom({ id, name, deck, customDeck, theme, owner, at }) {
  return {
    kind: 'poker', id, name, createdAt: at, ownerId: owner.id,
    deck, customDeck: customDeck ?? [], theme,
    settings: { hostOnly: false, autoReveal: false, showAverage: true, specials: true },
    people: { [owner.id]: { ...owner, role: 'voter', joinedAt: at } },
    stories: [], currentId: null,
    votes: {}, revealed: false, roundStartedAt: at,
    timer: { endsAt: null },
    history: [],
  }
}

const sid = (a, n = 0) => `${a.nonce}${n.toString(36)}`

function clearRound(r, at) {
  return { ...r, votes: {}, revealed: false, roundStartedAt: at, timer: { endsAt: null } }
}

function voters(r) {
  return Object.values(r.people).filter(p => p.role === 'voter' && !p.left)
}

export function reduce(r, a) {
  if (!r) return r
  switch (a.type) {
    case 'JOIN': {
      const prev = r.people[a.person.id]
      return { ...r, people: { ...r.people, [a.person.id]: { ...prev, ...a.person, role: prev?.role ?? a.role ?? 'voter', joinedAt: prev?.joinedAt ?? a.at, left: false } } }
    }
    case 'LEAVE': {
      const p = r.people[a.pid]
      if (!p) return r
      const { [a.pid]: _, ...votes } = r.votes
      return { ...r, people: { ...r.people, [a.pid]: { ...p, left: true } }, votes }
    }
    case 'SET_ROLE': {
      const p = r.people[a.pid]
      if (!p) return r
      const { [a.pid]: _, ...votes } = r.votes
      return { ...r, people: { ...r.people, [a.pid]: { ...p, role: a.role } }, votes: a.role === 'voter' ? r.votes : votes }
    }
    case 'VOTE': {
      if (r.revealed && !a.afterReveal) return r
      const votes = { ...r.votes }
      if (a.value == null) delete votes[a.pid]
      else votes[a.pid] = a.value
      const next = { ...r, votes }
      // Auto-reveal once every voter has picked a card.
      if (r.settings.autoReveal && !r.revealed) {
        const vs = voters(next)
        if (vs.length > 0 && vs.every(p => votes[p.id] != null)) return reveal(next, a)
      }
      return next
    }
    case 'REVEAL': return r.revealed ? r : reveal(r, a)
    case 'HIDE': return { ...r, revealed: false }
    case 'RESET': return clearRound(r, a.at)
    case 'ADD_STORIES': {
      const added = a.titles.map((title, i) => ({ id: sid(a, i), title: title.slice(0, 300), link: '', estimate: null, addedAt: a.at }))
      const stories = [...r.stories, ...added]
      return { ...r, stories, currentId: r.currentId ?? added[0]?.id ?? null }
    }
    case 'EDIT_STORY': return { ...r, stories: r.stories.map(s => s.id === a.storyId ? { ...s, ...pick(a.patch, ['title', 'link', 'estimate']) } : s) }
    case 'REMOVE_STORY': return { ...r, stories: r.stories.filter(s => s.id !== a.storyId), currentId: r.currentId === a.storyId ? null : r.currentId }
    case 'MOVE_STORY': {
      const list = r.stories.filter(s => s.id !== a.storyId)
      const s = r.stories.find(x => x.id === a.storyId)
      if (!s) return r
      list.splice(Math.max(0, Math.min(list.length, a.index)), 0, s)
      return { ...r, stories: list }
    }
    case 'SELECT_STORY': return clearRound({ ...r, currentId: a.storyId }, a.at)
    // Saves the agreed estimate on the current story and moves to the next one without one.
    case 'ACCEPT': {
      const stories = r.stories.map(s => s.id === a.storyId ? { ...s, estimate: a.value } : s)
      const idx = stories.findIndex(s => s.id === a.storyId)
      const next = stories.slice(idx + 1).find(s => s.estimate == null) ?? stories.find(s => s.estimate == null)
      const entry = { storyId: a.storyId, value: a.value, votes: r.votes, at: a.at }
      return clearRound({ ...r, stories, currentId: next?.id ?? null, history: [...r.history, entry].slice(-200) }, a.at)
    }
    case 'SET_DECK': return clearRound({ ...r, deck: a.deck, customDeck: a.customDeck ?? r.customDeck }, a.at)
    // Hands the host role to someone else. Only the creator can still delete the room.
    case 'SET_HOST': return r.people[a.pid] ? { ...r, ownerId: a.pid, creatorId: r.creatorId ?? r.ownerId } : r
    case 'SET_THEME': return { ...r, theme: a.theme }
    case 'RENAME': return { ...r, name: a.name.slice(0, 80) }
    case 'SETTINGS': return { ...r, settings: { ...r.settings, ...a.patch } }
    case 'TIMER': return { ...r, timer: { endsAt: a.seconds ? a.at + a.seconds * 1000 : null } }
    default: return r
  }
}

function reveal(r, a) {
  return { ...r, revealed: true, revealedAt: a.at, timer: { endsAt: null } }
}

const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)))

export const toNumber = v => (v === '½' ? 0.5 : /^\d+(\.\d+)?$/.test(v) ? Number(v) : null)

// Snaps a number to the closest card in the deck (used to suggest an estimate).
function closestCard(deck, x) {
  const nums = deck.map(v => [v, toNumber(v)]).filter(([, n]) => n != null)
  if (!nums.length) return null
  return nums.reduce((best, cur) => Math.abs(cur[1] - x) < Math.abs(best[1] - x) ? cur : best)[0]
}

// Results of a revealed round.
export function stats(room) {
  const deck = deckOf(room)
  const values = Object.values(room.votes)
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const dist = [...counts].sort((a, b) => deck.indexOf(a[0]) - deck.indexOf(b[0]))
  const top = [...counts].sort((a, b) => b[1] - a[1])
  const real = values.filter(v => v !== '?' && v !== '☕')
  const nums = real.map(toNumber).filter(n => n != null).sort((a, b) => a - b)
  const isSize = room.deck === 'tshirt'
  let average = null
  let median = null
  if (!isSize && nums.length) {
    average = nums.reduce((s, x) => s + x, 0) / nums.length
    median = nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
  }
  const consensus = real.length > 1 && new Set(real).size === 1
  const agreement = values.length ? Math.round(((top[0]?.[1] ?? 0) / values.length) * 100) : 0
  const order = real.map(v => deck.indexOf(v)).filter(i => i >= 0)
  const low = order.length ? deck[Math.min(...order)] : null
  const high = order.length ? deck[Math.max(...order)] : null
  // Spread of more than two cards apart usually means the team understands the story differently.
  const spread = order.length ? Math.max(...order) - Math.min(...order) : 0
  const suggestion = consensus ? real[0] : average != null ? closestCard(deck, average) : top.find(([v]) => v !== '?' && v !== '☕')?.[0] ?? null
  return { count: values.length, dist, average, median, consensus, agreement, low, high, spread, suggestion, mostCommon: top[0]?.[0] ?? null }
}

export function storiesCsv(room) {
  const q = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  return ['story,estimate,link', ...room.stories.map(s => [s.title, s.estimate ?? '', s.link ?? ''].map(x => q(String(x))).join(','))].join('\n')
}
