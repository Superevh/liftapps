import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { Avatar, navigate, useClickOutside } from '../core/ui.jsx'
import { backend, rememberedDocs, rememberDoc, forgetDoc, createDoc, newDocId } from '../core/live.js'
import { ago } from '../core/tools-ui.jsx'
import { T, fill } from './i18n.js'
import { KIND, POKER_KIND, newSession, parseBacklog, progress, reduce, stageOf, sessionStats } from './model.js'
import { Toast, useToast } from './bits.jsx'
import { History } from './History.jsx'
import { TEAM_KIND, newTeam, appendToTeam } from './team.js'
import './estimate.css'

// EstimateLift: the shell and home. The product is the estimation session (Session.jsx); the older
// stand-alone tools (silent sizing, confidence vote, function points) and the methods guide live
// under "Methods & tools" and keep their own routes, so links already shared still open.

const NewSession = lazy(() => import('./NewSession.jsx'))
const Session = lazy(() => import('./Session.jsx'))
const Methods = lazy(() => import('./Methods.jsx'))
const TeamPage = lazy(() => import('./Team.jsx'))
const pick = (load, name) => lazy(() => load().then(m => ({ default: m[name] })))
const sizing = () => import('../sizing/Sizing.jsx')
const confidence = () => import('../confidence/Confidence.jsx')
const fpa = () => import('../fpa/FunctionPoints.jsx')
const LEGACY = {
  sizing: { Home: pick(sizing, 'SizingHome'), Room: pick(sizing, 'SizingBoard'), named: true },
  confidence: { Home: pick(confidence, 'ConfidenceHome'), Room: pick(confidence, 'ConfidenceVote'), named: true },
  fpa: { Home: pick(fpa, 'FpaHome'), Room: pick(fpa, 'FpaRoom') },
}

function parse() {
  const [, view, id, sub] = window.location.hash.replace(/^#/, '').split('/')
  return { view: view || 'home', id, sub }
}

function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [route.view, route.id])
  return route
}

// The list entry kept in localStorage, so the home page can show progress without loading anything.
export function entryOf(doc) {
  const p = progress(doc)
  const st = sessionStats(doc)
  return { id: doc.id, name: doc.name, at: doc.createdAt, seen: Date.now(), stage: stageOf(doc), total: p.total, handled: p.handled, done: p.done, points: p.points, numeric: p.numeric, capacity: p.capacity, rounds: st.rounds, rps: st.roundsPerStory, consensus: st.consensus, teamId: doc.teamId ?? null, teamName: doc.teamName ?? null }
}

export async function createSession({ identity, name, deck, customDeck, capacity, async, items, team }) {
  const id = newDocId('es')
  const owner = { id: identity.id, name: identity.name || '', color: identity.color }
  let doc = newSession({ id, name, deck, customDeck, capacity, async, items, owner, at: Date.now() })
  if (team) doc = reduce(doc, { type: 'ATTACH_TEAM', teamId: team.id, teamName: team.name, nonce: 't0', at: doc.createdAt })
  await createDoc(id, doc, identity.secret)
  if (team) await appendToTeam(team.id, { type: 'SESSION_LINK', sessionId: id, name: doc.name, base: 's', createdAt: doc.createdAt }).catch(() => { /* the session records itself in the team when it finishes */ })
  rememberDoc(KIND, entryOf(doc))
  navigate(`/s/${id}`)
}

function Identity() {
  const { identity, rename } = useStore()
  const t = T[useLang()]
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(identity.name)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])
  const p = { ...identity, name: identity.name || t.guest }
  const submit = e => { e.preventDefault(); if (name.trim()) { rename(name); setOpen(false) } }
  return (
    <div className="dropdown" ref={ref}>
      <button className="participant-btn" onClick={() => { setName(identity.name); setOpen(o => !o) }} aria-label={`${t.yourName}: ${p.name}`} aria-expanded={open}>
        <Avatar p={p} size={26} /> <span className="pname">{p.name}</span> <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="menu right">
          <div className="menu-title">{t.yourName}</div>
          <form className="menu-form" onSubmit={submit}>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label={t.yourName} maxLength={40} placeholder={t.namePh} />
            <button className="btn primary sm" disabled={!name.trim()}>{t.save}</button>
          </form>
          <p className="menu-hint">{t.nameHint}</p>
        </div>
      )}
    </div>
  )
}

function Loading() {
  return <div className="empty-page"><span className="spinner" aria-hidden="true" /></div>
}

// The older tools join a room only once you have a name. Ask inline, never in a modal.
function NameBanner() {
  const { identity, rename } = useStore()
  const t = T[useLang()]
  const [name, setName] = useState('')
  if (identity.name) return null
  return (
    <form className="es-name-banner" onSubmit={e => { e.preventDefault(); if (name.trim()) rename(name) }}>
      <span>{t.nameBanner}</span>
      <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t.namePh} aria-label={t.yourName} />
      <button className="btn primary sm" disabled={!name.trim()}>{t.joinBtn}</button>
    </form>
  )
}

export default function App() {
  const lang = useLang()
  const t = T[lang]
  const route = useRoute()
  const legacy = LEGACY[route.view]
  const inMethods = route.view === 'methods' || !!legacy
  const isSession = route.view === 's' || route.view === 'poker'
  let page
  if (isSession && route.id) page = <Session key={route.id} id={route.id} base={route.view} sub={route.sub} />
  else if (route.view === 'new' || route.view === 'poker') page = <NewSession template={route.id} teamId={route.sub} />
  else if (route.view === 't' && route.id) page = <TeamPage key={route.id} id={route.id} />
  else if (route.view === 'methods') page = <Methods focus={route.id} />
  else if (legacy) page = route.id ? <>{legacy.named && backend && <NameBanner />}<legacy.Room key={route.id} id={route.id} sub={route.sub} /></> : <legacy.Home />
  else page = <Home />
  useEffect(() => {
    document.title = route.view === 'methods' || legacy ? `${t.methods} · EstimateLift · Lift Apps` : 'EstimateLift · Lift Apps'
  }, [route.view, legacy, t.methods])
  return (
    <div className="app es-app">
      <nav className="subnav no-print" aria-label="EstimateLift">
        <div className="subnav-tabs">
          <a className={`top-link ${!inMethods ? 'on' : ''}`} href="#/" aria-label={t.sessions} aria-current={!inMethods ? 'page' : undefined}><Icon name="cards" size={16} /><span className="lbl">{t.sessions}</span></a>
          <a className={`top-link ${inMethods ? 'on' : ''}`} href="#/methods" aria-label={t.methods} aria-current={inMethods ? 'page' : undefined}><Icon name="compass" size={16} /><span className="lbl">{t.methods}</span></a>
        </div>
        <Identity />
      </nav>
      <Suspense fallback={<Loading />}>{page}</Suspense>
      <footer className="site-foot no-print"><a href="https://liftapps.com.au">{t.foot}</a></footer>
    </div>
  )
}

// ---------- home ----------

function loadList() {
  const mine = rememberedDocs(KIND).map(e => ({ ...e, kind: KIND }))
  const rooms = rememberedDocs(POKER_KIND).map(e => ({ ...e, kind: POKER_KIND }))
  return [...mine, ...rooms].sort((a, b) => (b.seen ?? b.at ?? 0) - (a.seen ?? a.at ?? 0))
}

// Refreshes the cached progress of each listed session from the server (snapshot + newer events).
export function useFresh(list) {
  const [fresh, setFresh] = useState({})
  const ids = list.slice(0, 30).map(x => x.id).join(',')
  useEffect(() => {
    if (!backend || !ids) return
    let live = true
    backend.getBoards(ids.split(',')).then(rows => {
      if (!live) return
      const out = {}
      for (const r of rows) {
        try {
          const doc = r.events.reduce((d, e) => reduce(d, e.action), r.snapshot)
          out[r.id] = { ...entryOf(doc), seen: undefined, people: Object.values(doc.people).filter(p => !p.left).length, ownerId: doc.ownerId, creatorId: doc.creatorId ?? doc.ownerId }
        } catch { /* a document we can't read: keep the cached line */ }
      }
      setFresh(out)
    }).catch(() => {})
    return () => { live = false }
  }, [ids])
  return fresh
}

function Home() {
  const lang = useLang()
  const t = T[lang]
  const { identity } = useStore()
  const [list, setList] = useState(loadList)
  const fresh = useFresh(list)
  const [toast, show] = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const items = list.map(e => ({ ...e, ...(fresh[e.id] ?? {}), seen: e.seen ?? e.at }))
  const active = items.filter(x => (x.stage ?? 'estimate') !== 'done')
  const done = items.filter(x => x.stage === 'done')

  const remove = e => {
    forgetDoc(e.kind, e.id)
    setList(loadList())
    const { kind, ...entry } = e
    show(fill(t.removed, { name: e.name }), () => { rememberDoc(kind, entry); setList(loadList()) })
  }
  const sample = () => {
    setBusy(true)
    createSession({ identity, name: t.sampleName, deck: 'fib', capacity: 30, async: true, items: parseBacklog(t.sampleStories.join('\n')) })
      .catch(err => { setBusy(false); setError(err.message) })
  }

  const cta = <>
    <div className="es-hero-cta">
      <a className={`btn primary lg ${backend ? '' : 'disabled'}`} href="#/new" aria-disabled={!backend}><Icon name="plus" /> {t.newSession}</a>
      <button className="btn ghost lg" onClick={sample} disabled={busy || !backend}>{t.sample}</button>
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {backend?.kind === 'mock' && <p className="es-note">{t.mock}</p>}
    {!backend && <p className="es-note">{t.noBackend}</p>}
  </>

  return (
    <main className="tool-page es-home">
      {items.length === 0 ? (
        <section className="es-hero">
          <div className="es-hero-text">
            <div className="hero-eyebrow">{t.heroEyebrow}</div>
            <h1>{t.heroTitle}</h1>
            <p className="es-lead">{t.heroLead}</p>
            {cta}
          </div>
          <HeroArt />
        </section>
      ) : (
        <section className="es-top">
          <div><div className="hero-eyebrow">{t.heroEyebrow}</div><h1>{t.yourSessions}</h1></div>
          {cta}
        </section>
      )}

      <section className="es-section" aria-labelledby="es-sessions">
        <div className="es-section-head">
          <h2 id="es-sessions" className={items.length ? 'sr-only' : ''}>{t.yourSessions}</h2>
          <JoinLink t={t} />
        </div>
        {items.length === 0 ? (
          <div className="es-empty">
            <Icon name="cards" size={28} />
            <div><b>{t.noSessions}</b><p className="muted">{t.noSessionsHint}</p></div>
          </div>
        ) : <>
          {active.length > 0 && <SessionGrid label={done.length ? t.inProgress : null} items={active} t={t} lang={lang} onRemove={remove} />}
          {done.length > 0 && <SessionGrid label={t.finished} items={done} t={t} lang={lang} onRemove={remove} />}
        </>}
      </section>

      <Teams t={t} lang={lang} show={show} />

      <History items={done.filter(e => !e.teamId).map(e => ({ ...e, href: e.kind === POKER_KIND ? `#/poker/${e.id}` : `#/s/${e.id}` }))} t={t} lang={lang} lead={t.histLead} />

      <section className="es-section" aria-labelledby="es-tpl">
        <div className="es-section-head"><h2 id="es-tpl">{t.templates}</h2></div>
        <div className="es-tpl-grid">
          {Object.entries(t.tpl).map(([k, [name, line]]) => (
            <a key={k} className="es-tpl" href={`#/new/${k}`}>
              <span className="es-tpl-ico"><Icon name={{ sprint: 'target', refine: 'layers', roadmap: 'grid', quick: 'bolt' }[k]} size={20} /></span>
              <b>{name}</b>
              <span className="muted">{line}</span>
            </a>
          ))}
        </div>
      </section>

      {items.length < 2 && <section className="es-section es-how" aria-labelledby="es-how">
        <h2 id="es-how">{t.howTitle}</h2>
        <ol>
          {t.how.map(([title, text], i) => <li key={i}><span className="es-step">{i + 1}</span><div><b>{title}</b><p className="muted">{text}</p></div></li>)}
        </ol>
      </section>}

      <section className="es-section" aria-labelledby="es-tools">
        <div className="es-section-head">
          <div><h2 id="es-tools">{t.toolsTitle}</h2><p className="muted es-sub">{t.toolsLead}</p></div>
        </div>
        <div className="es-tools">
          {[['guide', 'compass', '#/methods'], ['pert', 'chart', '#/methods/pert'], ['sizing', 'grid', '#/sizing'], ['confidence', 'thumb', '#/confidence'], ['fpa', 'layers', '#/fpa']].map(([k, icon, href]) => (
            <a key={k} className="es-tool" href={href}>
              <Icon name={icon} size={18} />
              <span><b>{t.tools[k][0]}</b><span className="muted small">{t.tools[k][1]}</span></span>
            </a>
          ))}
        </div>
      </section>
      <Toast toast={toast} t={t} />
    </main>
  )
}

function SessionGrid({ label, items, t, lang, onRemove }) {
  return (
    <>
      {label && <h3 className="es-group">{label}</h3>}
      <ul className="es-cards">
        {items.map(e => {
          const stage = e.stage ?? 'estimate'
          const pct = e.total ? Math.round(((e.handled ?? e.done ?? 0) / e.total) * 100) : 0
          const href = e.kind === POKER_KIND ? `#/poker/${e.id}` : `#/s/${e.id}`
          return (
            <li key={e.id} className="es-card">
              <a href={href} className="es-card-link">
                <span className="es-card-top"><span className={`es-chip st-${stage}`}>{t.stage[stage]}</span><span className="muted small">{fill(t.opened, { d: ago(e.seen ?? e.at, lang) })}</span></span>
                <b className="es-card-name">{e.name}</b>
                <span className="es-card-meta muted small">
                  {e.total != null && <span>{t.storiesN(e.total)}</span>}
                  {e.numeric !== false && e.points != null && e.done > 0 && <span>{e.capacity ? fill(t.capFit, { p: e.points, c: e.capacity }) : `${e.points} ${t.pts}`}</span>}
                  {e.total > 0 && <span>{fill(t.ofDone, { d: e.handled ?? e.done ?? 0, t: e.total })}</span>}
                </span>
                {e.total > 0 && <span className="es-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
              </a>
              <button className="icon-btn sm es-card-x" aria-label={`${t.remove}: ${e.name}`} title={t.remove} onClick={() => onRemove(e)}><Icon name="x" size={14} /></button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function JoinLink({ t }) {
  const [v, setV] = useState('')
  const [bad, setBad] = useState(false)
  const go = e => {
    e.preventDefault()
    const m = v.match(/#\/(s|poker|sizing|confidence|fpa)\/([a-z0-9]+)/i) ?? v.trim().match(/^()(lf[a-z0-9]{18})$/i)
    if (!m) { setBad(true); return }
    navigate(`/${m[1] || 's'}/${m[2]}`)
  }
  return (
    <form className="es-join" onSubmit={go}>
      <label className="sr-only" htmlFor="es-join">{t.joinTitle}</label>
      <input id="es-join" value={v} onChange={e => { setV(e.target.value); setBad(false) }} placeholder={t.joinPh} aria-invalid={bad} aria-describedby={bad ? 'es-join-err' : undefined} />
      <button className="btn ghost sm" disabled={!v.trim()}>{t.join}</button>
      {bad && <span id="es-join-err" className="es-join-err" role="alert">{t.badLink}</span>}
    </form>
  )
}

// A small, static picture of a revealed round: the product at a glance.
function HeroArt() {
  return (
    <div className="es-hero-art theme-classic" aria-hidden="true">
      <div className="es-art-story"><span className="es-key">SHOP-204</span><span className="es-art-line" /><span className="es-art-line short" /></div>
      <div className="es-art-cards">
        {['5', '5', '8', '5', '3'].map((v, i) => <span key={i} className="pcard face" style={{ '--i': i }}><b>{v}</b></span>)}
      </div>
      <div className="es-art-dist">
        {[['3', 1], ['5', 3], ['8', 1]].map(([v, n]) => <span key={v} className="es-art-row"><b>{v}</b><i style={{ width: `${n * 30}%` }} /></span>)}
      </div>
    </div>
  )
}

// ---------- teams on the home page ----------

function Teams({ t, lang, show }) {
  const { identity } = useStore()
  const [list, setList] = useState(() => rememberedDocs(TEAM_KIND))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async e => {
    e.preventDefault()
    if (!name.trim() || !backend) return
    setBusy(true)
    const id = newDocId('et')
    const team = newTeam({ id, name: name.trim(), owner: identity, at: Date.now() })
    try {
      await createDoc(id, team, identity.secret)
      rememberDoc(TEAM_KIND, { id, name: team.name, at: team.createdAt })
      navigate(`/t/${id}`)
    } catch { setBusy(false) }
  }
  const remove = e => {
    forgetDoc(TEAM_KIND, e.id)
    setList(rememberedDocs(TEAM_KIND))
    show(fill(t.removed, { name: e.name }), () => { rememberDoc(TEAM_KIND, e); setList(rememberedDocs(TEAM_KIND)) })
  }
  return (
    <section className="es-section" aria-labelledby="es-teams">
      <div className="es-section-head">
        <div><h2 id="es-teams">{t.teams}</h2><p className="muted es-sub">{t.teamsLead}</p></div>
        {!adding && backend && <button className="btn ghost sm es-newteam" onClick={() => setAdding(true)}><Icon name="users" /> {t.newTeam}</button>}
      </div>
      {adding && (
        <form className="es-team-form tool-card" onSubmit={create}>
          <label className="field-label" htmlFor="es-team-name">{t.teamName}</label>
          <div className="es-inline">
            <input id="es-team-name" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder={t.teamNamePh} onKeyDown={e => { if (e.key === 'Escape') setAdding(false) }} />
            <button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>{t.cancel}</button>
            <button className="btn primary sm" disabled={!name.trim() || busy}>{t.createTeam}</button>
          </div>
          <p className="muted small es-hint">{t.teamHint}</p>
        </form>
      )}
      {list.length > 0 && (
        <ul className="es-cards es-team-cards">
          {list.map(e => (
            <li key={e.id} className="es-card">
              <a href={`#/t/${e.id}`} className="es-card-link">
                <span className="es-card-top"><span className="es-chip"><Icon name="users" size={13} /> {t.team}</span><span className="muted small">{fill(t.opened, { d: ago(e.seen ?? e.at, lang) })}</span></span>
                <b className="es-card-name">{e.name}</b>
                {e.count != null && <span className="es-card-meta muted small"><span>{t.storiesSessions(e.count)}</span>{e.velocity != null && <span>{fill(t.teamVelocity, { p: e.velocity })}</span>}</span>}
              </a>
              <button className="icon-btn sm es-card-x" aria-label={`${t.remove}: ${e.name}`} title={t.remove} onClick={() => remove(e)}><Icon name="x" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
