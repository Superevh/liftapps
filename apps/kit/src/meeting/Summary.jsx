import { useState } from 'react'
import { useStore } from '../core/store.jsx'
import { navigate } from '../core/ui.jsx'
import { Icon, DraftInput, copyText, showToast, itemIcon, money, downloadFile } from './common.jsx'
import { useMeeting, shareUrl } from './Meeting.jsx'
import { SeriesLinks, CalendarButton } from './Plan.jsx'
import { ActionList, PollResult, checkinLabel, checkinEmoji } from './Activities.jsx'
import { meetingIcs, mailtoMinutes, minutesText, plannedMinutes, fmtDate, MIN, usedMin, discussedTopics, topicEntries, voteCount } from './model.js'
import { createNext, fold } from './store.js'
import { backend } from '../core/live.js'
import { questionOf } from '../icebreakers/model.js'

export function Summary() {
  const { d, act, contribute, t, lang, nameOf, isFac, me } = useMeeting()
  const { identity } = useStore()
  const [busy, setBusy] = useState(false)
  // Only after the meeting has ended: before that its actions are still being worked on.
  const canPlanNext = d.run.status === 'done'
  const used = d.items.reduce((n, x) => n + (d.spent[x.id] ?? 0), 0)
  const ran = !!d.run.startedAt
  const names = [...new Set([...d.attendees, ...Object.values(d.people).map(p => p.name).filter(Boolean)])]
  const planNext = async () => {
    if (busy || d.series.nextId) return
    setBusy(true)
    try {
      navigate(`/m/${await createNext(d, identity)}/plan`)
    } catch (err) { setBusy(false); showToast(err.message) }
  }
  const elapsed = ran ? (d.run.endedAt ?? Date.now()) - d.run.startedAt : 0
  const people = d.cost.people ?? Math.max(1, Object.keys(d.people).length, d.attendees.length)
  const cost = (people * d.cost.rate * elapsed) / 3600000
  const removeDecision = x => { const i = d.decisions.indexOf(x); act({ type: 'REMOVE', coll: 'decisions', eid: x.id }); showToast(t.removed, () => act({ type: 'RESTORE', coll: 'decisions', entry: x, index: i })) }

  return (
    <div className="mt-summary">
      <div className="mt-summary-tools no-print">
        <a className="btn ghost sm" href={mailtoMinutes(d, t, lang, shareUrl(d.id) + '/summary')} title={t.emailHint}><Icon name="mail" size={14} /> {t.emailMinutes}</a>
        <button className="btn ghost sm" onClick={() => copyText(minutesText(d, t, lang, { format: 'slack', url: shareUrl(d.id) + '/summary' }), t)}><Icon name="comment" size={14} /> {t.copySlack}</button>
        <button className="btn ghost sm" onClick={() => copyText(minutesText(d, t, lang, { format: 'md', url: shareUrl(d.id) + '/summary' }), t)}><Icon name="copy" size={14} /> {t.copyTeams}</button>
        <button className="btn ghost sm" onClick={() => window.print()}><Icon name="print" size={14} /> {t.print}</button>
      </div>
      <div className="mt-summary-grid">
        <article className="mt-doc">
          <header className="mt-doc-head">
            <span className="mt-eyebrow">{t.minutesDoc}</span>
            <h1>{d.title || t.untitled}</h1>
            <p className="muted">
              {[d.date && fmtDate(d.date, lang, true), d.time, ran ? `${t.timeUsed} ${t.usedOf(usedMin(used), plannedMinutes(d))}` : t.minutes(plannedMinutes(d))].filter(Boolean).join(' · ')}
            </p>
            {names.length > 0 && <p className="small"><b>{t.attendees}{t.colon}</b>{names.join(', ')}</p>}
          </header>
          {!ran && <p className="tool-note small no-print">{t.notRunYet}</p>}

          {d.goal && <p className="mt-doc-goal"><b>{t.goal}{t.colon}</b>{d.goal}</p>}
          <section className="mt-doc-sec">
            <h2>{t.outcome}</h2>
            <DraftInput className="mt-outcome no-print" multiline rows={3} value={d.outcome} onSave={v => act({ type: 'SET', patch: { outcome: v } })} placeholder={t.outcomePh} aria-label={t.outcome} maxLength={2000} />
            <p className="print-only mt-pre">{d.outcome || '—'}</p>
          </section>

          <section className="mt-doc-sec">
            <h2><Icon name="decision" size={18} /> {t.decisions} <span className="mt-count">{d.decisions.length}</span></h2>
            {d.decisions.length ? (
              <ul className="mt-entries">
                {d.decisions.map(x => (
                  <li key={x.id} className="mt-entry c-decisions">
                    <span className="mt-entry-text">{x.text}<span className="muted small">{x.itemId ? ` · ${d.items.find(i => i.id === x.itemId)?.title ?? ''}` : ''}</span></span>
                    {(x.by === me || isFac) && <button className="icon-btn sm no-print" onClick={() => removeDecision(x)} aria-label={`${t.remove}: ${x.text}`} title={t.remove}><Icon name="trash" size={14} /></button>}
                  </li>
                ))}
              </ul>
            ) : <p className="muted small">{t.noDecisions}</p>}
            <QuickAdd coll="decisions" ph={t.ph.decisions} onAdd={(text) => contribute({ type: 'ADD', coll: 'decisions', text })} t={t} />
          </section>

          <section className="mt-doc-sec">
            <h2><Icon name="action" size={18} /> {t.actionItems} <span className="mt-count">{d.actions.filter(a => !a.done && !a.movedTo).length}</span></h2>
            <ActionList list={d.actions} empty={t.noActions} />
            {d.series?.nextId ? <p className="muted small no-print">{t.addInNext} <a href={`#/m/${d.series.nextId}/plan`}>{t.openNext} →</a></p> : <QuickAdd coll="actions" ph={t.ph.actions} onAdd={(text, owner, due) => contribute({ type: 'ADD', coll: 'actions', text, owner, due })} t={t} />}
          </section>

          <section className="mt-doc-sec">
            <h2><Icon name="agenda" size={18} /> {t.agendaNotes}</h2>
            <ol className="mt-doc-items">
              {d.items.map(x => <DocItem key={x.id} x={x} />)}
            </ol>
          </section>

          {d.parking.length > 0 && (
            <section className="mt-doc-sec">
              <h2><Icon name="parking" size={18} /> {t.parking}</h2>
              <ul className="mt-plain-list">
                {d.parking.map(x => (
                  <li key={x.id} className={x.resolved ? 'mt-resolved' : ''}>
                    {x.resolved ? <s>{x.text}</s> : x.text} <span className="muted small">· {nameOf(x.by)}{x.movedTo ? ` · ${t.movedTo}` : ''}</span>
                    {!x.movedTo && <button className="link-btn small no-print" onClick={() => act({ type: 'EDIT', coll: 'parking', eid: x.id, patch: { resolved: !x.resolved } })}>{x.resolved ? t.reopen : t.resolve}</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.cost.on && ran && <p className="muted small">{t.costTotal}{t.colon}<b>{money(cost, d.cost.currency, lang)}</b></p>}
        </article>

        <aside className="mt-col no-print">
          <section className="tool-card mt-card mt-next">
            <div className="mt-card-head"><h2><Icon name="repeat" size={18} /> {t.nextMeeting}</h2></div>
            {d.series?.nextId ? (
              <>
                <a className="btn primary mt-block-btn" href={`#/m/${d.series.nextId}/plan`}>{t.openNext} <Icon name="right" /></a>
                <NextCalendarButton id={d.series.nextId} />
              </>
            ) : (
              <>
                <p className="muted small">{canPlanNext ? t.planNextHint : t.nextAfter}</p>
                <button className="btn primary mt-block-btn" onClick={planNext} disabled={busy || !canPlanNext}>{busy ? t.creatingNext : <><Icon name="plus" /> {t.planNext}</>}</button>
                <CalendarButton />
              </>
            )}
          </section>
          <SeriesLinks prevOnly />
          {!ran && isFac && <a className="btn ghost mt-block-btn" href={`#/m/${d.id}/plan`}><Icon name="left" /> {t.tabs.plan}</a>}
        </aside>
      </div>
    </div>
  )
}

// The calendar entry for the next meeting in the series (loaded on demand, it is another document).
function NextCalendarButton({ id }) {
  const { t } = useMeeting()
  const save = async () => {
    try {
      const [row] = await backend.getBoards([id])
      const next = row && fold(row)
      const ics = next && meetingIcs(next, { url: shareUrl(id), t, now: Date.now() })
      if (!ics) { showToast(t.calNeedsDate); return }
      downloadFile(`${(next.title || 'meeting').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'meeting'}.ics`, ics, 'text/calendar')
      showToast(t.calDone)
    } catch (err) { showToast(err.message) }
  }
  return <button className="btn ghost sm mt-cal-btn" onClick={save}><Icon name="calendar" size={14} /> {t.addToCalendar}</button>
}

function QuickAdd({ coll, ph, onAdd, t }) {
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  return (
    <form className="mt-quickadd no-print" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; onAdd(text, owner, due); setText(''); setOwner(''); setDue('') }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder={ph} aria-label={ph} maxLength={500} />
      {coll === 'actions' && <input className="mt-qa-owner" value={owner} onChange={e => setOwner(e.target.value)} list="mt-people" placeholder={t.owner} aria-label={t.owner} maxLength={60} />}
      {coll === 'actions' && <input className="mt-qa-due" type="date" value={due} onChange={e => setDue(e.target.value)} aria-label={t.due} />}
      <button className="btn ghost sm" disabled={!text.trim()}><Icon name="plus" size={14} /> {t.add}</button>
    </form>
  )
}

function DocItem({ x }) {
  const { d, t, lang, nameOf } = useMeeting()
  const ms = d.spent[x.id] ?? 0
  const used = ms / MIN
  const notes = d.notes.filter(n => n.itemId === x.id && !n.topicId)
  const topics = x.activity === 'leancoffee' ? discussedTopics(d, x.id) : []
  const decisions = d.decisions.filter(n => n.itemId === x.id && !n.topicId)
  const checkin = x.activity === 'checkin' ? d.checkins[x.id] : null
  const poll = x.activity === 'poll' ? d.polls[x.id] : null
  const q = checkin && questionOf(checkin.qid, lang)
  const label = v => `${checkinEmoji(q, v)} ${checkinLabel(q, v, t)}`.trim()
  const pct = Math.min(100, (used / Math.max(1, x.minutes)) * 100)
  return (
    <li className="mt-doc-item">
      <div className="mt-doc-item-head">
        <Icon name={itemIcon(x)} size={15} />
        <b>{x.title}</b>
        {x.owner && <span className="muted small">· {x.owner}</span>}
        <span className="spacer" />
        <span className={`mt-used ${used > x.minutes ? 'over' : ''}`}>{ms ? t.usedOf(usedMin(ms), x.minutes) : t.minutes(x.minutes)}</span>
      </div>
      {ms > 0 && <div className="mt-used-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} className={used > x.minutes ? 'over' : ''} /></div>}
      {(notes.length > 0 || decisions.length > 0) && (
        <ul className="mt-doc-notes">
          {decisions.map(n => <li key={n.id}><b>{t.kinds.decisions}{t.colon}</b>{n.text}</li>)}
          {notes.map(n => <li key={n.id}>{n.text} <span className="muted small">· {nameOf(n.by)}</span></li>)}
        </ul>
      )}
      {topics.length > 0 && (
        <div className="mt-doc-sub"><span className="muted small">{t.topicsDiscussed}</span>
          <ol className="mt-doc-topics">
            {topics.map(tp => (
              <li key={tp.id}>
                <b>{tp.text}</b> <span className="muted small">· {t.votes(voteCount(tp))}</span>
                {topicEntries(d, tp.id).length > 0 && <ul className="mt-doc-notes">{topicEntries(d, tp.id).map(n => <li key={n.id}>{n.coll !== 'notes' && <b>{t.kinds[n.coll]}{t.colon}</b>}{n.text}{n.owner ? ` — ${n.owner}` : ''}</li>)}</ul>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {checkin && Object.keys(checkin.answers).length > 0 && (
        <div className="mt-doc-sub"><span className="muted small">{q?.text}</span>
          <ul className="mt-doc-notes">{Object.entries(checkin.answers).map(([pid, v]) => <li key={pid}><b>{nameOf(pid)}:</b> {label(v)}</li>)}</ul>
        </div>
      )}
      {poll && Object.keys(poll.votes).length > 0 && <div className="mt-doc-sub"><span className="muted small">{poll.question || t.pollDefault[poll.kind]}</span><PollResult p={poll} t={t} /></div>}
    </li>
  )
}
