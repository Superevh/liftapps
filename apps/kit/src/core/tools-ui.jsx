import { useRef, useState } from 'react'
import { useLang } from './lang.js'
import { Icon } from './icons.jsx'
import { QR } from './qr.jsx'
import { useClickOutside } from './ui.jsx'

// Pieces shared by the live tools.

const T = {
  en: { invite: 'Invite', inviteHint: 'Anyone with this link can join. No account needed.', copy: 'Copy link', copied: 'Copied!', scan: 'Scan to join from a phone', loading: 'Loading…', missing: 'Not found', missingHint: 'It may have been deleted, or the link is incomplete.', offline: 'Live sessions are not configured on this copy.' },
  zh: { invite: '邀请', inviteHint: '任何拿到链接的人都能加入，无需注册。', copy: '复制链接', copied: '已复制！', scan: '手机扫码加入', loading: '加载中…', missing: '没有找到', missingHint: '可能已被删除，或链接不完整。', offline: '此版本未配置实时会话。' },
}

export function InviteButton({ primary }) {
  const lang = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  const url = window.location.href
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ${primary ? 'primary' : 'ghost'}`} onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="link" /> {t.invite}</button>
      {open && (
        <div className="menu right invite-menu">
          <p className="menu-hint">{t.inviteHint}</p>
          <div className="menu-form"><input readOnly value={url} onFocus={e => e.target.select()} aria-label="Link" /><button className="btn primary sm" onClick={copy}>{copied ? t.copied : t.copy}</button></div>
          <div className="invite-qr"><QR text={url} size={150} /><span className="muted small">{t.scan}</span></div>
        </div>
      )}
    </div>
  )
}

export function DocStatus({ status }) {
  const t = T[useLang()]
  if (status === 'loading') return <div className="empty-page"><span className="spinner" aria-hidden="true" /><p className="muted">{t.loading}</p></div>
  if (status === 'offline') return <div className="empty-page"><p className="muted">{t.offline}</p></div>
  return <div className="empty-page"><h2>{t.missing}</h2><p className="muted">{t.missingHint}</p></div>
}

export const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')

export const ago = (at, lang) => {
  const days = Math.floor((Date.now() - at) / 86400000)
  return new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined })
}

// "How to use" panel shown on every tool. Pass steps/tips from the tool's own T dict, or `content`
// as { en: { steps, tips }, zh: { steps, tips } } (see howto.js). steps: [[title, text], …], tips: [text, …].
// Collapsed by default so it never pushes the tool down; opening it is remembered per tool.
const HOW = { en: { title: 'How to use', tips: 'Tips' }, zh: { title: '使用方法', tips: '小贴士' } }

export function HowTo({ tool, content, steps, tips }) {
  const lang = useLang()
  const t = HOW[lang]
  steps = steps ?? content?.[lang].steps ?? []
  tips = tips ?? content?.[lang].tips ?? []
  const key = `lift-howto2-${tool}` // v2: the live site used to open it by default and may have saved "open"
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === 'open' } catch { return false } })
  const toggle = e => {
    const next = e.currentTarget.open
    setOpen(next)
    try { localStorage.setItem(key, next ? 'open' : 'closed') } catch { /* private mode */ }
  }
  return (
    <details className="tool-card howto" open={open} onToggle={toggle}>
      <summary><Icon name="info" /> {t.title}</summary>
      <ol className="howto-steps">
        {steps.map(([title, text], i) => <li key={i}><span className="howto-n">{i + 1}</span><div><b>{title}</b><p>{text}</p></div></li>)}
      </ol>
      {tips.length > 0 && <div className="howto-tips"><b>{t.tips}</b><ul>{tips.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    </details>
  )
}
