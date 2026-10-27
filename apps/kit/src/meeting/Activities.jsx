import { useMemo, useState } from 'react'
import { sparkle } from '../core/fx.js'
import { Icon, Person, showToast, DraftInput, useNow } from './common.jsx'
import { useMeeting } from './Meeting.jsx'
import { votesUsed, voteCount, topicLeft, fmtClock, fmtDate, todayStr } from './model.js'
import { questionOf, optionsOf, drawQuestion } from '../icebreakers/model.js'
import { CHECKIN_CATS, checkinQid } from './Plan.jsx'
import { dueState } from './ActionsPage.jsx'

// ---------- suggested topics / Lean Coffee ----------

export function TopicsBoard({ mode = 'plan' }) {
  const { d, act, contribute, me, isFac, t, nameOf } = useMeeting()
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)
  const used = votesUsed(d, me)
  const left = d.settings.votes - used
  const open = useMemo(() => d.topics.filter(x => x.status === 'open').sort((a, b) => voteCount(b) - voteCount(a) || a.at - b.at), [d.topics])
  const closed = d.topics.filter(x => x.status !== 'open')
  const run = d.run
  const current = run.topic && d.topics.find(x => x.id === run.topic.id)
  const queue = mode === 'run' ? open.filter(x => x.id !== current?.id) : open
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    contribute({ type: 'ADD', coll: 'topics', text })
    setText('')
  }
  const remove = (x, i) => { act({ type: 'REMOVE', coll: 'topics', eid: x.id }); showToast(t.removed, () => act({ type: 'RESTORE', coll: 'topics', entry: x, index: i })) }
  return (
    <section className={`tool-card mt-card mt-topics ${mode}`} aria-label={t.topics}>
      <div className="mt-card-head">
        <h2><Icon name="coffee" size={18} /> {mode === 'run' ? t.acts.leancoffee : t.topics}</h2>
        <span className="mt-dots">
          <span aria-hidden="true">{Array.from({ length: d.settings.votes }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>
          {t.dotsLeft(left)}
        </span>
      </div>
      <p className="muted small">{mode === 'run' ? t.lcHint : t.topicsHint(d.settings.votes)}</p>
      {mode === 'run' && current && <Discussing x={current} />}
      <form className="mt-inline-form" onSubmit={add}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={t.topicPh} aria-label={t.topicPh} maxLength={200} />
        <button className="btn ghost sm" disabled={!text.trim()}>{t.suggest}</button>
      </form>
      {queue.length ? (
        <ul className="mt-topic-list">
          {queue.map(x => {
            const mine = x.votes[me] ?? 0
            const n = voteCount(x)
            const canRemove = x.by === me || isFac
            return (
              <li key={x.id} className="mt-topic">
                <div className="mt-vote-box">
                  <button className={`mt-vote ${mine ? 'mine' : ''}`} onClick={e => { if (left > 0) { sparkle(e.currentTarget); contribute({ type: 'VOTE', tid: x.id, delta: 1 }) } }} disabled={left <= 0 && !mine} aria-label={`${t.vote}: ${x.text}`} title={t.vote}>
                    <Icon name="dot" size={12} /><b>{n}</b>
                  </button>
                  {mine > 0 && <button className="mt-unvote" onClick={() => act({ type: 'VOTE', tid: x.id, delta: -1 })} aria-label={`${t.unvote}: ${x.text}`} title={t.unvote}>−{mine}</button>}
                </div>
                <div className="mt-topic-main">
                  <span className="mt-topic-text">{x.text}</span>
                  <span className="muted small">{nameOf(x.by)}{x.carried ? ` · ${t.carriedTag}` : ''}</span>
                </div>
                <div className="mt-topic-actions">
                  {mode === 'run' && isFac && <button className="btn ghost sm" onClick={() => act({ type: 'LC_START', tid: x.id })}><Icon name="play" size={13} /> {t.discuss}</button>}
                  {mode === 'plan' && <button className="btn ghost sm" onClick={() => act({ type: 'PROMOTE_TOPIC', tid: x.id })}><Icon name="plus" size={13} /> {t.toAgenda}</button>}
                  {canRemove && <button className="icon-btn sm" onClick={() => remove(x, d.topics.indexOf(x))} aria-label={`${t.remove}: ${x.text}`} title={t.remove}><Icon name="x" size={13} /></button>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="muted small mt-empty-line">{mode === 'run' && d.topics.length ? t.noOpenTopics : t.noTopics}</p>}
      {closed.length > 0 && (
        <>
          <button className="mt-disclose small" aria-expanded={showDone} onClick={() => setShowDone(s => !s)}><Icon name={showDone ? 'down' : 'right'} size={12} /> {t.inAgenda} / {t.discussed} <span className="mt-count">{closed.length}</span></button>
          {showDone && <ul className="mt-plain-list">{closed.map(x => <li key={x.id}><Icon name={x.status === 'agenda' ? 'agenda' : 'check'} size={14} /> {x.text} <span className="muted small">· {x.status === 'agenda' ? t.inAgenda : t.discussed}</span></li>)}</ul>}
        </>
      )}
    </section>
  )
}

function Discussing({ x }) {
  const { d, act, isFac, t } = useMeeting()
  const now = useNow(d.run.status === 'running', 500)
  const left = topicLeft(d.run, now)
  const over = left != null && left <= 0
  return (
    <div className={`mt-discussing ${over ? 'over' : ''}`}>
      <span className="mt-eyebrow">{t.discussing}</span>
      <b>{x.text}</b>
      <span className="mt-discussing-clock" aria-live="off">{fmtClock(left ?? 0)}</span>
      {isFac && (
        <span className="mt-discussing-ctl">
          <button className="btn ghost sm" onClick={() => act({ type: 'LC_ADD_TIME', minutes: 2 })}>{t.plus.replace('{n}', 2)}</button>
          <button className="btn ghost sm" onClick={() => act({ type: 'LC_DONE' })}><Icon name="check" size={13} /> {t.doneTopic}</button>
        </span>
      )}
    </div>
  )
}

// ---------- check-in round ----------

// Check-in options carry a visible word as well as the emoji (and the word is what screen readers hear).
export function checkinLabel(q, value, t) {
  if (q?.kind === 'scale') return `${value} · ${t.scaleL[value - 1] ?? ''}`
  if (q?.kind === 'weather') return t.weatherL[value] ?? String(value)
  if (q?.kind === 'esvp') return t.esvpL[value] ?? String(value)
  if (q?.kind === 'choice') return q.options[value] ?? String(value)
  return String(value)
}
export const checkinEmoji = (q, value) => optionsOf(q)?.find(o => o.value === value)?.emoji ?? ''
// Questions about "this sprint" or "this retro" only appear when chosen on purpose.
const GENERIC = q => !/sprint|retro|迭代|复盘/i.test(q.text)

export function CheckinPanel({ item }) {
  const { d, act, contribute, me, isFac, t, lang, person, nameOf } = useMeeting()
  const round = d.checkins[item.id]
  const qid = checkinQid(d, item)
  const q = questionOf(qid, lang) ?? questionOf('checkin:0', lang)
  const opts = optionsOf(q)
  const answers = round?.answers ?? {}
  const mine = answers[me]
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const answer = v => { contribute({ type: 'CHECKIN_ANSWER', itemId: item.id, qid, value: v }); setEditing(false) }
  const draw = () => {
    let next = qid
    for (let i = 0; i < 20 && (next === qid || !GENERIC(questionOf(next, 'en'))); i++) next = drawQuestion(CHECKIN_CATS, [qid])
    act({ type: 'CHECKIN_DRAW', itemId: item.id, qid: next })
  }
  const label = v => `${checkinEmoji(q, v)} ${checkinLabel(q, v, t)}`.trim()
  return (
    <div className="mt-activity mt-checkin">
      <div className="mt-q">
        <span className="mt-eyebrow">{t.checkin}</span>
        <p className="mt-q-text">{q.text}</p>
        {isFac && <button className="btn ghost sm" onClick={draw}><Icon name="sparkle" size={13} /> {t.anotherQ}</button>}
      </div>
      {mine == null || editing ? (
        opts ? (
          <div className="mt-opts" role="group" aria-label={t.yourAnswer}>
            {opts.map(o => <button key={o.value} className={`mt-opt ${o.emoji ? 'labelled' : ''} ${mine === o.value ? 'sel' : ''}`} aria-pressed={mine === o.value} aria-label={checkinLabel(q, o.value, t)} onClick={() => answer(o.value)}>{o.emoji && <span aria-hidden="true">{o.emoji}</span>}<span>{checkinLabel(q, o.value, t)}</span></button>)}
          </div>
        ) : (
          <form className="mt-inline-form" onSubmit={e => { e.preventDefault(); if (text.trim()) answer(text.trim()) }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={t.answerPh} aria-label={t.yourAnswer} maxLength={280} />
            <button className="btn ghost sm" disabled={!text.trim()}>{t.answer}</button>
          </form>
        )
      ) : <p className="small mt-mine">{t.yourAnswer}{t.colon}<b>{label(mine)}</b> <button className="link-btn small" onClick={() => { setText(typeof mine === 'string' ? mine : ''); setEditing(true) }}>{t.changeAnswer}</button></p>}
      <p className="muted small">{t.answered(Object.keys(answers).length)}</p>
      <ul className="mt-answers">
        {Object.entries(answers).map(([pid, v]) => (
          <li key={pid}><Person p={person(pid)} size={22} guest={t.guest} /><span><b>{nameOf(pid)}</b> {label(v)}</span></li>
        ))}
      </ul>
    </div>
  )
}


// ---------- quick poll / fist of five ----------

export function pollOptions(p, t) {
  if (p.kind === 'fist') return t.fist.map((label, value) => ({ value, label }))
  if (p.kind === 'yesno') return t.yesno.map((label, value) => ({ value, label }))
  return p.options.map((label, value) => ({ value, label }))
}

export function PollPanel({ item }) {
  const { d, act, contribute, me, isFac, t } = useMeeting()
  const p = d.polls[item.id] ?? { kind: 'fist', question: '', options: [], votes: {}, revealed: false }
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState(p.kind)
  const [question, setQuestion] = useState(p.question)
  const [opts, setOpts] = useState(p.options.join('\n'))
  const options = pollOptions(p, t)
  const votes = Object.values(p.votes)
  const mine = p.votes[me]
  const q = p.question || t.pollDefault[p.kind]
  const save = e => {
    e.preventDefault()
    act({ type: 'POLL_SET', itemId: item.id, kind, question, options: opts.split('\n') })
    setEditing(false)
  }
  return (
    <div className="mt-activity mt-poll">
      <div className="mt-q">
        <span className="mt-eyebrow">{t.pollKinds[p.kind]}</span>
        <p className="mt-q-text">{q}</p>
        {isFac && !editing && <button className="btn ghost sm" onClick={() => { setKind(p.kind); setQuestion(p.question); setOpts(p.options.join('\n')); setEditing(true) }}><Icon name="edit" size={13} /> {t.edit}</button>}
      </div>
      {editing && (
        <form className="mt-poll-edit" onSubmit={save}>
          <div className="seg small-seg" role="group" aria-label={t.type}>
            {['fist', 'yesno', 'options'].map(k => <button type="button" key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{t.pollKinds[k]}</button>)}
          </div>
          <label className="field-label" htmlFor={`pq-${item.id}`}>{t.pollQ}</label>
          <input id={`pq-${item.id}`} value={question} onChange={e => setQuestion(e.target.value)} placeholder={t.pollDefault[kind]} maxLength={200} />
          {kind === 'options' && <textarea rows={3} value={opts} onChange={e => setOpts(e.target.value)} placeholder={t.optionsPh} aria-label={t.optionsPh} />}
          <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>{t.cancel}</button><button className="btn primary sm" disabled={kind === 'options' && opts.split('\n').filter(s => s.trim()).length < 2}>{t.setPoll}</button></div>
        </form>
      )}
      <div className={`mt-opts ${p.kind === 'fist' ? 'fist' : ''}`} role="group" aria-label={t.yourVote}>
        {options.map(o => <button key={o.value} className={`mt-opt ${mine === o.value ? 'sel' : ''}`} aria-pressed={mine === o.value} onClick={() => contribute({ type: 'POLL_VOTE', itemId: item.id, value: mine === o.value ? null : o.value })}>{o.label}</button>)}
      </div>
      <div className="mt-poll-foot">
        <span className="muted small">{t.votedN(votes.length)}</span>
        {isFac && <button className="btn ghost sm" onClick={() => act({ type: 'POLL_REVEAL', itemId: item.id, revealed: !p.revealed })}><Icon name={p.revealed ? 'eyeOff' : 'eye'} size={13} /> {p.revealed ? t.hide : t.reveal}</button>}
        {isFac && votes.length > 0 && <button className="btn ghost sm" onClick={() => act({ type: 'POLL_SET', itemId: item.id, kind: p.kind, question: p.question, options: p.options })}>{t.resetPoll}</button>}
      </div>
      {p.revealed ? <PollResult p={p} t={t} /> : <p className="muted small">{t.hidden}</p>}
    </div>
  )
}

export function PollResult({ p, t }) {
  const options = pollOptions(p, t)
  const votes = Object.values(p.votes)
  const max = Math.max(1, ...options.map(o => votes.filter(v => v === o.value).length))
  const avg = votes.length ? (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1) : null
  return (
    <div className="mt-poll-result">
      {options.map(o => {
        const n = votes.filter(v => v === o.value).length
        return (
          <div key={o.value} className="mt-bar-row">
            <span className="mt-bar-label">{o.label}</span>
            <span className="mt-bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className="mt-bar-n">{n}</span>
          </div>
        )
      })}
      {p.kind === 'fist' && avg && <p className="mt-avg">{t.average}{t.colon}<b>{avg}</b> / 5</p>}
    </div>
  )
}

// ---------- parking lot ----------

export function ParkingPanel({ big }) {
  const { d, act, contribute, me, isFac, t, nameOf } = useMeeting()
  const [text, setText] = useState('')
  const cur = d.items[d.run.index]
  const live = d.run.status === 'running' || d.run.status === 'paused'
  const open = d.parking.filter(x => !x.resolved && !x.movedTo)
  const resolved = d.parking.filter(x => x.resolved)
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    contribute({ type: 'ADD', coll: 'parking', text, itemId: live ? cur?.id : null })
    setText('')
  }
  const toAction = x => {
    contribute({ type: 'ADD', coll: 'actions', text: x.text, itemId: live ? cur?.id : null })
    act({ type: 'EDIT', coll: 'parking', eid: x.id, patch: { resolved: true } })
  }
  return (
    <section className={`tool-card mt-card mt-parking ${big ? 'big' : ''}`} aria-label={t.parking}>
      <div className="mt-card-head"><h2><Icon name="parking" size={18} /> {t.parking}</h2>{open.length > 0 && <span className="mt-count">{open.length}</span>}</div>
      <p className="muted small">{t.parkingHint}</p>
      <form className="mt-inline-form" onSubmit={add}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={t.parkPh} aria-label={t.parkPh} maxLength={500} />
        <button className="btn ghost sm" disabled={!text.trim()}>{t.park}</button>
      </form>
      {open.length ? (
        <ul className="mt-entries">
          {open.map(x => (
            <li key={x.id} className="mt-entry">
              <span className="mt-entry-text">{x.text}<span className="muted small"> · {nameOf(x.by)}{x.carried ? ` · ${t.carriedTag}` : ''}</span></span>
              <span className="mt-entry-tools">
                <button className="icon-btn sm" onClick={() => toAction(x)} aria-label={`${t.toAction}: ${x.text}`} title={t.toAction}><Icon name="action" size={14} /></button>
                <button className="icon-btn sm" onClick={() => act({ type: 'EDIT', coll: 'parking', eid: x.id, patch: { resolved: true } })} aria-label={`${t.resolve}: ${x.text}`} title={t.resolve}><Icon name="check" size={14} /></button>
                {(x.by === me || isFac) && <button className="icon-btn sm" onClick={() => { const i = d.parking.indexOf(x); act({ type: 'REMOVE', coll: 'parking', eid: x.id }); showToast(t.removed, () => act({ type: 'RESTORE', coll: 'parking', entry: x, index: i })) }} aria-label={`${t.remove}: ${x.text}`} title={t.remove}><Icon name="trash" size={14} /></button>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="muted small mt-empty-line">{t.noParking}</p>}
      {resolved.length > 0 && (
        <ul className="mt-plain-list mt-resolved">
          {resolved.map(x => <li key={x.id}><Icon name="check" size={13} /> <s>{x.text}</s> <button className="link-btn small" onClick={() => act({ type: 'EDIT', coll: 'parking', eid: x.id, patch: { resolved: false } })}>{t.reopen}</button></li>)}
        </ul>
      )}
    </section>
  )
}

// ---------- action items ----------

export function ActionList({ list, compact, empty }) {
  const { d, act, t, lang } = useMeeting()
  const today = todayStr()
  if (!list.length) return empty ? <p className="muted small mt-empty-line">{empty}</p> : null
  return (
    <ul className="mt-actions">
      {list.map(a => {
        const ds = a.done ? null : dueState(a.due, today)
        if (a.movedTo) {
          return (
            <li key={a.id} className="mt-action moved">
              <span className="mt-check moved" aria-hidden="true"><Icon name="arrowRight" size={13} /></span>
              <span className="mt-action-main">
                <span className="mt-action-text">{a.text}</span>
                <span className="mt-action-meta"><span>{a.owner || t.noOwner}</span><span>{t.movedTo}</span><a href={`#/m/${a.movedTo}/plan`}>{t.openThere} →</a></span>
              </span>
            </li>
          )
        }
        return (
          <li key={a.id} className={`mt-action ${a.done ? 'done' : ''}`}>
            <button className={`mt-check ${a.done ? 'on' : ''}`} onClick={() => act({ type: 'EDIT', coll: 'actions', eid: a.id, patch: { done: !a.done } })} aria-pressed={a.done} aria-label={`${a.done ? t.markOpen : t.markDone}: ${a.text}`}>
              {a.done && <Icon name="check" size={14} />}
            </button>
            <span className="mt-action-main">
              {compact ? <span className="mt-action-text">{a.text}</span> : (
                <DraftInput className="mt-action-edit" value={a.text} onSave={v => v.trim() && act({ type: 'EDIT', coll: 'actions', eid: a.id, patch: { text: v } })} aria-label={t.kinds.actions} maxLength={500} />
              )}
              <span className="mt-action-meta">
                {compact ? <span>{a.owner || t.noOwner}</span> : (
                  <DraftInput className="mt-mini-input" value={a.owner} list="mt-people" onSave={v => act({ type: 'EDIT', coll: 'actions', eid: a.id, patch: { owner: v } })} aria-label={t.owner} placeholder={t.owner} maxLength={60} />
                )}
                {compact ? (a.due && <span className={`mt-due ${ds ?? ''}`}>{fmtDate(a.due, lang)}</span>) : (
                  <DueField a={a} ds={ds} />
                )}
                {ds === 'overdue' && <span className="mt-due overdue">{t.overdue}</span>}
                {a.carried && <span className="mt-tag">{t.carriedTag}</span>}
              </span>
            </span>
            {!compact && <button className="icon-btn sm" onClick={() => { const i = d.actions.indexOf(a); act({ type: 'REMOVE', coll: 'actions', eid: a.id }); showToast(t.removed, () => act({ type: 'RESTORE', coll: 'actions', entry: a, index: i })) }} aria-label={`${t.remove}: ${a.text}`} title={t.remove}><Icon name="trash" size={14} /></button>}
          </li>
        )
      })}
    </ul>
  )
}

function DueField({ a, ds }) {
  const { act, t } = useMeeting()
  const [open, setOpen] = useState(false)
  if (!a.due && !open) return <button className="link-btn small mt-due-add" onClick={() => setOpen(true)}>+ {t.addDue}</button>
  return <input type="date" autoFocus={open && !a.due} className={`mt-mini-input mt-due-input ${ds ?? ''}`} value={a.due} onBlur={() => setOpen(false)} onChange={e => act({ type: 'EDIT', coll: 'actions', eid: a.id, patch: { due: e.target.value } })} aria-label={t.due} />
}

export function ActionsReview() {
  const { d, t } = useMeeting()
  const list = [...d.actions].sort((a, b) => (b.carried ? 1 : 0) - (a.carried ? 1 : 0) || (a.done ? 1 : 0) - (b.done ? 1 : 0))
  return (
    <div className="mt-activity">
      <p className="muted small">{t.reviewHint}</p>
      <ActionList list={list} empty={t.noActionsReview} />
    </div>
  )
}
