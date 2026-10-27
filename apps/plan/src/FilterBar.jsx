import { useEffect, useRef } from 'react'
import { STATUSES, colorVar } from './store.js'
import { filterCount, ownersOf, tagsOf, NO_FILTERS } from './logic.js'
import Icon from './icons.jsx'

// Search + filters (shared by Timeline, Board and List) and the current view's own controls.
export default function FilterBar({ t, rm, ui, patchUi, filters, setFilters, open, setOpen, searchRef, shown, total, narrow, onToday, zoom, setZoom, maxZoom }) {
  const popRef = useRef(null)
  const n = filterCount(filters)
  const owners = ownersOf(rm), tags = tagsOf(rm)
  useEffect(() => {
    if (!open) return
    const away = e => { if (!popRef.current?.contains(e.target) && !e.target.closest('.filter-btn')) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open, setOpen])
  const toggle = (key, v) => setFilters(f => ({ ...f, [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }))
  const laneName = id => rm.lanes.find(l => l.id === id)?.name || '—'
  const chips = [
    ...filters.status.map(v => ['status', v, t.st[v]]), ...filters.lane.filter(v => rm.lanes.some(l => l.id === v)).map(v => ['lane', v, laneName(v)]),
    ...filters.owner.map(v => ['owner', v, v || t.unassigned]), ...filters.tag.map(v => ['tag', v, v || t.noTheme]),
  ]
  const group = (key, label, values) => values.length > 0 && (
    <fieldset className="f-group">
      <legend>{label}</legend>
      <div className="f-chips">
        {values.map(([v, text, extra]) => (
          <button key={v || '_'} className={`f-chip ${filters[key].includes(v) ? 'on' : ''}`} aria-pressed={filters[key].includes(v)} onClick={() => toggle(key, v)}>{extra}{text}</button>
        ))}
      </div>
    </fieldset>
  )
  const quarters = zoom <= 1

  return (
    <div className="subbar">
      <label className="search">
        <Icon name="search" size={15} />
        <input ref={searchRef} type="search" value={filters.q} placeholder={t.search} aria-label={t.search}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} onKeyDown={e => { if (e.key === 'Escape') { setFilters(f => ({ ...f, q: '' })); e.currentTarget.blur() } }} />
      </label>
      <div className="filter-wrap">
        <button className={`btn small filter-btn ${n ? 'active' : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} title={`${t.filter} (F)`}>
          <Icon name="filter" size={14} /><span className="hide-narrow">{t.filter}</span>{n > 0 && <span className="badge">{n}</span>}
        </button>
        {open && (
          <div className="filter-pop" role="dialog" aria-label={t.filters} ref={popRef}>
            {group('status', t.status, STATUSES.map(s => [s, t.st[s], <i key="d" className={`chip-dot st-${s}`} />]))}
            {group('lane', t.lane, rm.lanes.map(l => [l.id, l.name || '—', <i key="d" className="lane-mini" style={{ background: colorVar(l.color) }} />]))}
            {group('owner', t.owner, [...owners.map(o => [o, o]), ['', t.unassigned]])}
            {group('tag', t.themes, [...tags.map(x => [x, x]), ['', t.noTheme]])}
            <div className="f-foot"><span className="muted small">{t.shownOf(shown, total)}</span><button className="btn small ghost" disabled={!n} onClick={() => setFilters({ ...NO_FILTERS })}>{t.clearFilters}</button></div>
          </div>
        )}
      </div>
      {!narrow && chips.length > 0 && (
        <div className="active-chips">
          {chips.map(([k, v, label]) => <button key={k + v} className="f-chip on sm" onClick={() => toggle(k, v)} aria-label={`${t.clear}: ${label}`}>{label}<span aria-hidden="true">×</span></button>)}
        </div>
      )}
      {n > 0 && <span className="shown muted small hide-narrow">{t.shownOf(shown, total)}</span>}
      <span className="grow" />
      {ui.view === 'timeline' && (
        <>
          <label className="mini-select hide-narrow"><span>{t.groupBy}</span>
            <select value={ui.groupBy} onChange={e => patchUi({ groupBy: e.target.value })}>{['lane', 'status', 'owner', 'theme'].map(g => <option key={g} value={g}>{t.gb[g]}</option>)}</select></label>
          <div className="seg hide-narrow" role="group" aria-label={t.zoomIn}>
            <button className={!quarters ? 'on' : ''} aria-pressed={!quarters} onClick={() => setZoom(Math.max(3, zoom))}>{t.months}</button>
            <button className={quarters ? 'on' : ''} aria-pressed={quarters} onClick={() => setZoom(Math.min(1, zoom))}>{t.quarters}</button>
          </div>
          <div className="seg zoom">
            <button aria-label={t.zoomOut} title={`${t.zoomOut} (−)`} disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}><Icon name="minus" size={15} /></button>
            <button aria-label={t.zoomIn} title={`${t.zoomIn} (+)`} disabled={zoom === maxZoom} onClick={() => setZoom(zoom + 1)}><Icon name="plus" size={15} /></button>
          </div>
          <button className="btn small ghost" onClick={onToday} title={`${t.todayBtn} (T)`}><Icon name="today" size={15} /><span className="hide-narrow">{t.todayBtn}</span></button>
        </>
      )}
      {ui.view === 'board' && <label className="check"><input type="checkbox" checked={ui.showDone} onChange={e => patchUi({ showDone: e.target.checked })} /> {t.showDone}</label>}
    </div>
  )
}
