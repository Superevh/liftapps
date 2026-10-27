import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, useClickOutside } from '../core/ui.jsx'
import { useLiveDoc, deleteDoc, rememberDoc, forgetDoc } from '../core/live.js'
import { ago } from '../core/tools-ui.jsx'
import { T, fill } from './i18n.js'
import { TEAM_KIND, reduceTeam } from './team.js'
import { History } from './History.jsx'
import { useFresh } from './App.jsx'
import { Invite, Toast, useToast } from './bits.jsx'

// A team space: every session linked to the team, live progress for the ones still running, and
// the history of finished ones (recorded in the team document, so it's the same on any device).

export default function TeamPage({ id }) {
  const lang = useLang()
  const t = T[lang]
  const { identity } = useStore()
  const { status, doc: team, dispatch } = useLiveDoc(id, reduceTeam)
  const [toast, show, hide] = useToast()
  const sessions = useMemo(() => Object.values(team?.sessions ?? {}).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [team])
  const fresh = useFresh(sessions)
  const items = sessions.map(s => {
    const f = fresh[s.id]
    // Recorded stats win; a session finished before it was recorded falls back to its live summary.
    const st = s.stats ?? (f?.stage === 'done' ? f : null)
    return { ...s, live: f, stats: st, href: `#/${s.base ?? 's'}/${s.id}` }
  })
  const finished = items.filter(x => x.stats).map(x => ({ ...x.stats, id: x.id, name: x.live?.name ?? x.name, at: x.stats.finishedAt ?? x.createdAt, href: x.href }))

  useEffect(() => {
    if (!team) return
    const pts = finished.filter(x => x.numeric !== false && x.done > 0).map(x => x.points ?? 0)
    rememberDoc(TEAM_KIND, { id, name: team.name, at: team.createdAt, seen: Date.now(), count: sessions.length, velocity: pts.length ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10 : null })
  }, [team?.name, sessions.length, finished.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (team?.name) document.title = `${team.name} · EstimateLift` }, [team?.name])

  if (status === 'loading') return <div className="empty-page"><span className="spinner" aria-hidden="true" /><p className="muted">{t.loading}</p></div>
  if (status !== 'ready') return (
    <div className="empty-page"><h2>{t.teamMissing}</h2><p className="muted">{t.missingHint}</p><a className="btn ghost" href="#/"><Icon name="left" /> {t.allSessions}</a></div>
  )
  const url = `${window.location.origin}${window.location.pathname}#/t/${id}`
  const unlink = s => {
    dispatch({ type: 'SESSION_UNLINK', sessionId: s.id })
    show(fill(t.removed, { name: s.name }), () => {
      dispatch({ type: 'SESSION_LINK', sessionId: s.id, name: s.name, base: s.base, createdAt: s.createdAt })
      if (s.stats && team.sessions[s.id]?.stats) dispatch({ type: 'SESSION_RECORD', sessionId: s.id, name: s.name, stats: team.sessions[s.id].stats })
    })
  }
  return (
    <main className="tool-page es-teampage">
      <div className="es-page-head es-team-head">
        <a className="icon-btn" href="#/" aria-label={t.sessions} title={t.sessions}><Icon name="left" /></a>
        <div className="grow">
          <span className="es-eyebrow">{t.team}</span>
          <TeamTitle team={team} dispatch={dispatch} t={t} />
          <p className="muted">{t.teamPageLead}</p>
        </div>
        <div className="es-team-actions">
          <Invite url={url} t={{ ...t, inviteHint: t.teamInviteHint }} />
          <TeamMenu team={team} identity={identity} t={t} />
        </div>
      </div>
      <div className="es-hero-cta es-team-cta">
        <a className="btn primary" href={`#/new/sprint/${id}`}><Icon name="plus" /> {t.newTeamSession}</a>
      </div>
      <History items={finished} t={t} lang={lang} lead={t.teamHistLead} title={t.histTitle} />
      <section className="es-section" aria-labelledby="es-team-sessions">
        <div className="es-section-head"><h2 id="es-team-sessions">{t.sessions}</h2></div>
        {items.length === 0 ? (
          <div className="es-empty"><Icon name="cards" size={28} /><div><b>{t.teamEmpty}</b><p className="muted">{t.teamEmptyHint}</p></div></div>
        ) : (
          <ul className="es-cards">
            {items.map(s => {
              const stage = s.stats ? 'done' : s.live?.stage ?? 'estimate'
              const e = s.stats ?? s.live ?? {}
              const pct = e.total ? Math.round(((e.handled ?? e.done ?? 0) / e.total) * 100) : 0
              return (
                <li key={s.id} className="es-card">
                  <a href={s.href} className="es-card-link">
                    <span className="es-card-top"><span className={`es-chip st-${stage}`}>{t.stage[stage]}</span><span className="muted small">{ago(s.createdAt ?? Date.now(), lang)}</span></span>
                    <b className="es-card-name">{s.live?.name ?? s.name}</b>
                    <span className="es-card-meta muted small">
                      {e.total != null && <span>{t.storiesN(e.total)}</span>}
                      {e.numeric !== false && e.done > 0 && <span>{e.capacity ? fill(t.capFit, { p: e.points, c: e.capacity }) : `${e.points} ${t.pts}`}</span>}
                    </span>
                    {e.total > 0 && <span className="es-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
                  </a>
                  {(team.ownerId === identity.id || s.live?.ownerId === identity.id || s.live?.creatorId === identity.id) && <button className="icon-btn sm es-card-x" aria-label={`${t.unlink}: ${s.name}`} title={t.unlink} onClick={() => unlink(s)}><Icon name="x" size={14} /></button>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <Toast toast={toast} t={t} onHide={hide} />
    </main>
  )
}

function TeamTitle({ team, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  if (!editing) return <h1><button className="es-title-btn" onClick={() => { setName(team.name); setEditing(true) }} title={t.rename}>{team.name}</button></h1>
  const save = () => { if (name.trim() && name.trim() !== team.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function TeamMenu({ team, identity, t }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  useEffect(() => {
    if (!open) return
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(team.id, identity.secret).finally(() => { forgetDoc(TEAM_KIND, team.id); navigate('/') })
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right">
        <button className="menu-item" onClick={() => { forgetDoc(TEAM_KIND, team.id); navigate('/') }}><Icon name="logout" /> {t.forgetTeam}</button>
        {team.ownerId === identity.id && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteTeam}</button>}
      </div>}
    </div>
  )
}
