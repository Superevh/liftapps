import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { makeScale, rangeFor, today, toDay, addDays, addMonths, parts } from './dates.js'
import { PALETTE, colorVar, onColorVar } from './store.js'
import { rowsFor, rowKeyOf, depInfo, initials } from './logic.js'
import { dayMonth, when } from './format.js'
import Icon from './icons.jsx'

const ROW_H = 34, BAR_H = 26, PAD = 10, MIN_ROW = 58, MS_ROW = 22

const textW = s => [...(s || '')].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 12.5 : 6.6), 0)
// Stack bars into sub-rows by their on-screen extent, including a label drawn outside a bar too short for it.
function pack(boxes) {
  const sorted = [...boxes].sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2)
  const ends = [], pos = new Map()
  for (const b of sorted) {
    let r = ends.findIndex(e => e + 4 <= b.x1)
    if (r < 0) { r = ends.length; ends.push(b.reach) } else ends[r] = b.reach
    pos.set(b.id, r)
  }
  return { pos, rows: Math.max(1, ends.length) }
}

export default function Timeline({ rm, items, t, readOnly: ro = false, printing = false, monthW: zoomW, laneW: laneWProp, groupBy = 'lane', sel, todayToken, filtered, narrow, collapsed = {}, onToggleRow, onLaneW, onAddDep, onSelect, onAdd, onAddMs, onUpdateItem, onUpdateMs, onDragDone, lanes: laneOps, onClearFilters }) {
  const now = today()
  const readOnly = ro || printing
  const laneW = printing ? 170 : laneWProp
  const idp = printing ? '-p' : '' // unique SVG ids for the print copy
  const scroller = useRef(null)
  const [dragging, setDragging] = useState(false)
  const frozen = useRef(null)
  const lastDrag = useRef(0)
  const [viewW, setViewW] = useState(0)
  const [colourFor, setColourFor] = useState(null)
  const [laneMenu, setLaneMenu] = useState(null)
  const [link, setLink] = useState(null) // dependency being drawn: { x1, y1, x2, y2 }
  const [scrollX, setScrollX] = useState(0)
  const raf = useRef(0)
  const onScroll = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setScrollX(scroller.current?.scrollLeft || 0)) }
  useLayoutEffect(() => {
    const el = scroller.current
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const laneById = useMemo(() => new Map(rm.lanes.map(l => [l.id, l])), [rm.lanes])
  const scheduled = items.filter(i => i.start)
  const unscheduled = items.filter(i => !i.start)
  const laneFilter = new Set(items.map(i => i.laneId))
  const milestones = filtered ? rm.milestones.filter(m => !m.laneId || laneFilter.has(m.laneId)) : rm.milestones

  // Fill the visible width with whole quarters; keep the range still while dragging.
  // Printing shows just the dated span (whole quarters), scaled to a landscape page.
  const span = [...scheduled, ...milestones.map(m => ({ start: m.date, end: m.date }))]
  let range, monthW = zoomW
  if (printing && span.length) {
    // From the first dated month to the last (at least a quarter), scaled to a landscape page (~1040 px).
    const lo = span.reduce((a, x) => (x.start < a ? x.start : a), span[0].start), hi = span.reduce((a, x) => (x.end > a ? x.end : a), span[0].end)
    const a = parts(lo), b = parts(hi)
    const count = Math.min(36, Math.max(3, (b.y - a.y) * 12 + b.m - a.m + 1))
    range = { y0: a.y, m0: a.m, count }
    monthW = Math.max(20, Math.floor((1040 - laneW) / count))
  } else {
    // Twice the visible width, so zooming can always keep the centre date in place.
    const minMonths = Math.ceil((2 * Math.max(0, viewW - laneW)) / monthW / 3) * 3
    range = dragging && frozen.current ? frozen.current : rangeFor(span, now, minMonths)
  }
  frozen.current = range
  const scale = useMemo(() => makeScale(range.y0, range.m0, range.count, monthW), [range.y0, range.m0, range.count, monthW])
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const quarterMode = monthW < 50

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
    if (el) el.scrollLeft = Math.max(0, scale.x(now) - (el.clientWidth - laneW) / 4)
  }
  const jumped = useRef(false)
  useLayoutEffect(() => { scrollToToday(); jumped.current = true }, [todayToken]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { jumped.current = false })
  // Zooming keeps the date in the middle of the view where it was (read with the previous scale).
  const prevScale = useRef(scale)
  useLayoutEffect(() => {
    const old = prevScale.current
    prevScale.current = scale
    // A jump to today in the same commit (new roadmap, "Today") wins.
    if (jumped.current || old.monthW === scale.monthW || printing) return
    const el = scroller.current
    if (!el) return
    const mid = (el.clientWidth - laneW) / 2
    el.scrollLeft = Math.max(0, scale.x(old.date(Math.max(0, el.scrollLeft + mid))) - mid)
  }, [scale]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!colourFor) return
    const close = e => { if (!e.target.closest('.colour-pop, .lane-dot')) setColourFor(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [colourFor])

  // ---------- layout: rows, bars, milestones ----------
  const rows = useMemo(() => rowsFor(rm, items, groupBy, t), [rm, items, groupBy, t])
  const layout = useMemo(() => {
    const byRow = new Map(rows.map(r => [r.key, []]))
    for (const it of scheduled) byRow.get(rowKeyOf(it, groupBy))?.push(it)
    let y = 0
    const out = [], geo = new Map()
    for (const row of rows) {
      const list = byRow.get(row.key) || []
      const count = items.filter(i => rowKeyOf(i, groupBy) === row.key).length
      if (collapsed[row.key]) { out.push({ row, list: [], h: 40, y, count, folded: true }); y += 40; continue }
      const boxes = list.map(it => {
        const x1 = scale.x(it.start), x2 = Math.max(x1 + 8, scale.xEnd(it.end))
        const need = textW(it.title || t.untitledItem) + 28 + (it.status === 'done' || it.status === 'risk' ? 16 : 0)
        // Outside label only when the bar would show less than ~70% of its title.
        const outside = need * 0.7 > x2 - x1
        return { id: it.id, x1, x2, outside, need, reach: outside ? x2 + 8 + Math.min(need, 240) : x2 }
      })
      const { pos, rows: n } = pack(boxes)
      const h = Math.max(MIN_ROW, n * ROW_H + PAD * 2)
      // Room to the right of each bar before the next bar in its sub-row (for labels drawn outside).
      const byPos = new Map()
      for (const b of boxes) { const k = pos.get(b.id); if (!byPos.has(k)) byPos.set(k, []); byPos.get(k).push(b) }
      for (const list2 of byPos.values()) { list2.sort((a, c) => a.x1 - c.x1); list2.forEach((b, k) => { b.room = (list2[k + 1]?.x1 ?? Infinity) - b.x2 - 12 }) }
      for (const b of boxes) geo.set(b.id, { room: b.room, x1: b.x1, x2: b.x2, outside: b.outside, need: b.need, y: y + PAD + pos.get(b.id) * ROW_H + BAR_H / 2, top: PAD + pos.get(b.id) * ROW_H })
      out.push({ row, list, h, y, count })
      y += h
    }
    return { rows: out, geo, height: y }
  }, [rows, scheduled, scale, groupBy, items, collapsed, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const msLayout = useMemo(() => {
    const sorted = [...milestones].sort((a, b) => (a.date < b.date ? -1 : 1))
    const ends = [], out = []
    for (const m of sorted) {
      const x = scale.x(m.date) + monthW / 60
      const w = 22 + Math.min(180, textW(m.title || t.untitledMilestone))
      let r = ends.findIndex(e => e < x - 8)
      if (r < 0) { r = ends.length; ends.push(x + w) } else ends[r] = x + w
      out.push({ m, x, r: Math.min(r, 2) })
    }
    return { list: out, h: Math.max(1, Math.min(3, ends.length)) * MS_ROW + 8 }
  }, [milestones, scale, monthW, t])

  const deps = useMemo(() => depInfo(rm), [rm])
  const selId = sel?.kind === 'item' ? sel.id : null

  // A newly selected (or just created) bar is brought into view, clear of the details panel.
  const lastSel = useRef(null)
  useLayoutEffect(() => {
    if (selId === lastSel.current) return
    lastSel.current = selId
    const el = scroller.current, g = selId && layout.geo.get(selId)
    if (!el || !g) return
    const panel = !readOnly && window.innerWidth >= 640 ? 384 : 0
    const visW = el.clientWidth - laneW - panel
    if (g.x1 < el.scrollLeft + 8 || g.x1 > el.scrollLeft + visW - 80) el.scrollLeft = Math.max(0, g.x1 - Math.max(24, visW / 4))
    const bar = el.querySelector(`.bar[data-id="${selId}"]`)
    if (bar) {
      const r = bar.getBoundingClientRect(), box = el.getBoundingClientRect(), head = el.querySelector('.tl-head')?.offsetHeight || 0
      if (r.top < box.top + head) el.scrollTop -= box.top + head - r.top + 12
      else if (r.bottom > box.bottom) el.scrollTop += r.bottom - box.bottom + 12
    }
  })

  // Drag from the round handle at the end of the selected bar onto another bar: that bar waits on this one.
  const startLink = (e, from) => {
    if (readOnly || !onAddDep) return
    e.stopPropagation()
    e.preventDefault()
    const svg = scroller.current.querySelector('.tl-deps'), g = layout.geo.get(from)
    const at = ev => { const r = svg.getBoundingClientRect(); return { x2: ev.clientX - r.left, y2: ev.clientY - r.top } }
    setLink({ x1: g.x2, y1: g.y, ...at(e) })
    const move = ev => setLink(l => l && { ...l, ...at(ev) })
    const up = ev => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setLink(null)
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.bar[data-id]')?.dataset.id
      if (target && target !== from) onAddDep(from, target)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const startResize = e => {
    e.preventDefault()
    const sx = e.clientX, w0 = laneW
    const move = ev => onLaneW(Math.max(140, Math.min(380, w0 + ev.clientX - sx)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  useEffect(() => {
    if (!laneMenu) return
    const close = e => { if (!e.target.closest('.lane-menu, .lane-more')) setLaneMenu(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [laneMenu])

  // ---------- dragging ----------
  const rowsRef = useRef(layout.rows)
  rowsRef.current = layout.rows
  const rowAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-row]')
    return el ? { row: rowsRef.current[+el.dataset.row]?.row, el } : null
  }
  const startDrag = (e, it, schedule = false) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.stopPropagation()
    e.preventDefault()
    const mode = schedule ? 'schedule' : e.target.dataset.edge || 'move'
    const d = { id: it.id, mode, sx: e.clientX, sy: e.clientY, orig: { ...it }, base: { ...it }, moved: false, key: `drag:${it.id}:${Date.now()}` }
    const move = ev => {
      const dx = ev.clientX - d.sx
      if (!d.moved) {
        if (Math.hypot(dx, ev.clientY - d.sy) < 4) return
        d.moved = true
        setDragging(true)
      }
      const s = scaleRef.current, o = d.base
      let patch
      if (d.mode === 'schedule') {
        const hit = rowAt(ev.clientX, ev.clientY)
        if (!hit) return
        const body = hit.el.closest('.row')?.querySelector('.row-body') || hit.el
        const start = s.date(Math.max(0, ev.clientX - body.getBoundingClientRect().left - 12))
        patch = { start, end: addDays(addMonths(start, 1), -1), horizon: '' }
        if (hit.row.field) patch[hit.row.field] = hit.row.value
        // From here on it's an ordinary move of the new bar.
        Object.assign(d, { mode: 'move', sx: ev.clientX, base: { ...o, ...patch } })
      } else if (d.mode === 'move') {
        const start = s.date(s.x(o.start) + dx)
        patch = { start, end: addDays(start, toDay(o.end) - toDay(o.start)) }
        const hit = rowAt(ev.clientX, ev.clientY)
        if (hit?.row?.field && hit.row.value !== undefined) patch[hit.row.field] = hit.row.value
      } else if (d.mode === 'start') {
        const start = s.date(s.x(o.start) + dx)
        patch = { start: start > o.end ? o.end : start }
      } else {
        const end = s.date(s.xEnd(o.end) + dx - 0.5)
        patch = { end: end < o.start ? o.start : end }
      }
      onUpdateItem(d.id, patch, undefined, d.key)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (d.moved) { lastDrag.current = Date.now(); setDragging(false); onDragDone?.(d.id, d.orig) } else onSelect({ kind: 'item', id: d.id })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const startMsDrag = (e, m) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.stopPropagation()
    e.preventDefault()
    const d = { sx: e.clientX, moved: false }
    const move = ev => {
      if (!d.moved) { if (Math.abs(ev.clientX - d.sx) < 4) return; d.moved = true; setDragging(true) }
      const s = scaleRef.current
      onUpdateMs(m.id, { date: s.date(s.x(m.date) + ev.clientX - d.sx) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (d.moved) { lastDrag.current = Date.now(); setDragging(false) } else onSelect({ kind: 'ms', id: m.id })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const clickRow = (e, row) => {
    if (readOnly || e.target !== e.currentTarget || Date.now() - lastDrag.current < 300) return
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    const extra = row.field && row.field !== 'laneId' ? { [row.field]: row.value } : {}
    onAdd(row.field === 'laneId' ? row.value : null, scaleRef.current.date(x), extra)
  }
  const clickStrip = e => {
    if (readOnly || e.target !== e.currentTarget || Date.now() - lastDrag.current < 300) return
    onAddMs(scaleRef.current.date(e.clientX - e.currentTarget.getBoundingClientRect().left))
  }
  // Keyboard alternative to dragging: arrows move a week, Shift+arrows change the end.
  const barKey = (e, it) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ kind: 'item', id: it.id }); return }
    if (readOnly || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const k = e.key === 'ArrowLeft' ? -7 : 7
    if (e.shiftKey) { const end = addDays(it.end, k); onUpdateItem(it.id, { end: end < it.start ? it.start : end }) }
    else onUpdateItem(it.id, { start: addDays(it.start, k), end: addDays(it.end, k) })
  }

  const todayX = scale.x(now)
  const showToday = todayX >= 0 && todayX <= scale.width
  // Label outside the bar when the bar is too short for it, or only a sliver of it is in view; never into the next bar.
  // A bar that starts left of the view shifts its content right so the title starts in view (ellipsis, avatar kept).
  const pin = (g, out) => (!out && !printing && g.x1 < scrollX ? Math.max(0, Math.min(scrollX - g.x1, g.x2 - g.x1 - 48)) + 9 : 0)
  const showOut = g => (g.outside || (!printing && g.x1 < scrollX && g.x2 - scrollX < Math.min(g.need, 140))) && g.room >= 60 && (printing || g.x2 > scrollX)
  const nowParts = parts(now)
  const editableRows = groupBy === 'lane' && !readOnly
  const empty = !rm.items.length

  return (
    <div className={`tl ${dragging ? 'is-dragging' : ''} ${quarterMode ? 'q-mode' : ''} ${printing ? 'printing' : ''}`} ref={scroller} onScroll={onScroll} style={{ '--mw': `${monthW}px`, '--lw': `${laneW}px`, '--vw': viewW ? `${viewW}px` : '100%' }}>
      <div className="tl-grid" style={{ width: laneW + scale.width }}>
        <div className="tl-head">
          <div className="tl-corner">
            <span>{t.gb[groupBy] || t.lanes}</span>
            <span className="tl-corner-ms"><Icon name="diamond" size={12} />{t.milestones}</span>
            {onLaneW && !narrow && <span className="lane-resize" role="separator" aria-orientation="vertical" aria-label={t.resizeLanes} title={t.resizeLanes} onPointerDown={startResize} onDoubleClick={() => onLaneW(200)} />}
          </div>
          <div className="tl-cal" style={{ width: scale.width }}>
            <div className="tl-quarters">
              {quarters.map(q => <div key={`${q.y}-${q.q}`} style={{ width: q.span * monthW }}>{t.quarter(q.y, q.q)}</div>)}
            </div>
            <div className="tl-months">
              {scale.months.map(({ y, m }) => (
                <div key={`${y}-${m}`} className={y === nowParts.y && m === nowParts.m ? 'cur' : ''} style={{ width: monthW }}>
                  {quarterMode ? t.monthShort(y, m) : t.month(y, m)}{m === 1 && t.yearOnJan && monthW >= 60 ? <small> {y}</small> : null}
                </div>
              ))}
            </div>
            <div className={`tl-ms ${readOnly ? '' : 'can-add'}`} style={{ height: msLayout.h }} onClick={clickStrip} title={readOnly ? undefined : t.msHint}>
              {msLayout.list.map(({ m, x, r }) => (
                <button key={m.id} type="button" className={`ms ms-${m.kind} ${sel?.kind === 'ms' && sel.id === m.id ? 'sel' : ''}`} style={{ left: x, top: 4 + r * MS_ROW, '--c': m.laneId ? colorVar(laneById.get(m.laneId)?.color) : undefined }}
                  title={`${m.title || t.untitledMilestone} · ${dayMonth(t, m.date)}`} aria-label={`${m.kind === 'release' ? t.release : t.milestone}: ${m.title || t.untitledMilestone}, ${dayMonth(t, m.date)}`}
                  onPointerDown={e => startMsDrag(e, m)} onClick={e => { e.stopPropagation(); if (readOnly) onSelect({ kind: 'ms', id: m.id }) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ kind: 'ms', id: m.id }) }
                    else if (!readOnly && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); onUpdateMs(m.id, { date: addDays(m.date, e.key === 'ArrowLeft' ? -1 : 1) }) }
                  }}>
                  <i aria-hidden="true" /><span>{m.title || t.untitledMilestone}</span>
                </button>
              ))}
            </div>
            {showToday && (printing || todayX >= scrollX + 20) && <div className="tl-today-tag" style={{ left: todayX }}>{t.today}</div>}
          </div>
        </div>

        <div className="tl-rows" style={{ minHeight: layout.height }}>
          {(empty && !readOnly) || (!empty && filtered && !items.length) ? (
            <div className="tl-empty-wrap">
              <div className="tl-empty">
                {empty ? <><b>{t.emptyTimeline}</b><span>{t.emptyTimelineBody}</span>
                  <button className="btn small" onClick={() => onAdd(rm.lanes[0]?.id, now)}><Icon name="plus" size={14} />{t.addItem}</button></>
                  : <><b>{t.noMatch}</b><button className="btn small" onClick={onClearFilters}>{t.clearFilters}</button></>}
              </div>
            </div>
          ) : null}
          {layout.rows.map(({ row, list, h, count, folded }, ri) => {
            const lane = row.lane
            return (
              <div className={`row ${row.muted ? 'muted' : ''} ${folded ? 'folded' : ''}`} key={row.key} data-row={ri} style={lane ? { '--c': colorVar(lane.color) } : undefined}>
                <div className={`row-head ${lane ? 'has-lane' : ''}`} style={{ height: h, zIndex: lane && (laneMenu === lane.id || colourFor === lane.id) ? 8 : undefined }}>
                  {onToggleRow && <button className="fold" aria-expanded={!folded} aria-label={folded ? t.expandLane(row.label || '—') : t.collapseLane(row.label || '—')} title={folded ? t.expand : t.collapse} onClick={() => onToggleRow(row.key)}><Icon name={folded ? 'chevronR' : 'chevron'} size={14} /></button>}
                  {lane && (editableRows
                    ? <button className="lane-dot" aria-label={t.laneColour} title={t.laneColour} aria-expanded={colourFor === lane.id} onClick={() => setColourFor(colourFor === lane.id ? null : lane.id)} />
                    : <span className="lane-dot static" />)}
                  {row.status && <span className={`chip-dot st-${row.status}`} aria-hidden="true" />}
                  {editableRows
                    ? <input className="lane-name" value={lane.name} aria-label={t.laneName} placeholder={t.laneName} onChange={e => laneOps.rename(lane.id, e.target.value)} />
                    : <span className="lane-name">{row.label || '—'}</span>}
                  <span className="row-count" aria-label={t.itemsCount(count)}>{count}</span>
                  {editableRows && narrow && (
                    <>
                      <button className="lane-more" aria-label={t.laneActions(lane.name || t.lane)} aria-haspopup="true" aria-expanded={laneMenu === lane.id} onClick={() => setLaneMenu(laneMenu === lane.id ? null : lane.id)}><Icon name="more" size={16} sw={3} /></button>
                      {laneMenu === lane.id && (
                        <div className="menu lane-menu" role="menu">
                          <button role="menuitem" className="menu-item" disabled={ri === 0} onClick={() => { setLaneMenu(null); laneOps.move(lane.id, -1) }}><Icon name="up" size={15} /><span className="mi-label">{t.moveUp}</span></button>
                          <button role="menuitem" className="menu-item" disabled={ri === layout.rows.length - 1} onClick={() => { setLaneMenu(null); laneOps.move(lane.id, 1) }}><Icon name="down" size={15} /><span className="mi-label">{t.moveDown}</span></button>
                          <button role="menuitem" className="menu-item" onClick={() => { setLaneMenu(null); setColourFor(lane.id) }}><span className="mi-check"><i className="lane-mini" style={{ background: colorVar(lane.color) }} /></span><span className="mi-label">{t.laneColour}</span></button>
                          <button role="menuitem" className="menu-item danger" disabled={rm.lanes.length === 1} onClick={() => { setLaneMenu(null); laneOps.remove(lane.id) }}><Icon name="trash" size={15} /><span className="mi-label">{t.deleteLane}</span></button>
                        </div>
                      )}
                    </>
                  )}
                  {editableRows && !narrow && (
                    <div className="lane-tools">
                      <button aria-label={t.moveUp} title={t.moveUp} disabled={ri === 0} onClick={() => laneOps.move(lane.id, -1)}><Icon name="up" size={14} /></button>
                      <button aria-label={t.moveDown} title={t.moveDown} disabled={ri === layout.rows.length - 1} onClick={() => laneOps.move(lane.id, 1)}><Icon name="down" size={14} /></button>
                      <button aria-label={t.deleteLane} title={t.deleteLane} disabled={rm.lanes.length === 1} onClick={() => laneOps.remove(lane.id)}><Icon name="trash" size={14} /></button>
                    </div>
                  )}
                  {lane && colourFor === lane.id && (
                    <div className="colour-pop" role="listbox" aria-label={t.laneColour}>
                      {PALETTE.map(p => (
                        <button key={p.id} role="option" aria-selected={p.hex === lane.color} aria-label={p.id} title={p.id} style={{ background: `var(${p.v})` }}
                          onClick={() => { laneOps.colour(lane.id, p.hex); setColourFor(null) }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className={`row-body ${readOnly || folded ? '' : 'can-add'}`} style={{ width: scale.width, height: h }} onClick={e => !folded && clickRow(e, row)}>
                  {folded && <span className="folded-note">{t.itemsCount(count)}</span>}
                  {list.map(it => {
                    const g = layout.geo.get(it.id), w = g.x2 - g.x1, l = laneById.get(it.laneId)
                    const out = showOut(g)
                    const late = deps.late.has(it.id)
                    const related = selId && (selId === it.id || rm.deps.some(d => (d.from === selId && d.to === it.id) || (d.to === selId && d.from === it.id)))
                    return (
                      <div key={it.id} role="button" tabIndex={0} data-id={it.id}
                        className={`bar st-${it.status} ${selId === it.id ? 'sel' : ''} ${related && selId !== it.id ? 'rel' : ''} ${w < 70 ? 'narrow' : ''} ${late ? 'late' : ''}`}
                        style={{ left: g.x1, width: w, top: g.top, '--c': colorVar(l?.color), '--on-c': onColorVar(l?.color), '--p': `${it.progress}%`, ...(pin(g, out) ? { paddingLeft: pin(g, out) } : {}) }}
                        title={`${it.title || t.untitledItem} · ${t.st[it.status]} · ${when(t, it)}${it.owner ? ` · ${it.owner}` : ''}${late ? ` · ${t.lateBadge}` : ''}`}
                        aria-label={`${it.title || t.untitledItem}, ${t.st[it.status]}, ${when(t, it)}`}
                        onPointerDown={e => startDrag(e, it)}
                        onClick={e => { e.stopPropagation(); if (readOnly) onSelect({ kind: 'item', id: it.id }) }}
                        onKeyDown={e => barKey(e, it)}>
                        {!readOnly && <span className="edge l" data-edge="start" />}
                        {late && <span className="bar-warn"><Icon name="warn" size={13} sw={2.2} /></span>}
                        {it.status === 'risk' && !late && <span className="bar-warn"><Icon name="warn" size={13} sw={2.2} /></span>}
                        {it.status === 'done' && <Icon name="check" size={13} sw={2.4} />}
                        {!out && <span className="bar-title">{it.title || t.untitledItem}</span>}
                        {it.owner && w > 150 && <span className="avatar sm" aria-hidden="true">{initials(it.owner)}</span>}
                        {it.progress > 0 && it.status !== 'done' && <span className="bar-progress" aria-hidden="true" />}
                        {!readOnly && <span className="edge r" data-edge="end" />}
                      </div>
                    )
                  })}
                  {list.map(it => { const g = layout.geo.get(it.id); return showOut(g) ? <span key={'o' + it.id} className={`bar-out ${selId === it.id ? 'sel' : ''}`} style={{ left: g.x2 + 6, top: g.top, maxWidth: Math.min(240, g.room) }} aria-hidden="true">{it.title || t.untitledItem}</span> : null })}
                  {!readOnly && onAddDep && selId && list.some(i => i.id === selId) && (() => { const g = layout.geo.get(selId); return <span className="dep-handle" style={{ left: g.x2 + (g.outside ? 2 : 2), top: g.top + BAR_H / 2 }} title={t.linkHint} aria-hidden="true" onPointerDown={e => startLink(e, selId)} /> })()}
                </div>
              </div>
            )
          })}

          <svg className="tl-deps" width={scale.width} height={layout.height} style={{ left: laneW }} aria-hidden="true">
            <defs>
              <marker id={`pl-arrow${idp}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" className="dep-head" /></marker>
              <marker id={`pl-arrow-bad${idp}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" className="dep-head bad" /></marker>
            </defs>
            {rm.deps.map(d => {
              const a = layout.geo.get(d.from), b = layout.geo.get(d.to)
              if (!a || !b) return null
              const ay = a.y, by = b.y
              const x1 = a.x2, x2 = b.x1 - 2
              const bad = deps.conflicts.has(d.id)
              const hl = selId && (d.from === selId || d.to === selId)
              let path
              if (x2 - x1 >= 24) { const c = Math.max(20, (x2 - x1) / 2); path = `M${x1} ${ay} C${x1 + c} ${ay} ${x2 - c} ${by} ${x2} ${by}` }
              else {
                // Runs backwards (a conflict): step out, travel between the rows, step back in.
                const mid = ay === by ? ay + ROW_H / 2 : by > ay ? by - ROW_H / 2 : by + ROW_H / 2, r = 6
                path = `M${x1} ${ay} h${r + 4} q${r} 0 ${r} ${mid > ay ? r : -r} V${mid + (mid > ay ? -r : r)} q0 ${mid > ay ? r : -r} ${-r} ${mid > ay ? r : -r} H${x2 - 10 + r} q${-r} 0 ${-r} ${by > mid ? r : -r} V${by + (by > mid ? -r : r)} q0 ${by > mid ? r : -r} ${r} ${by > mid ? r : -r} H${x2}`
              }
              return <path key={d.id} className={`dep ${bad ? 'bad' : ''} ${hl ? 'hl' : ''}`} d={path} markerEnd={`url(#${bad ? 'pl-arrow-bad' : 'pl-arrow'}${idp})`} />
            })}
            {link && <path className="dep drawing" d={`M${link.x1} ${link.y1} C${link.x1 + 40} ${link.y1} ${link.x2 - 40} ${link.y2} ${link.x2} ${link.y2}`} markerEnd={`url(#pl-arrow${idp})`} />}
          </svg>
          {milestones.map(m => <div key={m.id} className={`tl-ms-line ms-${m.kind}`} style={{ left: laneW + scale.x(m.date) + monthW / 60 }} aria-hidden="true" />)}
          {showToday && <div className="tl-today" style={{ left: laneW + todayX }} aria-hidden="true" />}

        </div>

        {unscheduled.length > 0 && (
          <div className="tl-tray">
            <div className="tray-head"><b>{t.notScheduled(unscheduled.length)}</b>{!readOnly && <span>{t.notScheduledHint}</span>}</div>
            <div className="tray-chips">
              {unscheduled.map(it => (
                <button key={it.id} type="button" className={`tray-chip st-${it.status} ${selId === it.id ? 'sel' : ''}`} style={{ '--c': colorVar(laneById.get(it.laneId)?.color) }}
                  onPointerDown={e => startDrag(e, it, true)} onClick={() => readOnly && onSelect({ kind: 'item', id: it.id })}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ kind: 'item', id: it.id }) } }}>
                  <i aria-hidden="true" />{it.title || t.untitledItem}<small>{t.hz[it.horizon]}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tl-print-legend" aria-hidden="true">
          {['idea', 'planned', 'progress', 'risk', 'done'].map(s2 => <span key={s2} className="lg"><i className={`lg-bar st-${s2}`} />{t.st[s2]}</span>)}
          <span className="lg"><i className="lg-ms" />{t.milestone}</span><span className="lg"><i className="lg-ms rel" />{t.release}</span>
          <span className="grow" /><span>{t.printedOn(dayMonth(t, now))}</span>
        </div>

        {editableRows && (
          <div className="tl-foot">
            <button className="add-lane" onClick={laneOps.add}><Icon name="plus" size={15} /> {t.addLane}</button>
            <span className="tl-hint">{t.addHint}</span>
          </div>
        )}
      </div>
    </div>
  )
}
