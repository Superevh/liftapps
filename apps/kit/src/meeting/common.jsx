import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Icon as CoreIcon } from '../core/icons.jsx'
import { useStore } from '../core/store.jsx'
import { useClickOutside } from '../core/ui.jsx'
import { useT } from './i18n.js'

// A few line icons MeetingLift needs on top of the kit set (same 24px grid and 1.5px stroke).
const EXTRA = {
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  repeat: <path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3M20 12.5v1a4 4 0 0 1-4 4H4" />,
  note: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M14.5 3.5v4.5H19M8.5 12.5h7M8.5 16h5" /></>,
  decision: <><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>,
  action: <><path d="M4 6.5h2M4 12h2M4 17.5h2" /><path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H16" /></>,
  parking: <><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M10 16.5v-9h3a2.7 2.7 0 0 1 0 5.4h-3" /></>,
  dot: <circle cx="12" cy="12" r="4" />,
  coffee: <><path d="M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z" /><path d="M16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8M8 3.5c-.6 1 .6 2 0 3M12 3.5c-.6 1 .6 2 0 3" /></>,
  hand: <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-.5V5.5a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5h-.4a5.5 5.5 0 0 1-4.3-2.1L4 14.5a1.6 1.6 0 0 1 2.5-2L8 14V11Z" />,
  coin: <><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
  arrowRight: <path d="M4.5 12h15m0 0-5.5-5.5M19.5 12l-5.5 5.5" />,
}

export function Icon({ name, size = 16, className = '' }) {
  if (!EXTRA[name]) return <CoreIcon name={name} size={size} className={className} />
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {EXTRA[name]}
    </svg>
  )
}

export const TYPE_ICON = { discussion: 'comment', decision: 'decision', update: 'info', activity: 'sparkle', break: 'coffee' }
export const ACT_ICON = { checkin: 'balloon', leancoffee: 'coffee', poll: 'hand', parking: 'parking', actions: 'action' }
export const itemIcon = x => (x.type === 'activity' && x.activity ? ACT_ICON[x.activity] : TYPE_ICON[x.type] ?? 'comment')

export function useNow(active, every = 500) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const h = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(h)
  }, [active, every])
  return active ? now : Date.now()
}

// ---------- toasts (with an optional Undo) ----------

let toast = null
const subs = new Set()
let timer = null
const emit = () => subs.forEach(fn => fn())
export function showToast(text, undo) {
  clearTimeout(timer)
  toast = { text, undo, key: Math.random() }
  emit()
  timer = setTimeout(() => { toast = null; emit() }, undo ? 6000 : 2800)
}
export function Toaster() {
  const [t] = useT()
  const cur = useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => toast)
  return (
    <div className="mt-toast-slot" role="status" aria-live="polite">
      {cur && (
        <div className="toast mt-toast" key={cur.key}>
          <span>{cur.text}</span>
          {cur.undo && <button className="mt-toast-undo" onClick={() => { cur.undo(); toast = null; emit() }}>{t.undo}</button>}
        </div>
      )}
    </div>
  )
}

// ---------- dialogs ----------

// Focus moves in when it opens and back to the trigger when it closes; Esc and the backdrop close it.
export function Dialog({ title, onClose, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const back = document.activeElement
    const first = ref.current?.querySelector('input, textarea, select, button.primary, button')
    first?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2></div>
        {children}
      </div>
    </div>
  )
}

export function useConfirm() {
  const [t] = useT()
  const [ask, setAsk] = useState(null)
  const confirm = useCallback((text, yes, fn) => setAsk({ text, yes, fn }), [])
  const dialog = ask && (
    <Dialog title={t.confirm} onClose={() => setAsk(null)} className="welcome">
      <p className="mt-confirm-text">{ask.text}</p>
      <div className="row end">
        <button className="btn ghost" onClick={() => setAsk(null)}>{t.cancel}</button>
        <button className="btn primary" onClick={() => { setAsk(null); ask.fn() }}>{ask.yes}</button>
      </div>
    </Dialog>
  )
  return [confirm, dialog]
}

// Asks for a name only when someone first contributes, never on open. "Stay as Guest" is remembered for the tab.
const SKIP = 'meetinglift-name-skip'
export function useNameGate() {
  const { identity, rename } = useStore()
  const [t] = useT()
  const [pending, setPending] = useState(null)
  const [name, setName] = useState('')
  const skipped = () => { try { return sessionStorage.getItem(SKIP) === '1' } catch { return false } }
  const [required, setRequired] = useState(false)
  // { required: true } hides "Stay as Guest" (e.g. becoming the facilitator needs a name others recognise).
  const gate = useCallback((fn, opts) => {
    if (identity.name || (!opts?.required && skipped())) { fn(); return }
    setRequired(!!opts?.required)
    setPending(() => fn)
  }, [identity.name])
  const done = save => {
    if (save && name.trim()) rename(name)
    else try { sessionStorage.setItem(SKIP, '1') } catch { /* storage blocked */ }
    const fn = pending
    setPending(null)
    // Let the rename reach the store before the action that needed it runs.
    setTimeout(() => fn?.(), 0)
  }
  const dialog = pending && (
    <Dialog title={t.nameTitle} onClose={() => setPending(null)} className="welcome">
      <form onSubmit={e => { e.preventDefault(); done(true) }}>
        <p className="muted mt-dialog-lead">{t.nameHint}</p>
        <label className="field-label" htmlFor="mt-name">{t.yourName}</label>
        <input id="mt-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t.namePh} autoComplete="name" />
        <div className="row end mt-dialog-actions">
          {required ? <button type="button" className="btn ghost" onClick={() => setPending(null)}>{t.cancel}</button> : <button type="button" className="btn ghost" onClick={() => done(false)}>{t.nameSkip}</button>}
          <button className="btn primary" disabled={!name.trim()}>{t.nameSave}</button>
        </div>
      </form>
    </Dialog>
  )
  return [gate, dialog]
}

// ---------- small pieces ----------

export function Menu({ label, text, icon = 'more', children, className = '', btnClass = 'icon-btn' }) {
  const iconOnly = btnClass === 'icon-btn'
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <button className={btnClass} onClick={() => setOpen(o => !o)} aria-label={iconOnly ? label : undefined} title={label} aria-expanded={open} aria-haspopup="menu">
        <Icon name={icon} />{!iconOnly && <span>{text ?? label}</span>}
      </button>
      {open && <div className={`menu right ${className}`} role="menu" onClick={e => { if (e.target.closest('[data-close]')) setOpen(false) }}>{children}</div>}
    </div>
  )
}

// Text fields save on blur so typing does not send one event per key, and remote edits
// do not overwrite what someone is typing.
export function useDraft(value) {
  const [v, setV] = useState(value)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setV(value) }, [value])
  return [v, setV, focused]
}

export function DraftInput({ value, onSave, multiline, className = '', ...rest }) {
  const [v, setV, f] = useDraft(value)
  const ref = useRef(null)
  const Tag = multiline ? 'textarea' : 'input'
  // Multi-line fields grow with their text instead of clipping it.
  useLayoutEffect(() => {
    const el = ref.current
    if (!multiline || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [v, multiline])
  return (
    <Tag {...rest} ref={ref} className={className} value={v}
      onFocus={() => { f.current = true }} onChange={e => setV(e.target.value)}
      onBlur={() => { f.current = false; if (v !== value) onSave(v) }}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(value); setTimeout(() => e.target.blur(), 0) } }} />
  )
}

export function Person({ p, size = 22, guest }) {
  const name = p?.name || guest
  return <span className="avatar" title={name} style={{ width: size, height: size, background: p?.color ?? 'var(--lift-walnut)', fontSize: size * 0.44 }}>{name.slice(0, 1).toUpperCase()}</span>
}

export async function copyText(text, t) {
  try { await navigator.clipboard.writeText(text); showToast(t.copied) } catch { showToast(t.copyFail) }
}

// A soft two-tone bell made with Web Audio, so no sound file is needed.
let audio = null
export function unlockAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume() } catch { audio = null }
}
export function bell() {
  if (!audio) return
  try {
    const t0 = audio.currentTime + 0.02
    ;[[587.33, 0], [880, 0.28]].forEach(([f, d]) => {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + d)
      g.gain.exponentialRampToValueAtTime(0.12, t0 + d + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.6)
      o.connect(g).connect(audio.destination)
      o.start(t0 + d)
      o.stop(t0 + d + 1.7)
    })
  } catch { /* audio unavailable */ }
}

// Saves a generated file (calendar, minutes) without leaving the page.
export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function money(n, currency, lang) {
  try { return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { style: 'currency', currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n) } catch { return `${currency} ${n.toFixed(0)}` }
}
