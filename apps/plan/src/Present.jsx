import { useEffect, useState } from 'react'
import { STATUSES } from './store.js'
import { depInfo, copyText } from './logic.js'
import { longDate } from './format.js'
import { today, toDay } from './dates.js'
import Timeline from './Timeline.jsx'
import Board from './Board.jsx'
import Panel, { MilestonePanel } from './Panel.jsx'
import { ChangeRow } from './Changes.jsx'
import Icon from './icons.jsx'

const localDay = ms => { const d = new Date(ms || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// The calm stakeholder view: no editing chrome, big title, legend, read-only details on click.
export default function Present({ rm, items, t, filtered, onExit, link, onFlash, count = 1, index = 0, onStep, embedded, ws, meId, viewOnly, onShare }) {
  const [width, setWidth] = useState(window.innerWidth)
  const [view, setView] = useState(() => (window.innerWidth < 640 ? 'board' : 'timeline'))
  const [sel, setSel] = useState(null)
  const [showChanges, setShowChanges] = useState(false)
  useEffect(() => { const r = () => setWidth(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])
  useEffect(() => { setSel(null) }, [rm.id])
  const recent = ws ? ws.log.filter(e => e.rm === rm.id && e.at > Date.now() - 14 * 86400000).sort((a, b) => b.at - a.at) : []
  useEffect(() => {
    if (!onStep) return
    const k = e => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight' && count > 1) onStep(1)
      else if (e.key === 'ArrowLeft' && count > 1) onStep(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onStep, count])
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && (sel || showChanges)) { e.stopImmediatePropagation(); setSel(null); setShowChanges(false) } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [sel, showChanges])

  const narrow = width < 640
  const laneW = narrow ? 104 : 190
  // Fit the roadmap's dated span (at least a quarter, at most about a year and a half) to the screen.
  const ds = [...rm.items.filter(i => i.start).flatMap(i => [i.start, i.end]), ...rm.milestones.map(m => m.date)].sort()
  const months = ds.length ? Math.min(18, Math.max(4, (toDay(ds[ds.length - 1]) - toDay(ds[0])) / 30.4 + 1.5)) : 12
  const monthW = Math.max(narrow ? 56 : 36, Math.min(220, Math.floor((width - laneW - 40) / months)))
  const item = sel?.kind === 'item' && rm.items.find(i => i.id === sel.id)
  const ms = sel?.kind === 'ms' && rm.milestones.find(m => m.id === sel.id)
  const conflicts = depInfo(rm).conflicts.size
  const full = () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else el.requestFullscreen?.().catch(() => {}) }

  return (
    <div className={`present ${embedded ? 'embedded' : ''}`}>
      <header className="present-head">
        <div className="present-title">
          <div className="present-kick">
            {viewOnly && <span className="view-badge"><Icon name="eye" size={13} />{t.viewOnlyLive}</span>}
            {count > 1 && <span className="eyebrow">{t.roadmaps} · {index + 1} / {count}</span>}
          </div>
          <h1>{rm.name || t.untitled}</h1>
          {rm.desc && <p className="present-desc">{rm.desc}</p>}
          <p className="present-meta">{t.updatedOn(longDate(t, localDay(rm.updated)))} · {t.itemsCount(items.length)} · {rm.milestones.length} {t.milestones.toLowerCase()}{filtered && <span className="pill">{t.filteredNote}</span>}</p>
        </div>
        <div className="present-tools">
          <div className="seg" role="group" aria-label={t.views}>
            <button className={view === 'timeline' ? 'on' : ''} aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}><Icon name="timeline" size={15} /><span>{t.timeline}</span></button>
            <button className={view === 'board' ? 'on' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}><Icon name="columns" size={15} /><span>{narrow ? t.boardShort : t.board}</span></button>
          </div>
          {onStep && count > 1 && <>
            <button className="icon-btn" aria-label="←" title={t.presentHint} onClick={() => onStep(-1)}><Icon name="chevronL" /></button>
            <button className="icon-btn" aria-label="→" title={t.presentHint} onClick={() => onStep(1)}><Icon name="chevronR" /></button>
          </>}
          {ws && <button className={`btn small ${showChanges ? 'active' : ''}`} aria-pressed={showChanges} onClick={() => { setShowChanges(v => !v); setSel(null) }}><Icon name="history" size={14} />{t.changesTitle}{recent.length > 0 && <span className="badge">{recent.length}</span>}</button>}
          {!link && onShare && <button className="btn small hide-narrow" onClick={onShare}><Icon name="link" size={14} />{t.stakeholderLink}</button>}
          {link && <button className="btn small hide-narrow" onClick={async () => { await copyText(link); onFlash?.(t.copied) }}><Icon name="link" size={14} />{t.stakeholderLink}</button>}
          {!embedded && document.documentElement.requestFullscreen && <button className="icon-btn hide-narrow" aria-label={t.fullscreen} title={t.fullscreen} onClick={full}><Icon name="expand" size={17} /></button>}
          {onExit && <button className="btn small" onClick={onExit}><Icon name="close" size={14} />{t.exitPresent}</button>}
        </div>
      </header>
      <div className="present-body">
        {view === 'timeline'
          ? <Timeline rm={rm} items={items} t={t} readOnly monthW={monthW} laneW={laneW} sel={sel} todayToken={rm.id} filtered={filtered} onSelect={setSel} />
          : <Board rm={rm} items={items} t={t} showDone sel={sel} readOnly onSelect={setSel} />}
        {item && <Panel key={item.id} item={item} rm={rm} t={t} readOnly onClose={() => setSel(null)} />}
        {showChanges && !item && !ms && (
          <aside className="panel" aria-label={t.changesTitle}>
            <div className="panel-head"><span className="panel-kicker"><Icon name="history" size={13} /> {t.changesTitle}</span>
              <button className="icon-btn" aria-label={t.close} title={t.close} onClick={() => setShowChanges(false)}><Icon name="close" /></button></div>
            <p className="muted small">{t.recentNote}</p>
            {recent.length ? <ul className="chg-list compact">{recent.map(e => <ChangeRow key={e.id} e={e} t={t} ws={ws} meId={meId} onOpenItem={id => setSel({ kind: 'item', id })} />)}</ul> : <p className="muted">{t.noChanges}</p>}
          </aside>
        )}
        {ms && <MilestonePanel key={ms.id} ms={ms} rm={rm} t={t} readOnly onClose={() => setSel(null)} />}
      </div>
      <footer className="present-legend" aria-label={t.legend}>
        {STATUSES.map(s => <span key={s} className="lg"><i className={`lg-bar st-${s}`} />{t.st[s]}</span>)}
        <span className="lg"><i className="lg-ms" />{t.milestone}</span>
        <span className="lg"><i className="lg-ms rel" />{t.release}</span>
        {conflicts > 0 && <span className="lg warn"><Icon name="warn" size={13} sw={2.2} />{t.conflictsCount(conflicts)}</span>}
        <span className="grow" />
        {onStep && <span className="muted small hide-narrow">{viewOnly ? t.presentHintView : t.presentHint}</span>}
        <span className="muted small">{longDate(t, today())}</span>
      </footer>
    </div>
  )
}
