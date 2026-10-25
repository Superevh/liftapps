// Workshop agenda: ordered, time-boxed blocks plus a shared run state.
// The reducer is pure and takes time only from action.at, so every browser folding the same
// event log (or the local fallback) reaches the same agenda and the same countdown.

export const MAX_BLOCKS = 60
export const MAX_MINUTES = 480

const clampMin = m => Math.max(1, Math.min(MAX_MINUTES, Math.round(Number(m) || 1)))
const clean = (s, n) => String(s ?? '').slice(0, n)

export function newAgenda({ id, name, owner, blocks = [], at }) {
  return {
    id, kind: 'agenda', name: clean(name, 120), ownerId: owner.id, creatorId: owner.id, createdAt: at, startAt: '',
    blocks: blocks.slice(0, MAX_BLOCKS).map((b, i) => ({ id: `${id.slice(-6)}${i}`, title: clean(b.title, 160), minutes: clampMin(b.minutes), notes: clean(b.notes, 1000) })),
    run: { status: 'idle', index: 0, endsAt: null, remaining: null },
  }
}

const blockMs = (doc, i) => (doc.blocks[i]?.minutes ?? 0) * 60000

function startBlock(doc, index, at) {
  if (index >= doc.blocks.length) return { ...doc, run: { status: 'done', index: doc.blocks.length, endsAt: null, remaining: null, finishedAt: at } }
  return { ...doc, run: { status: 'running', index, endsAt: at + blockMs(doc, index), remaining: null } }
}

export function reduce(doc, a) {
  if (!doc) return doc
  const run = doc.run
  switch (a.type) {
    case 'RENAME': return { ...doc, name: clean(a.name, 120) || doc.name }
    case 'SET_START': return { ...doc, startAt: /^\d{2}:\d{2}$/.test(a.startAt) ? a.startAt : '' }
    case 'ADD_BLOCK': {
      if (doc.blocks.length >= MAX_BLOCKS) return doc
      const block = { id: a.nonce.slice(0, 10), title: clean(a.title, 160), minutes: clampMin(a.minutes), notes: clean(a.notes, 1000) }
      return { ...doc, blocks: [...doc.blocks, block] }
    }
    case 'UPDATE_BLOCK': {
      const patch = {}
      if ('title' in a) patch.title = clean(a.title, 160)
      if ('notes' in a) patch.notes = clean(a.notes, 1000)
      if ('minutes' in a) patch.minutes = clampMin(a.minutes)
      const i = doc.blocks.findIndex(b => b.id === a.bid)
      if (i < 0) return doc
      const next = { ...doc, blocks: doc.blocks.map(b => (b.id === a.bid ? { ...b, ...patch } : b)) }
      // Changing the length of the block that is running moves its end by the same amount.
      if ('minutes' in a && i === run.index && run.status !== 'idle' && run.status !== 'done') {
        const delta = (patch.minutes - doc.blocks[i].minutes) * 60000
        next.run = run.status === 'running' ? { ...run, endsAt: run.endsAt + delta } : { ...run, remaining: run.remaining + delta }
      }
      return next
    }
    case 'REMOVE_BLOCK': {
      const i = doc.blocks.findIndex(b => b.id === a.bid)
      if (i < 0) return doc
      const blocks = doc.blocks.filter(b => b.id !== a.bid)
      let nextRun = run
      if (run.status !== 'idle' && run.status !== 'done') {
        if (i < run.index) nextRun = { ...run, index: run.index - 1 }
        else if (i === run.index) return startBlock({ ...doc, blocks }, i, a.at)
      }
      return { ...doc, blocks, run: nextRun }
    }
    case 'MOVE_BLOCK': {
      const i = doc.blocks.findIndex(b => b.id === a.bid)
      const j = i + (a.dir < 0 ? -1 : 1)
      if (i < 0 || j < 0 || j >= doc.blocks.length) return doc
      const blocks = [...doc.blocks]
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
      let index = run.index
      if (run.status !== 'idle' && run.status !== 'done') index = run.index === i ? j : run.index === j ? i : run.index
      return { ...doc, blocks, run: { ...run, index } }
    }
    case 'START': return doc.blocks.length ? startBlock(doc, Math.max(0, Math.min(a.index ?? 0, doc.blocks.length - 1)), a.at) : doc
    case 'PAUSE': return run.status === 'running' ? { ...doc, run: { ...run, status: 'paused', remaining: run.endsAt - a.at, endsAt: null } } : doc
    case 'RESUME': return run.status === 'paused' ? { ...doc, run: { ...run, status: 'running', endsAt: a.at + run.remaining, remaining: null } } : doc
    case 'NEXT': return run.status === 'running' || run.status === 'paused' ? startBlock(doc, run.index + 1, a.at) : doc
    case 'PREV': return run.status !== 'idle' ? startBlock(doc, Math.max(0, Math.min(run.index, doc.blocks.length) - 1), a.at) : doc
    case 'ADD_MINUTE': {
      const ms = 60000 * (a.minutes ?? 1)
      if (run.status === 'running') return { ...doc, run: { ...run, endsAt: Math.max(run.endsAt, a.at) + ms } }
      if (run.status === 'paused') return { ...doc, run: { ...run, remaining: Math.max(run.remaining, 0) + ms } }
      return doc
    }
    case 'STOP': return { ...doc, run: { status: 'idle', index: 0, endsAt: null, remaining: null } }
    default: return doc
  }
}

export const totalMinutes = doc => doc.blocks.reduce((n, b) => n + b.minutes, 0)

// Milliseconds left in the current block (negative once it runs over).
export function remainingMs(run, now) {
  if (run.status === 'running') return run.endsAt - now
  if (run.status === 'paused') return run.remaining
  return null
}

export function fmtClock(ms) {
  const neg = ms < 0
  const s = Math.ceil(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
  return neg ? `+${body}` : body
}

export function fmtDuration(min, lang) {
  const h = Math.floor(min / 60), m = min % 60
  if (lang === 'zh') return h ? `${h} 小时${m ? ` ${m} 分钟` : ''}` : `${m} 分钟`
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

// "09:30" + offset minutes -> "10:05"
export function clockAt(startAt, offset) {
  if (!startAt) return null
  const [h, m] = startAt.split(':').map(Number)
  const t = (h * 60 + m + offset) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export function agendaMarkdown(doc, lang) {
  let at = 0
  const lines = [`# ${doc.name}`, '', `${lang === 'zh' ? '总时长' : 'Total'}: ${fmtDuration(totalMinutes(doc), lang)}`, '']
  doc.blocks.forEach((b, i) => {
    const when = doc.startAt ? `${clockAt(doc.startAt, at)}–${clockAt(doc.startAt, at + b.minutes)} ` : ''
    lines.push(`${i + 1}. ${when}**${b.title || '—'}** (${b.minutes} min)${b.notes ? `\n   ${b.notes.replace(/\n/g, '\n   ')}` : ''}`)
    at += b.minutes
  })
  return lines.join('\n')
}

// Starter agendas now live in the template library (templates/index.js).
export { TEMPLATES, CATEGORIES, BLANK, templateById, templateBlocks, searchTemplates } from './templates/index.js'
