import { useMemo, useState } from 'react'
import { STATUSES, PRIORITIES, SIZES, colorVar } from './store.js'
import { depInfo, ownersOf } from './logic.js'
import { when } from './format.js'
import Icon from './icons.jsx'

const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? list.length : i }

// A sortable table with inline editing; on phones, a list of compact cards.
export default function ListView({ rm, items, t, sel, narrow, compact, onSelect, onUpdate, onAdd, filtered, onClearFilters }) {
  const [sort, setSort] = useState({ key: 'start', dir: 1 })
  const lanes = useMemo(() => new Map(rm.lanes.map((l, i) => [l.id, { ...l, i }])), [rm.lanes])
  const owners = ownersOf(rm)
  const late = depInfo(rm).late
  const selId = sel?.kind === 'item' ? sel.id : null

  const rows = useMemo(() => {
    const key = sort.key
    const val = it => {
      switch (key) {
        case 'title': return (it.title || '').toLowerCase()
        case 'lane': return lanes.get(it.laneId)?.i ?? 0
        case 'status': return rank(STATUSES, it.status)
        case 'owner': return (it.owner || '￿').toLowerCase()
        case 'progress': return it.progress
        case 'priority': return rank(PRIORITIES, it.priority)
        case 'size': return rank(SIZES, it.size)
        case 'end': return it.end || '9999'
        default: return it.start || '9999-' + ['now', 'next', 'later'].indexOf(it.horizon)
      }
    }
    return [...items].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir })
  }, [items, sort, lanes])

  const head = (key, label, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))} title={t.sortBy(label)}>
        {label}{sort.key === key && <Icon name={sort.dir > 0 ? 'up' : 'down'} size={12} />}
      </button>
    </th>
  )
  const setStart = (it, v) => {
    if (!v) { onUpdate(it.id, { start: '', end: '', horizon: it.horizon || 'next' }); return }
    if (!it.start) onUpdate(it.id, { start: v, end: v, horizon: '' })
    else onUpdate(it.id, v > it.end ? { start: v, end: v } : { start: v })
  }
  const setEnd = (it, v) => { if (!v) return; if (!it.start) onUpdate(it.id, { start: v, end: v, horizon: '' }); else onUpdate(it.id, v < it.start ? { start: v, end: v } : { end: v }) }

  const empty = !items.length && (
    <div className="list-empty">
      {filtered && rm.items.length ? <><b>{t.noMatch}</b><button className="btn small" onClick={onClearFilters}>{t.clearFilters}</button></>
        : <><b>{t.emptyTimeline}</b><button className="btn small" onClick={onAdd}><Icon name="plus" size={14} />{t.addItem}</button></>}
    </div>
  )

  if (narrow) {
    return (
      <div className="list-cards">
        {empty}
        {rows.map(it => {
          const lane = lanes.get(it.laneId)
          return (
            <button key={it.id} className={`lcard ${selId === it.id ? 'sel' : ''}`} style={{ '--c': colorVar(lane?.color) }} onClick={() => onSelect({ kind: 'item', id: it.id })}>
              <span className="lcard-top"><span className="card-lane"><i />{lane?.name}</span><span className={`chip st-${it.status}`}>{t.st[it.status]}</span></span>
              <b>{it.title || t.untitledItem}{late.has(it.id) && <Icon name="warn" size={13} sw={2.2} />}</b>
              <span className="lcard-meta"><span>{when(t, it)}</span>{it.owner && <span>{it.owner}</span>}{it.progress > 0 && it.status !== 'done' && <span>{it.progress}%</span>}</span>
            </button>
          )
        })}
        {items.length > 0 && <button className="col-add wide" onClick={onAdd}><Icon name="plus" size={14} />{t.addItem}</button>}
      </div>
    )
  }

  return (
    <div className="list-wrap">
      <datalist id="pl-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
      <table className="list">
        <colgroup><col /><col style={{ width: 186 }} /><col style={{ width: 120 }} /><col style={{ width: 112 }} /><col style={{ width: 132 }} /><col style={{ width: 132 }} /><col style={{ width: 72 }} />
          {!compact && <><col style={{ width: 96 }} /><col style={{ width: 64 }} /><col style={{ width: 150 }} /></>}<col style={{ width: 44 }} /></colgroup>
        <thead>
          <tr>
            {head('title', t.title, 'c-title')}{head('lane', t.lane)}{head('status', t.status)}{head('owner', t.owner)}
            {head('start', t.start)}{head('end', t.end)}{head('progress', t.progress, 'num')}
            {!compact && <>{head('priority', t.priority)}{head('size', t.size)}<th className="c-tags">{t.themes}</th></>}<th className="c-open"><span className="sr">{t.rowOpen}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(it => {
            const lane = lanes.get(it.laneId)
            return (
              <tr key={it.id} className={selId === it.id ? 'sel' : ''} style={{ '--c': colorVar(lane?.color) }}>
                <td className="c-title">
                  <span className="lane-bar" aria-hidden="true" />
                  <input value={it.title} placeholder={t.untitledItem} aria-label={t.title} onChange={e => onUpdate(it.id, { title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                  {late.has(it.id) && <span className="warn-ico" title={t.lateBadge}><Icon name="warn" size={13} sw={2.2} /></span>}
                </td>
                <td><select value={it.laneId} aria-label={t.lane} onChange={e => onUpdate(it.id, { laneId: e.target.value })}>{rm.lanes.map(l => <option key={l.id} value={l.id}>{l.name || '—'}</option>)}</select></td>
                <td><select className={`st-sel st-${it.status}`} value={it.status} aria-label={t.status} onChange={e => onUpdate(it.id, { status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{t.st[s]}</option>)}</select></td>
                <td><input value={it.owner} list="pl-owners" placeholder="—" aria-label={t.owner} onChange={e => onUpdate(it.id, { owner: e.target.value })} /></td>
                <td className="c-date"><input type="date" className={it.start ? '' : 'empty'} value={it.start} aria-label={t.start} onChange={e => setStart(it, e.target.value)} />{!it.start && <span className="hz-tag">{t.hz[it.horizon]}</span>}</td>
                <td className="c-date"><input type="date" className={it.end ? '' : 'empty'} value={it.end} aria-label={t.end} onChange={e => setEnd(it, e.target.value)} /></td>
                <td className="num"><input type="number" min="0" max="100" step="5" value={it.progress} aria-label={t.progress} onChange={e => onUpdate(it.id, { progress: Math.max(0, Math.min(100, Math.round(+e.target.value || 0))) })} /></td>
                {!compact && <>
                <td><select value={it.priority} aria-label={t.priority} onChange={e => onUpdate(it.id, { priority: e.target.value })}><option value="">—</option>{PRIORITIES.map(p => <option key={p} value={p}>{t.pr[p]}</option>)}</select></td>
                <td><select value={it.size} aria-label={t.size} onChange={e => onUpdate(it.id, { size: e.target.value })}><option value="">—</option>{SIZES.map(p => <option key={p} value={p}>{p}</option>)}</select></td>
                <td className="c-tags" title={it.tags.join(', ')}>{it.tags.map(x => <span key={x} className="tag">{x}</span>)}</td>
                </>}
                <td className="c-open"><button className="icon-btn" aria-label={`${t.rowOpen}: ${it.title || t.untitledItem}`} title={t.rowOpen} onClick={() => onSelect({ kind: 'item', id: it.id })}><Icon name="chevronR" size={16} /></button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {empty}
      {items.length > 0 && <button className="col-add list-add" onClick={onAdd}><Icon name="plus" size={14} />{t.addItem}</button>}
    </div>
  )
}

