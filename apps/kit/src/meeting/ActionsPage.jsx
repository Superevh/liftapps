import { useMemo, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { backend } from '../core/live.js'
import { useT } from './i18n.js'
import { Icon, Toaster, showToast } from './common.jsx'
import { useMeetings, collectActions, sendTo } from './store.js'
import { todayStr, fmtDate } from './model.js'
import './meeting.css'

export function dueState(due, today) {
  if (!due) return null
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'later'
}

export function ActionRow({ a, t, lang, today, onToggle, showMeeting }) {
  const ds = a.done ? null : dueState(a.due, today)
  return (
    <li className={`mt-action ${a.done ? 'done' : ''}`}>
      <button className={`mt-check ${a.done ? 'on' : ''}`} onClick={onToggle} aria-pressed={a.done} aria-label={`${a.done ? t.markOpen : t.markDone}: ${a.text}`}>
        {a.done && <Icon name="check" size={14} />}
      </button>
      <span className="mt-action-main">
        <span className="mt-action-text">{a.text}</span>
        <span className="mt-action-meta">
          <span>{a.owner || t.noOwner}</span>
          {a.due && <span className={`mt-due ${ds ?? ''}`}>{ds === 'overdue' ? `${t.overdue} · ` : ds === 'today' ? `${t.dueToday} · ` : ''}{fmtDate(a.due, lang)}</span>}
          {showMeeting && a.doc && <a href={`#/m/${a.doc.id}`}>{a.doc.title || t.untitled}</a>}
        </span>
      </span>
    </li>
  )
}

const weekEnd = today => {
  const d = new Date(today + 'T00:00')
  d.setDate(d.getDate() + (7 - d.getDay()) % 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ActionsPage() {
  const [t] = useT()
  const m = useMeetings()
  return (
    <main className="tool-page mt-page-narrow">
      <header className="mt-page-head">
        <div className="hero-eyebrow">{t.homeEyebrow}</div>
        <h1>{t.actionsTitle}</h1>
        <p className="mt-lead">{t.actionsLead}</p>
      </header>
      {!backend && <p className="tool-note small">{t.offline}</p>}
      <ActionsBoard {...m} />
      <Toaster />
    </main>
  )
}

// Action items across a set of meetings (this device's, or a team's), grouped by due date. Each action
// is read from, and ticked in, its own meeting document. `members` and `me` add the "my actions" filter.
export function ActionsBoard({ status, docs, error, reload, setDocs, members, me, onMe, emptyCta = true }) {
  const [t, lang] = useT()
  const { identity } = useStore()
  const [owner, setOwner] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const today = todayStr()
  const all = useMemo(() => collectActions(docs), [docs])
  const owners = useMemo(() => [...new Set([...(members ?? []), ...all.filter(a => !a.done).map(a => a.owner).filter(Boolean)])].sort((a, b) => a.localeCompare(b)), [all, members])
  const pick = owner === 'me' ? me : owner
  const same = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
  const shown = all.filter(a => !pick || same(a.owner, pick))
  const open = shown.filter(a => !a.done)
  const sunday = weekEnd(today)
  const groups = { overdue: [], week: [], later: [], nodate: [] }
  for (const a of open) groups[!a.due ? 'nodate' : a.due < today ? 'overdue' : a.due <= sunday ? 'week' : 'later'].push(a)
  for (const g of Object.values(groups)) g.sort((x, y) => (x.due || '').localeCompare(y.due || '') || x.at - y.at)
  const done = shown.filter(a => a.done).sort((x, y) => (y.doneAt ?? 0) - (x.doneAt ?? 0)).slice(0, 30)

  const toggle = async a => {
    setDocs(ds => ds.map(d => (d.id === a.doc.id ? { ...d, actions: d.actions.map(x => (x.id === a.id ? { ...x, done: !a.done, doneAt: a.done ? null : Date.now() } : x)) } : d)))
    try {
      await sendTo(a.doc.id, { type: 'EDIT', coll: 'actions', eid: a.id, patch: { done: !a.done }, pid: identity.id })
      if (!a.done) showToast(t.doneLabel, () => toggle({ ...a, done: true }))
    } catch { reload() }
  }

  return (
    <>
      {status === 'loading' && <div className="mt-skeleton" aria-busy="true" aria-label={t.loading}><span /><span /></div>}
      {error && <p className="mt-error" role="alert">{t.loadError} <button className="link-btn" onClick={reload}>{t.retry}</button></p>}
      {status === 'ready' && !all.length && (
        <div className="tool-card mt-empty">
          <Icon name="action" size={28} />
          <p>{t.noActionsAll}</p>
          {emptyCta && <a className="btn primary" href="#/m/new"><Icon name="plus" /> {t.newMeeting}</a>}
        </div>
      )}
      {all.length > 0 && (
        <>
          {(owners.length > 0 || onMe) && (
            <div className="chip-row" role="group" aria-label={t.owner}>
              <button className={`chip-btn ${!owner ? 'sel' : ''}`} aria-pressed={!owner} onClick={() => setOwner(null)}>{t.allOwners}</button>
              {onMe && <button className={`chip-btn ${owner === 'me' ? 'sel' : ''}`} aria-pressed={owner === 'me'} onClick={() => (me ? setOwner(owner === 'me' ? null : 'me') : onMe())}>{t.myActions}{me ? ` · ${me}` : ''}</button>}
              {owners.map(o => <button key={o} className={`chip-btn ${owner === o ? 'sel' : ''}`} aria-pressed={owner === o} onClick={() => setOwner(owner === o ? null : o)}>{o}</button>)}
            </div>
          )}
          {!open.length && <p className="muted">{t.noOpenActions}</p>}
          {Object.entries(groups).filter(([, list]) => list.length).map(([k, list]) => (
            <section key={k} className="tool-card mt-card">
              <div className="mt-card-head"><h2 className={k === 'overdue' ? 'mt-overdue-h' : ''}>{t.groups[k]}</h2><span className="mt-count">{list.length}</span></div>
              <ul className="mt-actions">{list.map(a => <ActionRow key={a.doc.id + a.id} a={a} t={t} lang={lang} today={today} onToggle={() => toggle(a)} showMeeting />)}</ul>
            </section>
          ))}
          {done.length > 0 && (
            <section className="tool-card mt-card">
              <button className="mt-disclose" aria-expanded={showDone} onClick={() => setShowDone(s => !s)}>
                <Icon name={showDone ? 'down' : 'right'} size={14} /> {t.recentlyDone} <span className="mt-count">{done.length}</span>
              </button>
              {showDone && <ul className="mt-actions">{done.map(a => <ActionRow key={a.doc.id + a.id} a={a} t={t} lang={lang} today={today} onToggle={() => toggle(a)} showMeeting />)}</ul>}
            </section>
          )}
        </>
      )}
    </>
  )
}
