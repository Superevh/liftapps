// Date-only helpers. Dates are stored as "YYYY-MM-DD" strings and handled in UTC so time zones never shift them.
const DAY = 86400000
export const pad = n => String(n).padStart(2, '0')
export const parts = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d } }
export const toDay = s => { const { y, m, d } = parts(s); return Date.UTC(y, m - 1, d) / DAY }
export const fromDay = n => new Date(n * DAY).toISOString().slice(0, 10)
export const addDays = (s, k) => fromDay(toDay(s) + k)
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
export const ymd = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.toISOString().slice(0, 10) }
export const addMonths = (s, k) => { const { y, m, d } = parts(s); return ymd(y, m + k, Math.min(d, daysIn(y, m + k))) }
export const today = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` }
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDay(s))

// A run of whole months starting at {y, m}. x positions are proportional within each month,
// so month boundaries always line up with the grid.
export function makeScale(y0, m0, count, monthW) {
  const idxOf = (y, m) => (y - y0) * 12 + (m - m0)
  const x = s => { const { y, m, d } = parts(s); return idxOf(y, m) * monthW + ((d - 1) / daysIn(y, m)) * monthW }
  // Bars are inclusive of their end day, so they extend to the start of the next day.
  const xEnd = s => x(addDays(s, 1))
  const date = px => {
    const i = Math.floor(px / monthW)
    const t = new Date(Date.UTC(y0, m0 - 1 + i, 1))
    const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1
    const frac = (px - i * monthW) / monthW
    return ymd(y, m, Math.min(daysIn(y, m), 1 + Math.floor(frac * daysIn(y, m))))
  }
  const months = Array.from({ length: count }, (_, i) => { const t = new Date(Date.UTC(y0, m0 - 1 + i, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 } })
  return { x, xEnd, date, months, width: count * monthW, monthW }
}

// Visible range: whole quarters covering every item and today, at least 12 months.
export function rangeFor(items, now, minMonths = 12) {
  let lo = addMonths(now, -2), hi = addMonths(now, 7)
  for (const it of items) { if (it.start < lo) lo = it.start; if (it.end > hi) hi = it.end }
  const a = parts(lo), b = parts(hi)
  const y0 = a.y, m0 = Math.floor((a.m - 1) / 3) * 3 + 1
  let count = (b.y - y0) * 12 + (Math.floor((b.m - 1) / 3) * 3 + 3) - m0 + 1
  if (count < Math.max(12, minMonths)) count = Math.max(12, minMonths)
  return { y0, m0, count: Math.min(count, 120) }
}
