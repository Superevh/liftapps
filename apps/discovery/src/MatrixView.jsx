import { useRef, useState } from 'react'
import { useStore, fieldById, getValue, numeric, optionById, COLORS } from './store.jsx'
import { openIdea } from './App.jsx'
import { useT } from './lang.js'

// Maps a field onto a 0..1 axis, and back again for fields that can be edited by dragging.
function axisFor(state, field, ideas) {
  if (field.type === 'select') {
    const n = field.options.length || 1
    return {
      ticks: field.options.map((o, i) => ({ pos: (i + 0.5) / n, label: o.label })),
      value: i => getValue(state, i, field.id),
      toPos: v => { const i = field.options.findIndex(o => o.id === v); return i < 0 ? null : (i + 0.5) / n },
      fromPos: p => field.options[Math.min(n - 1, Math.max(0, Math.floor(p * n)))]?.id ?? null,
      editable: true,
    }
  }
  const rating = field.type === 'rating'
  const slider = field.type === 'slider'
  const vals = ideas.map(i => numeric(state, i, field.id)).filter(v => v != null)
  const max = rating ? field.max : slider ? 100 : Math.max(1, ...vals)
  const min = rating || slider ? 1 : Math.min(0, ...vals)
  const span = max - min || 1
  const steps = rating ? Array.from({ length: max }, (_, i) => i + 1) : [min, min + span / 2, max].map(v => Math.round(v * 10) / 10)
  return {
    ticks: steps.map(v => ({ pos: 0.06 + ((v - min) / span) * 0.88, label: String(v) })),
    value: i => numeric(state, i, field.id),
    toPos: v => (v == null ? null : 0.06 + ((v - min) / span) * 0.88),
    fromPos: p => {
      const v = min + ((p - 0.06) / 0.88) * span
      return rating ? Math.min(max, Math.max(1, Math.round(v))) : slider ? Math.min(100, Math.max(1, Math.round(v))) : Math.max(0, Math.round(v))
    },
    editable: rating || slider || field.type === 'number',
  }
}

export default function MatrixView({ view, ideas, mode, readOnly, selectedKey }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const plotRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const xf = fieldById(state, view.x)
  const yf = fieldById(state, view.y)
  const sf = view.size && fieldById(state, view.size)
  const cf = fieldById(state, view.colorBy ?? 'status') ?? fieldById(state, 'status')
  if (!xf || !yf) return <div className="empty">{t('Choose fields for both axes.')}</div>

  const xa = axisFor(state, xf, ideas)
  const ya = axisFor(state, yf, ideas)
  const sizeMax = sf ? Math.max(1, ...ideas.map(i => numeric(state, i, sf.id) ?? 0)) : 1
  const placed = []
  const unplaced = []
  const seen = {}
  for (const i of ideas) {
    const x = xa.toPos(xa.value(i))
    const y = ya.toPos(ya.value(i))
    if (x == null || y == null) { unplaced.push(i); continue }
    const cellKey = `${x.toFixed(3)}:${y.toFixed(3)}`
    const n = seen[cellKey] = (seen[cellKey] ?? -1) + 1
    const angle = n * 2.4
    const r = n ? 0.035 + n * 0.01 : 0
    placed.push({ idea: i, x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r })
  }
  const editable = !readOnly && !view.archive

  const posFromEvent = e => {
    const r = plotRef.current.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) }
  }
  const onPointerDown = (e, p) => {
    if (!editable || (!xa.editable && !ya.editable)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ key: p.idea.key, x: p.x, y: p.y, moved: false, startX: e.clientX, startY: e.clientY })
  }
  const onPointerMove = e => {
    if (!drag) return
    const moved = drag.moved || Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 4
    const p = posFromEvent(e)
    setDrag({ ...drag, moved, x: xa.editable ? p.x : drag.x, y: ya.editable ? p.y : drag.y })
  }
  const onPointerUp = (e, idea) => {
    if (!drag || !drag.moved) { setDrag(null); return openIdea(mode, view.id, idea.key) }
    if (xa.editable) dispatch({ type: 'SET_VALUE', key: idea.key, field: xf.id, value: xa.fromPos(drag.x) })
    if (ya.editable) dispatch({ type: 'SET_VALUE', key: idea.key, field: yf.id, value: ya.fromPos(drag.y) })
    setDrag(null)
  }

  const quick = xf.id === 'effort' && yf.id === 'impact'
  const colorOf = i => COLORS[optionById(cf, getValue(state, i, cf?.id))?.color ?? 'stone']

  return (
    <div className="matrix-view">
      <div className="matrix-wrap">
        <div className="y-label">{yf.name} →</div>
        <div className="y-ticks">{ya.ticks.map(tk => <span key={tk.label} style={{ bottom: `${tk.pos * 100}%` }}>{tk.label}</span>)}</div>
        <div className="plot" ref={plotRef}>
          {xa.ticks.map(tk => <span key={'x' + tk.label} className="gridline v" style={{ left: `${tk.pos * 100}%` }} />)}
          {ya.ticks.map(tk => <span key={'y' + tk.label} className="gridline h" style={{ bottom: `${tk.pos * 100}%` }} />)}
          {quick && (
            <>
              <span className="quadrant tl">{t('Quick wins')}</span><span className="quadrant tr">{t('Big bets')}</span>
              <span className="quadrant bl">{t('Small tweaks')}</span><span className="quadrant br">{t('Time sinks')}</span>
            </>
          )}
          {placed.map(p => {
            const isDrag = drag?.key === p.idea.key
            const x = isDrag ? drag.x : p.x
            const y = isDrag ? drag.y : p.y
            const sv = sf ? numeric(state, p.idea, sf.id) ?? 0 : 0
            const size = sf ? 22 + (sv / sizeMax) * 30 : 26
            const color = colorOf(p.idea)
            return (
              <div key={p.idea.key} className={`bubble-wrap ${isDrag ? 'dragging' : ''} ${selectedKey === p.idea.key ? 'selected' : ''} ${x > 0.7 ? 'flip' : ''}`}
                style={{ left: `${x * 100}%`, bottom: `${y * 100}%` }}>
                <button className="bubble" style={{ width: size, height: size, background: color.bg, borderColor: color.fg, cursor: editable ? 'grab' : 'pointer' }}
                  aria-label={p.idea.summary}
                  onPointerDown={e => onPointerDown(e, p)} onPointerMove={onPointerMove} onPointerUp={e => onPointerUp(e, p.idea)}
                  onKeyDown={e => e.key === 'Enter' && openIdea(mode, view.id, p.idea.key)}>
                  {sf && sv ? <span className="bubble-n" style={{ color: color.fg }}>{sv}</span> : null}
                </button>
                <span className="bubble-label">{p.idea.summary}</span>
              </div>
            )
          })}
        </div>
        <span /><span />
        <div className="x-ticks">{xa.ticks.map(tk => <span key={tk.label} style={{ left: `${tk.pos * 100}%` }}>{tk.label}</span>)}</div>
        <div className="x-label">{xf.name} →</div>
      </div>
      <aside className="matrix-side">
        {cf && (
          <>
            <div className="side-title">{t('Colour')} · {cf.name}</div>
            {cf.options.map(o => (
              <div key={o.id} className="legend-row"><span className="legend-dot" style={{ background: COLORS[o.color]?.bg, borderColor: COLORS[o.color]?.fg }} />{o.label}</div>
            ))}
          </>
        )}
        {sf && <div className="muted small legend-note">{t('Bubble size')}: {sf.name}</div>}
        {editable && (xa.editable || ya.editable) && <div className="muted small legend-note">{t('Drag a bubble to change its {fields}.', { fields: [xa.editable && xf.name, ya.editable && yf.name].filter(Boolean).join(t(' and ')) })}</div>}
        {unplaced.length > 0 && (
          <>
            <div className="side-title">{t('Not on the matrix')} ({unplaced.length})</div>
            <p className="muted small">{t('Missing {x} or {y}.', { x: xf.name, y: yf.name })}</p>
            {unplaced.map(i => <button key={i.key} className="unplaced" onClick={() => openIdea(mode, view.id, i.key)}>{i.summary}</button>)}
          </>
        )}
      </aside>
    </div>
  )
}
