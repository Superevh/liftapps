// MeetingLift: one shared document per meeting, with a Plan → Run → Follow-up lifecycle.
// The document is a JSON snapshot folded from an ordered action log (see core/live.js), so the
// reducer is pure: ids come from action.nonce, time only from action.at, and actions that only
// the facilitator may send (the run controls) are checked against action.pid.

export const V = 1
export const TYPES = ['discussion', 'decision', 'update', 'activity', 'break']
export const ACTIVITIES = ['checkin', 'leancoffee', 'poll', 'parking', 'actions']
export const CADENCES = ['none', 'daily', 'weekly', 'biweekly', 'monthly']
export const COLLS = ['notes', 'decisions', 'actions', 'parking', 'topics']
export const POLL_KINDS = ['fist', 'yesno', 'options']
export const MAX_ITEMS = 60
export const MAX_ENTRIES = 400
export const MIN = 60000
// A request to facilitate that the facilitator neither accepts nor declines for this long lets the
// requester take over. Judged by action.at, so every client agrees; nothing is written while waiting.
export const REQUEST_WAIT_MS = 75000

const clean = (s, n) => String(s ?? '').replace(/\s+$/, '').slice(0, n)
const line = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const clampMin = m => Math.max(1, Math.min(480, Math.round(Number(m) || 1)))
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '')
const isTime = s => /^\d{2}:\d{2}$/.test(s ?? '')

function cleanItem(x, id, by) {
  const type = TYPES.includes(x.type) ? x.type : 'discussion'
  return {
    id, title: line(x.title, 160), minutes: clampMin(x.minutes), type,
    activity: type === 'activity' && ACTIVITIES.includes(x.activity) ? x.activity : null,
    owner: line(x.owner, 60), notes: clean(x.notes, 1500), by: x.by ?? by ?? null, from: x.from ?? null,
    qid: type === 'activity' && x.activity === 'checkin' && /^[a-z]+:\d+$/.test(x.qid ?? '') ? x.qid : null,
  }
}

const IDLE = { status: 'idle', index: 0, endsAt: null, remaining: null, segAt: null, startedAt: null, endedAt: null, topic: null }

export function newMeeting({ id, owner, at, title, date = '', time = '', goal = '', cadence = 'none', items = [], attendees = [], cost, series, carried, team }) {
  const seed = id.slice(-6)
  return migrate({
    v: V, kind: 'meeting', id, createdAt: at, creatorId: owner.id, facilitatorId: owner.id,
    title: line(title, 120), date: isDate(date) ? date : '', time: isTime(time) ? time : '', goal: clean(goal, 600), outcome: '',
    cadence: CADENCES.includes(cadence) ? cadence : 'none',
    teamId: team?.id ?? null, teamName: line(team?.name, 60),
    series: series ?? { id, n: 1, prevId: null, nextId: null },
    attendees: [...new Set(attendees.map(n => line(n, 60)).filter(Boolean))].slice(0, 40),
    people: owner.name !== undefined ? { [owner.id]: { id: owner.id, name: line(owner.name, 40), color: owner.color, joinedAt: at } } : {},
    items: items.slice(0, MAX_ITEMS).map((x, i) => cleanItem(x, `${seed}i${i}`, owner.id)),
    notes: [], decisions: [], actions: carried?.actions ?? [], parking: carried?.parking ?? [], topics: carried?.topics ?? [],
    checkins: {}, polls: {}, spent: {},
    settings: { votes: 3, topicMinutes: 7 },
    cost: { on: false, rate: 80, currency: 'AUD', people: null, ...(cost ?? {}) },
    run: { ...IDLE },
  })
}

// Fills in anything an older or partial document lacks, so every client reads the same shape.
export function migrate(d) {
  if (!d || typeof d !== 'object') return d
  if (d.v === V && d.run && d.items && d.spent) return d
  return {
    ...d, v: V, kind: 'meeting',
    title: d.title ?? '', date: d.date ?? '', time: d.time ?? '', goal: d.goal ?? '', outcome: d.outcome ?? '', cadence: d.cadence ?? 'none',
    facilitatorId: d.facilitatorId ?? d.creatorId ?? null, teamId: d.teamId ?? null, teamName: d.teamName ?? '',
    series: d.series ?? { id: d.id, n: 1, prevId: null, nextId: null },
    attendees: d.attendees ?? [], people: d.people ?? {}, items: d.items ?? [],
    notes: d.notes ?? [], decisions: d.decisions ?? [], actions: d.actions ?? [], parking: d.parking ?? [], topics: d.topics ?? [],
    checkins: d.checkins ?? {}, polls: d.polls ?? {}, spent: d.spent ?? {},
    settings: { votes: 3, topicMinutes: 7, ...(d.settings ?? {}) },
    cost: { on: false, rate: 80, currency: 'AUD', people: null, ...(d.cost ?? {}) },
    run: { ...IDLE, ...(d.run ?? {}) },
  }
}

// ---------- run clock ----------

const live = run => run.status === 'running' || run.status === 'paused'
const itemLeft = (d, i, spent) => d.items[i] ? d.items[i].minutes * MIN - (spent[d.items[i].id] ?? 0) : 0

// Banks the time the current item has been running into `spent`.
function bank(d, at) {
  const r = d.run
  if (r.status !== 'running') return d
  const it = d.items[r.index]
  const spent = it ? { ...d.spent, [it.id]: (d.spent[it.id] ?? 0) + Math.max(0, at - r.segAt) } : d.spent
  return { ...d, spent, run: { ...r, segAt: at } }
}

// Leaving an item (or ending) closes the Lean Coffee topic under discussion.
function closeTopic(d, at) {
  const tp = d.run.topic
  if (!tp) return d
  return { ...d, topics: d.topics.map(x => (x.id === tp.id && x.status === 'open' ? { ...x, status: 'done', doneAt: at } : x)), run: { ...d.run, topic: null } }
}

function goTo(d, index, at) {
  d = closeTopic(bank(d, at), at)
  if (index >= d.items.length) return { ...d, run: { ...d.run, status: 'done', index: d.items.length, endsAt: null, remaining: null, segAt: null, endedAt: at, topic: null } }
  const i = Math.max(0, index)
  return { ...d, run: { ...d.run, status: 'running', index: i, endsAt: at + itemLeft(d, i, d.spent), remaining: null, segAt: at, startedAt: d.run.startedAt ?? at, endedAt: null, topic: null } }
}

// Time spent on each item so far, counting the segment that is running right now.
export function spentNow(d, now) {
  const r = d.run
  if (r.status !== 'running') return d.spent
  const it = d.items[r.index]
  return it ? { ...d.spent, [it.id]: (d.spent[it.id] ?? 0) + Math.max(0, now - r.segAt) } : d.spent
}

export function remainingMs(run, now) {
  if (run.status === 'running') return run.endsAt - now
  if (run.status === 'paused') return run.remaining
  return null
}

export function topicLeft(run, now) {
  const t = run.topic
  if (!t) return null
  return t.remaining != null ? t.remaining : t.endsAt - now
}

// ---------- entries (notes, decisions, actions, parking lot, suggested topics) ----------

function newEntry(coll, a, d) {
  const text = line(a.text, coll === 'topics' ? 200 : 500)
  if (!text) return null
  const id = a.nonce
  const base = { id, text, by: a.pid ?? null, at: a.at }
  const itemId = d.items.some(x => x.id === a.itemId) ? a.itemId : null
  const topicId = d.topics.some(x => x.id === a.topicId) ? a.topicId : null
  if (coll === 'notes' || coll === 'decisions') return { ...base, itemId, topicId }
  if (coll === 'actions') return { ...base, origin: id, itemId, topicId, meetingId: d.id, owner: line(a.owner, 60), due: isDate(a.due) ? a.due : '', done: false, doneAt: null }
  if (coll === 'parking') return { ...base, itemId, resolved: false }
  if (coll === 'topics') return { ...base, votes: {}, status: 'open' }
  return null
}

const EDITABLE = {
  notes: ['text'], decisions: ['text'], topics: ['text', 'status'],
  actions: ['text', 'owner', 'due', 'done'], parking: ['text', 'resolved'],
}

function patchEntry(coll, e, patch, at) {
  const out = { ...e }
  for (const k of EDITABLE[coll] ?? []) {
    if (!(k in patch)) continue
    const v = patch[k]
    if (k === 'text') { const tx = line(v, coll === 'topics' ? 200 : 500); if (tx) out.text = tx }
    else if (k === 'owner') out.owner = line(v, 60)
    else if (k === 'due') out.due = isDate(v) ? v : ''
    else if (k === 'done') { out.done = !!v; out.doneAt = v ? at : null }
    else if (k === 'resolved') out.resolved = !!v
    else if (k === 'status') out.status = ['open', 'agenda', 'done'].includes(v) ? v : out.status
  }
  return out
}

export const votesUsed = (d, pid) => d.topics.reduce((n, t) => n + (t.status === 'open' ? (t.votes[pid] ?? 0) : 0), 0)
export const voteCount = t => Object.values(t.votes ?? {}).reduce((n, v) => n + v, 0)

// ---------- reducer ----------

export function reduce(doc, a) {
  if (!doc) return doc
  return step(migrate(doc), a)
}

const named = (d, pid) => !!d.people[pid]?.name
// Milliseconds until a pending request may be turned into a take-over (0 = now).
export const requestWaitLeft = (d, now) => (d.request ? Math.max(0, d.request.at + REQUEST_WAIT_MS - now) : null)

function step(d, a) {
  const run = d.run
  const isFac = a.pid != null && a.pid === d.facilitatorId
  switch (a.type) {
    case 'JOIN': {
      const p = a.person
      if (!p?.id) return d
      const prev = d.people[p.id]
      return { ...d, people: { ...d.people, [p.id]: { id: p.id, name: line(p.name, 40), color: p.color, joinedAt: prev?.joinedAt ?? a.at } } }
    }
    case 'SET': {
      const p = a.patch ?? {}
      const n = { ...d }
      if ('title' in p) n.title = line(p.title, 120) || d.title
      if ('date' in p) n.date = isDate(p.date) ? p.date : ''
      if ('time' in p) n.time = isTime(p.time) ? p.time : ''
      if ('goal' in p) n.goal = clean(p.goal, 600)
      if ('outcome' in p) n.outcome = clean(p.outcome, 2000)
      if ('cadence' in p && CADENCES.includes(p.cadence)) n.cadence = p.cadence
      if ('votes' in p) n.settings = { ...n.settings, votes: Math.max(1, Math.min(10, Math.round(Number(p.votes) || 3))) }
      if ('topicMinutes' in p) n.settings = { ...n.settings, topicMinutes: clampMin(p.topicMinutes) }
      return n
    }
    case 'SET_COST': {
      const p = a.patch ?? {}
      const c = { ...d.cost }
      if ('on' in p) c.on = !!p.on
      if ('rate' in p) c.rate = Math.max(0, Math.min(100000, Number(p.rate) || 0))
      if ('currency' in p && /^[A-Z]{3}$/.test(p.currency)) c.currency = p.currency
      if ('people' in p) c.people = p.people == null || p.people === '' ? null : Math.max(1, Math.min(500, Math.round(Number(p.people) || 1)))
      return { ...d, cost: c }
    }
    case 'ATTENDEE_ADD': {
      const names = (Array.isArray(a.names) ? a.names : [a.name]).map(n => line(n, 60)).filter(Boolean)
      const attendees = [...d.attendees]
      for (const n of names) if (!attendees.some(x => x.toLowerCase() === n.toLowerCase()) && attendees.length < 40) attendees.push(n)
      return { ...d, attendees }
    }
    case 'ATTENDEE_REMOVE': return { ...d, attendees: d.attendees.filter(x => x !== a.name) }
    case 'PING': return d // older clients sent a heartbeat; it no longer means anything
    // Never instant: ask first; if the facilitator neither hands over nor declines in time, the requester may take over.
    case 'TAKE_FACILITATOR': return d.request?.pid === a.pid && named(d, a.pid) && a.at - d.request.at >= REQUEST_WAIT_MS ? { ...d, facilitatorId: a.pid, request: null } : d
    case 'REQUEST_FACILITATOR': return named(d, a.pid) && a.pid !== d.facilitatorId ? { ...d, request: { pid: a.pid, at: a.at } } : d
    case 'CANCEL_REQUEST': return d.request?.pid === a.pid ? { ...d, request: null, lastRequest: { pid: a.pid, outcome: 'cancelled', at: a.at } } : d
    case 'HAND_OVER': return isFac && named(d, a.to) ? { ...d, facilitatorId: a.to, request: null } : d
    case 'DECLINE_REQUEST': return isFac && d.request ? { ...d, request: null, lastRequest: { pid: d.request.pid, outcome: 'declined', at: a.at } } : d
    // The first next meeting wins. Action items still open move to it: here they become read-only pointers.
    // Links the meeting to a team space (or unlinks it with teamId null).
    case 'SET_TEAM': {
      const id = a.teamId == null ? null : String(a.teamId)
      if (id != null && !/^lfms[a-z0-9]+$/.test(id)) return d
      return { ...d, teamId: id, teamName: id ? line(a.teamName, 60) : '' }
    }
    case 'SET_NEXT': {
      const id = String(a.nextId ?? '').slice(0, 40)
      // Only once the meeting is over (or never started), so the live action review is not frozen.
      if (!id || d.series.nextId || d.run.status !== 'done') return d
      return {
        ...d, series: { ...d.series, nextId: id },
        actions: d.actions.map(x => (x.done || x.movedTo ? x : { ...x, movedTo: id })),
        parking: d.parking.map(x => (x.resolved || x.movedTo ? x : { ...x, movedTo: id })),
      }
    }

    // ----- agenda items -----
    case 'ADD_ITEM': {
      if (d.items.length >= MAX_ITEMS) return d
      const item = cleanItem(a.item ?? {}, a.nonce, a.pid)
      if (!item.title) return d
      const at = Number.isInteger(a.index) ? Math.max(0, Math.min(d.items.length, a.index)) : d.items.length
      const items = [...d.items.slice(0, at), item, ...d.items.slice(at)]
      const shift = live(run) && at <= run.index ? 1 : 0
      return { ...d, items, run: { ...run, index: run.index + shift } }
    }
    case 'RESTORE_ITEM': {
      const x = a.item
      if (!x?.id || d.items.some(i => i.id === x.id) || d.items.length >= MAX_ITEMS) return d
      const item = cleanItem(x, x.id, x.by)
      const at = Math.max(0, Math.min(d.items.length, Number(a.index) || 0))
      const shift = live(run) && at <= run.index ? 1 : 0
      return { ...d, items: [...d.items.slice(0, at), item, ...d.items.slice(at)], run: { ...run, index: run.index + shift } }
    }
    case 'UPDATE_ITEM': {
      const i = d.items.findIndex(x => x.id === a.iid)
      if (i < 0) return d
      const old = d.items[i]
      const p = a.patch ?? {}
      if ('minutes' in p && live(run) && i === run.index && !isFac) return d
      const item = cleanItem({ ...old, ...p, activity: 'activity' in p ? p.activity : old.activity }, old.id, old.by)
      if (!item.title) item.title = old.title
      const next = { ...d, items: d.items.map((x, k) => (k === i ? item : x)) }
      // A longer or shorter timebox on the running item moves its end by the same amount.
      if ('minutes' in p && i === run.index && live(run)) {
        const delta = (item.minutes - old.minutes) * MIN
        next.run = run.status === 'running' ? { ...run, endsAt: run.endsAt + delta } : { ...run, remaining: run.remaining + delta }
      }
      return next
    }
    case 'REMOVE_ITEM': {
      const i = d.items.findIndex(x => x.id === a.iid)
      if (i < 0 || (live(run) && i <= run.index && !isFac)) return d
      const items = d.items.filter(x => x.id !== a.iid)
      if (live(run)) {
        if (i < run.index) return { ...d, items, run: { ...run, index: run.index - 1 } }
        if (i === run.index) return goTo({ ...bank(d, a.at), items }, i, a.at)
      }
      return { ...d, items }
    }
    case 'MOVE_ITEM': {
      const i = d.items.findIndex(x => x.id === a.iid)
      const j = Number.isInteger(a.to) ? a.to : i + (a.dir < 0 ? -1 : 1)
      if (i < 0 || j < 0 || j >= d.items.length || i === j || (live(run) && !isFac)) return d
      const items = [...d.items]
      const [x] = items.splice(i, 1)
      items.splice(j, 0, x)
      let index = run.index
      if (live(run)) {
        const curId = d.items[run.index]?.id
        index = items.findIndex(y => y.id === curId)
      }
      return { ...d, items, run: { ...run, index } }
    }

    // ----- run (facilitator only) -----
    case 'START': {
      // A meeting whose next occurrence exists is closed: its open actions already live there.
      if (!isFac || !d.items.length || d.series.nextId) return d
      const i = Math.max(0, Math.min(Number.isInteger(a.index) ? a.index : 0, d.items.length - 1))
      return goTo(d, i, a.at)
    }
    case 'GOTO': return isFac && !d.series.nextId && (live(run) || run.status === 'done') && Number.isInteger(a.index) && a.index >= 0 && a.index < d.items.length ? goTo(d, a.index, a.at) : d
    case 'NEXT': return isFac && live(run) && run.index + 1 < d.items.length ? goTo(d, run.index + 1, a.at) : d
    case 'PREV': return isFac && live(run) && run.index > 0 ? goTo(d, run.index - 1, a.at) : d
    case 'PAUSE': {
      if (!isFac || run.status !== 'running') return d
      const b = bank(d, a.at)
      const tp = b.run.topic && b.run.topic.remaining == null ? { ...b.run.topic, remaining: b.run.topic.endsAt - a.at, endsAt: null } : b.run.topic
      return { ...b, run: { ...b.run, status: 'paused', remaining: run.endsAt - a.at, endsAt: null, segAt: null, topic: tp } }
    }
    case 'RESUME': {
      if (!isFac || run.status !== 'paused') return d
      const tp = run.topic && run.topic.remaining != null ? { ...run.topic, endsAt: a.at + run.topic.remaining, remaining: null } : run.topic
      return { ...d, run: { ...run, status: 'running', endsAt: a.at + run.remaining, remaining: null, segAt: a.at, topic: tp } }
    }
    case 'ADD_TIME': {
      if (!isFac) return d
      const ms = MIN * Math.max(1, Math.min(60, Math.round(Number(a.minutes) || 1)))
      if (run.status === 'running') return { ...d, run: { ...run, endsAt: Math.max(run.endsAt, a.at) + ms } }
      if (run.status === 'paused') return { ...d, run: { ...run, remaining: Math.max(run.remaining, 0) + ms } }
      return d
    }
    case 'END': {
      if (!isFac || run.status === 'idle' || run.status === 'done') return d
      const b = closeTopic(bank(d, a.at), a.at)
      return { ...b, run: { ...b.run, status: 'done', endsAt: null, remaining: null, segAt: null, endedAt: a.at, topic: null } }
    }
    case 'REOPEN': {
      // Picks a finished meeting up again on its last item.
      if (!isFac || run.status !== 'done' || !d.items.length || d.series.nextId) return d
      return goTo(d, Math.min(run.index, d.items.length - 1), a.at)
    }
    case 'RESET': return isFac ? { ...d, spent: {}, run: { ...IDLE } } : d

    // ----- lean coffee inside an activity item -----
    case 'LC_START': {
      const t = d.topics.find(x => x.id === a.tid)
      if (!isFac || !live(run) || !t) return d
      const prev = run.topic ? d.topics.map(x => (x.id === run.topic.id && x.status !== 'agenda' ? { ...x, status: 'done', doneAt: a.at } : x)) : d.topics
      const itemId = d.items[run.index]?.id ?? null
      const length = d.settings.topicMinutes * MIN
      const topic = run.status === 'running' ? { id: t.id, endsAt: a.at + length, remaining: null } : { id: t.id, endsAt: null, remaining: length }
      return { ...d, topics: prev.map(x => (x.id === t.id ? { ...x, status: 'open', itemId, startedAt: x.startedAt ?? a.at } : x)), run: { ...run, topic } }
    }
    case 'LC_ADD_TIME': {
      const tp = run.topic
      if (!isFac || !tp) return d
      const ms = MIN * Math.max(1, Math.min(30, Math.round(Number(a.minutes) || 2)))
      return { ...d, run: { ...run, topic: tp.remaining != null ? { ...tp, remaining: Math.max(0, tp.remaining) + ms } : { ...tp, endsAt: Math.max(tp.endsAt, a.at) + ms } } }
    }
    case 'LC_DONE': {
      if (!isFac || !run.topic) return d
      return { ...d, topics: d.topics.map(x => (x.id === run.topic.id ? { ...x, status: 'done', doneAt: a.at } : x)), run: { ...run, topic: null } }
    }
    case 'VOTE': {
      const t = d.topics.find(x => x.id === a.tid)
      if (!t || t.status !== 'open' || !a.pid) return d
      const mine = t.votes[a.pid] ?? 0
      if (a.delta > 0 && votesUsed(d, a.pid) >= d.settings.votes) return d
      if (a.delta < 0 && !mine) return d
      const votes = { ...t.votes, [a.pid]: mine + (a.delta > 0 ? 1 : -1) }
      if (!votes[a.pid]) delete votes[a.pid]
      return { ...d, topics: d.topics.map(x => (x.id === t.id ? { ...x, votes } : x)) }
    }
    case 'PROMOTE_TOPIC': {
      const t = d.topics.find(x => x.id === a.tid)
      if (!t || t.status === 'agenda' || d.items.length >= MAX_ITEMS) return d
      const item = cleanItem({ title: t.text, minutes: a.minutes ?? 10, type: 'discussion', by: t.by, from: t.id }, a.nonce, t.by)
      // New topics go before a closing item (decisions, wrap-up, parking lot) when there is one.
      const last = d.items[d.items.length - 1]
      const closing = last && (last.type === 'decision' || last.activity === 'parking' || last.activity === 'actions')
      const at = closing && d.items.length > 1 && !(live(run) && run.index >= d.items.length - 1) ? d.items.length - 1 : d.items.length
      const items = [...d.items.slice(0, at), item, ...d.items.slice(at)]
      return { ...d, items, topics: d.topics.map(x => (x.id === t.id ? { ...x, status: 'agenda' } : x)), run: live(run) && at <= run.index ? { ...run, index: run.index + 1 } : run }
    }

    // ----- notes, decisions, actions, parking lot, topics -----
    case 'ADD': {
      if (!COLLS.includes(a.coll) || d[a.coll].length >= MAX_ENTRIES) return d
      // After the next meeting exists, new action items belong there (this copy would be orphaned).
      if (a.coll === 'actions' && d.series.nextId) return d
      const e = newEntry(a.coll, a, d)
      return e ? { ...d, [a.coll]: [...d[a.coll], e] } : d
    }
    case 'EDIT': {
      if (!COLLS.includes(a.coll)) return d
      return { ...d, [a.coll]: d[a.coll].map(e => (e.id === a.eid && !e.movedTo ? patchEntry(a.coll, e, a.patch ?? {}, a.at) : e)) }
    }
    case 'REMOVE': {
      if (!COLLS.includes(a.coll)) return d
      if (d[a.coll].some(e => e.id === a.eid && e.movedTo)) return d
      const next = { ...d, [a.coll]: d[a.coll].filter(e => e.id !== a.eid) }
      if (a.coll === 'topics' && run.topic?.id === a.eid) next.run = { ...run, topic: null }
      return next
    }
    case 'RESTORE': {
      const e = a.entry
      if (!COLLS.includes(a.coll) || !e?.id || d[a.coll].some(x => x.id === e.id) || typeof e.text !== 'string') return d
      const list = [...d[a.coll]]
      list.splice(Math.max(0, Math.min(list.length, Number(a.index) || 0)), 0, { ...e, text: line(e.text, 500) })
      return { ...d, [a.coll]: list }
    }

    // ----- check-in round -----
    case 'CHECKIN_DRAW': {
      if (!d.items.some(x => x.id === a.itemId) || typeof a.qid !== 'string') return d
      return { ...d, checkins: { ...d.checkins, [a.itemId]: { qid: a.qid.slice(0, 20), answers: {} } } }
    }
    case 'CHECKIN_ANSWER': {
      if (!d.items.some(x => x.id === a.itemId) || !a.pid) return d
      const cur = d.checkins[a.itemId] ?? { qid: String(a.qid ?? '').slice(0, 20), answers: {} }
      const answers = { ...cur.answers }
      if (a.value == null || a.value === '') delete answers[a.pid]
      else answers[a.pid] = typeof a.value === 'string' ? line(a.value, 280) : a.value
      return { ...d, checkins: { ...d.checkins, [a.itemId]: { ...cur, answers } } }
    }

    // ----- quick poll / fist of five -----
    case 'POLL_SET': {
      if (!d.items.some(x => x.id === a.itemId)) return d
      const kind = POLL_KINDS.includes(a.kind) ? a.kind : 'fist'
      const options = kind === 'options' ? (a.options ?? []).map(o => line(o, 80)).filter(Boolean).slice(0, 8) : []
      return { ...d, polls: { ...d.polls, [a.itemId]: { kind, question: line(a.question, 200), options, votes: {}, revealed: false } } }
    }
    case 'POLL_VOTE': {
      if (!d.items.some(x => x.id === a.itemId) || !a.pid) return d
      const p = d.polls[a.itemId] ?? { kind: 'fist', question: '', options: [], votes: {}, revealed: false }
      const max = p.kind === 'fist' ? 5 : p.kind === 'yesno' ? 2 : p.options.length - 1
      const v = Math.round(Number(a.value))
      const votes = { ...p.votes }
      if (a.value == null || !(v >= 0 && v <= max)) delete votes[a.pid]
      else votes[a.pid] = v
      return { ...d, polls: { ...d.polls, [a.itemId]: { ...p, votes } } }
    }
    case 'POLL_REVEAL': {
      const p = d.polls[a.itemId] ?? (d.items.some(x => x.id === a.itemId) ? { kind: 'fist', question: '', options: [], votes: {}, revealed: false } : null)
      return p ? { ...d, polls: { ...d.polls, [a.itemId]: { ...p, revealed: !!a.revealed } } } : d
    }
    default: return d
  }
}

// ---------- derived values ----------

export const plannedMinutes = d => d.items.reduce((n, x) => n + x.minutes, 0)

export function nameOf(d, pid, guest = 'Guest') {
  const p = d.people[pid]
  return p?.name || guest
}

export function nextDate(date, cadence) {
  if (!isDate(date) || cadence === 'none') return ''
  const [y, m, dd] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, dd))
  if (cadence === 'daily') { do t.setUTCDate(t.getUTCDate() + 1); while (t.getUTCDay() === 0 || t.getUTCDay() === 6) }
  else if (cadence === 'weekly') t.setUTCDate(t.getUTCDate() + 7)
  else if (cadence === 'biweekly') t.setUTCDate(t.getUTCDate() + 14)
  else if (cadence === 'monthly') t.setUTCMonth(t.getUTCMonth() + 1)
  return t.toISOString().slice(0, 10)
}

export const todayStr = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

// The next meeting in a series: same agenda, attendees and cost settings; open action items,
// the unresolved parking lot and topics nobody got to come along.
export function nextOccurrence(prev, { id, owner, at, today = todayStr() }) {
  const d = migrate(prev)
  let date = nextDate(d.date || today, d.cadence === 'none' ? 'weekly' : d.cadence)
  while (date && date < today) date = nextDate(date, d.cadence === 'none' ? 'weekly' : d.cadence)
  const carry = e => ({ ...e, carried: true, from: d.id })
  return newMeeting({
    id, owner, at, title: d.title, date, time: d.time, goal: d.goal, cadence: d.cadence === 'none' ? 'weekly' : d.cadence,
    items: d.items.filter(x => !x.from).map(x => ({ ...x, by: x.by })),
    attendees: d.attendees, cost: d.cost, team: d.teamId ? { id: d.teamId, name: d.teamName } : null,
    series: { id: d.series?.id ?? d.id, n: (d.series?.n ?? 1) + 1, prevId: d.id, nextId: null },
    carried: {
      actions: d.actions.filter(x => !x.done && !x.movedTo).map(carry),
      parking: d.parking.filter(x => !x.resolved && !x.movedTo).map(e => ({ ...carry(e), itemId: null })),
      topics: d.topics.filter(x => x.status === 'open').map(e => ({ ...carry(e), votes: {} })),
    },
  })
}

export function status(d, today = todayStr()) {
  if (d.run.status === 'running' || d.run.status === 'paused') return 'live'
  if (d.run.status === 'done') return 'done'
  if (d.date && d.date < today) return 'past'
  return 'planned'
}

const fmtMin = ms => Math.round((ms ?? 0) / MIN)
// Minutes for display: anything under a minute but above zero reads as "<1".
export const usedMin = ms => (ms > 0 && ms < 30000 ? '<1' : Math.round((ms ?? 0) / MIN))

// Lean Coffee topics discussed under one agenda item, in the order they were taken.
export const discussedTopics = (d, itemId) => d.topics.filter(x => x.itemId === itemId && x.startedAt).sort((a, b) => a.startedAt - b.startedAt)
export const topicEntries = (d, tid) => ['decisions', 'actions', 'notes'].flatMap(coll => d[coll].filter(e => e.topicId === tid).map(e => ({ ...e, coll }))).sort((a, b) => a.at - b.at)

// Meeting minutes as Markdown (or plain text for email and chat).
// format: 'md' (Markdown, also fine for Teams), 'text' (email) or 'slack' (Slack mrkdwn: *bold*).
export function minutesText(d, t, lang, { markdown = true, format = markdown ? 'md' : 'text', url = '' } = {}) {
  markdown = format === 'md'
  const slack = format === 'slack'
  const h = (n, s) => (markdown ? `${'#'.repeat(n)} ${s}` : slack ? `*${s}*` : n === 1 ? s.toUpperCase() : s)
  const b = s => (markdown ? `**${s}**` : slack ? `*${s}*` : s)
  const out = [h(1, d.title || t.untitled)]
  const when = [d.date && fmtDate(d.date, lang, true), d.time].filter(Boolean).join(' · ')
  if (when) out.push(when)
  const present = Object.values(d.people).map(p => p.name).filter(Boolean)
  const names = [...new Set([...d.attendees, ...present])]
  if (names.length) out.push(`${t.attendees}${t.colon ?? ': '}${names.join(', ')}`)
  out.push('')
  if (d.goal) out.push(`${b(t.goal)}${t.colon ?? ': '}${d.goal}`, '')
  if (d.outcome) out.push(h(2, t.outcome), '', d.outcome, '')
  out.push(h(2, t.decisions), '')
  if (!d.decisions.length) out.push(`- ${t.none}`)
  for (const x of d.decisions) out.push(`- ${x.text}`)
  out.push('', h(2, t.actionItems), '')
  if (!d.actions.length) out.push(`- ${t.none}`)
  for (const x of d.actions) out.push(`- ${markdown ? `[${x.done ? 'x' : ' '}] ` : x.done ? '✓ ' : '☐ '}${x.text}${x.owner ? ` — ${x.owner}` : ''}${x.due ? ` (${t.due} ${fmtDate(x.due, lang)})` : ''}${x.movedTo ? ` — ${t.movedShort}` : ''}`)
  out.push('', h(2, t.agendaNotes), '')
  d.items.forEach((x, i) => {
    const used = fmtMin(d.spent[x.id])
    out.push(`${i + 1}. ${b(x.title)} — ${used ? `${used}/${x.minutes}` : x.minutes} min${x.owner ? ` · ${x.owner}` : ''}`)
    for (const n of d.notes.filter(n => n.itemId === x.id && !n.topicId)) out.push(`   - ${n.text}`)
    for (const n of d.decisions.filter(n => n.itemId === x.id && !n.topicId)) out.push(`   - ${t.kinds.decisions}${t.colon ?? ': '}${n.text}`)
    for (const tp of discussedTopics(d, x.id)) {
      out.push(`   - ${b(tp.text)} (${voteCount(tp)} ${t.votesWord})`)
      for (const n of topicEntries(d, tp.id)) out.push(`     - ${n.coll === 'decisions' ? `${t.kinds.decisions}${t.colon ?? ': '}` : n.coll === 'actions' ? `${t.kinds.actions}${t.colon ?? ': '}` : ''}${n.text}${n.owner ? ` — ${n.owner}` : ''}`)
    }
  })
  const loose = d.notes.filter(n => !d.items.some(x => x.id === n.itemId))
  for (const n of loose) out.push(`- ${n.text}`)
  const lot = d.parking.filter(x => !x.resolved)
  if (lot.length) {
    out.push('', h(2, t.parking), '')
    for (const x of lot) out.push(`- ${x.text}`)
  }
  if (d.run.startedAt) {
    const total = d.items.reduce((n, x) => n + (d.spent[x.id] ?? 0), 0)
    out.push('', `${t.timeUsed}${t.colon ?? ': '}${fmtMin(total)} / ${plannedMinutes(d)} min`)
  }
  if (url) out.push('', `${t.fullMinutes ?? 'Full minutes'}${t.colon ?? ': '}${url}`)
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

export function fmtDate(date, lang, long = false) {
  if (!isDate(date)) return ''
  const [y, m, dd] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, dd)
  return dt.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })
}

export function clockAt(time, offset) {
  if (!isTime(time)) return null
  const [h, m] = time.split(':').map(Number)
  const x = (h * 60 + m + offset + 24 * 60) % (24 * 60)
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}

export function fmtClock(ms) {
  const neg = ms < 0
  const s = Math.ceil(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
  return neg ? `+${body}` : body
}

// ---------- calendar (.ics) ----------

const icsEsc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// Lines longer than 75 octets are folded (RFC 5545), never splitting a UTF-8 character.
function fold(lineStr) {
  const enc = new TextEncoder()
  if (enc.encode(lineStr).length <= 75) return lineStr
  const parts = []
  let cur = ''
  for (const ch of lineStr) {
    if (enc.encode(cur + ch).length > (parts.length ? 74 : 75)) { parts.push(cur); cur = '' }
    cur += ch
  }
  parts.push(cur)
  return parts.join('\r\n ')
}
const RRULE = { daily: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY' }
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// One event for the meeting (a repeating one for a series), at local "floating" time so it shows
// at the clock time entered wherever it is imported. `now` is passed in for DTSTAMP.
export function meetingIcs(d, { url, t, now }) {
  if (!isDate(d.date)) return null
  const day = d.date.replace(/-/g, '')
  const mins = Math.max(15, plannedMinutes(d))
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lift Apps by AIYun//MeetingLift//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${d.series?.id ?? d.id}@liftapps.com.au`, `DTSTAMP:${stamp(now)}`]
  if (isTime(d.time)) {
    const [hh, mm] = d.time.split(':').map(Number)
    const start = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6), hh, mm))
    const end = new Date(start.getTime() + mins * MIN)
    const f = x => x.toISOString().replace(/[-:]/g, '').slice(0, 15)
    lines.push(`DTSTART:${f(start)}`, `DTEND:${f(end)}`)
  } else {
    const next = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6) + 1)).toISOString().slice(0, 10).replace(/-/g, '')
    lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`)
  }
  if (RRULE[d.cadence]) lines.push(`RRULE:${RRULE[d.cadence]}`)
  const agenda = d.items.map((x, i) => `${i + 1}. ${x.title} (${x.minutes} min)`).join('\n')
  const desc = [d.goal && `${t.goal}${t.colon ?? ': '}${d.goal}`, agenda && `${t.agenda}${t.colon ?? ': '}\n${agenda}`, url && `${t.joinLink}${t.colon ?? ': '}${url}`].filter(Boolean).join('\n\n')
  lines.push(`SUMMARY:${icsEsc(d.title || t.untitled)}`, `DESCRIPTION:${icsEsc(desc)}`)
  if (url) lines.push(`URL:${url}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// mailto: links break past roughly 2,000 characters, so long minutes are cut at a line break and
// end with a link to the full version.
export function mailtoMinutes(d, t, lang, url, limit = 1800) {
  const subject = `${t.minutesDoc}${t.colon ?? ': '}${d.title || t.untitled}${d.date ? ` (${fmtDate(d.date, lang)})` : ''}`
  let body = minutesText(d, t, lang, { format: 'text' })
  const tail = `\n${t.fullMinutes ?? 'Full minutes'}${t.colon ?? ': '}${url}\n`
  if (encodeURIComponent(body + tail).length > limit) {
    let cut = body
    while (cut.length && encodeURIComponent(cut + "\n…\n" + tail).length > limit) cut = cut.slice(0, cut.lastIndexOf('\n', cut.length - 2))
    body = cut + '\n…\n'
  }
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + tail)}`
}
