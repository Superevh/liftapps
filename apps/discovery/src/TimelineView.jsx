import { useState } from 'react'
import { useStore, fieldById, getValue, optionById, bucketsFor, bucketOf, COLORS } from './store.jsx'
import { BucketLabel } from './fields.jsx'
import { openIdea } from './App.jsx'
import { useT } from './lang.js'

const toIdx = m => { const [y, mo] = m.split('-').map(Number); return y * 12 + (mo - 1) }
const fromIdx = i => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
const COL_W = 110
const LABEL_W = 220

export default function TimelineView({ view, ideas, mode, readOnly, selectedKey }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [drag, setDrag] = useState(null)
  const df = fieldById(state, view.dateField)
  const gf = view.groupBy && fieldById(state, view.groupBy)
  const cf = fieldById(state, 'status')
  if (!df) return <div className="empty">{t('Choose a date range field.')}</div>
  const editable = !readOnly && !view.archive

  const now = new Date()
  const today = now.getFullYear() * 12 + now.getMonth()
  const scheduled = ideas.filter(i => getValue(state, i, df.id)?.start)
  const unscheduled = ideas.filter(i => !getValue(state, i, df.id)?.start)
  const starts = scheduled.map(i => toIdx(getValue(state, i, df.id).start))
  const ends = scheduled.map(i => toIdx(getValue(state, i, df.id).end))
  const first = Math.min(today - 1, ...starts) - 1
  const last = Math.max(today + 6, ...ends) + 1
  const months = Array.from({ length: last - first + 1 }, (_, k) => first + k)
  const locale = t.lang === 'zh' ? 'zh-CN' : 'en-AU'

  const groups = gf
    ? bucketsFor(state, gf).map(g => ({ ...g, ideas: scheduled.filter(i => bucketOf(state, i, gf) === g.id) })).filter(g => g.ideas.length)
    : [{ id: '__all', ideas: scheduled }]

  const begin = (e, idea, kind) => {
    if (!editable) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const v = getValue(state, idea, df.id)
    setDrag({ key: idea.key, kind, x0: e.clientX, s: toIdx(v.start), e: toIdx(v.end), ds: 0, de: 0, moved: false })
  }
  const move = e => {
    if (!drag) return
    const d = Math.round((e.clientX - drag.x0) / COL_W)
    const moved = drag.moved || Math.abs(e.clientX - drag.x0) > 4
    if (drag.kind === 'move') setDrag({ ...drag, ds: d, de: d, moved })
    if (drag.kind === 'start') setDrag({ ...drag, ds: Math.min(d, drag.e - drag.s), moved })
    if (drag.kind === 'end') setDrag({ ...drag, de: Math.max(d, drag.s - drag.e), moved })
  }
  const end = idea => {
    if (!drag) return openIdea(mode, view.id, idea.key)
    if (drag.moved && (drag.ds || drag.de)) {
      dispatch({ type: 'SET_VALUE', key: idea.key, field: df.id, value: { start: fromIdx(drag.s + drag.ds), end: fromIdx(drag.e + drag.de) } })
    } else if (!drag.moved) openIdea(mode, view.id, idea.key)
    setDrag(null)
  }

  return (
    <div className="timeline-view">
      <div className="timeline-scroll">
        <div className="tl-grid" style={{ width: LABEL_W + months.length * COL_W }}>
          <div className="tl-head">
            <div className="tl-label-col">{t('Idea')}</div>
            {months.map(m => (
              <div key={m} className={`tl-month ${m === today ? 'now' : ''}`} style={{ width: COL_W }}>
                {new Date(Math.floor(m / 12), m % 12, 1).toLocaleDateString(locale, { month: 'short', ...(m % 12 === 0 || m === first ? { year: 'numeric' } : {}) })}
              </div>
            ))}
          </div>
          <div className="tl-today" style={{ left: LABEL_W + (today - first + now.getDate() / 31) * COL_W }} title={t('Today')} />
          {groups.map(g => (
            <div key={String(g.id)} className="tl-group">
              {gf && <div className="tl-group-head"><BucketLabel bucket={g} field={gf} /> <span className="count-pill">{g.ideas.length}</span></div>}
              {g.ideas.map(i => {
                const v = getValue(state, i, df.id)
                const isDrag = drag?.key === i.key
                const s = toIdx(v.start) + (isDrag ? drag.ds : 0)
                const e = toIdx(v.end) + (isDrag ? drag.de : 0)
                const color = COLORS[optionById(cf, getValue(state, i, cf?.id))?.color ?? 'stone']
                return (
                  <div key={i.key} className={`tl-row ${selectedKey === i.key ? 'selected' : ''}`}>
                    <button className="tl-label-col tl-name" onClick={() => openIdea(mode, view.id, i.key)}>{i.summary}</button>
                    <div className={`tl-bar ${isDrag ? 'dragging' : ''} ${editable ? '' : 'ro'}`}
                      style={{ left: LABEL_W + (s - first) * COL_W + 4, width: (e - s + 1) * COL_W - 8, background: color.bg, borderColor: color.fg, color: color.fg }}
                      onPointerDown={ev => begin(ev, i, 'move')} onPointerMove={move} onPointerUp={() => end(i)}
                      title={`${i.summary} · ${v.start} → ${v.end}`}>
                      {editable && <span className="handle l" onPointerDown={ev => begin(ev, i, 'start')} onPointerMove={move} onPointerUp={ev => { ev.stopPropagation(); end(i) }} />}
                      <span className="tl-bar-text">{i.summary}</span>
                      {editable && <span className="handle r" onPointerDown={ev => begin(ev, i, 'end')} onPointerMove={move} onPointerUp={ev => { ev.stopPropagation(); end(i) }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {unscheduled.length > 0 && (
        <aside className="tl-unscheduled">
          <div className="side-title">{t('Not scheduled')} ({unscheduled.length})</div>
          {unscheduled.map(i => (
            <div key={i.key} className="unsched-row">
              <button className="unplaced" onClick={() => openIdea(mode, view.id, i.key)}>{i.summary}</button>
              {editable && <button className="btn subtle tiny" onClick={() => dispatch({ type: 'SET_VALUE', key: i.key, field: df.id, value: { start: fromIdx(today), end: fromIdx(today + 1) } })}>{t('Schedule')}</button>}
            </div>
          ))}
        </aside>
      )}
    </div>
  )
}
