import { useState } from 'react'
import { useStore, getValue, optionById, userById, COLORS } from './store.jsx'
import { Icon, Avatar, Chip, Dropdown } from './ui.jsx'
import { useT } from './lang.js'

export const TYPE_LABELS = {
  select: 'Single select', multiselect: 'Multi select', rating: 'Rating', number: 'Number', slider: 'Slider', text: 'Short text',
  link: 'Link', checkbox: 'Checkbox', date: 'Date', user: 'Person', interval: 'Date range', votes: 'Votes', formula: 'Formula',
  insights: 'Insights count', insightImpact: 'Insight impact', comments: 'Comments count', delivery: 'Delivery progress',
}
export const TYPE_ICONS = {
  select: 'chevron', multiselect: 'list', rating: 'more', number: 'fx', slider: 'filter', text: 'edit', link: 'link', checkbox: 'check',
  date: 'timeline', user: 'user', interval: 'timeline', votes: 'vote', formula: 'fx', insights: 'bulb', insightImpact: 'bulb', comments: 'comment', delivery: 'delivery',
}
export const COMPUTED = ['formula', 'insights', 'insightImpact', 'comments', 'delivery']

export const fmtMonth = (m, lang) => {
  if (!m) return ''
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { month: 'short', year: 'numeric' })
}
export const fmtDate = (d, lang) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const fmtNum = v => (Math.abs(v) >= 1000 ? v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : String(v))
export const safeUrl = u => (/^https?:\/\//i.test(u ?? '') ? u : null)

function Rating({ value, max = 5, onChange, label }) {
  const t = useT()
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0
  return (
    <span className={`rating ${onChange ? 'editable' : ''}`} onMouseLeave={() => setHover(null)} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? label : `${label}: ${value ?? 0}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        onChange
          ? <button key={i} type="button" className={`rating-dot ${i < shown ? 'on' : ''}`} aria-label={t('{n} of {max}', { n: i + 1, max })} role="radio" aria-checked={value === i + 1}
              onMouseEnter={() => setHover(i + 1)} onClick={e => { e.stopPropagation(); onChange(value === i + 1 ? null : i + 1) }} />
          : <span key={i} className={`rating-dot ${i < shown ? 'on' : ''}`} />
      ))}
    </span>
  )
}

function DeliveryBar({ v }) {
  const t = useT()
  if (!v) return <span className="muted small">–</span>
  const pct = n => `${(n / v.total) * 100}%`
  return (
    <span className="delivery-bar" title={t('{d} done, {p} in progress, {t} to do', { d: v.done, p: v.inprogress, t: v.total - v.done - v.inprogress })}>
      <span className="seg done" style={{ width: pct(v.done) }} />
      <span className="seg inprogress" style={{ width: pct(v.inprogress) }} />
    </span>
  )
}

function ScoreBar({ v, field }) {
  if (v == null) return <span className="muted small">–</span>
  if (field.formula?.kind === 'weighted') {
    return (
      <span className="score">
        <span className="score-bar"><span style={{ width: `${Math.min(100, Math.max(0, v))}%` }} /></span>
        <b>{v}</b>
      </span>
    )
  }
  return <span className="score num"><b>{fmtNum(v)}</b></span>
}

function VotesValue({ field, idea, editable }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const votes = idea.values[field.id] ?? {}
  const total = Object.values(votes).reduce((n, x) => n + x, 0)
  const mine = votes[state.me] ?? 0
  const used = Object.values(state.ideas).filter(i => !i.archived).reduce((n, i) => n + (i.values[field.id]?.[state.me] ?? 0), 0)
  const left = (field.maxPerUser ?? 3) - used
  if (!editable) return total ? <span className="votes-val"><Icon name="vote" size={13} />{total}</span> : <span className="muted small">0</span>
  return (
    <span className="votes-edit" onClick={e => e.stopPropagation()} title={t('You have {n} votes left', { n: left })}>
      <button className="vote-btn" aria-label={t('Remove my vote')} disabled={!mine} onClick={() => dispatch({ type: 'VOTE', key: idea.key, field: field.id, delta: -1 })}><Icon name="minus" size={12} /></button>
      <span className={`votes-total ${mine ? 'mine' : ''}`} aria-label={t('{n} votes, {m} mine', { n: total, m: mine })}>{total}{mine > 0 && <small>·{mine}</small>}</span>
      <button className="vote-btn up" aria-label={t('Vote')} disabled={left <= 0} onClick={() => dispatch({ type: 'VOTE', key: idea.key, field: field.id, delta: 1 })}><Icon name="plus" size={12} /></button>
    </span>
  )
}

// Read-only rendering of a field value; `compact` is used on cards (hides empty values).
export function FieldValue({ field, idea, compact }) {
  const t = useT()
  const { state } = useStore()
  const v = getValue(state, idea, field.id)
  const none = compact ? null : <span className="muted small">{t('None')}</span>
  const dash = compact ? null : <span className="muted small">–</span>
  switch (field.type) {
    case 'select': return v ? <Chip option={optionById(field, v)} /> : none
    case 'multiselect': return v?.length ? <span className="chips">{v.map(id => <Chip key={id} option={optionById(field, id)} />)}</span> : none
    case 'rating': return v ? <Rating value={v} max={field.max} label={field.name} /> : dash
    case 'number': return v != null ? <span className="num">{fmtNum(v)}</span> : dash
    case 'slider': return v != null ? <span className="slider-val"><span className="score-bar"><span style={{ width: `${v}%` }} /></span>{v}</span> : dash
    case 'text': return v ? <span className="text-val">{v}</span> : dash
    case 'link': return safeUrl(v) ? <a className="link-val" href={v} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><Icon name="link" size={13} />{v.replace(/^https?:\/\//, '').slice(0, 28)}</a> : dash
    case 'checkbox': return v ? <span className="check-val" title={field.name}><Icon name="check" size={14} />{compact && field.name}</span> : compact ? null : <span className="muted small">{t('No')}</span>
    case 'date': return v ? <span className="small">{fmtDate(v, t.lang)}</span> : dash
    case 'user': return v ? <span className="user-val"><Avatar user={userById(state, v)} size={20} />{!compact && userById(state, v)?.name}</span> : compact ? null : <span className="muted small">{t('Unassigned')}</span>
    case 'interval': return v ? <span className="small">{fmtMonth(v.start, t.lang)} – {fmtMonth(v.end, t.lang)}</span> : dash
    case 'formula': return compact && v == null ? null : <ScoreBar v={v} field={field} />
    case 'insights': return compact && !v ? null : <span className="insight-count" title={t('{n} insights', { n: v })}><Icon name="bulb" size={14} />{v}</span>
    case 'insightImpact': return compact && !v ? null : <span className="insight-count impact" title={field.name}><Icon name="bulb" size={14} />{v}</span>
    case 'comments': return compact && !v ? null : <span className="comment-count"><Icon name="comment" size={13} />{v}</span>
    case 'votes': return compact && !v ? null : <VotesValue field={field} idea={idea} />
    case 'delivery': return compact && !v ? null : <DeliveryBar v={v} />
    default: return null
  }
}

// Inline editor for a field value (falls back to FieldValue for computed fields).
export function FieldEditor({ field, idea, readOnly }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const v = getValue(state, idea, field.id)
  const set = value => dispatch({ type: 'SET_VALUE', key: idea.key, field: field.id, value })
  if (readOnly || COMPUTED.includes(field.type)) return <FieldValue field={field} idea={idea} />
  const stop = e => e.stopPropagation()

  switch (field.type) {
    case 'select':
    case 'multiselect': {
      const multi = field.type === 'multiselect'
      const selected = multi ? (v ?? []) : v
      return (
        <Dropdown searchable keepOpen={multi}
          options={[...(multi ? [] : [{ value: null, label: t('None') }]), ...field.options.map(o => ({ value: o.id, label: o.label, option: o }))]
            .map(o => ({ ...o, selected: multi ? selected.includes(o.value) : selected === o.value }))}
          onSelect={id => (multi ? set(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]) : set(id))}
          render={o => <>{multi && <input type="checkbox" readOnly checked={o.selected} tabIndex={-1} />}{o.option ? <Chip option={o.option} /> : <span className="muted">{o.label}</span>}</>}
          footer={({ query }) => query && !field.options.some(o => o.label.toLowerCase() === query.toLowerCase()) && (
            <button className="menu-item create-opt" onClick={() => dispatch({ type: 'ADD_OPTION', field: field.id, label: query })}>
              <Icon name="plus" size={14} /> {t('Create “{q}”', { q: query })}
            </button>
          )}
          trigger={({ toggle }) => (
            <button className="cell-btn" aria-label={field.name} onClick={e => { e.stopPropagation(); toggle() }}>
              {multi
                ? selected.length ? <span className="chips">{selected.map(id => <Chip key={id} option={optionById(field, id)} />)}</span> : <span className="muted small">{t('None')}</span>
                : selected ? <Chip option={optionById(field, selected)} /> : <span className="muted small">{t('None')}</span>}
            </button>
          )}
        />
      )
    }
    case 'rating':
      return <Rating value={v} max={field.max} onChange={set} label={field.name} />
    case 'number':
      return <input className="cell-input" type="number" aria-label={field.name} value={v ?? ''} onClick={stop} onChange={e => set(e.target.value === '' ? null : +e.target.value)} />
    case 'slider':
      return (
        <span className="slider-edit" onClick={stop}>
          <input type="range" min="1" max="100" aria-label={field.name} value={v ?? 1} onChange={e => set(+e.target.value)} />
          <span className="small num">{v ?? '–'}</span>
        </span>
      )
    case 'text':
      return <input className="cell-input" aria-label={field.name} maxLength={255} value={v ?? ''} onClick={stop} onChange={e => set(e.target.value || null)} />
    case 'link':
      return (
        <span className="link-edit" onClick={stop}>
          <input className="cell-input" type="url" aria-label={field.name} placeholder="https://" value={v ?? ''} onChange={e => set(e.target.value || null)} />
          {safeUrl(v) && <a className="icon-btn tiny" href={v} target="_blank" rel="noopener noreferrer" aria-label={t('Open link')}><Icon name="link" size={14} /></a>}
        </span>
      )
    case 'checkbox':
      return <input type="checkbox" className="cell-check" aria-label={field.name} checked={!!v} onClick={stop} onChange={e => set(e.target.checked)} />
    case 'date':
      return <input className="cell-input" type="date" aria-label={field.name} value={v ?? ''} onClick={stop} onChange={e => set(e.target.value || null)} />
    case 'votes':
      return <VotesValue field={field} idea={idea} editable />
    case 'user':
      return (
        <Dropdown searchable
          options={[{ value: null, label: t('Unassigned'), user: null }, ...state.users.map(u => ({ value: u.id, label: u.name, user: u }))].map(o => ({ ...o, selected: o.value === v }))}
          onSelect={set}
          render={o => <><Avatar user={o.user} size={20} /> {o.label}</>}
          trigger={({ toggle }) => (
            <button className="cell-btn" aria-label={field.name} onClick={e => { e.stopPropagation(); toggle() }}>
              <Avatar user={userById(state, v)} size={20} /> <span className={v ? '' : 'muted small'}>{userById(state, v)?.name ?? t('Unassigned')}</span>
            </button>
          )}
        />
      )
    case 'interval':
      return (
        <span className="interval-edit" onClick={stop}>
          <input type="month" aria-label={t('Start')} value={v?.start ?? ''} onChange={e => set(e.target.value ? { start: e.target.value, end: v?.end && v.end >= e.target.value ? v.end : e.target.value } : null)} />
          <span>–</span>
          <input type="month" aria-label={t('End')} value={v?.end ?? ''} min={v?.start} onChange={e => set(v?.start ? { ...v, end: e.target.value || v.start } : { start: e.target.value, end: e.target.value })} />
        </span>
      )
    default:
      return null
  }
}

export const optionColor = (field, id) => COLORS[optionById(field, id)?.color ?? 'stone']

// Label for a grouping bucket (select option, person, yes/no, or "none").
export function BucketLabel({ bucket, field }) {
  const t = useT()
  if (bucket.option) return <Chip option={bucket.option} />
  if (bucket.user) return <span className="user-val"><Avatar user={bucket.user} size={20} />{bucket.user.name}</span>
  if (bucket.check != null) return <span className="chip" style={{ background: bucket.check ? COLORS.sage.bg : COLORS.stone.bg, color: bucket.check ? COLORS.sage.fg : COLORS.stone.fg }}>{bucket.check ? t('Yes') : t('No')}</span>
  return <span className="muted">{t('No {field}', { field: field.name })}</span>
}
export const bucketTint = b => (b.option ? COLORS[b.option.color]?.bg + '59' : 'var(--sunk)')
