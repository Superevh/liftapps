import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, personalStorage } from '../core/store.jsx'
import { useLiveDoc, deleteDoc, usePresence } from '../core/live.js'
import { navigate, useClickOutside } from '../core/ui.jsx'
import { QR } from '../core/qr.jsx'
import { useT, fill } from './i18n.js'
import { Icon, Toaster, showToast, useNameGate, useConfirm, Menu, Person, copyText, DraftInput, useNow, bell } from './common.jsx'
import { reduce, status as statusOf, fmtDate, nameOf as nameIn, requestWaitLeft, fmtClock } from './model.js'
import { remember, forget, registerInTeam } from './store.js'
import { NewMeeting } from './NewMeeting.jsx'
import { Plan, CalendarButton } from './Plan.jsx'
import { Run } from './Run.jsx'
import { Summary } from './Summary.jsx'
import './meeting.css'

const Ctx = createContext(null)
export const useMeeting = () => useContext(Ctx)

export function MeetingRoom({ id, sub }) {
  if (id === 'new') return <NewMeeting tpl={sub} />
  return <Room id={id} sub={sub} />
}

export const shareUrl = id => `${location.origin}${location.pathname}#/m/${id}`

function Room({ id, sub }) {
  const { identity } = useStore()
  const [t, lang] = useT()
  const { status, doc: d, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const [gate, nameDialog] = useNameGate()
  const [confirm, confirmDialog] = useConfirm()

  // Everyone who opens the meeting shows up in it; name or colour changes follow.
  const known = d?.people[me]
  useEffect(() => {
    if (!d) return
    if (known && known.name === identity.name && known.color === identity.color) return
    dispatch({ type: 'JOIN', person: { id: me, name: identity.name, color: identity.color } })
  }, [!!d, known?.name, known?.color, identity.name, identity.color]) // eslint-disable-line react-hooks/exhaustive-deps

  const st = d ? statusOf(d) : null
  useEffect(() => { if (d) remember(d) }, [d?.title, d?.date, d?.time, st]) // eslint-disable-line react-hooks/exhaustive-deps
  // A meeting in a team keeps its entry in the team list current (idempotent; skipped when unchanged).
  useEffect(() => { if (d?.teamId) registerInTeam(d.teamId, d, me).catch(() => {}) }, [d?.teamId, d?.title, d?.date]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (d) document.title = `${d.title || t.untitled} · MeetingLift` }, [d?.title, t.untitled]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(a => dispatch({ ...a, pid: me }), [dispatch, me])

  // Who has this meeting open right now, from Realtime presence (nothing goes into the action log).
  // Without presence (backend lacks it, or not synced yet) everyone counts as here.
  const presence = usePresence(id, me)
  const online = useCallback(pid => !presence.ready || presence.keys.has(pid), [presence])

  // Tell people when the facilitator role changes hands, or when their request is turned down.
  const prevFac = useRef(null)
  const prevReq = useRef(null)
  useEffect(() => {
    if (!d) return
    // Remember the facilitator per meeting, so someone who comes back after a take-over is told too.
    const key = `meetinglift-fac:${d.id}`
    let was = prevFac.current
    if (was == null) { try { was = personalStorage().getItem(key) } catch { /* storage blocked */ } }
    try { personalStorage().setItem(key, d.facilitatorId) } catch { /* storage blocked */ }
    prevFac.current = d.facilitatorId
    if (was && was !== d.facilitatorId) showToast(d.facilitatorId === me ? t.youFac : fill(t.nowFac, { name: nameIn(d, d.facilitatorId, t.guest) }))
    else if (prevReq.current === me && !d.request && d.lastRequest?.pid === me && d.lastRequest.outcome === 'declined') showToast(t.declined)
    prevReq.current = d.request?.pid ?? null
  }, [d?.facilitatorId, d?.request?.pid, d?.lastRequest?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  // Contributions (notes, votes, answers…) ask for a name the first time, never before.
  const contribute = useCallback(a => gate(() => act(a)), [gate, act])
  const ctx = useMemo(() => d && {
    d, act, contribute, gate, confirm, me, t, lang, isFac: d.facilitatorId === me,
    nameOf: pid => nameIn(d, pid, t.guest), person: pid => d.people[pid], online,
  }, [d, act, contribute, gate, confirm, me, t, lang, online])

  if (status !== 'ready') {
    if (status === 'loading') return <main className="tool-page"><div className="empty-page"><span className="spinner" aria-hidden="true" /><p className="muted">{t.loading}</p></div></main>
    return (
      <main className="tool-page">
        <div className="empty-page">
          <Icon name="calendar" size={30} />
          <h2>{status === 'offline' ? t.offline : t.missing}</h2>
          {status !== 'offline' && <p className="muted">{t.missingHint}</p>}
          <a className="btn primary" href="#/">{t.goHome}</a>
        </div>
      </main>
    )
  }
  const tab = ['plan', 'run', 'summary'].includes(sub) ? sub : st === 'live' ? 'run' : st === 'done' ? 'summary' : 'plan'
  return (
    <Ctx.Provider value={ctx}>
      <main className={`mt-room tab-${tab}`}>
        <RoomHead st={st} />
        <Tabs tab={tab} st={st} />
        {error && <p className="mt-sync-error" role="alert">{t.syncError}</p>}
        <HandOverRequest />
        {tab === 'plan' && st === 'live' && <Banner text={t.liveBanner} cta={t.joinRun} href={`#/m/${d.id}/run`} live />}
        {tab === 'plan' && st === 'done' && <Banner text={t.endedBanner} cta={t.seeSummary} href={`#/m/${d.id}/summary`} />}
        {tab === 'plan' && <Plan />}
        {tab === 'run' && <Run />}
        {tab === 'summary' && <Summary />}
        <datalist id="mt-people">{[...new Set([...d.attendees, ...Object.values(d.people).map(p => p.name).filter(Boolean)])].map(n => <option key={n} value={n} />)}</datalist>
      </main>
      {nameDialog}
      {confirmDialog}
      <Toaster />
    </Ctx.Provider>
  )
}

function Banner({ text, cta, href, live }) {
  return (
    <div className="mt-banner no-print">
      {live && <span className="mt-live-dot" aria-hidden="true" />}
      <span>{text}</span>
      <a className="btn ghost sm" href={href}>{cta} <Icon name="right" size={14} /></a>
    </div>
  )
}

function RoomHead({ st }) {
  const { d, act, me, t, lang, isFac, nameOf, person, confirm, online } = useMeeting()
  const { identity } = useStore()
  const fac = person(d.facilitatorId)
  const del = () => confirm(t.deleteConfirm, t.deleteYes, () => {
    deleteDoc(d.id, identity.secret).finally(() => { forget(d.id); navigate('/') })
  })
  return (
    <header className="mt-room-head">
      <a className="icon-btn no-print" href="#/" aria-label={t.back} title={t.back}><Icon name="left" /></a>
      <div className="mt-room-title">
        <DraftInput className="mt-title-input" value={d.title} onSave={v => v.trim() && act({ type: 'SET', patch: { title: v } })} aria-label={t.title} maxLength={120} placeholder={t.untitled} />
        <div className="mt-room-meta">
          <span className={`mt-chip s-${st}`}>{st === 'live' && <span className="mt-live-dot" aria-hidden="true" />}{t.st[st]}</span>
          {d.date && <span><Icon name="calendar" size={14} /> {fmtDate(d.date, lang)}{d.time ? ` · ${d.time}` : ''}</span>}
          {d.teamId && <a className="mt-team-link" href={`#/team/${d.teamId}`}><Icon name="users" size={14} /> {d.teamName || t.team}</a>}
          {d.cadence !== 'none' && <span><Icon name="repeat" size={14} /> {t.cadence[d.cadence]}{d.series?.n > 1 ? ` · ${t.series(d.series.n)}` : ''}</span>}
          <span className={`mt-fac ${online(d.facilitatorId) ? '' : 'away'}`}><Person p={fac} size={18} guest={t.guest} /> {t.facilitator}{t.colon}{nameOf(d.facilitatorId)}{online(d.facilitatorId) ? '' : ` · ${t.offline}`}{isFac ? (lang === 'zh' ? `（${t.you}）` : ` (${t.you})`) : ''}</span>
        </div>
      </div>
      <div className="mt-head-actions no-print">
        <Invite />
        <Menu label={t.more}>
          <button className="menu-item" role="menuitem" data-close onClick={() => copyText(shareUrl(d.id), { ...t, copied: t.linkCopied })}><Icon name="link" /> {t.copyLink}</button>
          <CalendarButton asMenu />
          {!isFac && <FacilitatorMenuItem />}
          {d.creatorId === me && <button className="menu-item danger" role="menuitem" data-close onClick={del}><Icon name="trash" /> {t.deleteMeeting}</button>}
        </Menu>
      </div>
    </header>
  )
}

// Never an instant take-over: ask first. The facilitator hands over or declines; if they do neither
// for REQUEST_WAIT_MS, the requester may take over (and the facilitator sees that countdown).
function FacilitatorMenuItem() {
  const { d, act, gate, me, t, nameOf, online } = useMeeting()
  const name = nameOf(d.facilitatorId)
  if (d.request?.pid === me) return <button className="menu-item" role="menuitem" data-close onClick={() => act({ type: 'CANCEL_REQUEST' })}><Icon name="x" /> {t.cancelAsk}</button>
  return (
    <button className="menu-item" role="menuitem" data-close title={online(d.facilitatorId) ? t.facHereHint : fill(t.facOfflineHint, { name })}
      onClick={() => gate(() => { act({ type: 'REQUEST_FACILITATOR' }); showToast(fill(t.askSent, { name })) }, { required: true })}>
      <Icon name="crown" /> {t.askFacilitate}
    </button>
  )
}

function HandOverRequest() {
  const { d, act, isFac, me, t, nameOf, confirm, online } = useMeeting()
  const now = useNow(!!d.request, 1000)
  const left = d.request ? requestWaitLeft(d, now) : null
  // Once the wait is over, nudge a facilitator who is still here (a chime and a highlight), once per request.
  const nudged = useRef(null)
  useEffect(() => {
    if (!isFac || !d.request || left > 0 || nudged.current === d.request.at) return
    nudged.current = d.request.at
    bell()
  }, [isFac, d.request, left])
  if (!d.request) return null
  const who = nameOf(d.request.pid)
  const facHere = online(d.facilitatorId)
  if (isFac) {
    return (
      <div className={`mt-banner mt-request no-print ${left === 0 ? 'urgent' : ''}`} role="alert">
        <Icon name="crown" />
        <span>{left > 0 ? fill(t.requestBanner, { name: who, t: fmtClock(left) }) : `${fill(t.requestBannerNow, { name: who })}${t.colon === '：' ? '' : ' '}${t.facAttention}`}</span>
        <span className="mt-banner-btns">
          <button className="btn ghost sm" onClick={() => act({ type: 'DECLINE_REQUEST' })}>{t.decline}</button>
          <button className="btn ghost sm" onClick={() => act({ type: 'HAND_OVER', to: d.request.pid })}>{t.handOver}</button>
        </span>
      </div>
    )
  }
  if (d.request.pid === me) {
    const name = nameOf(d.facilitatorId)
    return (
      <div className="mt-banner mt-request no-print" role="status">
        <span>{left > 0 ? fill(t.askingWait, { name, t: fmtClock(left) }) : facHere ? fill(t.facHereWait, { name }) : fill(t.askingNow, { name })}</span>
        <span className="mt-banner-btns">
          <button className="btn ghost sm" onClick={() => act({ type: 'CANCEL_REQUEST' })}>{t.cancelAsk}</button>
          {left === 0 && !facHere && <button className="btn ghost sm" onClick={() => confirm(fill(t.takeOverConfirm, { name }), t.takeOverYes, () => act({ type: 'TAKE_FACILITATOR' }))}><Icon name="crown" size={14} /> {t.takeNow}</button>}
        </span>
      </div>
    )
  }
  return null
}

export function Invite({ primary }) {
  const { d, t } = useMeeting()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  const url = shareUrl(d.id)
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ${primary ? 'primary' : 'ghost'}`} onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="link" /> <span className="mt-hide-sm">{t.invite}</span></button>
      {open && (
        <div className="menu right invite-menu">
          <p className="menu-hint">{t.inviteHint}</p>
          <div className="menu-form"><input readOnly value={url} onFocus={e => e.target.select()} aria-label={t.copyLink} /><button className="btn primary sm" onClick={() => copyText(url, { ...t, copied: t.linkCopied })}>{t.copyLink}</button></div>
          <div className="invite-qr"><QR text={url} size={150} /></div>
        </div>
      )}
    </div>
  )
}

function Tabs({ tab, st }) {
  const { d, t } = useMeeting()
  const tabs = ['plan', 'run', 'summary']
  return (
    <nav className="mt-tabs no-print" aria-label={t.agenda}>
      {tabs.map((k, i) => (
        <a key={k} href={`#/m/${d.id}/${k}`} className={`mt-tab ${tab === k ? 'on' : ''}`} aria-current={tab === k ? 'page' : undefined}>
          <span className={`mt-tab-n ${k === 'run' && st === 'live' ? 'live' : ''}`}>{k === 'run' && st === 'live' ? <span className="mt-live-dot" aria-hidden="true" /> : i + 1}</span>
          {t.tabs[k]}
        </a>
      ))}
    </nav>
  )
}

