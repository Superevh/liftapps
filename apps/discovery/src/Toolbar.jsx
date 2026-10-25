import { useState } from 'react'
import { useStore, fieldById, groupable, NUMERIC_TYPES } from './store.jsx'
import { Icon, Chip, Avatar, Popover, Dropdown } from './ui.jsx'
import { TYPE_LABELS, TYPE_ICONS } from './fields.jsx'
import FieldSettings from './FieldSettings.jsx'
import { useT } from './lang.js'

const axisable = f => [...NUMERIC_TYPES, 'select'].includes(f.type) && f.type !== 'checkbox'

function FilterPop({ view, patch }) {
  const t = useT()
  const { state } = useStore()
  const filters = view.filters ?? []
  const get = field => filters.find(f => f.field === field)
  const vals = field => get(field)?.values ?? []
  const setFilter = (field, next) => patch({ filters: [...filters.filter(f => f.field !== field), ...(next ? [{ field, ...next }] : [])] })
  const setVals = (field, values) => setFilter(field, values.length ? { values } : null)
  const categorical = state.fields.filter(f => ['select', 'multiselect', 'user', 'checkbox'].includes(f.type))
  const numericFields = state.fields.filter(f => NUMERIC_TYPES.includes(f.type) && f.type !== 'checkbox')
  const [numField, setNumField] = useState(numericFields[0]?.id ?? '')
  const numFilters = filters.filter(f => f.min != null || f.max != null)
  return (
    <div className="filter-pop">
      <div className="popover-title">{t('Filter ideas')}</div>
      <input autoFocus placeholder={t('Search ideas')} aria-label={t('Search ideas')} value={vals('__text')[0] ?? ''} onChange={e => setVals('__text', e.target.value ? [e.target.value] : [])} />
      {categorical.map(f => {
        const opts = f.type === 'user'
          ? [...state.users.map(u => ({ id: u.id, node: <><Avatar user={u} size={18} /> {u.name}</> })), { id: '__none', node: <span className="muted">{t('Unassigned')}</span> }]
          : f.type === 'checkbox' ? [{ id: 'yes', node: t('Yes') }, { id: 'no', node: t('No') }]
            : [...f.options.map(o => ({ id: o.id, node: <Chip option={o} /> })), { id: '__none', node: <span className="muted">{t('None')}</span> }]
        const v = vals(f.id)
        return (
          <details key={f.id} open={v.length > 0}>
            <summary>{f.name}{v.length > 0 && <span className="count-pill">{v.length}</span>}</summary>
            {opts.map(o => (
              <label key={o.id} className="check-row">
                <input type="checkbox" checked={v.includes(o.id)} onChange={() => setVals(f.id, v.includes(o.id) ? v.filter(x => x !== o.id) : [...v, o.id])} />
                {o.node}
              </label>
            ))}
          </details>
        )
      })}
      {numericFields.length > 0 && (
        <details open={numFilters.length > 0}>
          <summary>{t('Number range')}{numFilters.length > 0 && <span className="count-pill">{numFilters.length}</span>}</summary>
          {numFilters.map(nf => (
            <div key={nf.field} className="num-filter">
              <span className="grow ellipsis">{fieldById(state, nf.field)?.name}</span>
              <input type="number" aria-label={t('Minimum')} placeholder={t('min')} value={nf.min ?? ''} onChange={e => setFilter(nf.field, { min: e.target.value === '' ? null : +e.target.value, max: nf.max })} />
              <input type="number" aria-label={t('Maximum')} placeholder={t('max')} value={nf.max ?? ''} onChange={e => setFilter(nf.field, { min: nf.min, max: e.target.value === '' ? null : +e.target.value })} />
              <button className="icon-btn tiny" aria-label={t('Remove')} onClick={() => setFilter(nf.field, null)}><Icon name="close" size={12} /></button>
            </div>
          ))}
          <div className="row">
            <select aria-label={t('Field')} value={numField} onChange={e => setNumField(e.target.value)}>
              {numericFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="btn subtle" onClick={() => numField && setFilter(numField, { min: 1, max: null })}>{t('Add')}</button>
          </div>
        </details>
      )}
      {filters.length > 0 && <button className="btn subtle full" onClick={() => patch({ filters: [] })}>{t('Clear all filters')}</button>}
    </div>
  )
}

function SortPop({ view, patch }) {
  const t = useT()
  const { state } = useStore()
  const sort = view.sort ?? { field: null, dir: 'asc' }
  return (
    <div className="sort-pop">
      <div className="popover-title">{t('Sort')}</div>
      <select aria-label={t('Sort by')} value={sort.field ?? ''} onChange={e => patch({ sort: e.target.value ? { field: e.target.value, dir: sort.dir ?? 'asc' } : null })}>
        <option value="">{t('Manual (drag to rank)')}</option>
        {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      {sort.field && (
        <div className="seg-control">
          <button className={sort.dir === 'asc' ? 'on' : ''} onClick={() => patch({ sort: { ...sort, dir: 'asc' } })}>{t('Ascending')}</button>
          <button className={sort.dir === 'desc' ? 'on' : ''} onClick={() => patch({ sort: { ...sort, dir: 'desc' } })}>{t('Descending')}</button>
        </div>
      )}
    </div>
  )
}

function FieldsPop({ view, patch, onEdit }) {
  const t = useT()
  const { state } = useStore()
  const [q, setQ] = useState('')
  const toggle = id => patch({ fields: view.fields.includes(id) ? view.fields.filter(x => x !== id) : [...view.fields, id] })
  const shown = state.fields.filter(f => !q || f.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fields-pop">
      <div className="popover-title">{t('Fields in this view')}</div>
      <input placeholder={t('Search fields')} aria-label={t('Search fields')} value={q} onChange={e => setQ(e.target.value)} />
      <div className="fields-scroll">
        {shown.map(f => (
          <div key={f.id} className="field-toggle">
            <label className="check-row grow">
              <input type="checkbox" checked={view.fields.includes(f.id)} onChange={() => toggle(f.id)} />
              <Icon name={TYPE_ICONS[f.type]} size={14} className="muted" />
              <span className="grow ellipsis">{f.name}</span>
              <span className="muted small">{t(TYPE_LABELS[f.type])}</span>
            </label>
            <button className="icon-btn tiny" aria-label={t('Edit {name}', { name: f.name })} onClick={() => onEdit(f)}><Icon name="gear" size={14} /></button>
          </div>
        ))}
      </div>
      <button className="btn subtle full" onClick={() => onEdit(null)}><Icon name="plus" size={14} /> {t('Create field')}</button>
    </div>
  )
}

function FieldSelect({ label, value, onChange, filter, allowNone }) {
  const t = useT()
  const { state } = useStore()
  const opts = [...(allowNone ? [{ value: null, label: t('None') }] : []), ...state.fields.filter(filter).map(f => ({ value: f.id, label: f.name }))]
  return (
    <Dropdown
      options={opts.map(o => ({ ...o, selected: o.value === value }))}
      onSelect={onChange}
      trigger={({ toggle }) => (
        <button className="btn subtle" onClick={toggle}>{label}: <b>{fieldById(state, value)?.name ?? t('None')}</b> <Icon name="chevron" size={12} /></button>
      )}
    />
  )
}

export default function Toolbar({ view, patch, readOnly, onCreate }) {
  const t = useT()
  const { state } = useStore()
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new field, object = edit
  const nFilters = (view.filters ?? []).filter(f => (f.values?.length && (f.field !== '__text' || f.values[0])) || f.min != null || f.max != null).length
  const custom = !readOnly && !view.archive
  return (
    <div className="toolbar">
      <Popover trigger={({ toggle }) => <button className={`btn subtle ${nFilters ? 'active' : ''}`} onClick={toggle}><Icon name="filter" size={14} /> {t('Filter')}{nFilters ? ` (${nFilters})` : ''}</button>}>
        {() => <FilterPop view={view} patch={patch} />}
      </Popover>
      <Popover trigger={({ toggle }) => <button className={`btn subtle ${view.sort?.field ? 'active' : ''}`} onClick={toggle}><Icon name="sort" size={14} /> {t('Sort')}{view.sort?.field ? `: ${fieldById(state, view.sort.field)?.name}` : ''}</button>}>
        {() => <SortPop view={view} patch={patch} />}
      </Popover>
      {custom && (
        <>
          <Popover trigger={({ toggle }) => <button className="btn subtle" onClick={toggle}><Icon name="fields" size={14} /> {t('Fields')}</button>}>
            {({ close }) => <FieldsPop view={view} patch={patch} onEdit={f => { close(); setEditing(f) }} />}
          </Popover>
          <span className="divider" />
          {view.type === 'list' && <FieldSelect label={t('Group by')} value={view.groupBy} allowNone filter={groupable} onChange={groupBy => patch({ groupBy })} />}
          {view.type === 'board' && (
            <>
              <FieldSelect label={t('Columns')} value={view.groupBy} filter={groupable} onChange={groupBy => patch({ groupBy })} />
              <FieldSelect label={t('Swimlanes')} value={view.swimlanes} allowNone filter={f => groupable(f) && f.id !== view.groupBy} onChange={swimlanes => patch({ swimlanes })} />
            </>
          )}
          {view.type === 'matrix' && (
            <>
              <FieldSelect label={t('X axis')} value={view.x} filter={axisable} onChange={x => patch({ x })} />
              <FieldSelect label={t('Y axis')} value={view.y} filter={axisable} onChange={y => patch({ y })} />
              <FieldSelect label={t('Bubble size')} value={view.size} allowNone filter={f => NUMERIC_TYPES.includes(f.type) && f.type !== 'checkbox'} onChange={size => patch({ size })} />
              <FieldSelect label={t('Colour')} value={view.colorBy} filter={f => f.type === 'select'} onChange={colorBy => patch({ colorBy })} />
            </>
          )}
          {view.type === 'timeline' && (
            <>
              <FieldSelect label={t('Dates')} value={view.dateField} filter={f => f.type === 'interval'} onChange={dateField => patch({ dateField })} />
              <FieldSelect label={t('Group by')} value={view.groupBy} allowNone filter={groupable} onChange={groupBy => patch({ groupBy })} />
            </>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={onCreate}><Icon name="plus" size={14} /> {t('Create idea')}</button>
        </>
      )}
      {editing !== undefined && <FieldSettings field={editing} viewId={view.id} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
