// Meeting cost maths. Everything is pure so it can be unit-checked with node.
// A running meeting is a list of segments { from, to, perHour }: each one has a constant cost
// per hour, and a new segment starts whenever someone joins or leaves. Cost and time are
// always worked out from timestamps, so a tab in the background never drifts.

// Rough price level per currency, used only to rescale the "≈ N coffees" prices when the
// currency changes.
export const CURRENCIES = {
  USD: 1, EUR: 0.95, GBP: 0.8, CNY: 7.2, JPY: 150, AUD: 1.5, CAD: 1.4, CHF: 0.9, INR: 85, SGD: 1.35, NZD: 1.7, HKD: 7.8,
}

// Things to compare the cost with, priced in USD (rescaled for other currencies).
export const TREATS = [
  { id: 'coffee', emoji: '☕', price: 4 },
  { id: 'pizza', emoji: '🍕', price: 18 },
  { id: 'book', emoji: '📚', price: 20 },
]

// How often a recurring meeting happens, as occurrences per week.
export const FREQUENCIES = { daily: 5, twice: 2, weekly: 1, biweekly: 0.5, monthly: 12 / 52 }

export const newId = () => Math.random().toString(36).slice(2, 10)

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function blankSetup(roleNames = ['Engineer', 'Product manager', 'Designer']) {
  return {
    title: '', currency: 'USD', mode: 'simple', overhead: 1, hoursPerYear: 1800, planned: 30,
    simple: { count: 6, rate: 60, unit: 'hour' },
    roles: [
      { id: newId(), name: roleNames[0], count: 4, rate: 120000, unit: 'year' },
      { id: newId(), name: roleNames[1], count: 1, rate: 130000, unit: 'year' },
      { id: newId(), name: roleNames[2], count: 1, rate: 110000, unit: 'year' },
    ],
    treats: Object.fromEntries(TREATS.map(x => [x.id, x.price])),
  }
}

// Cost of one person for one hour.
export const hourlyOf = (rate, unit, hoursPerYear) => unit === 'year' ? num(rate) / Math.max(1, num(hoursPerYear, 1800)) : num(rate)

// Head count and total cost per hour of everyone in the room, overheads included.
export function teamRate(setup) {
  const overhead = num(setup.overhead, 1) || 1
  if (setup.mode === 'roles') {
    let people = 0
    let perHour = 0
    for (const r of setup.roles) {
      const n = Math.floor(num(r.count))
      people += n
      perHour += n * hourlyOf(r.rate, r.unit, setup.hoursPerYear)
    }
    return { people, perHour: perHour * overhead }
  }
  const people = Math.floor(num(setup.simple.count))
  return { people, perHour: people * hourlyOf(setup.simple.rate, setup.simple.unit, setup.hoursPerYear) * overhead }
}

export const isRunning = segs => segs.length > 0 && segs[segs.length - 1].to == null

export function start(segs, now, perHour) {
  return isRunning(segs) ? segs : [...segs, { from: now, to: null, perHour }]
}

export function pause(segs, now) {
  return isRunning(segs) ? segs.map((s, i) => (i === segs.length - 1 ? { ...s, to: Math.max(s.from, now) } : s)) : segs
}

// Someone joined or left: close the open segment and carry on at the new rate.
export function changeRate(segs, now, perHour) {
  if (!isRunning(segs)) return segs
  const last = segs[segs.length - 1]
  if (last.perHour === perHour) return segs
  // A change within the same millisecond just replaces the rate.
  if (now <= last.from) return [...segs.slice(0, -1), { ...last, perHour }]
  return [...pause(segs, now), { from: now, to: null, perHour }]
}

export const elapsedMs = (segs, now) => segs.reduce((ms, s) => ms + Math.max(0, (s.to ?? now) - s.from), 0)

export const costOf = (segs, now) => segs.reduce((c, s) => c + (s.perHour * Math.max(0, (s.to ?? now) - s.from)) / 3600000, 0)

// Cost of a recurring meeting, and how many hours of people's time it takes.
export function recurring({ minutes, perWeek, people, rate, weeks }) {
  const each = (num(minutes) / 60) * num(people) * num(rate)
  const week = each * num(perWeek)
  const w = num(weeks, 46)
  return { each, week, month: (week * w) / 12, year: week * w, personHours: (num(minutes) / 60) * num(people) * num(perWeek) * w }
}

export function rescaleTreats(treats, from, to) {
  const k = (CURRENCIES[to] ?? 1) / (CURRENCIES[from] ?? 1)
  const nice = v => (v >= 100 ? Math.round(v / 10) * 10 : v >= 10 ? Math.round(v) : Math.round(v * 2) / 2)
  return Object.fromEntries(Object.entries(treats).map(([id, v]) => [id, nice(num(v) * k)]))
}

export function historyCsv(history) {
  const q = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return ['title,date,minutes,people,cost,currency',
    ...history.map(h => [h.title, new Date(h.at).toISOString(), (h.ms / 60000).toFixed(1), h.people, h.cost.toFixed(2), h.currency].map(x => q(String(x))).join(','))].join('\n')
}

// Share links carry the setup (including the rates entered) but never the meeting history.
export function encodeSetup(setup) {
  const { title, currency, mode, overhead, hoursPerYear, planned, simple, roles, treats } = setup
  const bytes = new TextEncoder().encode(JSON.stringify({ title, currency, mode, overhead, hoursPerYear, planned, simple, roles: roles.map(({ id, ...r }) => r), treats }))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSetup(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))))
    if (!d || typeof d !== 'object') return null
    const base = blankSetup()
    const unit = u => (u === 'year' ? 'year' : 'hour')
    return {
      ...base,
      title: String(d.title ?? '').slice(0, 80),
      currency: CURRENCIES[d.currency] ? d.currency : base.currency,
      mode: d.mode === 'roles' ? 'roles' : 'simple',
      overhead: num(d.overhead, 1) || 1,
      hoursPerYear: num(d.hoursPerYear, 1800) || 1800,
      planned: num(d.planned, 0),
      simple: d.simple ? { count: num(d.simple.count), rate: num(d.simple.rate), unit: unit(d.simple.unit) } : base.simple,
      roles: Array.isArray(d.roles) ? d.roles.slice(0, 30).map(r => ({ id: newId(), name: String(r.name ?? '').slice(0, 40), count: num(r.count), rate: num(r.rate), unit: unit(r.unit) })) : base.roles,
      treats: { ...base.treats, ...(d.treats && typeof d.treats === 'object' ? Object.fromEntries(Object.entries(d.treats).filter(([k]) => k in base.treats).map(([k, v]) => [k, num(v)])) : {}) },
    }
  } catch { return null }
}
