// "Your drawings": the home/switcher for cloud drawings, and the gate shown while a shared drawing opens.
import { useEffect, useMemo, useRef, useState } from 'react'
import { workspacesOf, openWorkspace, forgetWorkspace } from '../../../shared/cloud/cloud.mjs'
import Icon from './icons.jsx'
import { APP, metaOf, saveMeta, forgetMeta, loadDrawing, renameDrawing, duplicateDrawing } from './drawingStore.js'

function useAgo(lang) {
  const rel = useMemo(() => new Intl.RelativeTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { numeric: 'auto' }), [lang])
  const date = useMemo(() => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { day: 'numeric', month: 'short', year: 'numeric' }), [lang])
  const when = ts => {
    const s = (Date.now() - ts) / 1000
    if (s < 3600) return rel.format(-Math.max(1, Math.floor(s / 60)), 'minute')
    if (s < 86400) return rel.format(-Math.floor(s / 3600), 'hour')
    if (s < 86400 * 7) return rel.format(-Math.floor(s / 86400), 'day')
    return date.format(ts)
  }
  // "Edited 5 minutes ago" / "5分钟前编辑"
  return (ts, t) => (Date.now() - ts < 60000 ? t.editedNow : lang === 'zh' ? `${when(ts)}编辑` : `${t.edited} ${when(ts)}`)
}

export function DrawingsPanel({ t, lang, currentId, currentName, currentThumb, currentData, onRenameCurrent, onNew, onClose }) {
  const [list, setList] = useState(() => workspacesOf(APP))
  const [renaming, setRenaming] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [fresh, setFresh] = useState(null)
  const ago = useAgo(lang)
  const panelRef = useRef(null)
  const nameOf = w => (w.id === currentId ? currentName : w.name) || t.untitled

  useEffect(() => {
    const esc = e => {
      if (e.key !== 'Escape' || renaming) return
      e.stopPropagation()
      if (confirm) setConfirm(null); else onClose()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [renaming, confirm]) // eslint-disable-line react-hooks/exhaustive-deps
  // Focus starts on the open drawing, and goes back where it was when the panel closes.
  useEffect(() => {
    const back = document.activeElement
    panelRef.current?.querySelector('.dw-card.on .dw-thumb, .dw-new')?.focus()
    return () => { if (back?.isConnected) back.focus() }
  }, [])

  const run = async (key, fn) => {
    setBusy(key); setError(null)
    try { await fn() } catch { setError(t.createFail) }
    setBusy(null)
  }
  const startRename = w => { setConfirm(null); setRenaming(w.id); setDraft(w.id === currentId ? currentName : w.name) }
  const commitRename = w => {
    const name = draft.trim().slice(0, 120)
    setRenaming(null)
    if (name === ((w.id === currentId ? currentName : w.name) || '')) return
    if (w.id === currentId) { onRenameCurrent(name); setList(l => l.map(x => (x.id === w.id ? { ...x, name } : x))); return }
    run(`rename-${w.id}`, async () => {
      await renameDrawing(w.id, name)
      setList(workspacesOf(APP))
    })
  }
  const duplicate = w => run(`dup-${w.id}`, async () => {
    const data = w.id === currentId ? currentData() : await loadDrawing(w.id)
    const id = await duplicateDrawing(data, t.copyOf(nameOf(w)))
    const thumb = w.id === currentId ? currentThumb : metaOf(w.id).thumb
    saveMeta(id, { edited: Date.now(), ...(thumb ? { thumb } : null) })
    setList(workspacesOf(APP))
    setFresh(id)
  })
  const remove = w => {
    forgetWorkspace(APP, w.id)
    forgetMeta(w.id)
    setConfirm(null)
    setList(l => l.filter(x => x.id !== w.id))
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal drawings" role="dialog" aria-modal="true" aria-label={t.drawings} ref={panelRef}>
        <div className="modal-head"><h2>{t.drawings}</h2><button className="ui-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button></div>
        {error && <p className="dw-error" role="alert">{error}</p>}
        <ul className="dw-grid">
          <li className="dw-card">
            <button className="dw-new" onClick={() => run('new', onNew)} disabled={busy === 'new'}>
              <Icon name="plus" size={22} />
              <span>{busy === 'new' ? t.creating : t.newDrawing}</span>
            </button>
          </li>
          {list.map(w => {
            const on = w.id === currentId
            const meta = metaOf(w.id)
            const thumb = on ? currentThumb : meta.thumb
            const edited = meta.edited
            const name = nameOf(w)
            return (
              <li key={w.id} className={`dw-card ${on ? 'on' : ''} ${fresh === w.id ? 'fresh' : ''}`}>
                <button className="dw-thumb" onClick={() => (on ? onClose() : openWorkspace(w.id))} aria-label={`${t.openIt}: ${name}`} title={on ? t.openNow : t.openIt}>
                  {thumb ? <img src={thumb} alt="" /> : <span className="dw-blank"><Icon name="drawings" size={22} /></span>}
                  {on && <span className="dw-badge">{t.openNow}</span>}
                </button>
                <div className="dw-info">
                  {renaming === w.id ? (
                    <form className="dw-rename" onSubmit={e => { e.preventDefault(); commitRename(w) }}>
                      <input autoFocus value={draft} maxLength={120} aria-label={t.name} placeholder={t.untitled}
                        onChange={e => setDraft(e.target.value)} onFocus={e => e.target.select()}
                        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(null) } }}
                        onBlur={() => commitRename(w)} />
                    </form>
                  ) : <span className="dw-name" title={name}>{name}</span>}
                  <span className="dw-time">{busy?.endsWith(w.id) ? t.creating : edited ? ago(edited, t) : t.notSeen}</span>
                </div>
                {confirm === w.id ? (
                  <div className="dw-confirm" role="alertdialog" aria-label={t.remove}>
                    <p>{t.removeAsk}</p>
                    <div className="dw-confirm-btns">
                      <button className="btn" autoFocus onClick={() => setConfirm(null)}>{t.cancel}</button>
                      <button className="btn danger" onClick={() => remove(w)}>{t.removeYes}</button>
                    </div>
                  </div>
                ) : (
                  <div className="dw-actions">
                    <button className="prop-btn" aria-label={`${t.rename}: ${name}`} title={t.rename} onClick={() => startRename(w)} disabled={!!busy}><Icon name="pencil" size={16} /></button>
                    <button className="prop-btn" aria-label={`${t.duplicate2}: ${name}`} title={t.duplicate2} onClick={() => duplicate(w)} disabled={!!busy}><Icon name="duplicate" size={16} /></button>
                    {!on && <button className="prop-btn" aria-label={`${t.remove}: ${name}`} title={t.remove} onClick={() => { setRenaming(null); setConfirm(w.id) }}><Icon name="trash" size={16} /></button>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="dw-note">{t.listNote}</p>
      </div>
    </div>
  )
}

// Covers the canvas while a drawing this browser hasn't seen yet loads, or when its link is dead.
export function DrawingGate({ t, status, onDrawings, onSaveAsNew, onNew }) {
  const missing = status === 'missing'
  return (
    <div className="gate" role="status" aria-live="polite">
      <div className="gate-card">
        {missing ? <>
          <h2>{t.missingTitle}</h2>
          <p>{t.missingBody}</p>
          {onSaveAsNew && <p className="muted">{t.missingLocal}</p>}
          <div className="modal-actions">
            <button className="btn" onClick={onDrawings}>{t.drawings}</button>
            {onSaveAsNew
              ? <button className="btn primary" onClick={onSaveAsNew}>{t.saveAsNew}</button>
              : <button className="btn primary" onClick={onNew}>{t.newDrawing}</button>}
          </div>
        </> : <>
          <span className={`gate-spin ${status === 'offline' ? 'off' : ''}`} aria-hidden="true" />
          <p>{status === 'offline' ? t.openingOffline : t.opening}</p>
          <div className="modal-actions"><button className="btn" onClick={onDrawings}>{t.drawings}</button></div>
        </>}
      </div>
    </div>
  )
}
