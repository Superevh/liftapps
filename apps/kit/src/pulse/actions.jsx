import { useState } from 'react'
import { Icon } from '../core/icons.jsx'
import { useStore } from '../core/store.jsx'
import { ACTION_STATUS, VERDICTS, actionState, areaTitle } from './model.js'
import { useT, fill, showToast, fmtDate, rovingKeys, rovingTab } from './bits.jsx'

// Improvement actions live in the team document. Anyone on the team can add and update them;
// deletes come with an undo.

export function ActionForm({ areas, dispatch, checkId, defaultArea = '', onDone, compact }) {
  const [t] = useT()
  const { identity } = useStore()
  const [text, setText] = useState('')
  const [qid, setQid] = useState(defaultArea)
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const submit = e => {
    e.preventDefault()
    if (!text.trim()) return
    const a = areas.find(x => x.id === qid)
    dispatch({ type: 'ACTION_ADD', text: text.trim(), qid: a?.id ?? null, area: a?.title ?? '', owner: owner.trim(), due: due || null, checkId: checkId ?? null })
    setText(''); setOwner(''); setDue('')
    onDone?.()
  }
  const idp = `af-${checkId ?? 'x'}-${defaultArea || 'g'}`
  return (
    <form className={`pl-action-form ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <label className="pl-af-text"><span className="field-label">{t.act.text}</span><input value={text} onChange={e => setText(e.target.value)} placeholder={t.act.textPh} maxLength={300} /></label>
      {!compact && <label><span className="field-label" id={`${idp}-a`}>{t.act.area}</span>
        <select value={qid} onChange={e => setQid(e.target.value)}><option value="">{t.act.noArea}</option>{areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>}
      <label><span className="field-label">{t.act.owner}</span><input value={owner} onChange={e => setOwner(e.target.value)} placeholder={identity.name || t.act.ownerPh} maxLength={60} /></label>
      <label><span className="field-label">{t.act.due}</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      <button className="btn ghost pl-af-go" disabled={!text.trim()}><Icon name="plus" /> {t.act.add}</button>
    </form>
  )
}

export function ActionItem({ x, dispatch, now, review, checkId, canEdit = true }) {
  const [t, lang] = useT()
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(x.text)
  const [owner, setOwner] = useState(x.owner)
  const [due, setDue] = useState(x.due ?? '')
  const st = actionState(x, now)
  const del = () => {
    dispatch({ type: 'ACTION_DELETE', id: x.id })
    showToast(t.act.deleted, () => dispatch({ type: 'ACTION_RESTORE', item: x }))
  }
  const save = e => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'ACTION_UPDATE', id: x.id, patch: { text, owner, due: due || null } })
    setEdit(false)
  }
  if (edit) return (
    <li className="pl-action editing">
      <form className="pl-action-form compact" onSubmit={save}>
        <label className="pl-af-text"><span className="field-label">{t.act.text}</span><input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={300} /></label>
        <label><span className="field-label">{t.act.owner}</span><input value={owner} onChange={e => setOwner(e.target.value)} maxLength={60} placeholder={t.act.ownerPh} /></label>
        <label><span className="field-label">{t.act.due}</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        <div className="row pl-af-go"><button type="button" className="btn ghost sm" onClick={() => setEdit(false)}>{t.act.cancel}</button><button className="btn primary sm" disabled={!text.trim()}>{t.act.save}</button></div>
      </form>
    </li>
  )
  return (
    <li className={`pl-action st-${st}`}>
      <div className="pl-action-main">
        <button className={`pl-done-box ${x.status === 'done' ? 'on' : ''}`} role="checkbox" aria-checked={x.status === 'done'} aria-label={`${t.act.st.done}: ${x.text}`} disabled={!canEdit}
          onClick={() => dispatch({ type: 'ACTION_UPDATE', id: x.id, patch: { status: x.status === 'done' ? 'todo' : 'done' } })}>{x.status === 'done' && <Icon name="check" size={14} />}</button>
        <div className="pl-action-body">
          <span className="pl-action-text">{x.text}</span>
          <span className="pl-action-meta">
            {x.area && <span className="pl-chip">{x.qid ? areaTitle({ id: x.qid, title: x.area }, lang) : x.area}</span>}
            {x.owner && <span><Icon name="users" size={12} /> {x.owner}</span>}
            {x.due && <span className={st === 'overdue' ? 'pl-warn-text' : ''}><Icon name="timer" size={12} /> {fmtDate(Date.parse(x.due) + 43200000, lang)}</span>}
            <span className={`pl-status ${st}`}>{t.act.st[st]}</span>
          </span>
        </div>
        {canEdit && <div className="pl-action-tools">
          <select className="pl-status-sel" value={x.status} onChange={e => dispatch({ type: 'ACTION_UPDATE', id: x.id, patch: { status: e.target.value } })} aria-label={`${t.act.status}: ${x.text}`}>
            {ACTION_STATUS.map(s => <option key={s} value={s}>{t.act.st[s]}</option>)}
          </select>
          <button className="icon-btn sm" onClick={() => setEdit(true)} aria-label={`${t.act.edit}: ${x.text}`} title={t.act.edit}><Icon name="edit" size={14} /></button>
          <button className="icon-btn sm" onClick={del} aria-label={`${t.act.del}: ${x.text}`} title={t.act.del}><Icon name="trash" size={14} /></button>
        </div>}
      </div>
      {review && !x.review && x.status === 'todo' && <p className="pl-review muted small">{t.act.reviewLater}</p>}
      {((review && x.status !== 'todo') || x.review) && (
        <div className="pl-review">
          <span className="pl-review-q">{t.act.helped}</span>
          <div className="seg small-seg" role="radiogroup" aria-label={`${t.act.helped} ${x.text}`} onKeyDown={rovingKeys}>
            {VERDICTS.map((v, i) => <button key={v} role="radio" aria-checked={x.review?.verdict === v} tabIndex={rovingTab(x.review?.verdict === v, i, !!x.review)} className={x.review?.verdict === v ? 'on' : ''} disabled={!review}
              onClick={() => dispatch({ type: 'ACTION_REVIEW', id: x.id, verdict: x.review?.verdict === v ? null : v, checkId })}>{t.act.v[v]}</button>)}
          </div>
        </div>
      )}
    </li>
  )
}

export function ActionList({ items, dispatch, now, review, checkId, canEdit }) {
  return <ul className="pl-actions">{items.map(x => <ActionItem key={x.id} x={x} dispatch={dispatch} now={now} review={review} checkId={checkId} canEdit={canEdit} />)}</ul>
}

export { fill }
