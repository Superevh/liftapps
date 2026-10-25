import { parts } from './dates.js'
export function dateRange(t, start, end) {
  const a = parts(start), b = parts(end)
  return t.range(t.monthYear(a.y, a.m), t.monthYear(b.y, b.m))
}
export const longDate = (t, s) => { const { y, m, d } = parts(s); return t.shortDate(y, m, d) }
