import { useState } from 'react'
import { useStore, fieldById, bucketsFor, bucketOf } from './store.jsx'
import { Icon } from './ui.jsx'
import { FieldEditor, BucketLabel } from './fields.jsx'
import { openIdea } from './App.jsx'
import { useT } from './lang.js'

export function InlineCreate({ values, label }) {
  const t = useT()
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  if (!open) return <button className="inline-create-btn" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> {label ?? t('Create idea')}</button>
  const submit = () => { if (summary.trim()) { dispatch({ type: 'CREATE_IDEA', summary: summary.trim(), values }); setSummary('') } }
  return (
    <div className="inline-create">
      <input autoFocus aria-label={t('New idea summary')} placeholder={t('What’s the idea? Press Enter to add')} value={summary} onChange={e => setSummary(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
        onBlur={() => !summary && setOpen(false)} />
    </div>
  )
}

export default function ListView({ view, ideas, mode, readOnly, selectedKey }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [collapsed, setCollapsed] = useState([])
  const [drag, setDrag] = useState(null)
  const fields = view.fields.map(id => fieldById(state, id)).filter(Boolean)
  const manual = !view.sort?.field && !readOnly && !view.archive
  const groupField = view.groupBy && fieldById(state, view.groupBy)

  const groups = groupField
    ? bucketsFor(state, groupField)
        .map(g => ({ ...g, ideas: ideas.filter(i => bucketOf(state, i, groupField) === g.id) }))
        .filter(g => g.ideas.length || g.id != null)
    : [{ id: 'all', ideas }]

  const headerSort = f => {
    if (readOnly) return
    const cur = view.sort
    const next = cur?.field !== f.id ? { field: f.id, dir: 'desc' } : cur.dir === 'desc' ? { field: f.id, dir: 'asc' } : null
    dispatch({ type: 'UPDATE_VIEW', id: view.id, patch: { sort: next } })
  }

  const onDrop = (e, beforeKey) => {
    e.preventDefault()
    if (drag && drag !== beforeKey) dispatch({ type: 'RANK_IDEA', key: drag, beforeKey })
    setDrag(null)
  }
  const keyOf = id => String(id)

  return (
    <div className="list-view">
      <table className="grid">
        <thead>
          <tr>
            <th className="col-summary">{t('Idea')} <span className="muted small">({ideas.length})</span></th>
            {fields.map(f => (
              <th key={f.id} className={`col-${f.type}`} onClick={() => headerSort(f)} title={f.description ?? (readOnly ? '' : t('Click to sort'))}
                aria-sort={view.sort?.field === f.id ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {f.name}{view.sort?.field === f.id && <span className="sort-ind">{view.sort.dir === 'asc' ? ' ↑' : ' ↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(g => {
          const isCollapsed = collapsed.includes(keyOf(g.id))
          return (
            <tbody key={keyOf(g.id)}>
              {groupField && (
                <tr className="group-row">
                  <td colSpan={fields.length + 1}>
                    <button className="group-toggle" aria-expanded={!isCollapsed} onClick={() => setCollapsed(c => (isCollapsed ? c.filter(x => x !== keyOf(g.id)) : [...c, keyOf(g.id)]))}>
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevron'} size={14} />
                      <BucketLabel bucket={g} field={groupField} />
                      <span className="count-pill">{g.ideas.length}</span>
                    </button>
                  </td>
                </tr>
              )}
              {!isCollapsed && g.ideas.map(i => (
                <tr key={i.key} className={`idea-row ${selectedKey === i.key ? 'selected' : ''} ${drag === i.key ? 'dragging' : ''}`}
                  onClick={() => openIdea(mode, view.id, i.key)}
                  draggable={manual} onDragStart={e => { e.dataTransfer.setData('text/plain', i.key); setDrag(i.key) }} onDragEnd={() => setDrag(null)}
                  onDragOver={e => manual && drag && e.preventDefault()} onDrop={e => onDrop(e, i.key)}>
                  <td className="col-summary">
                    {manual && <span className="drag-handle"><Icon name="drag" size={14} /></span>}
                    <button className="idea-summary" onClick={e => { e.stopPropagation(); openIdea(mode, view.id, i.key) }}>{i.summary}</button>
                  </td>
                  {fields.map(f => <td key={f.id} className={`col-${f.type}`}><FieldEditor field={f} idea={i} readOnly={readOnly || view.archive} /></td>)}
                </tr>
              ))}
              {!isCollapsed && !readOnly && !view.archive && (
                <tr className="create-row"><td colSpan={fields.length + 1}><InlineCreate values={groupField && g.id != null ? { [groupField.id]: g.id } : {}} /></td></tr>
              )}
            </tbody>
          )
        })}
      </table>
      {ideas.length === 0 && <div className="empty">{view.archive ? t('Nothing archived. Archived ideas leave every view but keep their insights and history.') : t('No ideas match this view’s filters.')}</div>}
    </div>
  )
}
