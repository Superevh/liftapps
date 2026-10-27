import { useEffect, useRef, useState } from 'react'
import { Icon, Person, Menu, useNow, showToast, bell, unlockAudio, money, itemIcon } from './common.jsx'
import { useMeeting } from './Meeting.jsx'
import { remainingMs, spentNow, plannedMinutes, fmtClock, MIN, usedMin } from './model.js'
import { CURRENCIES } from '../meetingcost/model.js'
import { TopicsBoard, CheckinPanel, PollPanel, ParkingPanel, ActionsReview } from './Activities.jsx'
import { navigate } from '../core/ui.jsx'

const isLive = run => run.status === 'running' || run.status === 'paused'

export function Run() {
  const { d } = useMeeting()
  const run = d.run
  return (
    <div className="mt-run">
      <RunBar />
      {run.status === 'idle' && <Waiting />}
      {run.status === 'done' && <Finished />}
      {isLive(run) && (
        <div className="mt-run-grid">
          <Rail />
          <div className="mt-stage">
            <Current />
            <Activity />
            <Capture />
          </div>
          <aside className="mt-run-side">
            <ParkingPanel />
            <People />
          </aside>
        </div>
      )}
    </div>
  )
}

// ---------- top bar: progress, schedule, cost ----------

function RunBar() {
  const { d, t } = useMeeting()
  const run = d.run
  const now = useNow(run.status === 'running', 1000)
  const planned = plannedMinutes(d) * MIN
  const elapsed = run.startedAt ? (run.endedAt ?? now) - run.startedAt : 0
  let behind = null
  if (isLive(run)) {
    const left = Math.max(0, remainingMs(run, now))
    const rest = d.items.slice(run.index + 1).reduce((n, x) => n + x.minutes * MIN, 0)
    behind = Math.round((elapsed + left + rest - planned) / MIN)
  }
  const spent = spentNow(d, now)
  return (
    <div className="mt-runbar">
      <ol className="mt-progress" aria-label={t.agenda}>
        {d.items.map((x, i) => {
          const done = run.status === 'done' || (isLive(run) && i < run.index)
          const cur = isLive(run) && i === run.index
          const fillPct = cur ? Math.min(100, ((spent[x.id] ?? 0) / (x.minutes * MIN)) * 100) : done ? 100 : 0
          return <li key={x.id} style={{ flexGrow: x.minutes }} className={`${cur ? 'cur' : ''} ${done ? 'done' : ''}`} title={`${i + 1}. ${x.title}`}><i style={{ width: `${fillPct}%` }} /></li>
        })}
      </ol>
      <div className="mt-runbar-row">
        <span className="mt-stat"><span>{t.elapsed}</span><b>{fmtClock(elapsed)}</b><em>/ {t.minutes(plannedMinutes(d))}</em></span>
        {behind != null && <span className={`mt-sched ${behind > 1 ? 'behind' : ''}`}>{behind > 1 ? t.behind(behind) : behind < -1 ? t.ahead(-behind) : t.onTrack}</span>}
        <span className="spacer" />
        <Cost elapsed={elapsed} />
        <FullScreen />
      </div>
    </div>
  )
}

function FullScreen() {
  const { t } = useMeeting()
  const [on, setOn] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const h = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  if (!document.documentElement.requestFullscreen) return null
  const toggle = () => (on ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  return <button className="icon-btn" onClick={toggle} aria-label={on ? t.exitPresent : t.presentMode} title={on ? t.exitPresent : t.presentMode}><Icon name="expand" /></button>
}

function Cost({ elapsed }) {
  const { d, act, t, lang } = useMeeting()
  const c = d.cost
  const autoPeople = Math.max(1, Object.keys(d.people).length, d.attendees.length)
  const people = c.people ?? autoPeople
  const perHour = people * c.rate
  const total = (perHour * elapsed) / 3600000
  return (
    <Menu label={t.cost} text={c.on ? money(total, c.currency, lang) : t.cost} icon="coin" btnClass={`btn ghost sm mt-cost-btn ${c.on ? 'on' : ''}`} className="mt-cost-menu">
      <div className="mt-cost-pop">
        <label className="check"><input type="checkbox" checked={c.on} onChange={e => act({ type: 'SET_COST', patch: { on: e.target.checked } })} /> {t.costOn}</label>
        {c.on && <p className="mt-cost-big"><b>{money(total, c.currency, lang)}</b><span className="muted small">{t.costPerHour.replace('{v}', money(perHour, c.currency, lang))}</span></p>}
        <label className="field-label" htmlFor="ct-rate">{t.costRate}</label>
        <div className="mt-cost-row">
          <input id="ct-rate" type="number" min="0" step="5" defaultValue={c.rate} onBlur={e => act({ type: 'SET_COST', patch: { rate: e.target.value } })} />
          <select value={c.currency} onChange={e => act({ type: 'SET_COST', patch: { currency: e.target.value } })} aria-label={t.costCurrency}>
            {Object.keys(CURRENCIES).map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <label className="field-label" htmlFor="ct-people">{t.costPeople}</label>
        <input id="ct-people" type="number" min="1" placeholder={t.costAuto.replace('{n}', autoPeople)} defaultValue={c.people ?? ''} onBlur={e => act({ type: 'SET_COST', patch: { people: e.target.value } })} />
        <p className="menu-hint mt-cost-hint">{t.costHint}</p>
      </div>
    </Menu>
  )
}
// ---------- states before and after ----------

function Waiting() {
  const { d, act, gate, isFac, t } = useMeeting()
  return (
    <div className="mt-run-grid waiting">
      <div className="mt-stage">
        <section className="tool-card mt-card mt-waiting">
          <Icon name="timer" size={30} />
          <h2>{t.notStarted}</h2>
          {isFac ? (
            <button className="btn primary lg" onClick={() => { unlockAudio(); gate(() => act({ type: 'START', index: 0 })) }} disabled={!d.items.length || !!d.series?.nextId}><Icon name="play" /> {t.startMeeting}</button>
          ) : <p className="muted">{t.waitFac}</p>}
          <ol className="mt-waiting-list">{d.items.map(x => <li key={x.id}><Icon name={itemIcon(x)} size={14} /><span>{x.title}</span><em>{t.minutes(x.minutes)}</em></li>)}</ol>
        </section>
      </div>
      <aside className="mt-run-side">
        <TopicsBoard mode="plan" />
        <People />
      </aside>
    </div>
  )
}

function Finished() {
  const { d, act, isFac, t } = useMeeting()
  return (
    <section className="tool-card mt-card mt-finished">
      <Icon name="decision" size={34} />
      <h2>{t.ended}</h2>
      <p className="muted">{t.endedHint(d.decisions.length, d.actions.filter(a => !a.carried).length)}</p>
      <div className="row center wrap">
        <a className="btn primary lg" href={`#/m/${d.id}/summary`}>{t.toSummary} <Icon name="right" /></a>
        {isFac && !d.series?.nextId && <button className="btn ghost" onClick={() => act({ type: 'REOPEN' })}><Icon name="play" /> {t.reopenMeeting}</button>}
      </div>
    </section>
  )
}

// ---------- agenda rail ----------

function Rail() {
  const { d, act, isFac, t } = useMeeting()
  const run = d.run
  const now = useNow(run.status === 'running', 1000)
  const spent = spentNow(d, now)
  return (
    <nav className="mt-rail" aria-label={t.agenda}>
      <h2 className="mt-rail-h">{t.agenda}</h2>
      <ol>
        {d.items.map((x, i) => {
          const cur = i === run.index
          const ms = spent[x.id] ?? 0
          const over = ms > x.minutes * MIN
          const body = (
            <>
              <span className="mt-rail-n">{i < run.index ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className="mt-rail-t">{x.title}</span>
              <span className={`mt-rail-m ${over ? 'over' : ''}`}>{ms && !cur ? `${usedMin(ms)}/${x.minutes}` : x.minutes}′</span>
            </>
          )
          return (
            <li key={x.id} className={`${cur ? 'cur' : ''} ${i < run.index ? 'done' : ''}`} aria-current={cur ? 'step' : undefined}>
              {isFac && !cur ? <button onClick={() => act({ type: 'GOTO', index: i })} title={t.jumpHere}>{body}</button> : <div>{body}</div>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ---------- the current item and its timer ----------

function Current() {
  const { d, act, isFac, confirm, t } = useMeeting()
  const run = d.run
  const now = useNow(run.status === 'running', 250)
  const item = d.items[run.index]
  const next = d.items[run.index + 1]
  const left = remainingMs(run, now)
  const over = left != null && left <= 0
  const warn = !over && left != null && left <= MIN
  const [sound, setSound] = useState(isFac)
  const rung = useRef(null)
  const key = `${run.index}:${run.endsAt}`
  useEffect(() => {
    if (run.status !== 'running' || !over || rung.current === key) return
    rung.current = key
    if (sound && left > -5000) bell()
  }, [over, key, sound, run.status, left])

  useEffect(() => {
    if (!isFac) return
    const onKey = e => {
      // Shortcuts never fire while typing, inside tabs or menus (arrow keys move there), or behind a dialog.
      if (e.target.closest?.('input, textarea, select, [contenteditable], [role=tablist], [role=menu], [role=dialog]') || document.querySelector('.modal-backdrop') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ' && !e.target.closest?.('button, a')) { e.preventDefault(); act({ type: run.status === 'paused' ? 'RESUME' : 'PAUSE' }) }
      else if (e.key === 'ArrowRight') {
        // On the last item the arrow asks before ending, the same as the End button.
        if (run.index >= d.items.length - 1) confirm(t.endConfirm, t.endYes, () => { act({ type: 'END' }); navigate(`/m/${d.id}/summary`) })
        else act({ type: 'NEXT' })
      }
      else if (e.key === 'ArrowLeft') act({ type: 'PREV' })
      else if (e.key === '+' || e.key === '=') act({ type: 'ADD_TIME', minutes: 1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFac, act, run.status, run.index, d.items.length, d.id, confirm, t])

  if (!item) return null
  const pct = Math.min(100, Math.max(0, 100 - (left / (item.minutes * MIN)) * 100))
  const label = run.status === 'paused' ? t.paused : over ? t.timeUp : warn ? t.oneMinute : t.now
  const last = run.index === d.items.length - 1
  return (
    <section className={`mt-current ${run.status} ${over ? 'over' : warn ? 'warn' : ''}`} aria-label={t.now}>
      <div className="mt-current-top">
        <span className="mt-eyebrow">{t.itemOf(run.index + 1, d.items.length)} · {item.type === 'activity' && item.activity ? t.acts[item.activity] : t.types[item.type]}{item.owner ? ` · ${item.owner}` : ''}</span>
        <span className="spacer" />
        {isFac && <button className="btn ghost sm" onClick={() => { unlockAudio(); setSound(s => !s) }} aria-pressed={sound}>{sound ? t.soundOn : t.soundOff}</button>}
      </div>
      <h2 className="mt-current-title">{item.title}</h2>
      <div className="mt-clock-row">
        <span className="mt-clock" role="timer" aria-live="off">{fmtClock(left)}</span>
        <span className={`mt-clock-label ${over ? 'over' : warn ? 'warn' : ''}`}>{over ? `${label} · ${fmtClock(left).slice(1)} ${t.over}` : label}</span>
      </div>
      <div className="mt-clock-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {item.notes && <p className="mt-current-notes">{item.notes}</p>}
      {isFac ? (
        <div className="mt-controls">
          <button className="btn ghost" onClick={() => act({ type: 'PREV' })} disabled={run.index === 0}><Icon name="left" /> <span className="mt-hide-sm">{t.prev}</span></button>
          {run.status === 'paused'
            ? <button className="btn ghost" onClick={() => act({ type: 'RESUME' })}><Icon name="play" /> {t.resume}</button>
            : <button className="btn ghost" onClick={() => act({ type: 'PAUSE' })}><Icon name="pause" /> {t.pause}</button>}
          <button className="btn ghost" onClick={() => act({ type: 'ADD_TIME', minutes: 1 })}>{t.plus.replace('{n}', 1)}</button>
          <button className="btn primary" onClick={() => (last ? endMeeting() : act({ type: 'NEXT' }))}>{last ? t.finish : t.next} <Icon name={last ? 'check' : 'right'} /></button>
        </div>
      ) : <p className="muted small mt-fac-only">{t.facOnly}</p>}
      <div className="mt-upnext">
        {next ? <><span>{t.upNext}</span><b>{next.title}</b><em>{t.minutes(next.minutes)}</em></> : <span>{t.lastItem}</span>}
        {isFac && <span className="spacer" />}
        {isFac && <EndButton />}
      </div>
    </section>
  )
  function endMeeting() { act({ type: 'END' }); navigate(`/m/${d.id}/summary`) }
}

function EndButton() {
  const { d, act, confirm, t } = useMeeting()
  return <button className="link-btn small mt-end" onClick={() => confirm(t.endConfirm, t.endYes, () => { act({ type: 'END' }); navigate(`/m/${d.id}/summary`) })}>{t.endMeeting}</button>
}

function Activity() {
  const { d } = useMeeting()
  const item = d.items[d.run.index]
  if (!item || item.type !== 'activity') return null
  if (item.activity === 'checkin') return <section className="tool-card mt-card"><CheckinPanel item={item} /></section>
  if (item.activity === 'poll') return <section className="tool-card mt-card"><PollPanel item={item} /></section>
  if (item.activity === 'leancoffee') return <TopicsBoard mode="run" />
  if (item.activity === 'actions') return <section className="tool-card mt-card"><ActionsReview /></section>
  if (item.activity === 'parking') return null // the parking lot is always on the side
  return null
}

// ---------- capture notes, decisions and action items ----------

function Capture() {
  const { d, act, contribute, me, isFac, t, nameOf } = useMeeting()
  const item = d.items[d.run.index]
  const [kind, setKind] = useState(item?.type === 'decision' ? 'decisions' : 'notes')
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const input = useRef(null)
  useEffect(() => { setKind(item?.type === 'decision' ? 'decisions' : 'notes') }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null
  const topicId = d.run.topic?.id ?? null
  // Should a closed meeting ever be live, action items are refused by the reducer: say so instead of dropping them.
  const actionsClosed = !!d.series?.nextId
  const add = e => {
    e.preventDefault()
    if (!text.trim() || (kind === 'actions' && actionsClosed)) return
    contribute({ type: 'ADD', coll: kind, text, itemId: item.id, topicId, ...(kind === 'actions' ? { owner, due } : {}) })
    setText(''); setOwner(''); setDue('')
    input.current?.focus()
  }
  const entries = ['decisions', 'actions', 'notes'].flatMap(coll => d[coll].filter(x => x.itemId === item.id).map(x => ({ ...x, coll }))).sort((a, b) => a.at - b.at)
  const remove = x => {
    const i = d[x.coll].findIndex(e => e.id === x.id)
    const { coll, ...entry } = x
    act({ type: 'REMOVE', coll, eid: x.id })
    showToast(t.removed, () => act({ type: 'RESTORE', coll, entry, index: i }))
  }
  const ICON = { notes: 'note', decisions: 'decision', actions: 'action' }
  return (
    <section className="tool-card mt-card mt-capture" aria-label={t.capture}>
      <div className="mt-card-head">
        <h2>{t.capture}</h2>
        <div className="seg small-seg" role="tablist" aria-label={t.capture}>
          {['notes', 'decisions', 'actions'].map(k => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); input.current?.focus() }}><Icon name={ICON[k]} size={14} /> {t.kinds[k]}</button>)}
        </div>
      </div>
      {kind === 'actions' && actionsClosed && <p className="tool-note small">{t.closedNext} <a href={`#/m/${d.series.nextId}/plan`}>{t.openNext} →</a></p>}
      <form className={`mt-capture-form k-${kind}`} onSubmit={add}>
        <input ref={input} value={text} onChange={e => setText(e.target.value)} placeholder={t.ph[kind]} aria-label={t.ph[kind]} maxLength={500} />
        {kind === 'actions' && (
          <div className="mt-capture-extra">
            <input value={owner} onChange={e => setOwner(e.target.value)} list="mt-people" placeholder={t.owner} aria-label={t.owner} maxLength={60} />
            <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label={t.due} />
          </div>
        )}
        <button className="btn ghost" disabled={!text.trim() || (kind === 'actions' && actionsClosed)}><Icon name="plus" /> {t.add}</button>
      </form>
      {entries.length ? (
        <ul className="mt-entries">
          {entries.map(x => (
            <li key={x.id} className={`mt-entry c-${x.coll}`}>
              <span className="mt-entry-ico" title={t.kinds[x.coll]}><Icon name={ICON[x.coll]} size={15} /></span>
              <span className="mt-entry-text">
                {x.coll === 'decisions' && <b className="mt-entry-kind">{t.kinds.decisions}{t.colon}</b>}
                {x.text}
                <span className="muted small">
                  {x.coll === 'actions' && ` · ${x.owner || t.noOwner}${x.due ? ` · ${t.due} ${x.due}` : ''}`}
                  {x.topicId && ` · ${d.topics.find(tp => tp.id === x.topicId)?.text ?? ''}`}
                  {` · ${nameOf(x.by)}`}
                </span>
              </span>
              {(x.by === me || isFac) && <button className="icon-btn sm" onClick={() => remove(x)} aria-label={`${t.remove}: ${x.text}`} title={t.remove}><Icon name="trash" size={14} /></button>}
            </li>
          ))}
        </ul>
      ) : <p className="muted small mt-empty-line">{t.nothingYet}</p>}
    </section>
  )
}

function People() {
  const { d, t, nameOf, online } = useMeeting()
  const people = Object.values(d.people).sort((a, b) => (online(b.id) - online(a.id)) || a.joinedAt - b.joinedAt)
  return (
    <section className="tool-card mt-card mt-people">
      <div className="mt-card-head"><h2><Icon name="users" size={18} /> {t.people}</h2><span className="mt-count">{people.filter(p => online(p.id)).length}</span></div>
      <ul>
        {people.map(p => (
          <li key={p.id} className={online(p.id) ? '' : 'away'}><Person p={p} size={24} guest={t.guest} /> <span>{nameOf(p.id)}{online(p.id) ? '' : ` · ${t.offline}`}</span>{p.id === d.facilitatorId && <span className="mt-tag">{t.facTag}</span>}</li>
        ))}
      </ul>
    </section>
  )
}
