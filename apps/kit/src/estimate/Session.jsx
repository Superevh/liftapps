import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, newBoardId, personalStorage } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { Avatar, navigate, useClickOutside } from '../core/ui.jsx'
import { confetti, sparkle } from '../core/fx.js'
import { useLiveDoc, usePresence, deleteDoc, rememberDoc, forgetDoc } from '../core/live.js'
import { T, fill } from './i18n.js'
import {
  KIND, POKER_KIND, THEME_EMOJI, reduce, deckOf, stats, stageOf, statusOf, isOpen, progress, voters, activePeople, nameOf,
  agreedAhead, outliers, roundOf, confidenceTally, parseBacklog, DECK_IDS,
} from './model.js'
import { entryOf } from './App.jsx'
import { TEAM_KIND, appendToTeam, sessionRecord } from './team.js'
import { rememberedDocs } from '../core/live.js'
import { Toast, useToast, useCountdown, fmtClock, Dialog, Invite, Bar, copyText } from './bits.jsx'

const Summary = lazy(() => import('./Summary.jsx'))

// One estimation session: Backlog, Estimate, Confidence and Summary views over one live document.
// The facilitator's stage decides where everyone lands; anyone can still look at the other views.

const VIEW_OF = { prep: 'backlog', estimate: 'estimate', confidence: 'confidence', done: 'summary' }
const VIEWS = ['backlog', 'estimate', 'confidence', 'summary']
const SPECIAL = new Set(['?', '☕'])

const shareUrl = (base, id) => `${window.location.origin}${window.location.pathname}#/${base}/${id}`

export default function SessionPage({ id, base, sub }) {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const { status, doc, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const known = doc?.people[me]

  // Opening the link is joining: no name needed. Name or colour changes are carried over.
  useEffect(() => {
    if (!doc) return
    // Opening a finished session to read the summary doesn't add you to it.
    if (!known && stageOf(doc) === 'done') return
    // After leaving (or being removed) only the Rejoin button brings you back.
    if (known?.left) return
    if (known && (known.name ?? '') === identity.name && known.color === identity.color) return
    dispatch({ type: 'JOIN', person: { id: me, name: identity.name, color: identity.color }, role: 'voter' })
  }, [!!doc, known?.left, known?.name, known?.color, identity.name, identity.color]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the home list's line for this session current.
  const sig = doc ? JSON.stringify(entryOf(doc), ['name', 'stage', 'total', 'handled', 'points', 'capacity']) : ''
  useEffect(() => {
    if (doc) rememberDoc(doc.kind === 'poker' ? POKER_KIND : KIND, entryOf(doc))
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the facilitator moves the session on, everyone follows.
  const stage = doc ? stageOf(doc) : null
  const lastStage = useRef(stage)
  useEffect(() => {
    if (!stage) return
    if (lastStage.current && lastStage.current !== stage) navigate(`/${base}/${id}/${VIEW_OF[stage]}`)
    lastStage.current = stage
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (doc?.name) document.title = `${doc.name} · EstimateLift` }, [doc?.name])

  if (status === 'loading') return <div className="empty-page"><span className="spinner" aria-hidden="true" /><p className="muted">{t.loading}</p></div>
  if (status !== 'ready') return (
    <div className="empty-page">
      <h2>{status === 'offline' ? t.noBackend : t.missing}</h2>
      {status !== 'offline' && <p className="muted">{t.missingHint}</p>}
      <a className="btn ghost" href="#/"><Icon name="left" /> {t.allSessions}</a>
    </div>
  )
  const view = VIEWS.includes(sub) ? sub : VIEW_OF[stage]
  return <Room doc={doc} me={me} base={base} view={view} dispatch={dispatch} error={error} t={t} lang={lang} />
}

function Room({ doc, me, base, view, dispatch, error, t, lang }) {
  const { identity } = useStore()
  const isHost = doc.ownerId === me
  const canRun = isHost || !doc.settings.hostOnly
  const [toast, show, hide] = useToast()
  const [keys, setKeys] = useState(false)
  const [splitting, setSplitting] = useState(null)
  const online = useOnline(doc.id, me)
  const timerEnd = useTimerEnd(doc.timer)
  const left = !!doc.people[me]?.left
  useTeamRecord(doc, canRun)
  const ctx = { doc, me, base, dispatch, t, lang, isHost, canRun, show, identity, online, timerEnd, left, openKeys: () => setKeys(true), askSplit: story => setSplitting(story.id) }
  const p = progress(doc)
  const tab = (v, label, extra) => (
    <a key={v} href={`#/${base}/${doc.id}/${v}`} className={`es-tab ${view === v ? 'on' : ''}`} aria-current={view === v ? 'page' : undefined}>
      {label}{extra != null && <span className="es-tab-n">{extra}</span>}
    </a>
  )
  return (
    <main className={`es-room theme-${doc.theme ?? 'classic'}`}>
      <header className="es-shead">
        <div className="es-shead-row">
          <a className="icon-btn" href="#/" aria-label={t.allSessions} title={t.allSessions}><Icon name="left" /></a>
          <Title doc={doc} canEdit={isHost} dispatch={dispatch} t={t} />
          <span className={`es-chip st-${stageOf(doc)}`}>{t.stage[stageOf(doc)]}</span>
          {doc.teamId && <a className="es-chip es-team-chip" href={`#/t/${doc.teamId}`} title={t.team}><Icon name="users" size={13} /> {doc.teamName || t.team}</a>}
          <span className="spacer" />
          <People {...ctx} />
          {canRun ? <TimerControl {...ctx} /> : <TimerChip timerEnd={timerEnd} />}
          <Invite url={shareUrl(base, doc.id)} t={t} />
          <SessionMenu {...ctx} />
        </div>
        <nav className="es-tabs" aria-label={doc.name}>
          {tab('backlog', t.tabs.backlog, p.total ? `${p.handled}/${p.total}` : null)}
          {tab('estimate', t.tabs.estimate)}
          {tab('confidence', t.tabs.confidence)}
          {tab('summary', t.tabs.summary)}
          {canRun && <button className="es-keys-btn" onClick={() => setKeys(true)} title={t.shortcuts} aria-label={t.shortcuts}><kbd>?</kbd></button>}
        </nav>
      </header>
      {error && <div className="sync-banner es-sync" role="alert">{t.syncError}</div>}
      {left && (
        <section className="es-banner es-left">
          <div><b>{t.leftTitle}</b><p className="muted">{t.leftHint}</p></div>
          <button className="btn primary" onClick={() => dispatch({ type: 'JOIN', person: { id: me, name: identity.name, color: identity.color }, role: 'voter' })}>{t.rejoin}</button>
        </section>
      )}
      {view === 'backlog' && <BacklogView {...ctx} />}
      {view === 'estimate' && <EstimateView {...ctx} />}
      {view === 'confidence' && <ConfidenceView {...ctx} />}
      {view === 'summary' && <Suspense fallback={<div className="empty-page"><span className="spinner" aria-hidden="true" /></div>}><Summary {...ctx} /></Suspense>}
      {keys && <Dialog label={t.shortcuts} onClose={() => setKeys(false)}>
        <h2>{t.shortcuts}</h2>
        <dl className="es-keys">{t.keys.map(([k, what]) => <div key={k}><dt>{k.split('  ').map(x => <kbd key={x}>{x}</kbd>)}</dt><dd>{what}</dd></div>)}</dl>
      </Dialog>}
      {splitting && doc.stories.some(s => s.id === splitting) && <SplitDialog story={doc.stories.find(s => s.id === splitting)} t={t} dispatch={dispatch} show={show} onClose={() => setSplitting(null)} />}
      <Toast toast={toast} t={t} onHide={hide} />
    </main>
  )
}

// When a team session is finished, the facilitator's page writes its summary into the team
// document (recording again just replaces it). Each browser writes a given summary once.
function useTeamRecord(doc, canRun) {
  const entry = entryOf(doc)
  const sig = doc.teamId && stageOf(doc) === 'done' && canRun ? JSON.stringify([doc.teamId, sessionRecord(entry), doc.name]) : null
  // Marked as recorded only after both writes succeed; otherwise it tries again when the page
  // becomes visible or comes back online, and on the next load.
  useEffect(() => {
    if (!sig) return
    const key = `lift-estimate-recorded-${doc.id}`
    let busy = false
    const done = () => { try { return localStorage.getItem(key) === sig } catch { return false } }
    const attempt = () => {
      if (busy || done()) return
      busy = true
      appendToTeam(doc.teamId, { type: 'SESSION_LINK', sessionId: doc.id, name: doc.name, base: doc.kind === 'poker' ? 'poker' : 's', createdAt: doc.createdAt })
        .then(() => appendToTeam(doc.teamId, { type: 'SESSION_RECORD', sessionId: doc.id, name: doc.name, stats: { ...sessionRecord(entry), finishedAt: Date.now() } }))
        .then(() => { try { localStorage.setItem(key, sig) } catch { /* private mode */ } })
        .catch(() => { /* try again later */ })
        .finally(() => { busy = false })
    }
    attempt()
    const again = () => { if (document.visibilityState === 'visible') attempt() }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('online', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('online', again) }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Who is here: tabs with the session open (Realtime presence). Someone who has been gone for more
// than GRACE ms is "away": greyed out and not counted among the voters. Without presence, everyone counts.
const GRACE = 20000
const WARMUP = 2500
function useOnline(id, me) {
  const presence = usePresence(id, me)
  const seen = useRef(new Map())
  const readyAt = useRef(0)
  const [, tick] = useState(0)
  useEffect(() => {
    const h = setInterval(() => tick(x => x + 1), 5000)
    return () => clearInterval(h)
  }, [])
  const now = Date.now()
  if (presence.ready && !readyAt.current) readyAt.current = now
  for (const k of presence.keys) seen.current.set(k, now)
  // Only people actually seen count as here. The grace period is for someone seen who then
  // dropped (a reload, a flaky network); the first second or two after connecting covers
  // tabs whose hello hasn't arrived yet.
  return pid => {
    if (pid === me || !presence.ready) return true
    const at = seen.current.get(pid)
    return at != null ? now - at < GRACE : now - readyAt.current < WARMUP
  }
}

// The timer is stored as a start time and a length. Clocks differ between devices, so a timer that
// arrives live runs from the moment it arrived here; one already running when the page opened uses
// the sender's clock (the best we know).
function useTimerEnd(timer) {
  const mounted = useRef(false)
  const ends = useRef(new Map())
  const end = timer?.endsAt
  if (end && !ends.current.has(end)) ends.current.set(end, mounted.current && timer.seconds ? Date.now() + timer.seconds * 1000 : end)
  useEffect(() => { mounted.current = true }, [])
  return end ? ends.current.get(end) : null
}

function SplitDialog({ story, t, dispatch, show, onClose }) {
  const [text, setText] = useState('')
  const kids = text.split('\n').map(x => x.replace(/^(?:[-*•·]|\d{1,3}[.)、])\s+/, '').trim()).filter(Boolean).slice(0, 20)
  const go = children => {
    dispatch({ type: 'SPLIT', storyId: story.id, children })
    show(children.length ? t.splitDoneN(children.length) : t.splitDone, () => { dispatch({ type: 'UNSPLIT', storyId: story.id }) })
    onClose()
  }
  return (
    <Dialog label={t.splitTitle} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (kids.length) go(kids) }} className="es-edit">
        <h2>{t.splitTitle}</h2>
        <p className="muted es-split-parent">{story.key && <span className="es-key">{story.key}</span>}{story.title}</p>
        <label><span className="field-label">{t.splitInto}</span>
          <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={t.splitPh} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (kids.length) go(kids) } }} />
        </label>
        <p className="muted small">{t.splitHint}</p>
        <div className="row end wrap">
          <button type="button" className="btn ghost" onClick={() => go([])}>{t.splitFlag}</button>
          <button className="btn primary" disabled={!kids.length}>{kids.length ? t.splitN(kids.length) : t.splitAdd}</button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------- header pieces ----------

function Title({ doc, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(doc.name)
  if (!editing) return (
    <h1 className="es-title">
      {canEdit ? <button className="es-title-btn" onClick={() => { setName(doc.name); setEditing(true) }} title={t.rename}>{doc.name}</button> : doc.name}
    </h1>
  )
  const save = () => { if (name.trim() && name.trim() !== doc.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function useMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  // Closes on Esc, on a click outside (above) and when the view changes (tabs are hash links).
  useEffect(() => {
    if (!open) return
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    const away = () => setOpen(false)
    document.addEventListener('keydown', esc)
    window.addEventListener('hashchange', away)
    return () => { document.removeEventListener('keydown', esc); window.removeEventListener('hashchange', away) }
  }, [open])
  return [open, setOpen, ref]
}

function People({ doc, me, dispatch, t, isHost, online }) {
  const [open, setOpen, ref] = useMenu()
  const people = activePeople(doc)
  const shown = people.slice(0, 4)
  const named = p => ({ ...p, name: nameOf(doc, p, t.guest) })
  return (
    <div className="dropdown" ref={ref}>
      <button className="es-people" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t.people(people.length)}>
        <span className="es-stack">{shown.map(p => <span key={p.id} className={online(p.id) ? '' : 'es-away'}><Avatar p={named(p)} size={24} /></span>)}</span>
        <span className="es-people-n">{people.filter(p => online(p.id)).length}</span>
      </button>
      {open && (
        <div className="menu right room-menu es-people-menu">
          <div className="menu-title">{t.people(people.length)}</div>
          {people.map(p => (
            <div key={p.id} className={`menu-item person-row ${online(p.id) ? '' : 'es-away'}`}>
              <Avatar p={named(p)} size={22} />
              <span className="grow ellipsis">{nameOf(doc, p, t.guest)}{p.id === me ? ` (${t.you})` : ''}</span>
              {p.id === doc.ownerId && <span className="host-tag">{t.facilitator}</span>}
              {!online(p.id) ? <span className="es-mini muted">{t.away}</span> : p.role !== 'voter' && <span className="es-mini muted">{t.watching}</span>}
              {isHost && p.id !== me && <>
                <button className="chip-btn" onClick={() => { dispatch({ type: 'SET_HOST', pid: p.id }); setOpen(false) }}>{t.makeHost}</button>
                <button className="chip-btn" onClick={() => dispatch({ type: 'LEAVE', pid: p.id })}>{t.removeP}</button>
              </>}
            </div>
          ))}
          <button className="menu-item" onClick={() => dispatch({ type: 'SET_ROLE', pid: me, role: doc.people[me]?.role === 'voter' ? 'spectator' : 'voter' })}>
            <Icon name={doc.people[me]?.role === 'voter' ? 'eye' : 'cards'} /> {doc.people[me]?.role === 'voter' ? t.spectate : t.play}
          </button>
        </div>
      )}
    </div>
  )
}

function TimerChip({ timerEnd }) {
  const left = useCountdown(timerEnd)
  if (left == null) return null
  return <span className={`timer-chip ${left <= 10 ? 'hot' : ''}`} role="timer"><Icon name="timer" size={15} /> {fmtClock(left)}</span>
}

function TimerControl({ doc, dispatch, t, timerEnd }) {
  const [open, setOpen, ref] = useMenu()
  const left = useCountdown(timerEnd)
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ghost sm ${left != null ? (left <= 10 ? 'timer-hot' : 'on-soft') : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t.timer}>
        <Icon name="timer" /> <span className={left != null ? 'es-clock' : 'es-hide-xs'}>{left != null ? fmtClock(left) : t.timer}</span>
      </button>
      {open && <div className="menu right">
        {[1, 2, 3, 5].map(m => <button key={m} className="menu-item" onClick={() => { dispatch({ type: 'TIMER', seconds: m * 60 }); setOpen(false) }}>{t.min(m)}</button>)}
        {doc.timer?.endsAt && <button className="menu-item danger" onClick={() => { dispatch({ type: 'TIMER', seconds: 0 }); setOpen(false) }}>{t.stop}</button>}
      </div>}
    </div>
  )
}

function SessionMenu({ doc, me, dispatch, t, isHost, identity }) {
  const [open, setOpen, ref] = useMenu()
  const [confirm, setConfirm] = useState(null)
  const [cap, setCap] = useState(doc.capacity ?? '')
  useEffect(() => { if (!open) setConfirm(null) }, [open])
  const kind = doc.kind === 'poker' ? POKER_KIND : KIND
  const del = () => {
    if (confirm !== 'delete') return setConfirm('delete')
    deleteDoc(doc.id, identity.secret).finally(() => { forgetDoc(kind, doc.id); navigate('/') })
  }
  const takeOver = () => {
    if (confirm !== 'host') return setConfirm('host')
    dispatch({ type: 'SET_HOST', pid: me })
    setOpen(false)
  }
  const numeric = deckOf(doc).filter(v => !SPECIAL.has(v)).every(v => /^\d+(\.\d+)?$|^½$/.test(v))
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        {isHost ? <>
          <div className="menu-title">{t.settings}</div>
          {[['hostOnly', t.hostOnly], ['autoReveal', t.autoReveal], ['showAverage', t.showAverage], ['specials', t.specials], ['async', t.asyncSetting]].map(([k, label]) => (
            <label key={k} className="menu-item check"><input type="checkbox" checked={doc.settings[k] ?? k === 'specials'} onChange={e => dispatch({ type: 'SETTINGS', patch: { [k]: e.target.checked } })} /> {label}</label>
          ))}
          <div className="menu-title">{t.deck}</div>
          <div className="menu-chips">{DECK_IDS.filter(d => d !== 'custom' || doc.customDeck?.length).map(d => <button key={d} className={`chip-btn ${doc.deck === d ? 'sel' : ''}`} aria-pressed={doc.deck === d} onClick={() => dispatch({ type: 'SET_DECK', deck: d })}>{t.decks[d]}</button>)}</div>
          <TeamPicker doc={doc} dispatch={dispatch} t={t} />
          {numeric && <>
            <div className="menu-title">{t.capacity}</div>
            <form className="menu-form plain es-cap-form" onSubmit={e => { e.preventDefault(); dispatch({ type: 'CAPACITY', points: Number(cap) || 0 }); setOpen(false) }}>
              <input type="number" min="0" step="any" value={cap} onChange={e => setCap(e.target.value)} placeholder={t.capacityPh} aria-label={t.capacity} />
              <button className="btn ghost sm">{t.save}</button>
            </form>
          </>}
        </> : <>
          <p className="menu-hint">{fill(t.waitHost, { name: nameOf(doc, doc.people[doc.ownerId], t.guest) })}</p>
          <button className="menu-item" onClick={takeOver}><Icon name="crown" /> {confirm === 'host' ? t.takeOverConfirm : t.takeOver}</button>
        </>}
        <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(kind, doc.id); navigate('/') }}><Icon name="logout" /> {t.leave}</button>
        {(doc.creatorId ?? doc.ownerId) === me && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm === 'delete' ? t.confirm : t.deleteS}</button>}
      </div>}
    </div>
  )
}

// ---------- banners shared by Backlog and Estimate ----------

function Banners({ doc, dispatch, t, canRun, base, show }) {
  const agreed = agreedAhead(doc)
  const stage = stageOf(doc)
  const open = doc.stories.filter(isOpen).length
  return <>
    {stage === 'prep' && (
      <section className="es-banner">
        <div><b>{t.prepTitle}</b><p className="muted">{canRun ? t.prepHost : doc.settings.async ? t.prepGuestAsync : t.prepGuest}</p></div>
        {canRun && <div className="es-banner-actions">
          <button className="btn ghost" onClick={() => copyText(shareUrl(base, doc.id)).then(() => show(t.copied), () => {})}><Icon name="link" /> {t.copy}</button>
          <button className="btn primary" onClick={() => { dispatch({ type: 'STAGE', stage: 'estimate' }); navigate(`/${base}/${doc.id}/estimate`) }}><Icon name="play" /> {open ? fill(t.startN, { n: open }) : t.start}</button>
        </div>}
      </section>
    )}
    {canRun && agreed.length > 0 && (
      <section className="es-banner soft">
        <div><b>{t.agreedTitle(agreed.length)}</b><p className="muted">{t.agreedHint}</p>
          <p className="es-agreed">{agreed.slice(0, 6).map(x => <span key={x.story.id}>{x.story.key || x.story.title.slice(0, 24)} <b>{x.value}</b></span>)}</p>
        </div>
        <button className="btn ghost" onClick={() => dispatch({ type: 'ACCEPT_AGREED' })}><Icon name="check" /> {t.acceptAgreed}</button>
      </section>
    )}
  </>
}

// ---------- estimate ----------

function guestOk() { try { return personalStorage().getItem('lift-estimate-guest') === '1' } catch { return false } }

function EstimateView(ctx) {
  const { doc, me, dispatch, t, canRun, isHost, base, identity, openKeys, online, timerEnd, show, askSplit, left } = ctx
  const deck = deckOf(doc)
  const story = doc.stories.find(s => s.id === doc.currentId)
  const seated = voters(doc).sort((a, b) => a.joinedAt - b.joinedAt)
  // People who are away (closed the tab, lost the connection) don't hold up the round.
  const players = seated.filter(p => online(p.id) || doc.votes[p.id] != null)
  const mine = doc.people[me]
  const myVote = doc.votes[me]
  const votedCount = players.filter(p => doc.votes[p.id] != null).length
  const result = doc.revealed ? stats(doc) : null
  const out = outliers(doc, result)
  const openStories = doc.stories.filter(isOpen)
  const allDone = doc.stories.length > 0 && openStories.length === 0 && !story
  const idle = !story && openStories.length > 0
  const idx = story ? doc.stories.indexOf(story) : -1
  // A wide spread gets no preselected answer: the next step is talking, not accepting the average.
  const wide = !!out
  const [choice, setChoice] = useState(null)
  useEffect(() => { setChoice(wide ? null : result?.suggestion ?? null) }, [result?.suggestion, doc.revealedAt, wide]) // eslint-disable-line react-hooks/exhaustive-deps
  const hostName = nameOf(doc, doc.people[doc.ownerId], t.guest)
  const accepted = choice
  const cardValues = deck.filter(v => v !== '☕' && v !== '?')

  // Celebrate a unanimous reveal, once.
  const celebrated = useRef(null)
  useEffect(() => {
    if (result?.consensus && result.count > 1 && celebrated.current !== doc.revealedAt) { celebrated.current = doc.revealedAt; confetti(1800) }
  }, [result?.consensus, doc.revealedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const vote = (v, el) => {
    if (mine?.role !== 'voter' || doc.revealed) return
    const value = myVote === v ? null : v
    if (value != null && el) sparkle(el)
    dispatch({ type: 'VOTE', pid: me, value })
  }
  // Auto-reveal counts only the people who are here. One client sends it: the facilitator, or if
  // they are away, the first present voter. REVEAL is idempotent, so a double send is harmless.
  const allIn = players.length > 0 && votedCount === players.length
  const sender = online(doc.ownerId) ? doc.ownerId : seated.map(p => p.id).filter(online).sort()[0]
  useEffect(() => {
    if (doc.settings.autoReveal && !doc.revealed && allIn && sender === me) dispatch({ type: 'REVEAL' })
  }, [allIn, doc.revealed, doc.settings.autoReveal, sender]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = dir => {
    if (!doc.stories.length) return
    const list = doc.stories
    const i = idx < 0 ? (dir > 0 ? -1 : list.length) : idx
    const target = dir > 0 ? list.slice(i + 1).find(isOpen) ?? list[i + 1] : [...list.slice(0, Math.max(0, i))].reverse().find(isOpen) ?? list[i - 1]
    if (target) dispatch({ type: 'SELECT_STORY', storyId: target.id })
  }
  const act = {
    reveal: () => canRun && !doc.revealed && votedCount > 0 && dispatch({ type: 'REVEAL' }),
    accept: () => canRun && doc.revealed && story && accepted != null && dispatch({ type: 'ACCEPT', storyId: story.id, value: accepted }),
    revote: () => canRun && (doc.revealed || votedCount) && dispatch({ type: 'RESET' }),
    skip: () => {
      if (!canRun || !story) return
      const id = story.id
      dispatch({ type: 'SKIP', storyId: id })
      show(t.skippedToast, () => { dispatch({ type: 'REOPEN', storyId: id }); dispatch({ type: 'SELECT_STORY', storyId: id }) })
    },
    split: () => canRun && story && askSplit(story),
    next: () => canRun && go(1),
    prev: () => canRun && go(-1),
    timer: () => canRun && dispatch({ type: 'TIMER', seconds: timerEnd && timerEnd > Date.now() ? 0 : 120 }),
  }

  // Keyboard: facilitator letters, and digits to vote. "13" can be typed as 1 then 3.
  const latest = useRef(null)
  latest.current = { act, vote, deck, openKeys }
  useEffect(() => {
    let buf = ''
    let timer = null
    // A pending "1" (waiting to see whether "13" follows) is cast before any other key acts.
    const commit = () => {
      clearTimeout(timer)
      const { vote: v, deck: d } = latest.current
      if (buf && d.includes(buf)) v(buf, document.querySelector(`[data-card="${CSS.escape(buf)}"]`))
      buf = ''
    }
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || document.querySelector('.modal-backdrop')) return
      const { deck: d } = latest.current
      const k = e.key
      if (/^[0-9]$/.test(k)) {
        buf += k
        clearTimeout(timer)
        const exact = d.includes(buf)
        const longer = d.some(x => x !== buf && x.startsWith(buf))
        if (exact && !longer) commit()
        else if (!exact && !longer) buf = ''
        else timer = setTimeout(commit, 600)
        e.preventDefault()
        return
      }
      // Let the pending vote land (and the page re-render) before the shortcut acts on it.
      if (buf) { commit(); e.preventDefault(); setTimeout(() => run(k), 80); return }
      run(k, e)
    }
    const run = (k, e) => {
      const { act: a, openKeys: keys } = latest.current
      const map = { r: a.reveal, a: a.accept, v: a.revote, s: a.skip, x: a.split, n: a.next, ArrowRight: a.next, p: a.prev, ArrowLeft: a.prev, t: a.timer }
      if (k === '?') { keys(); e?.preventDefault(); return }
      const fn = map[k.length === 1 ? k.toLowerCase() : k]
      if (fn) { fn(); e?.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer) }
  }, [])

  return (
    <div className="es-body">
      <Banners {...ctx} />
      <div className="es-est-grid">
        <div className="es-est-main">
          {allDone ? (
            <section className="tool-card es-finish">
              <span className="es-finish-ico"><Icon name="check" size={26} /></span>
              <h2>{stageOf(doc) === 'done' ? t.sessionDone : t.noOpen}</h2>
              <p className="muted">{stageOf(doc) === 'done' ? t.sessionDoneHint : canRun ? t.noOpenHost : t.noOpenGuest}</p>
              {stageOf(doc) === 'done' && <a className="btn ghost" href={`#/${base}/${doc.id}/summary`}>{t.toSummary}</a>}
              {canRun && stageOf(doc) !== 'done' && <div className="row center wrap">
                <button className="btn primary" onClick={() => dispatch({ type: 'STAGE', stage: 'confidence' })}><Icon name="thumb" /> {t.toConfidence}</button>
                <a className="btn ghost" href={`#/${base}/${doc.id}/summary`}>{t.toSummary}</a>
              </div>}
            </section>
          ) : <>
            <Spotlight {...ctx} story={story} idx={idx} idle={idle} openStories={openStories} go={go} />
            <section className="poker-table es-table" aria-label={t.tabs.estimate}>
              {seated.length === 0 ? <p className="muted">{t.noVoters}</p> : (
                <div className="seats">
                  {seated.map(p => {
                    const v = doc.votes[p.id]
                    const edge = out && (v === out.low || v === out.high)
                    const away = !players.includes(p)
                    return (
                      <div key={p.id} className={`seat ${p.id === me ? 'me' : ''} ${away ? 'es-away' : ''}`}>
                        {doc.revealed && v != null
                          ? <span className={`pcard face flip ${edge ? 'edge' : ''}`}><b>{v}</b></span>
                          : v != null ? <span className="pcard back drop"><i>{THEME_EMOJI(doc.theme)}</i></span>
                            : <span className="pcard empty">{doc.revealed ? '–' : ''}</span>}
                        <span className="seat-name"><Avatar p={{ ...p, name: nameOf(doc, p, t.guest) }} size={20} /> <span className="ellipsis">{nameOf(doc, p, t.guest)}{p.id === me ? ` (${t.you})` : ''}</span></span>
                        {!doc.revealed && v == null && <span className="es-thinking">{away ? t.away : t.thinking}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="table-center">
                {!doc.revealed ? <>
                  <p className="muted" aria-live="polite">{votedCount ? fill(t.voted, { v: votedCount, t: players.length }) : t.waiting}</p>
                  {canRun && <button className="btn primary lg" disabled={!votedCount} onClick={act.reveal}><Icon name="eye" /> {votedCount < players.length ? fill(t.revealN, { v: votedCount, t: players.length }) : t.reveal}</button>}
                </> : (
                  <Results doc={doc} result={result} out={out} wide={wide} story={story} canRun={canRun} dispatch={dispatch} t={t} act={act} choice={accepted} setChoice={setChoice} cardValues={cardValues} hostName={hostName} />
                )}
              </div>
            </section>
            {mine?.role === 'voter' && !left && !idle && !doc.revealed && (
              <section className="hand es-hand" aria-label={t.pick}>
                <span className="hand-label">{t.pick}</span>
                <div className="hand-cards" role="group" aria-label={t.pick}>
                  {deck.map(v => (
                    <button key={v} data-card={v} className={`pcard face pick ${myVote === v ? 'sel' : ''}`} aria-pressed={myVote === v} aria-label={`${t.pick}: ${v}`} onClick={e => vote(v, e.currentTarget)}>
                      <b>{v}</b>
                    </button>
                  ))}
                </div>
                {myVote != null && <p className="muted small es-hand-note">{fill(t.youVoted, { v: myVote })}</p>}
                {!identity.name && !guestOk() && <NameNudge voted={myVote != null} t={t} />}
              </section>
            )}
          </>}
        </div>
        <BacklogRail {...ctx} />
      </div>
    </div>
  )
}

function Spotlight({ doc, t, canRun, story, idx, idle, openStories, go, dispatch }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  if (idle) return (
    <section className="tool-card es-spot">
      <span className="es-eyebrow">{t.storyOf.replace('{i}', '–').replace('{n}', doc.stories.length)}</span>
      <h2>{openStories[0].title}</h2>
      {canRun && <div className="row"><button className="btn primary" onClick={() => dispatch({ type: 'SELECT_STORY', storyId: openStories[0].id })}><Icon name="play" /> {t.estimateThis}</button></div>}
    </section>
  )
  if (!story) return (
    <section className="tool-card es-spot">
      <span className="es-eyebrow">{t.quickRound}</span>
      <h2>{doc.name}</h2>
      <p className="muted">{t.quickHint}</p>
    </section>
  )
  const pre = Object.keys(story.pre ?? {}).length
  return (
    <section className="tool-card es-spot" aria-live="polite">
      <div className="es-spot-top">
        <span className="es-eyebrow">{fill(t.storyOf, { i: idx + 1, n: doc.stories.length })} · {fill(t.round, { n: roundOf(doc, story) })}{pre > 0 && !doc.revealed ? ` · ${fill(t.preSeeded, { n: pre })}` : ''}</span>
        {canRun && <span className="es-spot-nav">
          <button className="icon-btn sm" onClick={() => go(-1)} aria-label={t.prev} title={`${t.prev} (P)`}><Icon name="left" size={15} /></button>
          <button className="icon-btn sm" onClick={() => go(1)} aria-label={t.nextStory} title={`${t.nextStory} (N)`}><Icon name="right" size={15} /></button>
        </span>}
      </div>
      <h2 className="es-spot-title">{story.key && <span className="es-key lg">{story.key}</span>}{story.title}</h2>
      <div className="es-spot-meta">
        {story.link && /^https?:/i.test(story.link) && <a href={story.link} target="_blank" rel="noreferrer noopener" className="es-link"><Icon name="link" size={14} /> {t.links}</a>}
        {canRun && !editing && <button className="link-btn small" onClick={() => { setNotes(story.notes ?? ''); setEditing(true) }}><Icon name="edit" size={13} /> {story.notes ? t.editNotes : t.notes}</button>}
      </div>
      {editing ? (
        <form className="es-notes-form" onSubmit={e => { e.preventDefault(); dispatch({ type: 'EDIT_STORY', storyId: story.id, patch: { notes } }); setEditing(false) }}>
          <textarea autoFocus rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.notesPh} aria-label={t.notes} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
          <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>{t.cancel}</button><button className="btn ghost sm">{t.saveNotes}</button></div>
        </form>
      ) : story.notes ? <p className="es-notes">{story.notes}</p> : null}
    </section>
  )
}

function Results({ doc, result, out, wide, story, canRun, dispatch, t, act, choice, setChoice, cardValues, hostName }) {
  const max = Math.max(...result.dist.map(d => d[1]), 1)
  const fmt = n => (Math.round(n * 10) / 10).toString()
  const names = list => list.map(p => nameOf(doc, p, t.guest)).join(t.and)
  const real = result.dist.filter(([v]) => !SPECIAL.has(v))
  let head
  if (result.consensus) head = <p className="es-verdict good"><Icon name="check" size={18} /> {fill(t.consensus, { v: real[0]?.[0] })}</p>
  else if (real.length === 2 && result.spread <= 1) head = <p className="es-verdict"><Icon name="target" size={18} /> {fill(t.closeVotes, { a: real[0][0], b: real[1][0] })}</p>
  else if (result.spread > 2) head = <p className="es-verdict warn"><Icon name="flag" size={18} /> {fill(t.spread, { lo: result.low, hi: result.high })}</p>
  else head = <p className="es-verdict">{t.mixed}</p>
  return (
    <div className="results es-results">
      {head}
      {out && (
        <div className="es-outliers">
          <p>{fill(t.askOutliers, { lows: names(out.lows), lo: out.low, highs: names(out.highs), hi: out.high })}</p>
          {canRun && <button className="btn ghost sm" onClick={() => dispatch({ type: 'TIMER', seconds: 120 })}><Icon name="timer" /> {fill(t.discuss, { n: 2 })}</button>}
        </div>
      )}
      <div className="es-res-grid">
        <div className="dist">
          {result.dist.map(([v, n]) => (
            <div key={v} className="dist-row"><span className="dist-v">{v}</span><span className="dist-bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><span className="dist-n">{n}</span></div>
          ))}
        </div>
        <div className="result-stats">
          {doc.settings.showAverage !== false && result.average != null && <div><b>{fmt(result.average)}</b><span>{t.average}</span></div>}
          {doc.settings.showAverage !== false && result.median != null && <div><b>{fmt(result.median)}</b><span>{t.median}</span></div>}
          <div><b>{result.agreement}%</b><span>{t.agreement}</span></div>
        </div>
      </div>
      {canRun ? (
        story ? (
          <div className="es-decide">
            <span className="field-label">{t.final}</span>
            <div className="es-choices" role="radiogroup" aria-label={t.final}>
              {cardValues.map(v => (
                <button key={v} role="radio" aria-checked={choice === v} className={`es-choice ${choice === v ? 'sel' : ''}`} onClick={() => setChoice(v)} title={v === result.suggestion ? t.suggested : undefined}>
                  {v}{v === result.suggestion && <i className="es-sugg" aria-label={t.suggested}>•</i>}
                </button>
              ))}
            </div>
            {wide && choice == null && <p className="muted small">{t.wideHint}</p>}
            <div className="es-decide-row">
              {wide && <button className="btn primary" onClick={act.revote}>{t.revote}</button>}
              <button className={`btn ${wide ? 'ghost' : 'primary'}`} disabled={choice == null} onClick={act.accept}><Icon name="check" /> {choice == null ? t.acceptPick : fill(t.accept, { v: choice })}</button>
              {!wide && <button className="btn ghost" onClick={act.revote}>{t.revote}</button>}
              <button className="btn ghost sm es-quiet" onClick={act.skip}>{t.skip}</button>
              <button className="btn ghost sm es-quiet" onClick={act.split}>{t.split}</button>
            </div>
          </div>
        ) : <div className="row center"><button className="btn primary" onClick={act.revote}>{t.next}</button></div>
      ) : <p className="muted small">{fill(t.waitHost, { name: hostName })}</p>}
    </div>
  )
}

function NameNudge({ voted, t }) {
  const { rename } = useStore()
  const [name, setName] = useState('')
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  const stay = () => { try { personalStorage().setItem('lift-estimate-guest', '1') } catch { /* private mode */ } setHidden(true) }
  return (
    <form className="es-nudge" onSubmit={e => { e.preventDefault(); if (name.trim()) rename(name) }}>
      <span className="es-nudge-text">{voted ? t.nameAskVoted : t.nameAsk}</span>
      <span className="es-nudge-row">
        <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t.namePh} aria-label={t.yourName} />
        <button className="btn ghost sm" disabled={!name.trim()}>{t.save}</button>
        <button type="button" className="link-btn small" onClick={stay}>{t.stayGuest}</button>
      </span>
    </form>
  )
}

function CapacityLine({ doc, t, p }) {
  if (!p.numeric) return <span className="muted small">{p.sizes.filter(([, n]) => n).map(([v, n]) => `${v}×${n}`).join(' · ') || ''}</span>
  if (!p.capacity) return <span className="muted small">{p.points} {t.pts}</span>
  const over = p.points > p.capacity
  return (
    <span className={`es-cap ${over ? 'over' : ''}`}>
      <span className="small"><b>{fill(t.capOf, { p: p.points, c: p.capacity })}</b> · {over ? fill(t.capOver, { n: Math.round((p.points - p.capacity) * 10) / 10 }) : fill(t.capLeft, { n: Math.round((p.capacity - p.points) * 10) / 10 })}</span>
      <Bar value={p.points} max={p.capacity} over={over} />
    </span>
  )
}

function BacklogRail({ doc, t, canRun, dispatch, base }) {
  const p = progress(doc)
  if (!doc.stories.length) return null
  return (
    <aside className="es-rail" aria-label={t.tabs.backlog}>
      <div className="es-rail-head">
        <h2>{t.tabs.backlog}</h2>
        <a className="link-btn small" href={`#/${base}/${doc.id}/backlog`}>{fill(t.progressLine, { d: p.handled, t: p.total })}</a>
      </div>
      <CapacityLine doc={doc} t={t} p={p} />
      <ol className="es-rail-list">
        {doc.stories.map(s => {
          const st = statusOf(s)
          const cur = s.id === doc.currentId
          return (
            <li key={s.id} className={`${cur ? 'cur' : ''} st-${st}`}>
              <button className="es-rail-btn" disabled={!canRun || cur} onClick={() => dispatch({ type: 'SELECT_STORY', storyId: s.id })} aria-current={cur ? 'true' : undefined}>
                {s.key && <span className="es-key">{s.key}</span>}<span className="es-rail-title">{s.title}</span>
              </button>
              <StatusBadge s={s} t={t} cur={cur} doc={doc} />
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function StatusBadge({ s, t, cur, doc }) {
  const st = statusOf(s)
  const kids = doc ? doc.stories.filter(x => x.parentId === s.id).length : 0
  if (st === 'split' && kids) return <span className="es-flag" title={t.st.splitInto(doc.stories.filter(x => x.parentId === s.id).map(c => c.key || c.title).join(', '))}>{t.splitShort(kids)}</span>
  if (st === 'done') return <span className="es-est" title={t.st.done}>{s.estimate}</span>
  if (st === 'skipped') return <span className="es-flag" title={t.st.skipped}>{t.st.skipped}</span>
  if (st === 'split') return <span className="es-flag warn" title={t.st.split}>{t.st.split}</span>
  if (cur) return <span className="es-now">{t.now}</span>
  return null
}

// ---------- backlog ----------

function BacklogView(ctx) {
  const { doc, me, t, canRun, dispatch, base, show, askSplit } = ctx
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null)
  const items = useMemo(() => parseBacklog(text), [text])
  const p = progress(doc)
  const deck = deckOf(doc)
  const asyncOn = !!doc.settings.async
  const add = e => {
    e.preventDefault()
    if (items.length) dispatch({ type: 'ADD_STORIES', items })
    setText('')
    setAdding(false)
  }
  const remove = s => {
    const index = doc.stories.indexOf(s)
    dispatch({ type: 'REMOVE_STORY', storyId: s.id })
    show(t.storyRemoved, () => dispatch({ type: 'RESTORE_STORY', story: s, index }))
  }
  const estimateNow = s => {
    dispatch({ type: 'SELECT_STORY', storyId: s.id })
    if (stageOf(doc) !== 'estimate') dispatch({ type: 'STAGE', stage: 'estimate' })
    navigate(`/${base}/${doc.id}/estimate`)
  }
  return (
    <div className="es-body">
      <Banners {...ctx} />
      <section className="tool-card es-backlog">
        <div className="es-backlog-head">
          <div>
            <h2>{t.backlog}</h2>
            <span className="muted small">{fill(t.progressLine, { d: p.handled, t: p.total })}</span>
          </div>
          <CapacityLine doc={doc} t={t} p={p} />
          {canRun && <button className="btn ghost sm" onClick={() => setAdding(a => !a)} aria-expanded={adding}><Icon name="plus" /> {t.addStories}</button>}
        </div>
        {asyncOn && doc.stories.some(isOpen) && <p className="es-ahead-hint muted small"><Icon name="info" size={14} /> {t.voteAheadHint}</p>}
        {adding && (
          <form className="es-add" onSubmit={add}>
            <textarea autoFocus rows={5} value={text} onChange={e => setText(e.target.value)} placeholder={t.backlogPh} aria-label={t.addStories} spellCheck={false}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e); if (e.key === 'Escape') setAdding(false) }} />
            <div className="row end">
              <span className="muted small grow">{items.length ? t.parsed(items.length) : t.backlogHint}</span>
              <button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>{t.cancel}</button>
              <button className="btn primary sm" disabled={!items.length}>{t.add}</button>
            </div>
          </form>
        )}
        {doc.stories.length === 0 && !adding ? (
          <div className="es-empty">
            <Icon name="agenda" size={28} />
            <div><b>{t.emptyBacklog}</b><p className="muted">{canRun ? t.emptyBacklogHost : t.emptyBacklogGuest}</p>
              {canRun && <button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" /> {t.addStories}</button>}
            </div>
          </div>
        ) : (
          <ol className="es-blist">
            {doc.stories.map((s, i) => {
              const st = statusOf(s)
              const cur = s.id === doc.currentId && stageOf(doc) === 'estimate'
              const pre = Object.keys(s.pre ?? {}).length
              return (
                <li key={s.id} className={`es-brow st-${st} ${cur ? 'cur' : ''}`}>
                  <span className="es-bnum">{i + 1}</span>
                  <div className="es-bmain">
                    <span className="es-btitle">{s.key && <span className="es-key">{s.key}</span>}{s.link && /^https?:/i.test(s.link) ? <a href={s.link} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}</span>
                    <span className="es-bmeta muted small">
                      {(st === 'open' || s.rounds > 0) && <span>{[st === 'open' ? t.st.open : null, s.rounds ? t.rounds(s.rounds) : null].filter(Boolean).join(' · ')}</span>}
                      {pre > 0 && st === 'open' && <span>{t.ahead(pre)}</span>}
                      {s.notes && <span className="ellipsis es-bnotes">{s.notes}</span>}
                    </span>
                  </div>
                  {asyncOn && st === 'open' && !cur && doc.people[me]?.role === 'voter' && (
                    <label className="es-pre">
                      <span className="sr-only">{t.voteAhead}: {s.title}</span>
                      <select value={s.pre?.[me] ?? ''} onChange={e => dispatch({ type: 'PREVOTE', storyId: s.id, pid: me, value: e.target.value || null })} className={s.pre?.[me] ? 'set' : ''}>
                        <option value="">{t.voteAhead}</option>
                        {deck.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                  )}
                  <StatusBadge s={s} t={t} cur={cur} doc={doc} />
                  {canRun && <RowMenu s={s} i={i} doc={doc} t={t} dispatch={dispatch} onEdit={() => setEditing(s)} onRemove={() => remove(s)} onEstimate={() => estimateNow(s)} onSplit={() => askSplit(s)} />}
                </li>
              )
            })}
          </ol>
        )}
      </section>
      {editing && <EditStory story={doc.stories.find(s => s.id === editing.id) ?? editing} deck={deck} t={t} dispatch={dispatch} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RowMenu({ s, i, doc, t, dispatch, onEdit, onRemove, onEstimate, onSplit }) {
  const [open, setOpen, ref] = useMenu()
  const st = statusOf(s)
  const item = (icon, label, fn, cls = '') => <button className={`menu-item ${cls}`} onClick={() => { fn(); setOpen(false) }}><Icon name={icon} /> {label}</button>
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn sm" aria-label={`${t.edit}: ${s.title}`} aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="more" /></button>
      {open && <div className="menu right">
        {st === 'open' && item('play', t.estimateThis, onEstimate)}
        {item('edit', t.edit, onEdit)}
        {i > 0 && item('up', t.up, () => dispatch({ type: 'MOVE_STORY', storyId: s.id, index: i - 1 }))}
        {i < doc.stories.length - 1 && item('down', t.down, () => dispatch({ type: 'MOVE_STORY', storyId: s.id, index: i + 1 }))}
        {st === 'open' ? <>
          {item('skip', t.skip, () => dispatch({ type: 'SKIP', storyId: s.id }))}
          {item('flag', t.split, onSplit)}
        </> : item('timer', t.reopen, () => dispatch({ type: 'REOPEN', storyId: s.id }))}
        {item('trash', t.delete, onRemove, 'danger')}
      </div>}
    </div>
  )
}

function EditStory({ story, deck, t, dispatch, onClose }) {
  const [v, setV] = useState({ key: story.key ?? '', title: story.title, link: story.link ?? '', notes: story.notes ?? '', estimate: statusOf(story) === 'done' ? story.estimate ?? '' : '' })
  const set = k => e => setV(x => ({ ...x, [k]: e.target.value }))
  const save = e => {
    e.preventDefault()
    if (!v.title.trim()) return
    const patch = { key: v.key.trim(), title: v.title.trim(), link: v.link.trim(), notes: v.notes }
    const was = statusOf(story) === 'done' ? story.estimate ?? '' : ''
    if (v.estimate !== was) patch.estimate = v.estimate || null
    dispatch({ type: 'EDIT_STORY', storyId: story.id, patch })
    onClose()
  }
  return (
    <Dialog label={t.edit} onClose={onClose}>
      <form onSubmit={save} className="es-edit">
        <h2>{t.edit}</h2>
        <div className="es-edit-row">
          <label><span className="field-label">{t.key}</span><input value={v.key} onChange={set('key')} maxLength={40} placeholder="ABC-123" /></label>
          <label><span className="field-label">{t.estimate}</span>
            <select value={v.estimate} onChange={set('estimate')}>
              <option value="">–</option>
              {deck.filter(x => x !== '☕').map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>
        <label><span className="field-label">{t.title}</span><input value={v.title} onChange={set('title')} maxLength={300} required /></label>
        <label><span className="field-label">{t.link}</span><input value={v.link} onChange={set('link')} maxLength={500} placeholder="https://" type="url" /></label>
        <label><span className="field-label">{t.notes}</span><textarea rows={3} value={v.notes} onChange={set('notes')} placeholder={t.notesPh} /></label>
        <div className="row end"><button type="button" className="btn ghost" onClick={onClose}>{t.cancel}</button><button className="btn primary" disabled={!v.title.trim()}>{t.save}</button></div>
      </form>
    </Dialog>
  )
}

// ---------- confidence ----------

function ballotId(docId) {
  const key = `lift-ballot-${docId}`
  try {
    let b = personalStorage().getItem(key)
    if (!b) { b = newBoardId(); personalStorage().setItem(key, b) }
    return b
  } catch { return newBoardId() }
}

function ConfidenceView({ doc, t, canRun, dispatch, base }) {
  const ballot = useMemo(() => ballotId(doc.id), [doc.id])
  const c = doc.confidence
  const p = progress(doc)
  const [editQ, setEditQ] = useState(false)
  const [q, setQ] = useState('')
  const res = c?.revealed ? confidenceTally(c) : null
  const celebrated = useRef(null)
  useEffect(() => {
    if (res?.verdict === 'go' && celebrated.current !== c.revealedAt) { celebrated.current = c.revealedAt; confetti(2000) }
  }, [res?.verdict, c?.revealedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const plan = p.numeric
    ? (p.capacity ? fill(t.confPlanCap, { p: p.points, c: p.capacity, n: p.done }) : fill(t.confPlan, { p: p.points, n: p.done }))
    : fill(t.confPlanSizes, { n: p.done })
  if (!c) return (
    <div className="es-body">
      <section className="tool-card es-finish">
        <span className="es-finish-ico"><Icon name="thumb" size={26} /></span>
        <h2>{t.confNotStarted}</h2>
        <p className="muted">{canRun ? t.confLead : t.confNotStartedHint}</p>
        {canRun && <button className="btn primary" onClick={() => dispatch({ type: 'STAGE', stage: 'confidence', question: t.confDefault })}><Icon name="thumb" /> {t.startConf}</button>}
      </section>
    </div>
  )
  const mine = c.ballots[ballot]?.v
  const n = Object.keys(c.ballots).length
  const prev = doc.confidenceHistory?.length ? confidenceTally(doc.confidenceHistory[doc.confidenceHistory.length - 1]) : null
  const max = res ? Math.max(1, ...Object.values(res.counts)) : 1
  const verdict = res?.verdict === 'stop' && res.low === 0 ? 'block' : res?.verdict
  return (
    <div className="es-body">
      <section className="tool-card es-conf">
        <span className="es-eyebrow">{t.confTitle}</span>
        {editQ ? (
          <form className="es-notes-form" onSubmit={e => { e.preventDefault(); dispatch({ type: 'CONF_QUESTION', question: q }); setEditQ(false) }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} maxLength={200} aria-label={t.editQuestion} onKeyDown={e => { if (e.key === 'Escape') setEditQ(false) }} />
            <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setEditQ(false)}>{t.cancel}</button><button className="btn ghost sm">{t.save}</button></div>
          </form>
        ) : (
          <h2 className="es-conf-q">{c.question || t.confDefault}{canRun && <button className="icon-btn sm" aria-label={t.editQuestion} title={t.editQuestion} onClick={() => { setQ(c.question || t.confDefault); setEditQ(true) }}><Icon name="edit" size={14} /></button>}</h2>
        )}
        <p className="muted">{plan} · <a href={`#/${base}/${doc.id}/summary`}>{t.toSummary}</a></p>
        {!res ? <>
          <div className="es-fist" role="radiogroup" aria-label={c.question || t.confDefault}>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <button key={v} role="radio" aria-checked={mine === v} className={`es-fist-btn ${mine === v ? 'sel' : ''}`} onClick={e => { if (mine !== v) sparkle(e.currentTarget); dispatch({ type: 'CONF_VOTE', ballot, v: mine === v ? null : v }) }}>
                <b>{v}</b><span>{t.fist[v]}</span>
              </button>
            ))}
          </div>
          <p className="muted small">{t.confYour}</p>
          <div className="es-conf-foot">
            <span className="muted" aria-live="polite">{t.confVoted(n)}</span>
            {canRun && <button className="btn primary" disabled={!n} onClick={() => dispatch({ type: 'CONF_REVEAL' })}><Icon name="eye" /> {t.confReveal}</button>}
          </div>
        </> : <>
          <div className="es-conf-res">
            <div className="es-conf-avg"><b>{res.average == null ? '–' : (Math.round(res.average * 10) / 10).toString()}</b><span>{t.average} · {t.confVoted(res.n)}</span></div>
            <div className="dist">
              {[5, 4, 3, 2, 1, 0].map(v => <div key={v} className="dist-row"><span className="dist-v">{v}</span><span className="dist-bar"><i style={{ width: `${(res.counts[v] / max) * 100}%` }} /></span><span className="dist-n">{res.counts[v]}</span></div>)}
            </div>
          </div>
          {verdict && <p className={`es-verdict ${verdict === 'go' ? 'good' : 'warn'}`}><Icon name={verdict === 'go' ? 'check' : 'flag'} size={18} /> {fill(t.verdict[verdict], { b: t.belowN(res.below) })}</p>}
          {prev && prev.average != null && <p className="muted small">{fill(t.previous, { a: (Math.round(prev.average * 10) / 10).toString() })}</p>}
          {canRun && <div className="es-conf-foot">
            <button className="btn ghost" onClick={() => dispatch({ type: 'CONF_ASK' })}>{t.confAgain}</button>
            {stageOf(doc) !== 'done' && <button className="btn primary" onClick={() => dispatch({ type: 'STAGE', stage: 'done' })}><Icon name="check" /> {t.finish}</button>}
          </div>}
        </>}
      </section>
    </div>
  )
}

export { CapacityLine, StatusBadge }

// Puts the session in one of the teams this browser knows (or takes it out of its team).
function TeamPicker({ doc, dispatch, t }) {
  const teams = rememberedDocs(TEAM_KIND)
  if (!teams.length && !doc.teamId) return null
  const pick = id => {
    const team = teams.find(x => x.id === id)
    if (doc.teamId && doc.teamId !== id) appendToTeam(doc.teamId, { type: 'SESSION_UNLINK', sessionId: doc.id }).catch(() => {})
    dispatch({ type: 'ATTACH_TEAM', teamId: team?.id ?? null, teamName: team?.name ?? null })
    if (team) appendToTeam(team.id, { type: 'SESSION_LINK', sessionId: doc.id, name: doc.name, base: doc.kind === 'poker' ? 'poker' : 's', createdAt: doc.createdAt }).catch(() => {})
  }
  return <>
    <div className="menu-title">{t.team}</div>
    <div className="menu-form plain es-cap-form">
      <select value={doc.teamId ?? ''} onChange={e => pick(e.target.value)} aria-label={t.team}>
        <option value="">{t.noTeam}</option>
        {doc.teamId && !teams.some(x => x.id === doc.teamId) && <option value={doc.teamId}>{doc.teamName || t.team}</option>}
        {teams.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </div>
  </>
}
