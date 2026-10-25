import { useState } from 'react'
import { useStore, fieldById, userById } from './store.jsx'
import { Icon, Avatar, Dropdown, InlineText, RichText, timeAgo } from './ui.jsx'
import { FieldEditor, safeUrl } from './fields.jsx'
import { openIdea } from './App.jsx'
import { useT } from './lang.js'

function Collapsible({ title, children, defaultOpen = true, count }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="collapsible">
      <button className="collapsible-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name={open ? 'chevron' : 'chevronRight'} size={14} />
        <h3>{title}</h3>
        {count != null && <span className="count-pill">{count}</span>}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  )
}

function FieldRows({ fields, idea, readOnly }) {
  return (
    <div className="field-rows">
      {fields.map(f => (
        <div key={f.id} className="field-row">
          <div className="field-name" title={f.description}>{f.name}</div>
          <div className="field-val"><FieldEditor field={f} idea={idea} readOnly={readOnly} /></div>
        </div>
      ))}
    </div>
  )
}

function Overview({ idea, view, readOnly }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(idea.desc)
  const inView = view.fields.map(id => fieldById(state, id)).filter(Boolean)
  const others = state.fields.filter(f => !view.fields.includes(f.id))
  const startEdit = body => { setDesc(body ?? idea.desc); setEditing(true) }
  return (
    <>
      {editing ? (
        <div className="desc-edit">
          <textarea autoFocus rows={9} aria-label={t('Description')} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('Describe the problem, who has it and why it matters…')} />
          <div className="row">
            <button className="btn primary" onClick={() => { dispatch({ type: 'UPDATE_IDEA', key: idea.key, patch: { desc } }); setEditing(false) }}>{t('Save')}</button>
            <button className="btn subtle" onClick={() => setEditing(false)}>{t('Cancel')}</button>
          </div>
        </div>
      ) : (
        <>
          <div className={`idea-desc ${readOnly ? '' : 'editable'}`} role={readOnly ? undefined : 'button'} tabIndex={readOnly ? undefined : 0}
            onClick={() => !readOnly && startEdit()} onKeyDown={e => !readOnly && e.key === 'Enter' && startEdit()}>
            {idea.desc ? <RichText text={idea.desc} /> : <span className="muted">{readOnly ? t('No description') : t('Add a description…')}</span>}
          </div>
          {!readOnly && !idea.desc && state.templates.length > 0 && (
            <div className="template-row">
              <span className="muted small">{t('Start from a template')}:</span>
              {state.templates.map(tp => <button key={tp.id} className="field-token" onClick={() => startEdit(tp.body)}><Icon name="doc" size={12} /> {tp.name}</button>)}
            </div>
          )}
        </>
      )}
      <Collapsible title={t('Fields in this view')}><FieldRows fields={inView} idea={idea} readOnly={readOnly} /></Collapsible>
      {!readOnly && others.length > 0 && (
        <Collapsible title={t('Other fields')} defaultOpen={false} count={others.length}><FieldRows fields={others} idea={idea} /></Collapsible>
      )}
    </>
  )
}

function ImpactPicker({ value, onChange }) {
  const t = useT()
  return (
    <span className="impact-pick" role="radiogroup" aria-label={t('Insight impact')}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t('{n} of {max}', { n, max: 5 })}
          className={`rating-dot ${value >= n ? 'on' : ''}`} onClick={() => onChange(value === n ? null : n)} />
      ))}
    </span>
  )
}

function InsightForm({ initial, onSave, onCancel, submitLabel }) {
  const t = useT()
  const [f, setF] = useState({ text: '', source: '', customer: '', link: '', impact: 3, labels: [], ...initial })
  const [label, setLabel] = useState('')
  const set = p => setF(x => ({ ...x, ...p }))
  const addLabel = () => { const l = label.trim(); if (l && !f.labels.includes(l)) set({ labels: [...f.labels, l] }); setLabel('') }
  return (
    <form className="insight-form" onSubmit={e => { e.preventDefault(); if (f.text.trim()) onSave({ ...f, text: f.text.trim(), source: f.source.trim(), customer: f.customer.trim(), link: f.link.trim() }) }}>
      <textarea autoFocus rows={3} aria-label={t('Insight')} placeholder={t('Paste a quote, data point or observation…')} value={f.text} onChange={e => set({ text: e.target.value })} />
      <div className="row wrap">
        <input aria-label={t('Source')} placeholder={t('Source (interview, ticket, survey…)')} value={f.source} onChange={e => set({ source: e.target.value })} />
        <input aria-label={t('Customer or segment')} placeholder={t('Customer or segment')} value={f.customer} onChange={e => set({ customer: e.target.value })} />
      </div>
      <input aria-label={t('Link')} type="url" placeholder={t('Link to the evidence (optional)')} value={f.link} onChange={e => set({ link: e.target.value })} />
      <div className="row wrap">
        <span className="muted small">{t('Impact')}</span><ImpactPicker value={f.impact} onChange={impact => set({ impact })} />
        <span className="spacer" />
        {f.labels.map(l => <span key={l} className="label-chip">{l}<button type="button" aria-label={t('Remove')} onClick={() => set({ labels: f.labels.filter(x => x !== l) })}>×</button></span>)}
        <input className="label-input" aria-label={t('Add label')} placeholder={t('+ label')} value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel() } }} onBlur={addLabel} />
      </div>
      <div className="row"><button className="btn primary" disabled={!f.text.trim()}>{submitLabel}</button><button type="button" className="btn subtle" onClick={onCancel}>{t('Cancel')}</button></div>
    </form>
  )
}

function Insights({ idea, readOnly }) {
  const t = useT()
  const { dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const total = idea.insights.reduce((n, x) => n + (x.impact ?? 1), 0)
  return (
    <div className="insights">
      <p className="muted small">{t('Insights are the evidence behind an idea: customer quotes, data points, tickets. Rate how strongly each one supports the idea; the ratings add up to the Insight impact field.')}</p>
      {idea.insights.length > 0 && <div className="insight-total"><Icon name="bulb" size={16} /> {t('{n} insights · impact {m}', { n: idea.insights.length, m: total })}</div>}
      {!readOnly && (adding
        ? <InsightForm submitLabel={t('Add insight')} onCancel={() => setAdding(false)} onSave={insight => { dispatch({ type: 'ADD_INSIGHT', key: idea.key, insight }); setAdding(false) }} />
        : <button className="btn subtle" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> {t('Add insight')}</button>)}
      <ul className="insight-list">
        {idea.insights.map(ins => editing === ins.id ? (
          <li key={ins.id}><InsightForm initial={ins} submitLabel={t('Save')} onCancel={() => setEditing(null)} onSave={patch => { dispatch({ type: 'UPDATE_INSIGHT', key: idea.key, id: ins.id, patch }); setEditing(null) }} /></li>
        ) : (
          <li key={ins.id} className="insight">
            <span className="insight-impact" title={t('Impact')} aria-label={t('Impact {n}', { n: ins.impact ?? 1 })}>{ins.impact ?? '–'}</span>
            <div className="grow">
              <div className="insight-text">“{ins.text}”</div>
              <div className="muted small">{[ins.customer, ins.source, timeAgo(ins.at, t.lang)].filter(Boolean).join(' · ')}</div>
              {(ins.labels?.length > 0 || safeUrl(ins.link)) && (
                <div className="insight-meta">
                  {ins.labels.map(l => <span key={l} className="label-chip">{l}</span>)}
                  {safeUrl(ins.link) && <a href={ins.link} target="_blank" rel="noopener noreferrer" className="small"><Icon name="link" size={12} /> {t('Source link')}</a>}
                </div>
              )}
            </div>
            {!readOnly && (
              <>
                <button className="icon-btn tiny" aria-label={t('Edit insight')} onClick={() => setEditing(ins.id)}><Icon name="edit" size={14} /></button>
                <button className="icon-btn tiny" aria-label={t('Delete insight')} onClick={() => dispatch({ type: 'DELETE_INSIGHT', key: idea.key, id: ins.id })}><Icon name="trash" size={14} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const DELIVERY_STATUS = { todo: 'To do', inprogress: 'In progress', done: 'Done' }

function Delivery({ idea, readOnly }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [summary, setSummary] = useState('')
  const [key, setKey] = useState('')
  const total = idea.delivery.length
  const done = idea.delivery.filter(d => d.status === 'done').length
  const prog = idea.delivery.filter(d => d.status === 'inprogress').length
  const add = e => {
    e.preventDefault()
    if (!summary.trim()) return
    const n = Object.values(state.ideas).reduce((m, i) => m + i.delivery.length, 0) + 101
    dispatch({ type: 'ADD_DELIVERY', key: idea.key, item: { key: key.trim() || `DEV-${n}`, summary: summary.trim() } })
    setSummary(''); setKey('')
  }
  return (
    <div className="delivery">
      <p className="muted small">{t('Track the build work for this idea. Add each ticket or story; progress rolls up into the Delivery progress field and onto the roadmap.')}</p>
      {total > 0 && (
        <div className="delivery-summary">
          <span className="delivery-bar big">
            <span className="seg done" style={{ width: `${(done / total) * 100}%` }} />
            <span className="seg inprogress" style={{ width: `${(prog / total) * 100}%` }} />
          </span>
          <span className="small muted">{t('{d} of {n} done', { d: done, n: total })}</span>
        </div>
      )}
      <ul className="delivery-list">
        {idea.delivery.map(d => (
          <li key={d.id}>
            <span className="dev-key">{d.key}</span>
            <span className="grow">{d.summary}</span>
            {readOnly ? <span className={`lozenge ${d.status}`}>{t(DELIVERY_STATUS[d.status])}</span> : (
              <>
                <Dropdown align="right"
                  options={Object.entries(DELIVERY_STATUS).map(([v, l]) => ({ value: v, label: t(l), selected: v === d.status }))}
                  onSelect={status => dispatch({ type: 'UPDATE_DELIVERY', key: idea.key, id: d.id, patch: { status } })}
                  render={o => <span className={`lozenge ${o.value}`}>{o.label}</span>}
                  trigger={({ toggle }) => <button className={`lozenge ${d.status}`} onClick={toggle}>{t(DELIVERY_STATUS[d.status])} ▾</button>} />
                <button className="icon-btn tiny" aria-label={t('Remove ticket')} onClick={() => dispatch({ type: 'DELETE_DELIVERY', key: idea.key, id: d.id })}><Icon name="close" size={14} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form className="row" onSubmit={add}>
          <input className="dev-key-input" aria-label={t('Ticket key')} placeholder={t('Key')} value={key} onChange={e => setKey(e.target.value)} />
          <input aria-label={t('Ticket summary')} placeholder={t('Add a delivery ticket…')} value={summary} onChange={e => setSummary(e.target.value)} />
          <button className="btn subtle" disabled={!summary.trim()}>{t('Add')}</button>
        </form>
      )}
    </div>
  )
}

function Comments({ idea }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  return (
    <div className="comments">
      <div className="comment-composer">
        <Avatar user={userById(state, state.me)} size={28} />
        <div className="grow">
          <textarea rows={2} aria-label={t('Add a comment…')} placeholder={t('Add a comment…')} value={text} onChange={e => setText(e.target.value)} />
          {text.trim() && <div className="row"><button className="btn primary" onClick={() => { dispatch({ type: 'ADD_COMMENT', key: idea.key, text: text.trim() }); setText('') }}>{t('Save')}</button></div>}
        </div>
      </div>
      {[...idea.comments].reverse().map(c => (
        <div key={c.id} className="comment">
          <Avatar user={userById(state, c.author)} size={28} />
          <div className="grow">
            <div><b>{userById(state, c.author)?.name}</b> <span className="muted small">{timeAgo(c.at, t.lang)}</span></div>
            <div className="comment-text">{c.text}</div>
            {c.author === state.me && <button className="link-btn" onClick={() => dispatch({ type: 'DELETE_COMMENT', key: idea.key, id: c.id })}>{t('Delete')}</button>}
          </div>
        </div>
      ))}
      {idea.comments.length === 0 && <p className="muted small">{t('No comments yet.')}</p>}
    </div>
  )
}

export default function IdeaPanel({ idea, view, mode, layout, onClose }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const readOnly = mode === 'share'
  const [tab, setTab] = useState('overview')
  const [confirm, setConfirm] = useState(false)
  const tabs = [['overview', t('Overview')], ['insights', `${t('Insights')} (${idea.insights.length})`], ['delivery', t('Delivery')], ['comments', `${t('Comments')}${idea.comments.length ? ` (${idea.comments.length})` : ''}`]]
  const actions = [
    { value: 'archive', label: idea.archived ? t('Restore idea') : t('Archive idea'), icon: idea.archived ? 'restore' : 'archive' },
    { value: 'delete', label: t('Delete idea'), icon: 'trash', danger: true },
  ]
  return (
    <aside className={`right-panel idea-panel layout-${layout}`} aria-label={idea.summary}>
      <div className="panel-head">
        <nav className="crumbs">
          <Icon name="bulb" size={14} />
          <span className="ellipsis">{state.space.name}</span> /
          {readOnly ? <span>{idea.key}</span> : <a href={`#/view/${view.id}?idea=${idea.key}&layout=full`}>{idea.key}</a>}
          {idea.archived && <span className="archived-badge">{t('Archived')}</span>}
        </nav>
        <span className="spacer" />
        {!readOnly && (
          <>
            <Dropdown align="right" options={actions}
              onSelect={v => {
                if (v === 'archive') { dispatch({ type: 'ARCHIVE_IDEA', key: idea.key, archived: !idea.archived }); onClose() }
                if (v === 'delete') setConfirm(true)
              }}
              render={o => <span className={o.danger ? 'danger' : ''}><Icon name={o.icon} size={14} /> {o.label}</span>}
              trigger={({ toggle }) => <button className="icon-btn" aria-label={t('More actions')} onClick={toggle}><Icon name="more" /></button>} />
            <button className="icon-btn hide-mobile" aria-label={layout === 'full' ? t('Collapse') : t('Expand')}
              onClick={() => openIdea(mode, view.id, idea.key, layout === 'full' ? 'sidebar' : 'full')}>
              <Icon name="expand" />
            </button>
          </>
        )}
        <button className="icon-btn" aria-label={t('Close')} onClick={onClose}><Icon name="close" /></button>
      </div>
      {confirm && (
        <div className="confirm-bar" role="alert">
          <span>{t('Delete this idea for good? Archive keeps it out of views but recoverable.')}</span>
          <button className="btn danger-btn" onClick={() => { dispatch({ type: 'DELETE_IDEA', key: idea.key }); onClose() }}>{t('Delete')}</button>
          <button className="btn subtle" onClick={() => setConfirm(false)}>{t('Cancel')}</button>
        </div>
      )}
      <InlineText className="idea-title" value={idea.summary} readOnly={readOnly} multiline label={t('Idea summary')}
        onSave={summary => dispatch({ type: 'UPDATE_IDEA', key: idea.key, patch: { summary } })} />
      <div className="tabs" role="tablist">
        {(readOnly ? tabs.slice(0, 3) : tabs).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'overview' && <Overview key={idea.key} idea={idea} view={view} readOnly={readOnly} />}
        {tab === 'insights' && <Insights key={idea.key} idea={idea} readOnly={readOnly} />}
        {tab === 'delivery' && <Delivery idea={idea} readOnly={readOnly} />}
        {!readOnly && tab === 'comments' && <Comments idea={idea} />}
      </div>
      {!readOnly && <div className="panel-foot muted small">{t('Created {a} · Updated {b}', { a: timeAgo(idea.created, t.lang), b: timeAgo(idea.updated, t.lang) })}</div>}
    </aside>
  )
}
