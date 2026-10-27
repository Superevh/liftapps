import { useEffect, useRef, useState } from 'react'
import { columns, depInfo, initials } from './logic.js'
import { colorVar } from './store.js'
import { when } from './format.js'
import Icon from './icons.jsx'

// Now / Next / Later: the same items grouped by horizon, for planning conversations and stakeholders.
const DRAG_PX = 6

export default function Board({ rm, items, t, showDone, sel, readOnly = false, onSelect, onMove, onAdd }) {
  const selId = sel?.kind === 'item' ? sel.id : null
  const late = depInfo(rm).late
  const lanes = new Map(rm.lanes.map(l => [l.id, l]))
  const cols = [['now', t.now, t.nowHint], ['next', t.next, t.nextHint], ['later', t.later, t.laterHint]]
  if (showDone) cols.push(['done', t.doneCol, t.doneHint])
  const groups = columns(rm, items, showDone)
  const colOf = id => cols.find(([k]) => groups[k].some(i => i.id === id))?.[0]

  const boardRef = useRef(null)
  // drag: { id, x, y, w, h, ox, oy, col, index } while a card is being dragged
  const [drag, setDrag] = useState(null)
  const [moveFor, setMoveFor] = useState(null)
  const suppressClick = useRef(0)
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  useEffect(() => {
    if (!moveFor) return
    const close = e => { if (!e.target.closest('.card-menu, .card-move')) setMoveFor(null) }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); setMoveFor(null) } }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key, true) }
  }, [moveFor])

  // Final id order of a column after inserting `id` at `index`.
  const orderWith = (col, id, index) => {
    const ids = groupsRef.current[col].map(i => i.id).filter(x => x !== id)
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id)
    return ids
  }

  // Where would a drop at (x, y) go? Column under the pointer, index by card midpoints.
  const target = (x, y, id) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-col]')
    if (!el) return null
    const cards = [...el.querySelectorAll('.card[data-id]')].filter(c => c.dataset.id !== id)
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) { index = i; break }
    }
    return { col: el.dataset.col, index }
  }

  const startDrag = (e, it) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return
    // Touch scrolls the board, so on touch only the grip handle starts a drag.
    const onGrip = !!e.target.closest('.card-grip')
    if (e.pointerType === 'touch' && !onGrip) return
    if (e.target.closest('.card-move')) return
    const card = e.currentTarget
    const r = card.getBoundingClientRect()
    const d = { id: it.id, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, started: false, last: null }
    if (onGrip) e.preventDefault()
    let raf = 0, py = e.clientY
    const scrollLoop = () => {
      const b = boardRef.current
      if (b && d.started) {
        const br = b.getBoundingClientRect(), edge = 56
        const dy = py < br.top + edge ? -(br.top + edge - py) : py > br.bottom - edge ? py - (br.bottom - edge) : 0
        if (dy) b.scrollTop += Math.max(-18, Math.min(18, dy / 3))
      }
      raf = requestAnimationFrame(scrollLoop)
    }
    const move = ev => {
      py = ev.clientY
      if (!d.started) {
        if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < DRAG_PX) return
        d.started = true
        raf = requestAnimationFrame(scrollLoop)
      }
      ev.preventDefault()
      d.last = target(ev.clientX, ev.clientY, d.id)
      setDrag({ id: d.id, x: ev.clientX - d.ox, y: ev.clientY - d.oy, w: d.w, h: d.h, ...(d.last || { col: null, index: 0 }) })
    }
    const noScroll = ev => { if (d.started) ev.preventDefault() }
    const end = ev => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('keydown', esc, true)
      window.removeEventListener('touchmove', noScroll)
      cancelAnimationFrame(raf)
      if (!d.started) return
      suppressClick.current = Date.now()
      setDrag(null)
      if (ev && ev.type === 'pointerup' && d.last) onMove(d.id, d.last.col, orderWith(d.last.col, d.id, d.last.index))
    }
    const esc = ev => { if (ev.key === 'Escape' && d.started) { ev.stopPropagation(); d.last = null; end(null) } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('keydown', esc, true)
    window.addEventListener('touchmove', noScroll, { passive: false })
  }

  const moveTo = (it, col) => {
    setMoveFor(null)
    const from = colOf(it.id)
    const list = groups[col]
    if (from === col) return
    onMove(it.id, col, orderWith(col, it.id, list.length))
  }
  const nudge = (it, dir) => {
    setMoveFor(null)
    const col = colOf(it.id)
    const i = groups[col].findIndex(x => x.id === it.id)
    const j = i + dir
    if (j < 0 || j >= groups[col].length) return
    onMove(it.id, col, orderWith(col, it.id, j))
  }

  const dragged = drag && rm.items.find(i => i.id === drag.id)

  return (
    <div ref={boardRef} className={`board cols-${cols.length} ${drag ? 'is-dragging' : ''} ${readOnly ? '' : 'can-drag'}`}>
      {cols.map(([k, label, hint]) => {
        const list = groups[k]
        const over = drag?.col === k
        // Drop line position among the cards that stay in place.
        const staying = list.filter(i => i.id !== drag?.id)
        const lineBefore = over ? staying[drag.index]?.id ?? 'end' : null
        return (
          <section key={k} className={`col col-${k} ${over ? 'drop-target' : ''}`} aria-label={label} data-col={k}>
            <header><h2>{label}</h2><span className="count">{list.length}</span><p>{hint}</p></header>
            <div className="cards">
              {list.length === 0 && !over && <p className="empty">{t.emptyCol}</p>}
              {list.map((it, idx) => {
                const lane = lanes.get(it.laneId)
                return [
                  lineBefore === it.id && <div key="line" className="drop-line" aria-hidden="true" />,
                  <div key={it.id} data-id={it.id} className={`card st-${it.status} ${selId === it.id ? 'sel' : ''} ${drag?.id === it.id ? 'ghosted' : ''}`} style={{ '--c': colorVar(lane?.color) }}
                    onPointerDown={e => startDrag(e, it)}>
                    <button className="card-open" onClick={() => { if (Date.now() - suppressClick.current > 300) onSelect({ kind: 'item', id: it.id }) }}>
                      <CardBody it={it} lane={lane} t={t} late={late.has(it.id)} />
                    </button>
                    {!readOnly && (
                      <span className="card-tools">
                        <span className="card-grip" title={t.dragHint} aria-hidden="true"><svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3.5" cy="3" r="1.4" /><circle cx="8.5" cy="3" r="1.4" /><circle cx="3.5" cy="8" r="1.4" /><circle cx="8.5" cy="8" r="1.4" /><circle cx="3.5" cy="13" r="1.4" /><circle cx="8.5" cy="13" r="1.4" /></svg></span>
                        <button className="card-move" aria-haspopup="true" aria-expanded={moveFor === it.id} aria-label={t.moveToLabel(it.title || t.untitledItem)} title={t.moveTo}
                          onClick={() => setMoveFor(moveFor === it.id ? null : it.id)}><Icon name="more" size={18} sw={3} /></button>
                        {moveFor === it.id && (
                          <div className="menu right card-menu" role="menu">
                            <div className="menu-label">{t.moveTo}</div>
                            {cols.map(([c, cl]) => (
                              <button key={c} role="menuitemradio" aria-checked={c === k} className={`menu-item ${c === k ? 'on' : ''}`} onClick={() => moveTo(it, c)}>
                                <span className="mi-check">{c === k && <Icon name="check" size={14} />}</span><span className="mi-label">{cl}</span>
                              </button>
                            ))}
                            <hr />
                            <button role="menuitem" className="menu-item" disabled={idx === 0} onClick={() => nudge(it, -1)}><Icon name="up" size={15} /><span className="mi-label">{t.moveUp}</span></button>
                            <button role="menuitem" className="menu-item" disabled={idx === list.length - 1} onClick={() => nudge(it, 1)}><Icon name="down" size={15} /><span className="mi-label">{t.moveDown}</span></button>
                          </div>
                        )}
                      </span>
                    )}
                  </div>,
                ]
              })}
              {lineBefore === 'end' && <div className="drop-line" aria-hidden="true" />}
            </div>
            {!readOnly && onAdd && <button className="col-add" onClick={() => onAdd(k)}><Icon name="plus" size={14} />{t.add}</button>}
          </section>
        )
      })}
      {dragged && (
        <div className={`card drag-ghost st-${dragged.status}`} aria-hidden="true"
          style={{ '--c': colorVar(lanes.get(dragged.laneId)?.color), width: drag.w, transform: `translate(${drag.x}px, ${drag.y}px) rotate(1.5deg)` }}>
          <span className="card-open"><CardBody it={dragged} lane={lanes.get(dragged.laneId)} t={t} late={late.has(dragged.id)} /></span>
        </div>
      )}
    </div>
  )
}

function CardBody({ it, lane, t, late }) {
  return (
    <>
      <span className="card-lane"><i />{lane?.name}{late && <span className="warn-tag" title={t.lateBadge}><Icon name="warn" size={13} sw={2.2} />{t.lateBadge}</span>}</span>
      <b>{it.title || t.untitledItem}</b>
      <span className="card-meta">
        <span className="when">{when(t, it)}</span>
        {it.owner && <span className="avatar sm" title={it.owner} aria-label={`${t.owner}: ${it.owner}`}>{initials(it.owner)}</span>}
        <span className={`chip st-${it.status}`}>{t.st[it.status]}{it.progress > 0 && it.status !== 'done' ? ` · ${it.progress}%` : ''}</span>
      </span>
      {it.tags.length > 0 && <span className="card-tags">{it.tags.slice(0, 3).map(x => <span key={x} className="tag">{x}</span>)}</span>}
    </>
  )
}
