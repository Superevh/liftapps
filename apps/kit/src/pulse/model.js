// PulseLift data model.
//
// A team is one live document (id prefix "tm"): settings, the list of its health checks, the
// improvement actions and the weekly pulse answers. Each health check stays its own document
// (prefix "hc", see ../health/model.js) so checks made before teams existed keep opening.
// Reducers are pure: time comes only from action.at and new ids only from action.nonce.
//
// Anonymity: answers are stored under random ballot codes that live only in the voter's
// browser (one per check, one per team and week for the pulse). No name or person id is ever
// written next to an answer, and results are hidden until `minAnon` people have answered.

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
import { sha256 } from './sha256.js'
import { reduce as reduceCheckBase, summarize, ballotCount, overall, templateQuestions, TEMPLATES } from '../health/model.js'

export { summarize, ballotCount, overall, templateQuestions, TEMPLATES }

export const DAY = 86400000
export const CADENCES = [7, 14, 21, 28, 42, 91, 0]
export const ACTION_STATUS = ['todo', 'doing', 'done', 'dropped']
export const VERDICTS = ['yes', 'some', 'no']
export const MIN_ANON = 3
export const HOUR = 3600000

// ---------- checks ----------

// New action types for check documents; everything else is the original reducer.
// Checks created by this version (v >= 2) are sealed: results can only be shown once `minAnon`
// people have voted, and once shown, voting cannot reopen (no "vote again and compare").
// Older documents keep their original behaviour so they replay exactly as before.
export function reduceCheck(c, a) {
  if (!c) return c
  if (a.type === 'ATTACH_TEAM') return typeof a.teamId === 'string' ? { ...c, teamId: a.teamId, team: String(a.teamName ?? c.team ?? '').slice(0, 60) } : c
  if (c.v >= 2 && a.type === 'PHASE') {
    const n = ballotCount(c)
    if (a.phase === 'vote' && c.revealed && n > 0) return c
    if (a.phase !== 'vote' && n > 0 && n < (c.minAnon ?? MIN_ANON)) return c
    const next = reduceCheckBase(c, a)
    return a.phase !== 'vote' && n > 0 ? { ...next, revealed: true } : next
  }
  return reduceCheckBase(c, a)
}

export const minAnonOf = (check, team) => check?.minAnon ?? team?.settings?.minAnon ?? MIN_ANON

// Per-area results with the anonymity threshold applied: an area answered by fewer than
// `min` people shows no score, no split and no comments.
export function summarizeSafe(check, min = minAnonOf(check)) {
  return summarize(check).map(r => r.n >= min ? r : { ...r, hidden: true, score: null, mood: null, lights: { g: 0, a: 0, r: 0 }, trends: { up: 0, flat: 0, down: 0 }, trend: null, notes: [], n: 0, hiddenN: r.n })
}

// Default check names ("Health check · 28 Oct") follow the reader's language.
export function checkName(name, at, defName, lang) {
  if (/^(Health check|健康检查) · /.test(name ?? '')) return `${defName} · ${new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short' })}`
  return name
}

export const moodOf = score => score == null ? null : score >= 67 ? 'g' : score >= 40 ? 'a' : 'r'

// Health-check areas keep their template id ("squad3"), so titles can follow the reader's language.
export function areaTitle(q, lang) {
  const m = /^(squad|team|remote|pulse)(\d+)$/.exec(q?.id ?? '')
  if (m) { const t = templateQuestions(m[1], lang)[+m[2]]; if (t) return t.title }
  return q?.title ?? ''
}
export function localQuestion(q, lang) {
  const m = /^(squad|team|remote|pulse)(\d+)$/.exec(q?.id ?? '')
  if (m) { const t = templateQuestions(m[1], lang)[+m[2]]; if (t) return { ...q, title: t.title, good: t.good, bad: t.bad } }
  return q
}

// Spread of opinion for one area: standard deviation of green=1, amber=½, red=0 (0 … 0.5).
export function split(lights) {
  const n = lights.g + lights.a + lights.r
  if (!n) return 0
  const mean = (lights.g + lights.a / 2) / n
  const v = (lights.g * (1 - mean) ** 2 + lights.a * (0.5 - mean) ** 2 + lights.r * mean ** 2) / n
  return Math.sqrt(v)
}

// Discussion order: most red first; among equally red areas the lowest score, then the most divided.
export function discussionOrder(rows) {
  return [...rows].filter(r => r.n).sort((x, y) =>
    (y.lights.r / y.n) - (x.lights.r / x.n) || x.score - y.score || split(y.lights) - split(x.lights))
}

export function isComplete(check) {
  // Below the anonymity threshold a check shows nothing, so it is left out of trends too.
  return check && check.phase !== 'vote' && ballotCount(check) >= minAnonOf(check)
}

// ---------- team ----------

// The facilitator key never enters the document: only its SHA-256 hash does. Whoever holds the
// key (in the facilitator link, kept on their device) sees facilitator controls.
export function newTeam({ id, name, owner, at, templateId = 'squad', cadenceDays = 14, size = null, hostHash }) {
  return {
    kind: 'team', v: 2, id, name: name.slice(0, 60), createdAt: at, ownerId: owner, hostHash,
    settings: { templateId, cadenceDays, size, minAnon: MIN_ANON, trends: true, comments: true },
    checks: [], results: {}, actions: [], pulse: {},
  }
}

const clean = (s, n) => String(s ?? '').trim().slice(0, n)
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const ACTION_FIELDS = ['text', 'qid', 'area', 'owner', 'due', 'status', 'note']

function actionPatch(p) {
  const out = {}
  for (const k of ACTION_FIELDS) if (k in (p ?? {})) out[k] = p[k]
  if ('text' in out) out.text = clean(out.text, 300)
  if ('owner' in out) out.owner = clean(out.owner, 60)
  if ('area' in out) out.area = clean(out.area, 80)
  if ('note' in out) out.note = clean(out.note, 300)
  if ('due' in out && out.due && !isDay(out.due)) delete out.due
  if ('status' in out && !ACTION_STATUS.includes(out.status)) delete out.status
  return out
}

export function reduceTeam(t, a) {
  if (!t || t.kind !== 'team') return t
  switch (a.type) {
    case 'TEAM_RENAME': return clean(a.name, 60) ? { ...t, name: clean(a.name, 60) } : t
    case 'TEAM_SETTINGS': {
      const p = a.patch ?? {}
      const s = { ...t.settings }
      if (p.templateId && (TEMPLATES[p.templateId] || p.templateId === 'custom')) s.templateId = p.templateId
      if ('cadenceDays' in p && CADENCES.includes(p.cadenceDays)) s.cadenceDays = p.cadenceDays
      if ('size' in p) s.size = Number.isInteger(p.size) && p.size > 0 && p.size < 1000 ? p.size : null
      if ('minAnon' in p && [3, 4, 5].includes(p.minAnon)) s.minAnon = p.minAnon
      if ('trends' in p) s.trends = !!p.trends
      if ('comments' in p) s.comments = !!p.comments
      if (Array.isArray(p.customQuestions)) s.customQuestions = p.customQuestions.slice(0, 20)
      return { ...t, settings: s }
    }
    // A new facilitator key. The action must prove the current key (checked against its hash, or
    // for teams made before keys were hashed, against the old plain key). That key is retired by
    // this very action, so it showing up in the log gives nobody anything.
    case 'HOST_ROTATE': {
      // (sets `relinked` so people with an old facilitator link get a helpful message)
      if (typeof a.hash !== 'string' || !/^[0-9a-f]{64}$/.test(a.hash) || typeof a.key !== 'string' || !a.key) return t
      const ok = t.hostHash ? sha256(a.key) === t.hostHash : !!t.hostKey && a.key === t.hostKey
      if (!ok) return t
      const { hostKey, hosts, ...rest } = t // eslint-disable-line no-unused-vars
      return { ...rest, hostHash: a.hash, relinked: true }
    }
    case 'CHECK_ADD': {
      const c = a.check
      if (!c?.id || t.checks.some(x => x.id === c.id)) return t
      const entry = { id: c.id, name: clean(c.name, 80), at: c.at ?? a.at, templateId: c.templateId ?? null }
      return { ...t, checks: [...t.checks, entry].sort((x, y) => x.at - y.at) }
    }
    case 'CHECK_REMOVE': {
      const results = { ...t.results }
      delete results[a.id]
      return { ...t, checks: t.checks.filter(x => x.id !== a.id), results }
    }
    // A small cached summary so the home page can show scores without opening every check.
    case 'CHECK_RESULT': {
      if (!t.checks.some(x => x.id === a.id)) return t
      const r = { score: a.score ?? null, votes: a.votes ?? 0, phase: a.phase, at: a.at }
      return { ...t, results: { ...t.results, [a.id]: r } }
    }
    case 'ACTION_ADD': {
      const text = clean(a.text, 300)
      if (!text || t.actions.length >= 300) return t
      const item = { id: `${a.nonce}a`, text, qid: a.qid ?? null, area: clean(a.area, 80), owner: clean(a.owner, 60),
        due: isDay(a.due) ? a.due : null, status: 'todo', checkId: a.checkId ?? null, at: a.at, review: null }
      return { ...t, actions: [...t.actions, item] }
    }
    // Undo of a delete puts the item back exactly as it was.
    case 'ACTION_RESTORE': return a.item?.id && !t.actions.some(x => x.id === a.item.id) ? { ...t, actions: [...t.actions, a.item].sort((x, y) => x.at - y.at) } : t
    case 'ACTION_UPDATE': {
      const patch = actionPatch(a.patch)
      if (patch.status === 'done') patch.doneAt = a.at
      return { ...t, actions: t.actions.map(x => x.id === a.id ? { ...x, ...patch } : x) }
    }
    case 'ACTION_DELETE': return { ...t, actions: t.actions.filter(x => x.id !== a.id) }
    // "Did it help?", asked when the team meets for its next check.
    case 'ACTION_REVIEW': return VERDICTS.includes(a.verdict) || a.verdict === null
      ? { ...t, actions: t.actions.map(x => x.id === a.id ? { ...x, review: a.verdict ? { verdict: a.verdict, at: a.at, checkId: a.checkId ?? null } : null } : x) }
      : t
    case 'PULSE': {
      // Only answers given during that week count (with 14 hours either side for time zones), so a
      // week's results can't change after they are shown.
      if (!isDay(a.week) || typeof a.ballot !== 'string' || a.at < Date.parse(a.week) - 14 * HOUR || a.at >= weekEnd(a.week)) return t
      const ans = a.answer ?? {}
      const v = x => Number.isInteger(x) && x >= 1 && x <= 5 ? x : null
      const answer = { mood: v(ans.mood), energy: v(ans.energy), load: v(ans.load), note: clean(ans.note, 280), at: a.at }
      if (!answer.mood && !answer.energy && !answer.load) return t
      // The first answer of each ballot is kept as given: the facilitators' provisional view only
      // ever uses these, so later edits can't be spotted by watching it change.
      const before = t.pulse[a.week]?.[a.ballot]
      answer.first = before?.first ?? a.at
      answer.orig = before ? (before.orig ?? { mood: before.mood, energy: before.energy, load: before.load, note: before.note }) : { mood: answer.mood, energy: answer.energy, load: answer.load, note: answer.note }
      const week = { ...(t.pulse[a.week] ?? {}), [a.ballot]: answer }
      // Keep about half a year of weeks so the document stays small.
      const pulse = Object.fromEntries(Object.entries({ ...t.pulse, [a.week]: week }).filter(([w]) => Date.parse(w) > a.at - 190 * DAY))
      return { ...t, pulse }
    }
    default: return t
  }
}

// ---------- time ----------

const pad = n => String(n).padStart(2, '0')
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// Monday of the local week, e.g. "2026-10-26".
export function weekKey(at) {
  const d = new Date(at)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}
export const prevWeek = w => weekKey(Date.parse(w) - 3 * DAY)
// A week's pulse is shown once nobody can answer it any more.
export const weekEnd = w => Date.parse(w) + 7 * DAY + 14 * HOUR

// When the next check is due: { state: 'none' | 'off' | 'open' | 'ok' | 'soon' | 'due', at, days }.
export function cadence(team, now) {
  const days = team.settings.cadenceDays
  const last = team.checks[team.checks.length - 1]
  if (last && team.results[last.id]?.phase === 'vote') return { state: 'open', check: last }
  if (!last) return { state: 'none' }
  if (!days) return { state: 'off' }
  const at = last.at + days * DAY
  const left = Math.ceil((at - now) / DAY)
  return { state: left < 0 ? 'due' : left <= 2 ? 'soon' : 'ok', at, days: left }
}

// ---------- pulse ----------

export function pulseWeek(team, week, now = Infinity, only = null) {
  const answers = only ?? Object.values(team.pulse?.[week] ?? {})
  const n = answers.length
  const avg = k => { const xs = answers.map(x => x[k]).filter(Boolean); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null }
  const load = { light: 0, right: 0, heavy: 0 }
  for (const x of answers) if (x.load) load[x.load <= 2 ? 'light' : x.load === 3 ? 'right' : 'heavy'] += 1
  const ln = load.light + load.right + load.heavy
  return {
    week, n, enough: n >= (team.settings.minAnon ?? MIN_ANON), closed: now >= weekEnd(week),
    // Results are published once per week, after it closes and only with enough answers, so
    // nobody can work out one person's answer by watching the numbers change.
    get shown() { return this.enough && this.closed },
    mood: avg('mood'), energy: avg('energy'), loadAvg: avg('load'),
    heavy: ln ? load.heavy / ln : null, load,
    notes: answers.map(x => x.note).filter(Boolean),
  }
}

// Facilitators get an early look at the current week once at least PROVISIONAL_MIN people have
// answered. It moves in steps of PROVISIONAL_STEP answers (the earliest ones first), so one new
// answer never changes the numbers on its own.
export const PROVISIONAL_MIN = 5
export const PROVISIONAL_STEP = 3
export function pulseProvisional(team, week) {
  // Earliest first submissions first, with their first values: edits never change this view.
  const all = Object.values(team.pulse?.[week] ?? {}).map(x => ({ ...(x.orig ?? x), at: x.first ?? x.at })).sort((a, b) => a.at - b.at)
  const min = Math.max(PROVISIONAL_MIN, team.settings.minAnon ?? MIN_ANON)
  if (all.length < min) return null
  const k = min + PROVISIONAL_STEP * Math.floor((all.length - min) / PROVISIONAL_STEP)
  return { ...pulseWeek(team, week, -Infinity, all.slice(0, k)), total: all.length }
}

export function pulseSeries(team, now, weeks = 8) {
  const out = []
  let w = weekKey(now)
  for (let i = 0; i < weeks; i++) { out.unshift(pulseWeek(team, w, now)); w = prevWeek(w) }
  return out
}

// ---------- trends across checks ----------

// docs: check documents of one team. Returns what the dashboard needs, oldest check first.
export function teamTrends(docs, lang) {
  const done = docs.filter(isComplete).sort((a, b) => a.createdAt - b.createdAt)
  const series = done.map(d => {
    const rows = summarizeSafe(d)
    return { id: d.id, name: d.name, at: d.createdAt, score: overall(rows), votes: ballotCount(d), rows, doc: d }
  })
  // Areas: those of the latest check first, then any older ones.
  const areas = []
  const seen = new Set()
  for (const s of [...series].reverse()) for (const q of s.doc.questions) if (!seen.has(q.id)) { seen.add(q.id); areas.push({ id: q.id, emoji: q.emoji, title: areaTitle(q, lang) }) }
  const cell = (s, qid) => s.rows.find(r => r.q.id === qid) ?? null
  const latest = series[series.length - 1] ?? null
  const prev = series[series.length - 2] ?? null
  const movers = []
  if (latest && prev) for (const a of areas) {
    const x = cell(latest, a.id), y = cell(prev, a.id)
    if (x?.score != null && y?.score != null && x.score !== y.score) movers.push({ area: a, delta: x.score - y.score, score: x.score })
  }
  movers.sort((x, y) => y.delta - x.delta)
  const improvers = movers.filter(m => m.delta >= 5).slice(0, 3)
  const decliners = movers.filter(m => m.delta <= -5).reverse().slice(0, 3)
  // Areas to watch: low now, dropping fast, or down two checks in a row.
  const watch = []
  if (latest) for (const a of areas) {
    const c = cell(latest, a.id)
    if (c?.score == null) continue
    const hist = series.map(s => cell(s, a.id)?.score).filter(x => x != null)
    const d1 = hist.length > 1 ? hist[hist.length - 1] - hist[hist.length - 2] : 0
    const d2 = hist.length > 2 ? hist[hist.length - 2] - hist[hist.length - 3] : 0
    let reason = null
    if (c.score < 40) reason = 'low'
    else if (d1 <= -15) reason = 'drop'
    else if (d1 < 0 && d2 < 0) reason = 'slide'
    else if (c.n >= 3 && split(c.lights) >= 0.38) reason = 'split'
    if (reason) watch.push({ area: a, reason, score: c.score, delta: hist.length > 1 ? d1 : null, rank: c.score + (reason === 'split' ? 30 : 0) })
  }
  watch.sort((x, y) => x.rank - y.rank)
  // Nothing alarming: still point at the weakest area if it isn't healthy yet.
  if (!watch.length && latest) {
    const low = latest.rows.filter(r => r.score != null).sort((x, y) => x.score - y.score)[0]
    const a = low && areas.find(x => x.id === low.q.id)
    if (a && low.score < 67) watch.push({ area: a, reason: 'lowest', score: low.score, delta: null, rank: low.score })
  }
  return { series, areas, cell, latest, prev, improvers, decliners, watch: watch.slice(0, 4) }
}

// ---------- actions ----------

export function actionState(x, now) {
  if (x.status === 'done' || x.status === 'dropped') return x.status
  if (x.due && Date.parse(x.due) + DAY < now) return 'overdue'
  return x.status
}

// Actions that came out of earlier checks and still need a "did it help?" answer.
export function toReview(team, checkId) {
  const idx = team.checks.findIndex(c => c.id === checkId)
  const earlier = new Set(team.checks.slice(0, idx < 0 ? team.checks.length : idx).map(c => c.id))
  return team.actions.filter(x => x.status !== 'dropped' && (earlier.has(x.checkId) || (!x.checkId && x.at < (team.checks[idx]?.at ?? Infinity))) && (!x.review || x.review.checkId === checkId))
}

// ---------- export ----------

export const SMALL_SAMPLE = 5
// The latest and previous checks, if either had fewer than SMALL_SAMPLE votes.
export const smallSamples = ({ latest, prev }) => [prev, latest].filter(s => s && s.votes < SMALL_SAMPLE)

// Readable, unique labels for checks: default names follow the language, and two checks with the
// same label (e.g. same day) get their time added.
export function checkLabels(list, defName, lang) {
  const base = list.map(c => checkName(c.name, c.at ?? c.createdAt, defName, lang))
  return base.map((b, i) => base.indexOf(b) !== base.lastIndexOf(b) ? `${b}, ${new Date(list[i].at ?? list[i].createdAt).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-AU', { hour: 'numeric', minute: '2-digit' })}` : b)
}

export function markdownReport({ team, trends, pulse, t, lang, now }) {
  const L = []
  const fmt = at => new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtW = w => fill(t.pu.weekOf, { d: new Date(Date.parse(w) + 12 * HOUR).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short' }) })
  L.push(`# ${t.rp.title}: ${team.name}`, '', `_${fmt(now)}_`, '')
  const { series, latest, prev, watch, improvers, decliners } = trends
  const labels = checkLabels(series, t.create.defName, lang)
  const nm = s => labels[series.indexOf(s)]
  if (latest) {
    const d = prev && latest.score != null && prev.score != null ? latest.score - prev.score : null
    L.push(`## ${t.rp.headline}`, '')
    L.push(`- ${t.kpi.score}: **${latest.score}/100**${d != null ? ` (${d > 0 ? '+' : ''}${d} ${t.rp.vsPrev})` : ''}`)
    L.push(`- ${t.kpi.votes}: ${latest.votes}${team.settings.size ? ` / ${team.settings.size}` : ''}`)
    L.push(`- ${t.rp.checks}: ${series.length} (${fmt(series[0].at)} – ${fmt(latest.at)})`)
    const small = smallSamples(trends)
    if (small.length) L.push(`- ${fill(t.rp.small, { list: small.map(s => fill(t.rp.smallItem, { name: nm(s), n: s.votes })).join(t.rp.sep) })}`)
    L.push('')
    const sz = team.settings.size
    L.push(`## ${t.rp.trend}`, '', `| ${t.rp.check} | ${t.rp.date} | ${t.kpi.score} | ${t.kpi.votes} |${sz ? ` ${t.kpi.part} |` : ''}`, `|---|---|---:|---:|${sz ? '---:|' : ''}`)
    for (const [i, s] of series.entries()) L.push(`| ${labels[i]} | ${fmt(s.at)} | ${s.score ?? '–'} | ${s.votes} |${sz ? ` ${Math.min(100, Math.round((s.votes / sz) * 100))}% |` : ''}`)
    L.push('')
    L.push(`## ${t.rp.areas}`, '', `| ${t.rp.area} | ${t.kpi.score} | ${t.rp.change} |`, '|---|---:|---:|')
    for (const r of [...latest.rows].filter(r => r.n).sort((a, b) => a.score - b.score)) {
      const p = prev?.rows.find(x => x.q.id === r.q.id)
      const dd = p?.score != null ? r.score - p.score : null
      L.push(`| ${areaTitle(r.q, lang)} | ${r.score} | ${dd == null ? '–' : `${dd > 0 ? '+' : ''}${dd}`} |`)
    }
    L.push('')
    if (watch.length) { L.push(`## ${t.dash.watch}`, ''); for (const w of watch) L.push(`- **${w.area.title}** (${w.score}): ${t.why[w.reason]}`); L.push('') }
    if (improvers.length || decliners.length) {
      L.push(`## ${t.dash.movers}`, '')
      for (const m of improvers) L.push(`- ↑ ${m.area.title} +${m.delta}`)
      for (const m of decliners) L.push(`- ↓ ${m.area.title} ${m.delta}`)
      L.push('')
    }
  } else L.push(t.rp.noData, '')
  const open = team.actions.filter(x => x.status !== 'done' && x.status !== 'dropped')
  const done = team.actions.filter(x => x.status === 'done' || x.status === 'dropped')
  L.push(`## ${t.rp.plan}`, '')
  if (!team.actions.length) L.push(t.act.none)
  for (const x of [...open, ...done]) {
    const bits = [x.area, x.owner, x.due && `${t.act.due} ${x.due}`, t.act.st[actionState(x, now)], x.review && `${t.rp.helped}: ${t.act.v[x.review.verdict]}`].filter(Boolean)
    L.push(`- [${x.status === 'done' ? 'x' : ' '}] ${x.text}${bits.length ? ` (${bits.join(' · ')})` : ''}`)
  }
  L.push('')
  const ok = pulse.filter(w => w.shown)
  if (ok.length) {
    L.push(`## ${t.rp.pulse}`, '', `| ${t.rp.week} | ${t.pu.mood} | ${t.pu.energy} | ${t.pu.heavy} | n |`, '|---|---:|---:|---:|---:|')
    for (const w of ok) L.push(`| ${fmtW(w.week)} | ${w.mood?.toFixed(1) ?? '–'} | ${w.energy?.toFixed(1) ?? '–'} | ${w.heavy == null ? '–' : `${Math.round(w.heavy * 100)}%`} | ${w.n} |`)
    L.push('')
  }
  L.push(`_${fill(t.rp.anonNote, { m: team.settings.minAnon ?? MIN_ANON })}_`)
  return L.join('\n')
}
