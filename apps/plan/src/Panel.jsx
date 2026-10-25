import { useEffect, useRef, useState } from 'react'
import { STATUSES, safeLink } from './store.js'
import { longDate } from './format.js'
import Icon from './icons.jsx'

export default function Panel({ item, rm, t, readOnly, onChange, onDelete, onClose }) {
  const titleRef = useRef(null)
  const [link, setLink] = useState(item.link)
  useEffect(() => { setLink(item.link) }, [item.id, item.link])
  useEffect(() => { if (!readOnly && !item.title) titleRef.current?.focus() }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const lane = rm.lanes.find(l => l.id === item.laneId)

  if (readOnly) {
    return (
      <aside className="panel" aria-label={t.item}>
        <div className="panel-head"><span className="panel-lane" style={{ '--c': lane?.color }}><i />{lane?.name}</span>
          <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button></div>
        <h2 className="panel-title">{item.title || t.untitledItem}</h2>
        <dl className="panel-dl">
          <dt>{t.status}</dt><dd><span className={`chip st-${item.status}`}>{t.st[item.status]}</span></dd>
          <dt>{t.start}</dt><dd>{longDate(t, item.start)}</dd>
          <dt>{t.end}</dt><dd>{longDate(t, item.end)}</dd>
          {item.note && <><dt>{t.note}</dt><dd className="note">{item.note}</dd></>}
          {item.link && <><dt>{t.link}</dt><dd><a href={item.link} target="_blank" rel="noopener noreferrer">{item.link}</a></dd></>}
        </dl>
      </aside>
    )
  }

  const setStart = v => { if (!v) return; onChange(v > item.end ? { start: v, end: v } : { start: v }) }
  const setEnd = v => { if (!v) return; onChange(v < item.start ? { start: v, end: v } : { end: v }) }
  return (
    <aside className="panel" aria-label={t.item}>
      <div className="panel-head">
        <span className="panel-kicker">{t.item}</span>
        <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button>
      </div>
      <label className="field"><span>{t.title}</span>
        <input ref={titleRef} value={item.title} placeholder={t.newItem} onChange={e => onChange({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
      <label className="field"><span>{t.lane}</span>
        <select value={item.laneId} onChange={e => onChange({ laneId: e.target.value })}>
          {rm.lanes.map(l => <option key={l.id} value={l.id}>{l.name || '—'}</option>)}
        </select></label>
      <div className="field-row">
        <label className="field"><span>{t.start}</span><input type="date" value={item.start} onChange={e => setStart(e.target.value)} /></label>
        <label className="field"><span>{t.end}</span><input type="date" value={item.end} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <div className="field"><span>{t.status}</span>
        <div className="status-seg" role="radiogroup" aria-label={t.status}>
          {STATUSES.map(s => <button key={s} role="radio" aria-checked={item.status === s} className={`st-${s} ${item.status === s ? 'on' : ''}`} onClick={() => onChange({ status: s })}>{t.st[s]}</button>)}
        </div>
      </div>
      <label className="field"><span>{t.note}</span>
        <textarea rows={4} value={item.note} onChange={e => onChange({ note: e.target.value })} /></label>
      <label className="field"><span>{t.link}</span>
        <div className="link-row">
          <input value={link} placeholder={t.linkPh} inputMode="url" onChange={e => setLink(e.target.value)} onBlur={() => { const v = safeLink(link); setLink(v); if (v !== item.link) onChange({ link: v }) }} />
          {item.link && <a className="icon-btn" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={t.openLinkShort} title={t.openLinkShort}><Icon name="link" /></a>}
        </div></label>
      <div className="panel-foot">
        <button className="text-btn danger" onClick={onDelete}><Icon name="trash" size={15} /> {t.deleteItem}</button>
      </div>
    </aside>
  )
}
