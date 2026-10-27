// The sync pill + share menu every workspace app shows in its toolbar.
// <CloudMenu sync={useCloudSync(...)} app="goal" lang="en" onNew={() => ...} />
import { useEffect, useRef, useState } from 'react'
import { openWorkspace, forgetWorkspace } from './cloud.mjs'
import './cloud.css'

const T = {
  en: {
    synced: 'Saved', saving: 'Saving…', connecting: 'Connecting…', offline: 'Offline', missing: 'Link not found', local: 'This device only',
    title: 'Workspace', shareBtn: 'Share', share: 'Share this workspace', shareNote: 'Anyone with the link can view and edit. Changes appear for everyone live.',
    copy: 'Copy link', copied: 'Copied', recent: 'Your workspaces', open: 'Open', current: 'Open now', forget: 'Remove from this list',
    newWs: 'New workspace', untitled: 'Untitled workspace',
    offlineNote: 'Your changes are kept on this device and will be sent when the connection is back.',
    missingNote: 'This link doesn’t point to a workspace (it may have been deleted). Your own work on this device is safe.',
    localNote: 'Cloud saving isn’t set up in this copy of the app, so work stays in this browser. Use export to back it up.',
    tooLarge: 'One change was too large to sync (for example a big image). It is kept on this device only.',
    savedNote: 'Saved to the cloud. Open this workspace on any device with its link.',
  },
  zh: {
    synced: '已保存', saving: '保存中…', connecting: '连接中…', offline: '离线', missing: '链接无效', local: '仅此设备',
    title: '工作区', shareBtn: '分享', share: '分享这个工作区', shareNote: '拿到链接的人都可以查看和编辑，改动会实时同步给所有人。',
    copy: '复制链接', copied: '已复制', recent: '你的工作区', open: '打开', current: '当前', forget: '从列表移除',
    newWs: '新建工作区', untitled: '未命名工作区',
    offlineNote: '改动已保存在这台设备上，网络恢复后会自动同步。',
    missingNote: '这个链接没有对应的工作区（可能已被删除）。你在这台设备上的内容不受影响。',
    localNote: '这个版本没有启用云端保存，内容只保存在当前浏览器，请用导出功能备份。',
    tooLarge: '有一处改动太大（比如大图片），无法同步，只保存在这台设备上。',
    savedNote: '已保存到云端。在任何设备上用链接即可打开这个工作区。',
  },
}

// words: optional per-language overrides, e.g. { en: { recent: 'Your drawings' }, zh: { … } } for apps whose
// documents aren't "workspaces".
export function CloudMenu({ sync, app, lang = 'en', onNew, compact, words }) {
  const l = lang === 'zh' ? 'zh' : 'en'
  const t = words?.[l] ? { ...T[l], ...words[l] } : T[l]
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [list, setList] = useState(sync.workspaces)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    setList(sync.workspaces)
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async () => {
    try { await navigator.clipboard.writeText(sync.shareUrl) } catch { /* the input is selectable as a fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const s = sync.status
  const note = s === 'offline' ? t.offlineNote : s === 'missing' ? t.missingNote : s === 'local' ? t.localNote : t.savedNote
  return (
    <div className="lc-menu" ref={ref}>
      <button type="button" className={`lc-pill lc-${s}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)} title={t[s]}>
        <span className="lc-dot" aria-hidden="true" />
        {!compact && <span className="lc-label">{t[s]}</span>}
        {sync.mode === 'cloud' && <span className="lc-share">{t.shareBtn}</span>}
      </button>
      {open && (
        <div className="lc-pop" role="dialog" aria-label={t.title}>
          <p className={`lc-note lc-${s}`}><span className="lc-dot" aria-hidden="true" /> {note}</p>
          {sync.tooLarge && <p className="lc-note lc-offline">{t.tooLarge}</p>}
          {sync.shareUrl && s !== 'missing' && <>
            <h3>{t.share}</h3>
            <div className="lc-link">
              <input readOnly value={sync.shareUrl} onFocus={e => e.target.select()} aria-label={t.share} />
              <button type="button" className="lc-btn primary" onClick={copy}>{copied ? t.copied : t.copy}</button>
            </div>
            <p className="lc-small">{t.shareNote}</p>
          </>}
          {sync.mode === 'cloud' && <>
            <h3>{t.recent}</h3>
            <ul className="lc-list">
              {list.map(w => (
                <li key={w.id} className={w.id === sync.id ? 'on' : ''}>
                  <span className="lc-name">{w.name || t.untitled}</span>
                  {w.id === sync.id
                    ? <span className="lc-small">{t.current}</span>
                    : <>
                      <button type="button" className="lc-btn" onClick={() => openWorkspace(w.id)}>{t.open}</button>
                      <button type="button" className="lc-x" aria-label={t.forget} title={t.forget} onClick={() => { forgetWorkspace(app, w.id); setList(l => l.filter(x => x.id !== w.id)) }}>×</button>
                    </>}
                </li>
              ))}
            </ul>
            {onNew && <button type="button" className="lc-btn wide" onClick={() => { setOpen(false); onNew() }}>+ {t.newWs}</button>}
          </>}
        </div>
      )}
    </div>
  )
}
