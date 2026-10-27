import { useState } from 'react'
import { Icon, Menu, DraftInput, showToast, itemIcon, unlockAudio, downloadFile } from './common.jsx'
import { useMeeting, Invite, shareUrl } from './Meeting.jsx'
import { QR } from '../core/qr.jsx'
import { rememberedTeams, registerInTeam, unregisterFromTeam } from './store.js'
import { navigate } from '../core/ui.jsx'
import { CADENCES, ACTIVITIES, plannedMinutes, clockAt, MAX_ITEMS, meetingIcs } from './model.js'
import { MEETING_TEMPLATES, templateItems } from './templates.js'
import { QUESTIONS } from '../icebreakers/questions.js'
import { questionOf } from '../icebreakers/model.js'
import { TopicsBoard, ActionList } from './Activities.jsx'

export const typeValue = x => (x.type === 'activity' && x.activity ? `activity:${x.activity}` : x.type)
const parseType = v => (v.startsWith('activity:') ? { type: 'activity', activity: v.slice(9) } : { type: v, activity: null })

export function TypeSelect({ value, onChange, id, t }) {
  return (
    <select id={id} className="mt-type-select" value={value} onChange={e => onChange(parseType(e.target.value))} aria-label={t.type}>
      {['discussion', 'decision', 'update', 'break'].map(k => <option key={k} value={k}>{t.types[k]}</option>)}
      <optgroup label={t.types.activity}>
        {ACTIVITIES.map(k => <option key={k} value={`activity:${k}`}>{t.acts[k]}</option>)}
      </optgroup>
    </select>
  )
}

export function Plan() {
  const { d, act, gate, isFac, t } = useMeeting()
  const live = d.run.status === 'running' || d.run.status === 'paused'
  const start = () => {
    unlockAudio()
    gate(() => {
      if (!live) act({ type: 'START', index: 0 })
      navigate(`/m/${d.id}/run`)
    })
  }
  const carriedActions = d.actions.filter(a => a.carried)
  const carriedParking = d.parking.filter(a => a.carried && !a.resolved)
  return (
    <div className="mt-plan">
      <div className="mt-col">
        <Details />
        <Agenda />
      </div>
      <aside className="mt-col">
        <section className="tool-card mt-card mt-start">
          <div className="mt-start-sum">
            <b>{t.minutes(plannedMinutes(d))}</b>
            <span className="muted">{t.items(d.items.length)}{d.time && d.items.length ? ` · ${d.time}–${clockAt(d.time, plannedMinutes(d))}` : ''}</span>
          </div>
          {d.series?.nextId && d.run.status !== 'done' ? (
            <p className="tool-note small">{t.closedNext} <a href={`#/m/${d.series.nextId}/plan`}>{t.openNext} →</a></p>
          ) : live ? (
            <a className="btn primary lg mt-block-btn" href={`#/m/${d.id}/run`}><Icon name="play" /> {t.resumeMeeting}</a>
          ) : isFac ? (
            <button className="btn primary lg mt-block-btn" onClick={start} disabled={!d.items.length || d.run.status === 'done'}><Icon name="play" /> {t.startMeeting}</button>
          ) : <p className="muted small">{t.onlyFac}</p>}
          <p className="muted small">{t.startHint}</p>
          <CalendarButton />
          <div className="mt-start-invite">
            <QR text={shareUrl(d.id)} size={84} />
            <div><p className="small">{t.inviteHint}</p><Invite /></div>
          </div>
        </section>
        <TopicsBoard mode="plan" />
        {(carriedActions.length > 0 || carriedParking.length > 0) && (
          <section className="tool-card mt-card">
            <div className="mt-card-head"><h2>{t.carried}</h2></div>
            <p className="muted small">{t.carriedHint}</p>
            {carriedActions.length > 0 && <ActionList list={carriedActions} compact />}
            {carriedParking.length > 0 && <ul className="mt-plain-list">{carriedParking.map(p => <li key={p.id}><Icon name="parking" size={14} /> {p.text}</li>)}</ul>}
          </section>
        )}
        <SeriesLinks />
      </aside>
    </div>
  )
}

export function CalendarButton({ asMenu }) {
  const { d, t } = useMeeting()
  const save = () => {
    const ics = meetingIcs(d, { url: shareUrl(d.id), t, now: Date.now() })
    if (!ics) { showToast(t.calNeedsDate); return }
    downloadFile(`${(d.title || 'meeting').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'meeting'}.ics`, ics, 'text/calendar')
    showToast(t.calDone)
  }
  if (asMenu) return <button className="menu-item" role="menuitem" data-close onClick={save}><Icon name="calendar" /> {t.addToCalendar}</button>
  return <button className="btn ghost sm mt-cal-btn" onClick={save}><Icon name="calendar" size={14} /> {t.addToCalendar}</button>
}

export function SeriesLinks({ prevOnly }) {
  const { d, t } = useMeeting()
  if (!d.series?.prevId && (prevOnly || !d.series?.nextId)) return null
  return (
    <nav className="mt-series no-print" aria-label={t.repeats}>
      {d.series.prevId && <a href={`#/m/${d.series.prevId}/summary`}><Icon name="left" size={14} /> {t.prevMeeting}</a>}
      {!prevOnly && d.series.nextId && <a href={`#/m/${d.series.nextId}/plan`}>{t.nextMeeting} <Icon name="right" size={14} /></a>}
    </nav>
  )
}

function Details() {
  const { d, act, t } = useMeeting()
  const [name, setName] = useState('')
  const add = e => {
    e.preventDefault()
    const names = name.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean)
    if (names.length) act({ type: 'ATTENDEE_ADD', names })
    setName('')
  }
  return (
    <section className="tool-card mt-card">
      <div className="mt-card-head"><h2>{t.details}</h2></div>
      <div className="mt-fields3">
        <div><label className="field-label" htmlFor="pl-date">{t.date}</label><input id="pl-date" type="date" value={d.date} onChange={e => act({ type: 'SET', patch: { date: e.target.value } })} /></div>
        <div><label className="field-label" htmlFor="pl-time">{t.time}</label><input id="pl-time" type="time" value={d.time} onChange={e => act({ type: 'SET', patch: { time: e.target.value } })} /></div>
        <div><label className="field-label" htmlFor="pl-cad">{t.repeats}</label>
          <select id="pl-cad" value={d.cadence} onChange={e => act({ type: 'SET', patch: { cadence: e.target.value } })}>
            {CADENCES.map(c => <option key={c} value={c}>{t.cadence[c]}</option>)}
          </select>
        </div>
      </div>
      <TeamSelect />
      <label className="field-label" htmlFor="pl-goal">{t.goal}</label>
      <DraftInput id="pl-goal" multiline rows={2} value={d.goal} onSave={v => act({ type: 'SET', patch: { goal: v } })} placeholder={t.goalPh} maxLength={600} />
      <span className="field-label" id="pl-att">{t.attendees}</span>
      <div className="mt-attendees" aria-labelledby="pl-att">
        {d.attendees.map(n => (
          <span key={n} className="mt-attendee">{n}<button className="mt-attendee-x" aria-label={`${t.remove}: ${n}`} onClick={() => { act({ type: 'ATTENDEE_REMOVE', name: n }); showToast(t.removed, () => act({ type: 'ATTENDEE_ADD', names: [n] })) }}><Icon name="x" size={12} /></button></span>
        ))}
        <form onSubmit={add} className="mt-attendee-add">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t.addAttendeePh} aria-label={t.addAttendee} maxLength={300} />
          <button className="btn ghost sm" disabled={!name.trim()}><Icon name="plus" size={14} /> {t.add}</button>
        </form>
      </div>
      <p className="muted small mt-hint">{t.attendeesHint}</p>
    </section>
  )
}

function TeamSelect() {
  const { d, act, me, t } = useMeeting()
  const teams = rememberedTeams().map(x => ({ id: x.id, name: x.name }))
  if (d.teamId && !teams.some(x => x.id === d.teamId)) teams.unshift({ id: d.teamId, name: d.teamName || t.team })
  if (!teams.length) return null
  const change = e => {
    const id = e.target.value || null
    const team = teams.find(x => x.id === id)
    if (d.teamId && d.teamId !== id) unregisterFromTeam(d.teamId, d.id, me).catch(() => {})
    act({ type: 'SET_TEAM', teamId: id, teamName: team?.name ?? '' })
    if (id) registerInTeam(id, d, me, true).catch(() => {})
  }
  return (
    <>
      <label className="field-label" htmlFor="pl-team">{t.linkTeam}</label>
      <select id="pl-team" value={d.teamId ?? ''} onChange={change}>
        <option value="">{t.noTeam}</option>
        {teams.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <p className="muted small mt-hint">{t.teamHint}</p>
    </>
  )
}

function Agenda() {
  const { d, act, t, lang } = useMeeting()
  const total = plannedMinutes(d)
  const live = d.run.status === 'running' || d.run.status === 'paused'
  let offset = 0
  const appendTemplate = id => {
    const items = templateItems(MEETING_TEMPLATES.find(x => x.id === id), lang)
    items.slice(0, MAX_ITEMS - d.items.length).forEach(item => act({ type: 'ADD_ITEM', item }))
  }
  return (
    <section className="tool-card mt-card mt-agenda">
      <div className="mt-card-head">
        <h2>{t.agenda}</h2>
        <span className="mt-total mt-grow-left"><Icon name="timer" size={14} /> {t.total}{t.colon}{t.minutes(total)}{d.time && total ? ` · ${fill2(t.endsAt, clockAt(d.time, total))}` : ''}</span>
        <Menu label={t.useTemplate} icon="agenda" btnClass="btn ghost sm" className="mt-tpl-menu">
          <div className="menu-title">{t.templateAppend}</div>
          {MEETING_TEMPLATES.map(x => <button key={x.id} className="menu-item" role="menuitem" data-close onClick={() => appendTemplate(x.id)}><Icon name="agenda" /> {x[lang][0]}</button>)}
        </Menu>
      </div>
      {!d.items.length && <p className="tool-note small">{t.emptyAgenda}</p>}
      <ol className="mt-items">
        {d.items.map((x, i) => {
          const from = offset
          offset += x.minutes
          return <ItemRow key={x.id} x={x} i={i} from={from} isNow={live && d.run.index === i} done={(live && i < d.run.index) || d.run.status === 'done'} />
        })}
      </ol>
      {d.items.length < MAX_ITEMS && <AddItem />}
    </section>
  )
}

const fill2 = (s, v) => s.replace('{t}', v)

function ItemRow({ x, i, from, isNow, done }) {
  const { d, act, t, nameOf, isFac } = useMeeting()
  // While the meeting runs, only the facilitator reshapes the live part of the agenda.
  const live = d.run.status === 'running' || d.run.status === 'paused'
  const locked = live && !isFac
  const lockMin = locked && i === d.run.index
  const lockRemove = locked && i <= d.run.index
  const [more, setMore] = useState(!!x.notes || !!x.owner)
  const remove = () => {
    act({ type: 'REMOVE_ITEM', iid: x.id })
    showToast(t.itemRemoved, () => act({ type: 'RESTORE_ITEM', item: x, index: i }))
  }
  const when = d.time ? clockAt(d.time, from) : `+${from}′`
  return (
    <li className={`mt-item ${isNow ? 'now' : ''} ${done ? 'done' : ''}`}>
      <div className="mt-item-num"><b>{i + 1}</b><span>{when}</span></div>
      <div className="mt-item-main">
        <div className="mt-item-row1">
          <span className="mt-item-ico" aria-hidden="true"><Icon name={itemIcon(x)} size={16} /></span>
          <DraftInput className="mt-item-title" value={x.title} onSave={v => v.trim() && act({ type: 'UPDATE_ITEM', iid: x.id, patch: { title: v } })} aria-label={t.itemTitle} maxLength={160} placeholder={t.itemTitlePh} />
        </div>
        <div className="mt-item-row2">
          <TypeSelect value={typeValue(x)} onChange={p => act({ type: 'UPDATE_ITEM', iid: x.id, patch: p })} t={t} />
          {x.from && <span className="mt-tag">{t.addedBy.replace('{name}', nameOf(x.by))}</span>}
          {!more && <button className="link-btn small mt-add-notes" onClick={() => setMore(true)}>+ {t.owner} / {t.itemNotes}</button>}
        </div>
        {more && (
          <div className="mt-item-more">
            <DraftInput className="mt-item-owner" value={x.owner} list="mt-people" onSave={v => act({ type: 'UPDATE_ITEM', iid: x.id, patch: { owner: v } })} aria-label={t.owner} placeholder={t.ownerPh} maxLength={60} />
            <DraftInput className="mt-item-notes" multiline rows={1} value={x.notes} onSave={v => act({ type: 'UPDATE_ITEM', iid: x.id, patch: { notes: v } })} aria-label={t.itemNotes} placeholder={t.itemNotesPh} maxLength={1500} />
          </div>
        )}
        {x.type === 'activity' && x.activity && <p className="muted small mt-act-hint">{t.actsHint[x.activity]}</p>}
        {x.activity === 'checkin' && <CheckinQuestion x={x} />}
      </div>
      <div className="mt-item-side">
        <Minutes value={x.minutes} disabled={lockMin} onChange={m => act({ type: 'UPDATE_ITEM', iid: x.id, patch: { minutes: m } })} t={t} />
        <div className="mt-item-tools">
          <button className="icon-btn sm" onClick={() => act({ type: 'MOVE_ITEM', iid: x.id, dir: -1 })} disabled={i === 0 || locked} aria-label={t.moveUp} title={t.moveUp}><Icon name="up" size={15} /></button>
          <button className="icon-btn sm" onClick={() => act({ type: 'MOVE_ITEM', iid: x.id, dir: 1 })} disabled={i === d.items.length - 1 || locked} aria-label={t.moveDown} title={t.moveDown}><Icon name="down" size={15} /></button>
          <button className="icon-btn sm" onClick={remove} disabled={lockRemove} aria-label={t.removeItem} title={t.removeItem}><Icon name="trash" size={15} /></button>
        </div>
      </div>
    </li>
  )
}

export function Minutes({ value, onChange, t, disabled }) {
  const [v, setV] = useState(null)
  return (
    <div className="mt-min" role="group" aria-label={t.min}>
      <button className="icon-btn sm" onClick={() => onChange(Math.max(1, value - (value > 10 ? 5 : 1)))} disabled={value <= 1 || disabled} aria-label={`− ${t.min}`}>−</button>
      <input type="number" min="1" max="480" inputMode="numeric" value={v ?? value} aria-label={t.min} disabled={disabled}
        onChange={e => setV(e.target.value)} onBlur={() => { if (v != null && Number(v) >= 1 && Number(v) !== value) onChange(Number(v)); setV(null) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      <button className="icon-btn sm" onClick={() => onChange(value + (value >= 10 ? 5 : 1))} disabled={disabled} aria-label={`+ ${t.min}`}>+</button>
      <span className="muted small">{t.min}</span>
    </div>
  )
}

// The facilitator picks the check-in question ahead of time (sprint questions only suit sprint meetings).
export const CHECKIN_CATS = ['checkin', 'quick', 'work', 'remote', 'know']
export const checkinQid = (d, item) => d.checkins[item.id]?.qid || item.qid || 'checkin:0'
function CheckinQuestion({ x }) {
  const { d, act, t, lang } = useMeeting()
  const qid = checkinQid(d, x)
  const id = `cq-${x.id}`
  return (
    <div className="mt-checkin-q">
      <label className="field-label mt-cq-label" htmlFor={id}>{t.chooseQ}</label>
      <select id={id} value={qid} onChange={e => { act({ type: 'UPDATE_ITEM', iid: x.id, patch: { qid: e.target.value } }); act({ type: 'CHECKIN_DRAW', itemId: x.id, qid: e.target.value }) }}>
        {CHECKIN_CATS.map(c => (
          <optgroup key={c} label={t.qCats[c]}>
            {QUESTIONS[c].map((_, n) => { const q = questionOf(`${c}:${n}`, lang); return q && <option key={n} value={`${c}:${n}`}>{q.text}</option> })}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function AddItem() {
  const { act, t } = useMeeting()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [kind, setKind] = useState({ type: 'discussion', activity: null })
  const add = e => {
    e.preventDefault()
    const name = title.trim() || (kind.activity ? t.acts[kind.activity] : '')
    if (!name) return
    act({ type: 'ADD_ITEM', item: { title: name, minutes, ...kind } })
    setTitle('')
  }
  const addActivity = k => act({ type: 'ADD_ITEM', item: { title: t.acts[k], minutes: k === 'leancoffee' ? 15 : 5, type: 'activity', activity: k } })
  return (
    <form className="mt-add-item" onSubmit={add}>
      <input className="grow" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.itemTitlePh} aria-label={t.itemTitle} maxLength={160} />
      <TypeSelect value={kind.activity ? `activity:${kind.activity}` : kind.type} onChange={setKind} t={t} />
      <label className="mt-add-min"><input type="number" min="1" max="480" value={minutes} onChange={e => setMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))} aria-label={t.min} /> {t.min}</label>
      <button className="btn ghost" disabled={!title.trim() && !kind.activity}><Icon name="plus" /> {t.addItem}</button>
      <Menu label={t.addActivity} icon="sparkle" btnClass="btn ghost mt-act-btn" className="mt-act-menu">
        {ACTIVITIES.map(k => (
          <button key={k} className="menu-item mt-act-opt" role="menuitem" data-close onClick={() => addActivity(k)}>
            <Icon name={itemIcon({ type: 'activity', activity: k })} />
            <span><b>{t.acts[k]}</b><span>{t.actsHint[k]}</span></span>
          </button>
        ))}
      </Menu>
    </form>
  )
}
