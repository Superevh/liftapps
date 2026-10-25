// CSV reading and column detection for exports from Jira, Linear, Azure DevOps, GitHub and plain sheets.

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const delim = guessDelimiter(text)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(x => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some(x => x.trim() !== '')) rows.push(row)
  if (!rows.length) return { headers: [], rows: [] }
  const headers = rows[0].map(h => h.replace(/^﻿/, '').trim())
  return { headers, rows: rows.slice(1) }
}

function guessDelimiter(text) {
  const line = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length)
  const counts = [',', ';', '\t'].map(d => [d, line.split(d).length])
  return counts.sort((a, b) => b[1] - a[1])[0][0]
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Accepts ISO dates, Jira's "12/Oct/24 3:15 PM", "12 Oct 2024", and day-first or month-first
// slashed dates (`dayFirst` decides the ambiguous ones like 03/04/2024).
export function parseDate(raw, dayFirst = false) {
  const s = (raw ?? '').trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], m[2] - 1, +m[3])
  m = s.match(/^(\d{1,2})[/\- ]([A-Za-z]{3})[A-Za-z]*[/\- ,]+(\d{2,4})/)
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return new Date(year(m[3]), MONTHS[m[2].toLowerCase()], +m[1])
  m = s.match(/^([A-Za-z]{3})[A-Za-z]* (\d{1,2}),? (\d{4})/)
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) return new Date(+m[3], MONTHS[m[1].toLowerCase()], +m[2])
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/)
  if (m) {
    let [a, b] = [+m[1], +m[2]]
    if (a > 12) dayFirst = true
    else if (b > 12) dayFirst = false
    const [day, month] = dayFirst ? [a, b] : [b, a]
    return new Date(year(m[3]), month - 1, day)
  }
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const year = y => (y.length === 2 ? 2000 + +y : +y)

// Header names used by common tools, most specific first.
const GUESS = {
  id: [/^(issue )?key$/i, /^id$/i, /^issue id$/i, /^work item id$/i, /^identifier$/i, /^number$/i, /^#$/],
  title: [/^summary$/i, /^title$/i, /^name$/i, /^subject$/i],
  type: [/^issue ?type$/i, /^work item type$/i, /^type$/i, /^labels?$/i],
  start: [/^start(ed)?( date| at)?$/i, /in progress/i, /^activated date$/i, /^started$/i, /^date started$/i, /^commit/i, /^doing$/i, /^created( date| at)?$/i],
  done: [/^(resolved|resolution date)$/i, /^done( date| at)?$/i, /^completed( date| at)?$/i, /^closed( date| at)?$/i, /^finished( date| at)?$/i, /^end( date)?$/i],
}

export function guessColumns(headers) {
  const pick = {}
  for (const [field, patterns] of Object.entries(GUESS)) {
    for (const p of patterns) {
      const i = headers.findIndex((h, idx) => p.test(h) && !Object.values(pick).includes(idx))
      if (i >= 0) { pick[field] = i; break }
    }
  }
  return pick
}

// Day-first if any slashed date column has a first part above 12.
export function guessDayFirst(rows, cols) {
  for (const r of rows.slice(0, 200)) for (const c of cols) {
    const m = (r[c] ?? '').match(/^(\d{1,2})[/.](\d{1,2})[/.]/)
    if (m && +m[1] > 12) return true
    if (m && +m[2] > 12) return false
  }
  return false
}

export function toItems({ rows }, map, dayFirst) {
  const items = []
  rows.forEach((r, n) => {
    const start = map.start >= 0 ? parseDate(r[map.start], dayFirst) : null
    const done = map.done >= 0 ? parseDate(r[map.done], dayFirst) : null
    if (!start && !done) return
    items.push({
      id: (map.id >= 0 && r[map.id]?.trim()) || `#${n + 1}`,
      title: map.title >= 0 ? r[map.title]?.trim() ?? '' : '',
      type: map.type >= 0 ? r[map.type]?.trim() || '—' : '—',
      // Without a start date, treat the item as started on the day it finished.
      start: start ?? done,
      done,
    })
  })
  return items
}

// Plain throughput: one number per line (items per day or per week), oldest first.
export function parseThroughputList(text) {
  return text.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).map(Number).filter(x => Number.isFinite(x) && x >= 0)
}

export function itemsToCsv(items) {
  const iso = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''
  const q = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  return ['id,title,type,start,done', ...items.map(i => [i.id, i.title, i.type, iso(i.start), iso(i.done)].map(x => q(String(x))).join(','))].join('\n')
}
