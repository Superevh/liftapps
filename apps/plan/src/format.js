import { parts, today } from './dates.js'

// "Oct – Dec 2026", "Oct 2026 – Feb 2027"
export function dateRange(t, start, end) {
  if (!start) return ''
  const a = parts(start), b = parts(end)
  return t.range(t.monthYear(a.y, a.m), t.monthYear(b.y, b.m))
}
export const longDate = (t, s) => { if (!s) return ''; const { y, m, d } = parts(s); return t.shortDate(y, m, d) }
// "12 Mar" this year, "12 Mar 2027" otherwise.
export const dayMonth = (t, s) => { if (!s) return ''; const { y, m, d } = parts(s); return t.dayMonth(y, m, d, y !== parts(today()).y) }
export const dayRange = (t, a, b) => (a === b ? dayMonth(t, a) : t.range(dayMonth(t, a), dayMonth(t, b)))
// Item schedule as shown on cards and rows: dates, or the horizon when it has none.
export const when = (t, it) => (it.start ? dayRange(t, it.start, it.end) : t.hz[it.horizon] || t.noDates)
