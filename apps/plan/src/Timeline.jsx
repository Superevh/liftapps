import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { makeScale, rangeFor, today, toDay, addDays, parts } from './dates.js'
import { PALETTE, DARK } from './store.js'
import Icon from './icons.jsx'

const ROW_H = 36, PAD = 10, MIN_LANE = 64

// Stack overlapping items in a lane into rows.
function pack(items) {
  const sorted = [...items].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1))
  const ends = [], pos = new Map()
  for (const it of sorted) {
    let r = ends.findIndex(e => e < it.start)
    if (r < 0) { r = ends.length; ends.push(it.end) } else ends[r] = it.end
    pos.set(it.id, r)
  }
  return { pos, rows: Math.max(1, ends.length) }
}

export default function Timeline({ rm, t, readOnly, monthW, laneW, selId, todayToken, onSelect, onAdd, onUpdateItem, lanes: laneOps }) {
  const now = today()
  const scroller = useRef(null)
  const [dragging, setDragging] = useState(false)
  const frozen = useRef(null)
  const lastDrag = useRef(0)
  const [viewW, setViewW] = useState(0)
  useLayoutEffect(() => {
    const el = scroller.current
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Fill the visible width with whole quarters.
  const minMonths = Math.ceil(Math.max(0, viewW - laneW) / monthW / 3) * 3
  const range = dragging && frozen.current ? frozen.current : rangeFor(rm.items, now, minMonths)
  frozen.current = range
  const scale = useMemo(() => makeScale(range.y0, range.m0, range.count, monthW), [range.y0, range.m0, range.count, monthW])
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const [colourFor, setColourFor] = useState(null)

  const quarters = useMemo(() => {
    const out = []
    for (const { y, m } of scale.months) {
      const q = Math.ceil(m / 3), last = out[out.length - 1]
      if (last && last.y === y && last.q === q) last.span++
      else out.push({ y, q, span: 1 })
    }
    return out
  }, [scale])

  const scrollToToday = () => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, scale.x(now) - (el.clientWidth - laneW) / 3)
  }
  useLayoutEffect(scrollToToday, [todayToken]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!colourFor) return
    const close = e => { if (!e.target.closest('.colour-pop, .lane-dot')) setColourFor(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [colourFor])

  // ---------- dragging ----------
  const startDrag = (e, it) => {
    if (readOnly || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const mode = e.target.dataset.edge || 'move'
    const d = { id: it.id, mode, sx: e.clientX, sy: e.clientY, orig: { ...it }, moved: false }
    const move = ev => {
      const dx = ev.clientX - d.sx
      if (!d.moved) {
        if (Math.hypot(dx, ev.clientY - d.sy) < 4) return
        d.moved = true
        setDragging(true)
      }
      const s = scaleRef.current, o = d.orig
      let patch
      if (d.mode === 'move') {
        const start = s.date(s.x(o.start) + dx)
        patch = { start, end: addDays(start, toDay(o.end) - toDay(o.start)) }
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-lane]')
        if (lane) patch.laneId = lane.dataset.lane
      } else if (d.mode === 'start') {
        const start = s.date(s.x(o.start) + dx)
        patch = { start: start > o.end ? o.end : start }
      } else {
        const end = s.date(s.xEnd(o.end) + dx - 0.5)
        patch = { end: end < o.start ? o.start : end }
      }
      onUpdateItem(d.id, patch)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (d.moved) { lastDrag.current = Date.now(); setDragging(false) } else onSelect(d.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const clickLane = (e, laneId) => {
    if (readOnly || e.target !== e.currentTarget || Date.now() - lastDrag.current < 300) return
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    onAdd(laneId, scale.date(x))
  }

  const todayX = scale.x(now)
  const showToday = todayX >= 0 && todayX <= scale.width
  const byLane = useMemo(() => {
    const m = new Map(rm.lanes.map(l => [l.id, []]))
    for (const it of rm.items) m.get(it.laneId)?.push(it)
    return m
  }, [rm])
  const nowParts = parts(now)

  return (
    <div className={`tl ${dragging ? 'is-dragging' : ''}`} ref={scroller} style={{ '--mw': `${monthW}px`, '--lw': `${laneW}px` }}>
      <div className="tl-grid" style={{ width: laneW + scale.width }}>
        <div className="tl-head">
          <div className="tl-corner">{t.lanes}</div>
          <div className="tl-cal" style={{ width: scale.width }}>
            <div className="tl-quarters">
              {quarters.map(q => <div key={`${q.y}-${q.q}`} style={{ width: q.span * monthW }}>{t.quarter(q.y, q.q)}</div>)}
            </div>
            <div className="tl-months">
              {scale.months.map(({ y, m }) => (
                <div key={`${y}-${m}`} className={y === nowParts.y && m === nowParts.m ? 'cur' : ''} style={{ width: monthW }}>
                  {t.month(y, m)}{m === 1 && t.yearOnJan && monthW >= 60 ? <small> {y}</small> : null}
                </div>
              ))}
            </div>
            {showToday && <div className="tl-today-tag" style={{ left: todayX }}>{t.today}</div>}
          </div>
        </div>

        <div className="tl-lanes">
          {rm.lanes.map((lane, li) => {
            const items = byLane.get(lane.id) || []
            const { pos, rows } = pack(items)
            const h = Math.max(MIN_LANE, rows * ROW_H + PAD * 2)
            const ink = DARK.has(lane.color) ? '#FBF8F2' : '#2B1E14'
            return (
              <div className="lane" key={lane.id} style={{ '--c': lane.color, '--on-c': ink }}>
                <div className="lane-head" style={{ height: h }}>
                  {readOnly ? <span className="lane-dot static" /> : (
                    <button className="lane-dot" aria-label={t.laneColour} title={t.laneColour} onClick={() => setColourFor(colourFor === lane.id ? null : lane.id)} />
                  )}
                  {readOnly ? <span className="lane-name">{lane.name}</span> : (
                    <input className="lane-name" value={lane.name} aria-label={t.laneName} placeholder={t.laneName} onChange={e => laneOps.rename(lane.id, e.target.value)} />
                  )}
                  {!readOnly && (
                    <div className="lane-tools">
                      <button aria-label={t.moveUp} title={t.moveUp} disabled={li === 0} onClick={() => laneOps.move(lane.id, -1)}><Icon name="up" size={14} /></button>
                      <button aria-label={t.moveDown} title={t.moveDown} disabled={li === rm.lanes.length - 1} onClick={() => laneOps.move(lane.id, 1)}><Icon name="down" size={14} /></button>
                      <button aria-label={t.deleteLane} title={t.deleteLane} disabled={rm.lanes.length === 1} onClick={() => laneOps.remove(lane.id)}><Icon name="trash" size={14} /></button>
                    </div>
                  )}
                  {colourFor === lane.id && (
                    <div className="colour-pop" role="listbox" aria-label={t.laneColour}>
                      {PALETTE.map(p => (
                        <button key={p.id} role="option" aria-selected={p.hex === lane.color} aria-label={p.id} title={p.id} style={{ background: p.hex }}
                          onClick={() => { laneOps.colour(lane.id, p.hex); setColourFor(null) }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className={`lane-body ${readOnly ? '' : 'can-add'}`} data-lane={lane.id} style={{ width: scale.width, height: h }} onClick={e => clickLane(e, lane.id)}>
                  {items.map(it => {
                    const left = scale.x(it.start), w = Math.max(8, scale.xEnd(it.end) - left)
                    return (
                      <div key={it.id} role="button" tabIndex={0} className={`bar st-${it.status} ${selId === it.id ? 'sel' : ''} ${w < 70 ? 'narrow' : ''}`}
                        style={{ left, width: w, top: PAD + pos.get(it.id) * ROW_H }}
                        title={`${it.title || t.untitledItem} · ${t.st[it.status]}`}
                        onPointerDown={e => startDrag(e, it)}
                        onClick={e => { e.stopPropagation(); if (readOnly) onSelect(it.id) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(it.id) } }}>
                        {!readOnly && <span className="edge l" data-edge="start" />}
                        {it.status === 'done' && <Icon name="check" size={13} sw={2.4} />}
                        <span className="bar-title">{it.title || t.untitledItem}</span>
                        {!readOnly && <span className="edge r" data-edge="end" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {showToday && <div className="tl-today" style={{ left: laneW + todayX }} aria-hidden="true" />}
        </div>

        {!readOnly && (
          <div className="tl-foot">
            <button className="add-lane" onClick={laneOps.add}><Icon name="plus" size={15} /> {t.addLane}</button>
            <span className="tl-hint">{t.addHint}</span>
          </div>
        )}
      </div>
    </div>
  )
}
