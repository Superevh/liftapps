import { useEffect, useRef, useState } from 'react'
import { COLORS } from './store.jsx'
import { useT, translate } from './lang.js'

const PATHS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  filter: 'M4 6h16M7 12h10M10 18h4',
  sort: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
  fields: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h10',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  board: 'M4 4h5v16H4zM10 4h4v10h-4zM15 4h5v7h-5z',
  matrix: 'M4 4v16h16M8 14h.01M12 9h.01M16 12h.01M10 17h.01',
  timeline: 'M4 6h9M8 12h12M6 18h8',
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  sidebar: 'M4 4h16v16H4zM9 4v16',
  menu: 'M4 7h16M4 12h16M4 17h16',
  archive: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
  restore: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  folder: 'M3 7h7l2 2h9v10H3z',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  vote: 'M7 11l5-6 5 6M12 5v14',
  check: 'M5 12l4 4 10-10',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  delivery: 'M4 7h11v10H4zM15 10h3l2 3v4h-5M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  comment: 'M4 5h16v11H9l-5 4z',
  fx: 'M10 4c-2 0-3 1-3 3v13M4 10h7M14 10l6 8M20 10l-6 8',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
}

export const VIEW_ICONS = { list: 'list', board: 'board', matrix: 'matrix', timeline: 'timeline' }

export function Icon({ name, size = 16, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

export const initials = name => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return /[一-鿿]/.test(name) ? name.slice(-2) : name.slice(0, 2).toUpperCase()
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export function Avatar({ user, size = 24 }) {
  const t = useT()
  if (!user) {
    return <span className="avatar unassigned" style={{ width: size, height: size }} title={t('Unassigned')}><Icon name="user" size={size * 0.6} /></span>
  }
  return (
    <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }} title={user.name}>
      {initials(user.name)}
    </span>
  )
}

export function Chip({ option, onRemove }) {
  if (!option) return null
  const c = COLORS[option.color] ?? COLORS.stone
  return (
    <span className="chip" style={{ background: c.bg, color: c.fg }}>
      {option.label}
      {onRemove && <button className="chip-x" aria-label={`Remove ${option.label}`} onClick={e => { e.stopPropagation(); onRemove() }}>×</button>}
    </span>
  )
}

export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onOutside() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOutside, active])
}

// Trigger + menu. `keepOpen` leaves it open after a selection (multi-select).
export function Dropdown({ trigger, options, onSelect, render, align = 'left', searchable, keepOpen, footer, className = '' }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  const shown = searchable && q ? options.filter(o => String(o.label).toLowerCase().includes(q.toLowerCase())) : options
  return (
    <div className={`dropdown ${className}`} ref={ref} onClick={e => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div className={`menu align-${align}`} role="listbox">
          {searchable && <input autoFocus className="menu-search" placeholder={t('Search…')} value={q} onChange={e => setQ(e.target.value)} />}
          {shown.map(o => (
            <button key={String(o.value)} role="option" aria-selected={!!o.selected} className={`menu-item ${o.selected ? 'selected' : ''}`}
              onClick={() => { onSelect(o.value); if (!keepOpen) { setOpen(false); setQ('') } }}>
              {render ? render(o) : o.label}
            </button>
          ))}
          {shown.length === 0 && <div className="menu-empty">{t('No matches')}</div>}
          {footer && footer({ close: () => setOpen(false), query: q })}
        </div>
      )}
    </div>
  )
}

export function Popover({ trigger, children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  return (
    <div className="dropdown" ref={ref}>
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && <div className={`popover align-${align} ${className}`}>{children({ close: () => setOpen(false) })}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide, className = '' }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  )
}

export function timeAgo(at, lang) {
  const tr = (s, v) => translate(lang, s, v)
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return tr('just now')
  const m = Math.round(s / 60)
  if (m < 60) return tr(m === 1 ? '1 minute ago' : '{n} minutes ago', { n: m })
  const h = Math.round(m / 60)
  if (h < 24) return tr(h === 1 ? '1 hour ago' : '{n} hours ago', { n: h })
  const d = Math.round(h / 24)
  if (d < 30) return tr(d === 1 ? '1 day ago' : '{n} days ago', { n: d })
  return new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function InlineText({ value, onSave, className = '', placeholder, multiline, readOnly, label }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => {
    setEditing(false)
    if (v.trim() && v !== value) onSave(v.trim())
    else setV(value)
  }
  if (readOnly || !editing) {
    return (
      <div className={`inline-text ${readOnly ? 'ro' : ''} ${className}`} role={readOnly ? undefined : 'button'} tabIndex={readOnly ? undefined : 0}
        aria-label={readOnly ? undefined : label} onClick={() => !readOnly && setEditing(true)} onKeyDown={e => !readOnly && e.key === 'Enter' && setEditing(true)}>
        {value || <span className="muted">{placeholder}</span>}
      </div>
    )
  }
  const Field = multiline ? 'textarea' : 'input'
  return (
    <Field autoFocus aria-label={label} className={`inline-input ${className}`} value={v} onChange={e => setV(e.target.value)} onBlur={commit}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
        if (e.key === 'Escape') { setV(value); setEditing(false) }
      }} />
  )
}

// Minimal rendering: blank-line paragraphs and "- " bullet lists.
export function RichText({ text }) {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((b, i) => {
    const lines = b.split('\n')
    if (lines.every(l => /^[-*] ?/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.replace(/^[-*] ?/, '') || ' '}</li>)}</ul>
    return <p key={i}>{lines.map((l, j) => <span key={j}>{l}{j < lines.length - 1 && <br />}</span>)}</p>
  })
}

// Triggers a file download from a string (CSP allows blob: URLs).
export function downloadText(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
