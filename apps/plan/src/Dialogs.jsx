import { useEffect, useRef, useState } from 'react'
import { TEMPLATE_IDS } from './store.js'
import { copyText } from './logic.js'
import Icon from './icons.jsx'

// Modal shell: focus goes in on open and back to the trigger on close; Esc and the backdrop close it;
// Tab stays inside.
export function Modal({ title, onClose, children, wide, id = 'dlg' }) {
  const ref = useRef(null)
  useEffect(() => {
    const back = document.activeElement
    const first = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('input, select, textarea, button:not(.dlg-x)')
    first?.focus()
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab') return
      const f = [...ref.current.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('keydown', key, true); if (back && document.contains(back)) back.focus?.({ preventScroll: true }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} ref={ref}>
        <div className="dialog-head"><h2 id={`${id}-h`}>{title}</h2><button className="icon-btn dlg-x" aria-label="×" title="Esc" onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ t, title, body, action, onOk, onClose }) {
  return (
    <Modal title={title} onClose={onClose} id="confirm">
      <p>{body}</p>
      <div className="dialog-actions">
        <button className="btn" onClick={onClose} data-autofocus>{t.cancel}</button>
        <button className="btn danger-btn" onClick={() => { onClose(); onOk() }}><Icon name="trash" size={15} />{action}</button>
      </div>
    </Modal>
  )
}

export function TemplateDialog({ t, preset, example, onCreate, onClose }) {
  const [pick, setPick] = useState(preset || 'product')
  const [ex, setEx] = useState(true)
  const [rep, setRep] = useState(true)
  const [name, setName] = useState('')
  const go = id => onCreate(id, ex && id !== 'blank', example && rep, name)
  return (
    <Modal title={t.startFromTemplate} onClose={onClose} wide id="tpl">
      <div className="tpl-pick" role="radiogroup" aria-label={t.startFromTemplate}>
        {TEMPLATE_IDS.map(id => (
          <button key={id} role="radio" aria-checked={pick === id} tabIndex={pick === id ? 0 : -1} className={`tpl-card tpl-${id} ${pick === id ? 'on' : ''}`}
            onClick={e => { setPick(id); e.currentTarget.focus() }} onDoubleClick={() => go(id)} data-autofocus={pick === id ? true : undefined}
            onKeyDown={e => {
              const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
              if (!k) return
              e.preventDefault()
              const next = TEMPLATE_IDS[(TEMPLATE_IDS.indexOf(pick) + k + TEMPLATE_IDS.length) % TEMPLATE_IDS.length]
              setPick(next)
              e.currentTarget.parentElement.querySelector(`.tpl-${next}`)?.focus()
            }}>
            <span className="tpl-art" aria-hidden="true"><i /><i /><i /></span>
            <b>{t.tpl[id][0]}</b><span>{t.tpl[id][1]}</span>
          </button>
        ))}
      </div>
      <label className="field tpl-name"><span>{t.roadmapName}</span>
        <input value={name} maxLength={120} placeholder={t.tpl[pick][0]} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go(pick) }} /></label>
      <div className="dialog-actions spread">
        <div className="checks">
          {pick !== 'blank' && <label className="check"><input type="checkbox" checked={ex} onChange={e => setEx(e.target.checked)} /> {t.withExamples}</label>}
          {example && <label className="check"><input type="checkbox" checked={rep} onChange={e => setRep(e.target.checked)} /> {t.replaceExample}</label>}
        </div>
        <div className="row-btns">
          <button className="btn" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" onClick={() => go(pick)}>{t.create}</button>
        </div>
      </div>
    </Modal>
  )
}

export function SnapshotDialog({ t, url, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal title={t.snapshotTitle} onClose={onClose} id="snap">
      <p>{t.snapshotBody}</p>
      <input className="share-url" readOnly value={url} onFocus={e => e.target.select()} aria-label={t.snapshotTitle} />
      <p className="muted small">{t.chars(url.length)}</p>
      <div className="dialog-actions">
        <a className="btn" href={url} target="_blank" rel="noopener">{t.openLink}</a>
        <button className="btn primary" onClick={async () => { await copyText(url); setCopied(true) }}><Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? t.copied : t.copyLink}</button>
      </div>
    </Modal>
  )
}

export function ViewLinkDialog({ t, url, onCreate, onStop, onClose }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={t.viewLinkTitle} onClose={onClose} id="viewlink">
      <p>{t.viewLinkBody}</p>
      {url ? <>
        <input className="share-url" readOnly value={url} onFocus={e => e.target.select()} aria-label={t.viewLinkTitle} />
        <p className="muted small">{t.viewLinkNote}</p>
        <div className="dialog-actions spread">
          <button className="btn danger-btn" onClick={() => { onStop(); onClose() }}>{t.viewLinkStop}</button>
          <div className="row-btns">
            <a className="btn" href={url} target="_blank" rel="noopener">{t.openLink}</a>
            <button className="btn primary" onClick={async () => { await copyText(url); setCopied(true) }} data-autofocus><Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? t.copied : t.copyLink}</button>
          </div>
        </div>
      </> : <>
        <p className="muted small">{t.viewLinkNote}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onCreate(); setBusy(false) }} data-autofocus><Icon name="eye" size={15} /> {t.viewLinkCreate}</button>
        </div>
      </>}
    </Modal>
  )
}

export function ShortcutsDialog({ t, onClose }) {
  return (
    <Modal title={t.shortcuts} onClose={onClose} id="keys">
      <dl className="keys">{t.keys.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
      <div className="dialog-actions"><button className="btn" onClick={onClose}>{t.close}</button></div>
    </Modal>
  )
}

export function NameDialog({ t, value, onSave, onClose }) {
  const [v, setV] = useState(value)
  return (
    <Modal title={t.yourName} onClose={onClose} id="name">
      <form onSubmit={e => { e.preventDefault(); onSave(v) }}>
        <label className="field"><span>{t.yourName}</span><input value={v} maxLength={40} placeholder={t.namePh} onChange={e => setV(e.target.value)} data-autofocus /></label>
        <p className="muted small">{t.nameHelp}</p>
        <div className="dialog-actions"><button type="button" className="btn" onClick={onClose}>{t.cancel}</button><button className="btn primary">{t.save}</button></div>
      </form>
    </Modal>
  )
}

export function DetailsDialog({ t, rm, onSave, onClose }) {
  const [name, setName] = useState(rm.name)
  const [desc, setDesc] = useState(rm.desc || '')
  return (
    <Modal title={t.rmDetails} onClose={onClose} id="details">
      <form onSubmit={e => { e.preventDefault(); onSave({ name: name.trim() || t.untitled, desc: desc.trim() }) }}>
        <label className="field"><span>{t.roadmapName}</span><input value={name} maxLength={120} onChange={e => setName(e.target.value)} data-autofocus /></label>
        <label className="field"><span>{t.description}</span><textarea rows={3} maxLength={600} value={desc} onChange={e => setDesc(e.target.value)} /></label>
        <div className="dialog-actions"><button type="button" className="btn" onClick={onClose}>{t.cancel}</button><button className="btn primary">{t.save}</button></div>
      </form>
    </Modal>
  )
}
