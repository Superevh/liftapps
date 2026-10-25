// Function point count (IFPUG-style): a JSON document folded from an ordered log of actions.
// The reducer is pure: ids derive from the action nonce, time only from action.at, so every
// browser folding the same log reaches the same count.

export const TYPES = ['EI', 'EO', 'EQ', 'ILF', 'EIF']
export const LEVELS = ['low', 'avg', 'high']

// Standard IFPUG complexity weights.
export const WEIGHTS = {
  EI: { low: 3, avg: 4, high: 6 },
  EO: { low: 4, avg: 5, high: 7 },
  EQ: { low: 3, avg: 4, high: 6 },
  ILF: { low: 7, avg: 10, high: 15 },
  EIF: { low: 5, avg: 7, high: 10 },
}

// The 14 general system characteristics, each rated 0 (no influence) to 5 (strong influence).
export const GSC_COUNT = 14
export const MAX_FUNCTIONS = 300

const clean = (s, n) => String(s ?? '').slice(0, n)
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)))
const clampNum = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo }
const okType = t => TYPES.includes(t)
const okLevel = l => LEVELS.includes(l)

export function newCount({ id, name, owner, at }) {
  return {
    id, kind: 'fpa', name: clean(name, 120), ownerId: owner.id, creatorId: owner.id, createdAt: at,
    functions: [],
    vafOn: false, gsc: Array(GSC_COUNT).fill(0),
    hoursPerFp: '', hoursPerDay: 8,
  }
}

export function reduce(doc, a) {
  if (!doc) return doc
  switch (a.type) {
    case 'RENAME': return { ...doc, name: clean(a.name, 120) || doc.name }
    case 'ADD_FN': {
      if (doc.functions.length >= MAX_FUNCTIONS || !okType(a.fnType) || !okLevel(a.level)) return doc
      const fn = { id: a.nonce.slice(0, 10), name: clean(a.name, 160), type: a.fnType, level: a.level, notes: clean(a.notes, 400), by: clean(a.by, 40), at: a.at }
      return { ...doc, functions: [...doc.functions, fn] }
    }
    case 'UPDATE_FN': {
      const patch = {}
      if ('name' in a) patch.name = clean(a.name, 160)
      if ('notes' in a) patch.notes = clean(a.notes, 400)
      if ('fnType' in a && okType(a.fnType)) patch.type = a.fnType
      if ('level' in a && okLevel(a.level)) patch.level = a.level
      return { ...doc, functions: doc.functions.map(f => (f.id === a.fid ? { ...f, ...patch } : f)) }
    }
    case 'REMOVE_FN': return { ...doc, functions: doc.functions.filter(f => f.id !== a.fid) }
    case 'VAF_ON': return { ...doc, vafOn: !!a.on }
    case 'SET_GSC': {
      const i = clampInt(a.index, 0, GSC_COUNT - 1)
      const gsc = [...doc.gsc]
      gsc[i] = clampInt(a.value, 0, 5)
      return { ...doc, gsc }
    }
    case 'RESET_GSC': return { ...doc, gsc: Array(GSC_COUNT).fill(a.value == null ? 0 : clampInt(a.value, 0, 5)) }
    case 'SET_RATE': {
      const next = { ...doc }
      if ('hoursPerFp' in a) next.hoursPerFp = a.hoursPerFp === '' ? '' : clampNum(a.hoursPerFp, 0, 1000)
      if ('hoursPerDay' in a) next.hoursPerDay = clampNum(a.hoursPerDay, 1, 24)
      return next
    }
    default: return doc
  }
}

export const weightOf = f => WEIGHTS[f.type]?.[f.level] ?? 0

// Everything the screen and the exports show, derived from the document.
export function compute(doc) {
  const matrix = Object.fromEntries(TYPES.map(t => [t, Object.fromEntries(LEVELS.map(l => [l, 0]))]))
  for (const f of doc.functions) if (matrix[f.type]) matrix[f.type][f.level] += 1
  const rows = TYPES.map(t => {
    const cells = LEVELS.map(l => ({ level: l, count: matrix[t][l], weight: WEIGHTS[t][l], points: matrix[t][l] * WEIGHTS[t][l] }))
    return { type: t, cells, count: cells.reduce((n, c) => n + c.count, 0), points: cells.reduce((n, c) => n + c.points, 0) }
  })
  const ufp = rows.reduce((n, r) => n + r.points, 0)
  const tdi = doc.gsc.reduce((n, v) => n + v, 0)
  const vaf = round(0.65 + 0.01 * tdi, 2)
  const afp = doc.vafOn ? round(ufp * vaf, 2) : ufp
  const rate = doc.hoursPerFp === '' ? null : Number(doc.hoursPerFp)
  const hours = rate ? round(afp * rate, 1) : null
  const days = hours != null ? round(hours / (doc.hoursPerDay || 8), 1) : null
  return { rows, ufp, tdi, vaf, afp, hours, days, count: doc.functions.length }
}

export const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

const q = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export function countCsv(doc, gscNames) {
  const c = compute(doc)
  const lines = ['function,type,complexity,weight,notes']
  for (const f of doc.functions) lines.push([f.name, f.type, f.level, weightOf(f), f.notes ?? ''].map(x => q(String(x))).join(','))
  lines.push('', 'type,low,average,high,points')
  for (const r of c.rows) lines.push([r.type, ...r.cells.map(x => x.count), r.points].join(','))
  lines.push(`UFP,,,,${c.ufp}`)
  if (doc.vafOn) {
    lines.push('', 'general system characteristic,degree of influence (0-5)')
    doc.gsc.forEach((v, i) => lines.push(`${q(gscNames[i])},${v}`))
    lines.push(`TDI,${c.tdi}`, `VAF,${c.vaf.toFixed(2)}`, `Adjusted FP,${c.afp}`)
  }
  if (c.hours != null) lines.push('', `hours per FP,${doc.hoursPerFp}`, `estimated hours,${c.hours}`, `estimated days,${c.days}`)
  return lines.join('\n')
}

export function countMarkdown(doc, t, gscNames) {
  const c = compute(doc)
  const lvl = l => t.levels[l]
  const out = [`# ${doc.name}`, '']
  out.push(`| ${t.fn} | ${t.type} | ${t.complexity} | ${t.weight} |`, '|---|---|---|---:|')
  for (const f of doc.functions) out.push(`| ${(f.name || '—').replace(/\|/g, '/')} | ${f.type} | ${lvl(f.level)} | ${weightOf(f)} |`)
  out.push('', `| ${t.type} | ${lvl('low')} | ${lvl('avg')} | ${lvl('high')} | ${t.points} |`, '|---|---:|---:|---:|---:|')
  for (const r of c.rows) out.push(`| ${r.type} | ${r.cells.map(x => `${x.count} × ${x.weight}`).join(' | ')} | ${r.points} |`)
  out.push('', `**${t.ufp}: ${c.ufp}**`)
  if (doc.vafOn) {
    out.push('', `| ${t.gsc} | 0–5 |`, '|---|---:|')
    doc.gsc.forEach((v, i) => out.push(`| ${i + 1}. ${gscNames[i]} | ${v} |`))
    out.push('', `TDI = ${c.tdi} · VAF = 0.65 + 0.01 × ${c.tdi} = ${c.vaf.toFixed(2)}`, `**${t.afp}: ${c.ufp} × ${c.vaf.toFixed(2)} = ${c.afp}**`)
  }
  if (c.hours != null) out.push('', `${t.effort}: ${c.afp} × ${doc.hoursPerFp} h = ${c.hours} h ≈ ${c.days} ${t.daysUnit}`)
  return out.join('\n')
}
