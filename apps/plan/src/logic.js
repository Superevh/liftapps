// Pure helpers shared by the views: filters, grouping, Now/Next/Later buckets, dependency checks,
// the change log and exports.
import { today, addMonths, addDays, toDay, parts, ymd } from './dates.js'
import { STATUSES, LOG_MAX, uid } from './store.js'

// ---------- Now / Next / Later ----------
export function bucket(it, now, soon) {
  if (it.status === 'done') return 'done'
  if (!it.start) return it.horizon || 'later'
  if (it.status === 'progress' || it.start <= now) return 'now'
  return it.start <= soon ? 'next' : 'later'
}

// What changes when an item is dropped into a column. Durations are kept.
//   Now   → start today (unless it has already started), status "in progress"
//   Next  → start on the 1st of next month;  Later → the 1st of the month 4 months from now
//   Done  → status done, dates unchanged
// Unscheduled items just change horizon. Next / Later drop "in progress" / "done" back to "planned".
export function movePatch(it, col, now = today()) {
  const p = {}
  if (!it.start) {
    if (col === 'done') { if (it.status !== 'done') Object.assign(p, { status: 'done', progress: 100 }) } else {
      if (it.horizon !== col) p.horizon = col
      if (it.status === 'done') p.status = 'planned'
      if (col === 'now' && (it.status === 'idea' || it.status === 'planned')) p.status = 'progress'
    }
    return p
  }
  const dur = toDay(it.end) - toDay(it.start)
  const at = start => ({ start, end: addDays(start, dur) })
  const { y, m } = parts(now)
  if (col === 'now') {
    if (it.start > now) Object.assign(p, at(now))
    if (it.status !== 'progress' && it.status !== 'risk') p.status = 'progress'
  } else if (col === 'next' || col === 'later') {
    const start = ymd(y, m + (col === 'next' ? 1 : 4), 1)
    if (it.start !== start) Object.assign(p, at(start))
    if (it.status === 'progress' || it.status === 'done') p.status = 'planned'
  } else if (col === 'done' && it.status !== 'done') Object.assign(p, { status: 'done', progress: 100 })
  return p
}

// Explicit order first (set by dragging), then by start date and lane.
export function columns(rm, items, showDone, now = today()) {
  const soon = addMonths(now, 3)
  const laneOrder = new Map(rm.lanes.map((l, i) => [l.id, i]))
  const has = v => typeof v === 'number'
  const groups = { now: [], next: [], later: [], done: [] }
  const sorted = [...items].sort((a, b) => {
    if (has(a.order) !== has(b.order)) return has(a.order) ? -1 : 1
    if (has(a.order) && a.order !== b.order) return a.order - b.order
    const sa = a.start || '9999', sb = b.start || '9999'
    if (sa !== sb) return sa < sb ? -1 : 1
    return (laneOrder.get(a.laneId) ?? 0) - (laneOrder.get(b.laneId) ?? 0)
  })
  for (const it of sorted) groups[bucket(it, now, soon)].push(it)
  if (!showDone) delete groups.done
  return groups
}

// ---------- filters ----------
export const NO_FILTERS = { q: '', status: [], owner: [], tag: [], lane: [] }
export const filterCount = f => (f.q.trim() ? 1 : 0) + f.status.length + f.owner.length + f.tag.length + f.lane.length
export function applyFilters(items, f) {
  if (!filterCount(f)) return items
  const q = f.q.trim().toLowerCase()
  return items.filter(it =>
    (!q || [it.title, it.desc, it.owner, ...it.tags].some(s => s && s.toLowerCase().includes(q))) &&
    (!f.status.length || f.status.includes(it.status)) &&
    (!f.owner.length || f.owner.includes(it.owner || '')) &&
    (!f.tag.length || it.tags.some(x => f.tag.includes(x)) || (f.tag.includes('') && !it.tags.length)) &&
    (!f.lane.length || f.lane.includes(it.laneId)))
}
export const ownersOf = rm => [...new Set(rm.items.map(i => i.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b))
export const tagsOf = rm => [...new Set(rm.items.flatMap(i => i.tags))].sort((a, b) => a.localeCompare(b))

// ---------- grouping (timeline rows) ----------
// Each row: { key, label, color, field, value }. `field`/`value` say what moving an item into the row changes.
export function rowsFor(rm, items, groupBy, t) {
  if (groupBy === 'status') return STATUSES.map(s => ({ key: s, label: t.st[s], status: s, field: 'status', value: s }))
  if (groupBy === 'owner') {
    const names = [...new Set(items.map(i => i.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    const rows = names.map(n => ({ key: 'o:' + n, label: n, field: 'owner', value: n }))
    if (!rows.length || items.some(i => !i.owner)) rows.push({ key: 'o:', label: t.unassigned, field: 'owner', value: '', muted: true })
    return rows
  }
  if (groupBy === 'theme') {
    const names = [...new Set(items.map(i => i.tags[0]).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    const rows = names.map(n => ({ key: 't:' + n, label: n, field: null }))
    if (!rows.length || items.some(i => !i.tags.length)) rows.push({ key: 't:', label: t.noTheme, field: null, muted: true })
    return rows
  }
  return rm.lanes.map(l => ({ key: l.id, label: l.name, color: l.color, lane: l, field: 'laneId', value: l.id }))
}
export function rowKeyOf(it, groupBy) {
  if (groupBy === 'status') return it.status
  if (groupBy === 'owner') return 'o:' + (it.owner || '')
  if (groupBy === 'theme') return 't:' + (it.tags[0] || '')
  return it.laneId
}

// ---------- dependencies ----------
// A dependency is in conflict when the item it waits for ends on or after the day the dependent item starts
// (unless that item is already done).
export function depInfo(rm) {
  const byId = new Map(rm.items.map(i => [i.id, i]))
  const conflicts = new Set()
  const waitsOn = new Map(), blocks = new Map()
  for (const d of rm.deps) {
    const a = byId.get(d.from), b = byId.get(d.to)
    if (!a || !b) continue
    const bad = !!(a.start && b.start && a.end >= b.start && a.status !== 'done')
    if (bad) conflicts.add(d.id)
    if (!waitsOn.has(b.id)) waitsOn.set(b.id, [])
    waitsOn.get(b.id).push({ dep: d, item: a, bad })
    if (!blocks.has(a.id)) blocks.set(a.id, [])
    blocks.get(a.id).push({ dep: d, item: b, bad })
  }
  const late = new Set([...waitsOn].filter(([, list]) => list.some(x => x.bad)).map(([id]) => id))
  return { conflicts, waitsOn, blocks, late }
}
// Would "to waits on from" create a loop?
export function wouldCycle(deps, from, to) {
  if (from === to) return true
  const next = new Map()
  for (const d of deps) { if (!next.has(d.from)) next.set(d.from, []); next.get(d.from).push(d.to) }
  const seen = new Set(), stack = [to]
  while (stack.length) {
    const x = stack.pop()
    if (x === from) return true
    if (seen.has(x)) continue
    seen.add(x)
    stack.push(...(next.get(x) || []))
  }
  return false
}

// ---------- change log ----------
const sameVal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// Adds a change, folding repeated edits of the same thing by the same person within 10 minutes into one entry
// (a drag produces dozens of date changes; stakeholders want "moved from A to B").
export function addChange(log, e) {
  const last = [...log].reverse().find(x => x.item === e.item && x.kind === e.kind && x.wid === e.wid && e.at - x.at < 600000)
  if (last && ['dates', 'status', 'lane', 'mdate'].includes(e.kind)) {
    const rest = log.filter(x => x !== last)
    if (sameVal(last.from, e.to)) return rest
    return [...rest, { ...last, at: e.at, to: e.to, title: e.title }]
  }
  if (e.kind === 'delete' || e.kind === 'mdelete') {
    // Added and removed again within the window: nothing for stakeholders to see.
    const added = log.find(x => x.item === e.item && x.kind === (e.kind === 'delete' ? 'add' : 'madd') && x.wid === e.wid && e.at - x.at < 600000)
    if (added) return log.filter(x => x.item !== e.item)
  }
  const next = [...log, { id: uid(), ...e }]
  return next.length > LOG_MAX ? next.slice(next.length - LOG_MAX) : next
}
export const slipDays = e => (e.kind === 'dates' && e.from?.[1] && e.to?.[1] ? toDay(e.to[1]) - toDay(e.from[1]) : e.kind === 'mdate' && e.from && e.to ? toDay(e.to) - toDay(e.from) : 0)

// ---------- exports ----------
const csvCell = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s }
export function toCSV(rm, items, t) {
  const lane = new Map(rm.lanes.map(l => [l.id, l.name]))
  const title = new Map(rm.items.map(i => [i.id, i.title]))
  const head = [t.csv.type, t.lane, t.title, t.status, t.owner, t.start, t.end, t.horizon, t.progress, t.priority, t.size, t.themes, t.dependsOn, t.description, t.links]
  const rows = items.map(i => [t.csv.item, lane.get(i.laneId) || '', i.title, t.st[i.status], i.owner, i.start, i.end, i.start ? '' : t.hz[i.horizon], i.progress, i.priority ? t.pr[i.priority] : '', i.size,
    i.tags.join('; '), rm.deps.filter(d => d.to === i.id).map(d => title.get(d.from)).filter(Boolean).join('; '), i.desc, i.links.map(l => l.url).join(' ')])
  const ms = rm.milestones.map(m => [m.kind === 'release' ? t.release : t.milestone, lane.get(m.laneId) || '', m.title, '', '', m.date, m.date, '', '', '', '', '', '', m.note, ''])
  return '﻿' + [head, ...rows, ...ms].map(r => r.map(csvCell).join(',')).join('\r\n')
}

export function toMarkdown(rm, items, t, { plain = false, fmtRange, fmtDate } = {}) {
  const lane = new Map(rm.lanes.map(l => [l.id, l.name]))
  const b = s => (plain ? s : `**${s}**`)
  const groups = columns(rm, items, true)
  const out = [plain ? rm.name : `# ${rm.name}`]
  if (rm.desc) out.push(rm.desc)
  out.push(plain ? t.updatedOn(fmtDate(today())) : `_${t.updatedOn(fmtDate(today()))}_`)
  for (const [k, label] of [['now', t.now], ['next', t.next], ['later', t.later], ['done', t.doneCol]]) {
    if (!groups[k].length) continue
    out.push('', plain ? label.toUpperCase() : `## ${label}`)
    for (const i of groups[k]) {
      const bits = [lane.get(i.laneId), i.owner, i.start ? fmtRange(i.start, i.end) : '', t.st[i.status] + (i.progress && i.status !== 'done' ? ` ${i.progress}%` : '')].filter(Boolean)
      out.push(`- ${b(i.title || t.untitledItem)} — ${bits.join(' · ')}`)
    }
  }
  const ms = [...rm.milestones].sort((a, c) => (a.date < c.date ? -1 : 1))
  if (ms.length) {
    out.push('', plain ? t.milestones.toUpperCase() : `## ${t.milestones}`)
    for (const m of ms) out.push(`- ${fmtDate(m.date)} — ${b(m.title || t.untitledMilestone)}${m.kind === 'release' ? ` (${t.release})` : ''}`)
  }
  return out.join('\n')
}

export function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const slug = s => (s || 'roadmap').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'roadmap'
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* unsupported */ }
    ta.remove()
    return ok
  }
}
export const initials = name => (name || '?').trim().split(/\s+/).map(w => [...w][0]).slice(0, 2).join('').toUpperCase()
