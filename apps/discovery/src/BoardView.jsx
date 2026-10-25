import { useState } from 'react'
import { useStore, fieldById, bucketsFor, bucketOf } from './store.jsx'
import { Icon } from './ui.jsx'
import { FieldValue, BucketLabel, bucketTint } from './fields.jsx'
import { openIdea } from './App.jsx'
import { InlineCreate } from './ListView.jsx'
import { useT } from './lang.js'

function Card({ idea, fields, selected, onClick, draggable, onDragStart, onDragEnd, dragging }) {
  return (
    <div className={`idea-card ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`} data-idea={idea.key}
      role="button" tabIndex={0} onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}
      draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="card-title">{idea.summary}</div>
      <div className="card-fields">
        {fields.map(f => <FieldValue key={f.id} field={f} idea={idea} compact />)}
      </div>
    </div>
  )
}

const k = id => String(id)

export default function BoardView({ view, ideas, mode, readOnly, selectedKey }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [collapsedLanes, setCollapsedLanes] = useState([])
  const [drag, setDrag] = useState(null)
  const colField = fieldById(state, view.groupBy)
  const laneField = view.swimlanes && fieldById(state, view.swimlanes)
  const cardFields = view.fields.map(id => fieldById(state, id)).filter(f => f && f.id !== colField?.id && f.id !== laneField?.id)
  if (!colField) return <div className="empty">{t('Choose a field for the columns.')}</div>

  const columns = bucketsFor(state, colField)
    .filter(c => c.id != null || ideas.some(i => bucketOf(state, i, colField) == null))
    .filter(c => !view.hideEmpty || !readOnly || ideas.some(i => bucketOf(state, i, colField) === c.id))
  const lanes = laneField
    ? bucketsFor(state, laneField)
        .map(l => ({ ...l, ideas: ideas.filter(i => bucketOf(state, i, laneField) === l.id) }))
        .filter(l => l.ideas.length || (!view.hideEmpty && l.id != null))
    : [{ id: '__all', ideas }]
  const allCollapsed = laneField && lanes.every(l => collapsedLanes.includes(k(l.id)))
  const editable = !readOnly && !view.archive

  const onDrop = (e, colId, laneId) => {
    e.preventDefault()
    if (!drag) return
    const idea = state.ideas[drag]
    if (bucketOf(state, idea, colField) !== colId) dispatch({ type: 'SET_VALUE', key: drag, field: colField.id, value: colId })
    if (laneField && bucketOf(state, idea, laneField) !== laneId) dispatch({ type: 'SET_VALUE', key: drag, field: laneField.id, value: laneId })
    if (!view.sort?.field) {
      const els = [...e.currentTarget.querySelectorAll('[data-idea]')].filter(el => el.dataset.idea !== drag)
      const before = els.find(el => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
      if (before) dispatch({ type: 'RANK_IDEA', key: drag, beforeKey: before.dataset.idea })
    }
    setDrag(null)
  }
  const cols = `${laneField ? '28px ' : ''}repeat(${columns.length}, minmax(240px, 1fr))`

  return (
    <div className="board-view">
      <div className="board-inner" style={{ minWidth: columns.length * 252 + (laneField ? 28 : 0) }}>
        <div className="board-cols-head" style={{ gridTemplateColumns: cols }}>
          {laneField && (
            <button className="icon-btn tiny" aria-label={t('Collapse all groups')} onClick={() => setCollapsedLanes(allCollapsed ? [] : lanes.map(l => k(l.id)))}>
              <Icon name={allCollapsed ? 'chevronRight' : 'chevron'} size={14} />
            </button>
          )}
          {columns.map(c => (
            <div key={k(c.id)} className="col-head" style={{ background: bucketTint(c) }}>
              <BucketLabel bucket={c} field={colField} />
              <span className="spacer" />
              <span className="muted small">{ideas.filter(i => bucketOf(state, i, colField) === c.id).length}</span>
            </div>
          ))}
        </div>
        {lanes.map(lane => {
          const isCollapsed = collapsedLanes.includes(k(lane.id))
          return (
            <div key={k(lane.id)} className="lane">
              {laneField && (
                <div className="lane-head">
                  <button className="icon-btn tiny" aria-label={t('Toggle group')} aria-expanded={!isCollapsed} onClick={() => setCollapsedLanes(c => (isCollapsed ? c.filter(x => x !== k(lane.id)) : [...c, k(lane.id)]))}>
                    <Icon name={isCollapsed ? 'chevronRight' : 'chevron'} size={14} />
                  </button>
                  <BucketLabel bucket={lane} field={laneField} />
                  <span className="count-pill">{lane.ideas.length}</span>
                </div>
              )}
              {!isCollapsed && (
                <div className="lane-cols" style={{ gridTemplateColumns: cols }}>
                  {laneField && <span />}
                  {columns.map(c => {
                    const cell = lane.ideas.filter(i => bucketOf(state, i, colField) === c.id)
                    return (
                      <div key={k(c.id)} className={`cell ${drag ? 'droppable' : ''}`} style={{ background: bucketTint(c) }}
                        onDragOver={e => drag && e.preventDefault()} onDrop={e => onDrop(e, c.id, laneField ? lane.id : undefined)}>
                        {cell.map(i => (
                          <Card key={i.key} idea={i} fields={cardFields} selected={selectedKey === i.key} dragging={drag === i.key}
                            onClick={() => openIdea(mode, view.id, i.key)}
                            draggable={editable} onDragStart={e => { e.dataTransfer.setData('text/plain', i.key); setDrag(i.key) }} onDragEnd={() => setDrag(null)} />
                        ))}
                        {editable && <InlineCreate label={t('Add')} values={{ ...(c.id != null ? { [colField.id]: c.id } : {}), ...(laneField && lane.id != null ? { [laneField.id]: lane.id } : {}) }} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {ideas.length === 0 && <div className="empty">{t('No ideas match this view’s filters.')}</div>}
    </div>
  )
}
