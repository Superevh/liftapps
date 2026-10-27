import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../core/icons.jsx'
import { QR } from '../core/qr.jsx'
import { useClickOutside } from '../core/ui.jsx'
import { useLang } from '../core/lang.js'
import { T } from './i18n.js'

// Small pieces shared by the EstimateLift pages.

// A toast with an optional Undo. show(text, undo?) replaces any toast already showing.
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((text, undo) => {
    clearTimeout(timer.current)
    setToast({ text, undo, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), undo ? 6000 : 2600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const hide = useCallback(() => { clearTimeout(timer.current); setToast(null) }, [])
  return [toast, show, hide]
}

export function Toast({ toast, t, onHide }) {
  return (
    <div className="es-toast-wrap" role="status" aria-live="polite">
      {toast && (
        <div className="toast es-toast" key={toast.key}>
          <span>{toast.text}</span>
          {toast.undo && <button className="es-toast-undo" onClick={() => { toast.undo(); onHide?.() }}>{t.undo}</button>}
        </div>
      )}
    </div>
  )
}

export function useCountdown(endsAt) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const h = setInterval(() => tick(x => x + 1), 250)
    return () => clearInterval(h)
  }, [endsAt])
  return endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null
}

export const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// A dialog that takes focus, closes on Escape or a click outside, and gives focus back.
export function Dialog({ label, onClose, children, wide }) {
  const t = T[useLang()]
  const ref = useRef(null)
  useEffect(() => {
    const before = document.activeElement
    const first = ref.current?.querySelector('input, textarea, button, [href]')
    first?.focus()
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll('input, textarea, select, button:not(:disabled), [href]')]
        if (!els.length) return
        const [a, z] = [els[0], els[els.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('keydown', key, true); before?.focus?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal es-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <button className="icon-btn modal-x" onClick={onClose} aria-label={t.close}><Icon name="x" /></button>
        {children}
      </div>
    </div>
  )
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = Object.assign(document.createElement('textarea'), { value: text })
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } finally { ta.remove() }
  return Promise.resolve()
}

export function download(name, text, type = 'text/csv') {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + text], { type: `${type};charset=utf-8` })), download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Invite menu: the clean session link, a QR code, and a full-screen QR for the meeting room screen.
export function Invite({ url, t, primary }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [big, setBig] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])
  const copy = () => copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ${primary ? 'primary' : 'ghost'} sm`} onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="link" /> <span className="es-hide-xs">{t.invite}</span></button>
      {open && (
        <div className="menu right invite-menu">
          <p className="menu-hint">{t.inviteHint}</p>
          <div className="menu-form"><input readOnly value={url} onFocus={e => e.target.select()} aria-label={t.link} /><button className="btn primary sm" onClick={copy}>{copied ? t.copied : t.copy}</button></div>
          <div className="invite-qr"><QR text={url} size={150} /><span className="muted small">{t.scan}</span></div>
          <button className="menu-item" onClick={() => { setBig(true); setOpen(false) }}><Icon name="expand" /> {t.showQr}</button>
        </div>
      )}
      {big && (
        <Dialog label={t.scan} onClose={() => setBig(false)}>
          <div className="es-bigqr">
            <h2>{t.scan}</h2>
            <QR text={url} size={300} />
            <p className="muted small es-url">{url}</p>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export function Bar({ value, max, over }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return <span className={`es-bar ${over ? 'over' : ''}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
}
