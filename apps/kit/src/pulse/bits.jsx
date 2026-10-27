import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { QR } from '../core/qr.jsx'
import { useClickOutside } from '../core/ui.jsx'
import { backend, rememberedDocs, rememberDoc, forgetDoc, deleteDoc } from '../core/live.js'
import { uid } from '../core/store.jsx'
import { T } from './i18n.js'
import { moodOf } from './model.js'
import { sha256 } from './sha256.js'

export const useT = () => { const lang = useLang(); return [T[lang], lang] }
export const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
export const plural = (n, one, many) => fill(n === 1 ? one : many, { n })

// ---------- this browser's lists ----------

export const TEAMS = 'pulse-teams'
export const CHECKS = 'health-checks'
export const rememberTeam = (id, name, extra = {}) => {
  const old = rememberedDocs(TEAMS).find(e => e.id === id)
  rememberDoc(TEAMS, { ...old, id, name, at: Date.now(), ...extra })
}
export const forgetTeam = id => forgetDoc(TEAMS, id)

// Appends an action to a document this page is not subscribed to, and tells anyone watching it.
export async function postAction(id, raw) {
  const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
  const seq = await backend.append(id, action)
  const sub = backend.subscribe(id, () => {}, () => {})
  sub.send({ seq, action })
  setTimeout(() => sub.close(), 1500)
  return seq
}

// Deletes a document and checks it is really gone (only the creator's device holds the key).
export async function deleteVerified(id, secret) {
  try { await deleteDoc(id, secret) } catch { return false }
  try { return !(await backend.getBoards([id])).length } catch { return false }
}

// Loads several documents once and folds their pending events.
export async function loadDocs(ids, reduce) {
  if (!backend || !ids.length) return []
  const rows = await backend.getBoards(ids)
  return rows.map(r => r.events.reduce((d, e) => reduce(d, e.action), r.snapshot)).filter(Boolean)
}

// ---------- facilitator key: kept on the device, only its hash is in the team document ----------

export async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const hostStore = () => (import.meta.env.VITE_BACKEND === 'mock' ? sessionStorage : localStorage)
export const hostKeyFor = teamId => { try { return hostStore().getItem(`lift-pulse-host-${teamId}`) } catch { return null } }
export const saveHostKey = (teamId, key) => { try { hostStore().setItem(`lift-pulse-host-${teamId}`, key) } catch { /* storage blocked */ } }

// True when this device holds the team's facilitator key. Teams made before keys were hashed
// (no hostHash) keep their old rule until they are migrated (see TeamRoom).
export function useIsHost(team, me) {
  const [, setBump] = useState(0)
  useEffect(() => { const h = () => setBump(x => x + 1); window.addEventListener('pulse:host', h); return () => window.removeEventListener('pulse:host', h) }, [])
  if (!team) return false
  if (!team.hostHash) return !!team.hosts?.[me]
  const key = hostKeyFor(team.id)
  return !!key && sha256(key) === team.hostHash
}

// Arrow keys move between the radios of a group (one Tab stop per group).
export function rovingKeys(e) {
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' }
  if (!(e.key in keys)) return
  const items = [...e.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')]
  const i = items.indexOf(document.activeElement)
  if (i < 0) return
  e.preventDefault()
  const k = keys[e.key]
  const next = k === 'first' ? items[0] : k === 'last' ? items[items.length - 1] : items[(i + k + items.length) % items.length]
  next.focus()
  next.click()
}
// tabIndex for radio i of a group: the checked one, or the first when none is checked.
export const rovingTab = (checked, i, anyChecked) => (checked || (!anyChecked && i === 0) ? 0 : -1)

export function AnonNote({ t, m, open }) {
  return (
    <details className="pl-anon-note" open={open}>
      <summary><Icon name="shield" size={14} /> {t.anon.title}</summary>
      <ul>{t.anon.points.map((x, i) => <li key={i}>{fill(x, { m })}</li>)}</ul>
    </details>
  )
}

export const fmtDate = (at, lang, opts = { day: 'numeric', month: 'short' }) =>
  new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', opts)

export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(h) }, [ms])
  return now
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text })
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* ignore */ }
    ta.remove()
    return ok
  }
}

// ---------- toast with undo ----------

let toast = null
const listeners = new Set()
let timer = null
export function showToast(text, undo) {
  clearTimeout(timer)
  toast = { text, undo, key: Date.now() }
  listeners.forEach(f => f())
  timer = setTimeout(() => { toast = null; listeners.forEach(f => f()) }, undo ? 6000 : 3000)
}
export function Toast() {
  const cur = useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f) }, () => toast)
  const [t] = useT()
  return (
    <div className="pl-toast-zone" role="status" aria-live="polite">
      {cur && (
        <div className="toast pl-toast" key={cur.key}>
          <span>{cur.text}</span>
          {cur.undo && <button className="pl-toast-undo" onClick={() => { cur.undo(); toast = null; listeners.forEach(f => f()) }}>{t.act.undo}</button>}
        </div>
      )}
    </div>
  )
}

// ---------- modal ----------

export function Modal({ title, onClose, children, wide, label }) {
  const ref = useRef(null)
  const back = useRef(document.activeElement)
  const [t] = useT()
  useEffect(() => {
    const el = ref.current
    const first = el?.querySelector('[autofocus], input, select, textarea, button:not(.modal-x)')
    ;(first ?? el)?.focus()
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab') {
        const items = [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled)
        if (!items.length) return
        const [a, z] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', key)
    const prev = back.current
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal pl-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label ?? title} ref={ref} tabIndex={-1}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn modal-x" onClick={onClose} aria-label={t.common.close}><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ title, text, yes, no, onYes, onClose, danger }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="row end pl-modal-foot">
        <button className="btn ghost" onClick={onClose}>{no}</button>
        <button className={`btn ${danger ? 'pl-danger-btn' : 'primary'}`} onClick={() => { onYes(); onClose() }}>{yes}</button>
      </div>
    </Modal>
  )
}

// ---------- share menu ----------

export function ShareMenu({ links, label, primary }) {
  const [t] = useT()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open])
  const cur = links[sel] ?? links[0]
  const copy = () => copyText(cur.url).then(ok => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1600) } })
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ${primary ? 'primary' : 'ghost'}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"><Icon name="link" /> {label ?? t.team.share}</button>
      {open && (
        <div className="menu right pl-share" role="dialog" aria-label={label ?? t.team.share}>
          {links.length > 1 && (
            <div className="pl-share-tabs" role="radiogroup" aria-label={label ?? t.team.share} onKeyDown={rovingKeys}>
              {links.map((l, i) => <button key={l.key} role="radio" aria-checked={sel === i} tabIndex={sel === i ? 0 : -1} className={`pl-share-opt ${sel === i ? 'on' : ''}`} onClick={() => { setSel(i); setCopied(false) }}><b>{l.title}</b><span>{l.hint}</span></button>)}
            </div>
          )}
          {links.length === 1 && <p className="menu-hint">{cur.hint}</p>}
          <div className="menu-form"><input readOnly value={cur.url} onFocus={e => e.target.select()} aria-label={cur.title} /><button className="btn primary sm" onClick={copy}>{copied ? t.team.copied : t.team.copy}</button></div>
          <div className="invite-qr"><QR text={cur.url} size={150} /><span className="muted small">{t.team.scan}</span></div>
        </div>
      )}
    </div>
  )
}

export const appUrl = path => `${window.location.origin}${window.location.pathname}#/health/${path}`

// ---------- charts ----------

const MOOD_WORD = { g: 'healthy', a: 'mixed', r: 'unhealthy' }

// A score chip: colour plus the number, so colour is never the only signal.
export function Score({ value, big, label }) {
  const m = moodOf(value)
  return <span className={`pl-score ${m ?? 'none'} ${big ? 'big' : ''}`} aria-label={label}>{value ?? '–'}</span>
}

// Line chart of the overall score per check, with healthy / unhealthy bands.
// Charts draw at the container's real width so text stays at its true size on any screen.
function useWidth(fallback = 640) {
  const ref = useRef(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => { const x = Math.round(e.contentRect.width); if (x > 0) setW(Math.max(220, x)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function TrendChart({ points, lang, t }) {
  const [ref, W] = useWidth()
  const H = 220, L = 34, R = 30, Tp = 24, B = 30
  const n = points.length
  const x = i => n === 1 ? (L + W - R) / 2 : L + 14 + (i * (W - L - R - 28)) / (n - 1)
  const y = v => Tp + (1 - v / 100) * (H - Tp - B)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const desc = points.map(p => `${p.label}: ${p.value}`).join(', ')
  const maxLabels = Math.max(2, Math.floor((W - L - R) / 70))
  const every = Math.ceil(n / maxLabels)
  // Date labels: thinned to fit, and never the same date twice (two checks on one day).
  let last = null
  const lbls = points.map((p, i) => {
    const d = fmtDate(p.at, lang)
    if (!((i % every === 0 && n - 1 - i >= every) || i === n - 1) || d === last) return null
    last = d
    return d
  })
  return (
    <div ref={ref} className="pl-chart-box">
    <svg className="pl-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.dash.trend}. ${desc}`}>
      <rect x={L} y={y(100)} width={W - L - R} height={y(67) - y(100)} className="band g" />
      <rect x={L} y={y(40)} width={W - L - R} height={y(0) - y(40)} className="band r" />
      {[0, 40, 67, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="axis">{v}</text></g>)}
      {n > 1 && <path d={path} className="line" />}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.value)} r="5" className={`pt ${moodOf(p.value)}`} />
          <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" className="val">{p.value}</text>
          {lbls[i] && <text x={x(i)} y={H - 10} textAnchor={n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle'} dx={n > 1 && i === n - 1 ? 8 : n > 1 && i === 0 ? -8 : 0} className="axis">{lbls[i]}</text>}
        </g>
      ))}
    </svg>
    </div>
  )
}

// Tiny inline trend for team cards.
export function Spark({ values }) {
  if (values.length < 2) return null
  const W = 84, H = 26
  const x = i => 2 + (i * (W - 4)) / (values.length - 1)
  const y = v => 3 + (1 - v / 100) * (H - 6)
  return (
    <svg className="pl-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" />
    </svg>
  )
}

// Weekly pulse: mood and energy averages per week as paired bars (1–5), hidden weeks marked.
export function PulseChart({ weeks: all, t, lang }) {
  const [ref, W] = useWidth()
  const H = 200, L = 26, R = 10, Tp = 20, B = 30
  // On a phone, fewer weeks so every bar keeps its value label.
  const weeks = W < 520 ? all.slice(-5) : all
  const n = weeks.length
  const bw = (W - L - R) / n
  const y = v => Tp + (1 - v / 5) * (H - Tp - B)
  const wk = w => fmtDate(Date.parse(w.week) + 43200000, lang)
  const desc = weeks.map(w => w.shown ? `${wk(w)}: ${t.pu.mood} ${w.mood?.toFixed(1)}, ${t.pu.energy} ${w.energy?.toFixed(1)}` : `${wk(w)}: –`).join('; ')
  const narrow = false
  return (
    <div ref={ref} className="pl-chart-box">
    <svg className="pl-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.pu.trend}. ${desc}`}>
      {[0, 1, 2, 3, 4, 5].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="axis">{v}</text></g>)}
      {weeks.map((w, i) => {
        const cx = L + i * bw + bw / 2
        const label = (!narrow || i % 2 === 1) && <text x={cx} y={H - 10} textAnchor="middle" className="axis">{wk(w)}</text>
        const bwid = Math.min(16, Math.max(10, bw / 2 - 6))
        if (!w.shown) return <g key={w.week}><rect x={cx - bwid} y={y(5)} width={bwid * 2} height={y(0) - y(5)} className="ghost" /><text x={cx} y={y(2.5) + 4} textAnchor="middle" className="axis">–</text>{label}</g>
        const bar = (v, dx, cls) => v == null ? null : <g><rect x={cx + dx} y={y(v)} width={bwid} height={y(0) - y(v)} className={cls} rx="2" />{!narrow && <text x={cx + dx + bwid / 2} y={y(v) - 5} textAnchor="middle" className="val sm">{v.toFixed(1)}</text>}</g>
        return <g key={w.week}>{bar(w.mood, -bwid - 1, 'bar mood')}{bar(w.energy, 1, 'bar energy')}{label}</g>
      })}
    </svg>
    </div>
  )
}

export function Legend({ t }) {
  return (
    <div className="pl-legend" aria-label={t.dash.legend}>
      <span><i className="pl-score g mini">70</i>{t.dash.healthy}</span>
      <span><i className="pl-score a mini">50</i>{t.dash.mixed}</span>
      <span><i className="pl-score r mini">30</i>{t.dash.unhealthy}</span>
      <span><i className="pl-score none mini">–</i>{t.dash.notAsked}</span>
    </div>
  )
}

export { MOOD_WORD }
