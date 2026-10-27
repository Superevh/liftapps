import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLiveDoc, backend } from '../core/live.js'
import { navigate } from '../core/ui.jsx'
import { QR } from '../core/qr.jsx'
import { useT } from './i18n.js'
import { Icon, Toaster, showToast, useNameGate, DraftInput, copyText } from './common.jsx'
import { useMeetings, createTeam, rememberedTeams, rememberTeam, forgetTeam } from './store.js'
import { reduceTeam } from './team.js'
import { status, todayStr } from './model.js'
import { MeetingList } from './Home.jsx'
import { ActionsBoard } from './ActionsPage.jsx'
import './meeting.css'

export const teamUrl = id => `${location.origin}${location.pathname}#/team/${id}`
// "New team meeting" hands the team to the new-meeting page through this tab's storage.
export const NEW_TEAM = 'meetinglift-new-team'

export function TeamHome() {
  const [t] = useT()
  const { identity } = useStore()
  const [gate, nameDialog] = useNameGate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState(rememberedTeams)
  const create = e => {
    e.preventDefault()
    if (!name.trim() || busy || !backend) return
    gate(async () => {
      setBusy(true)
      try { const team = await createTeam(name.trim(), identity); navigate(`/team/${team.id}`) } catch (err) { setBusy(false); showToast(err.message) }
    })
  }
  return (
    <main className="tool-page mt-page-narrow">
      <header className="mt-page-head">
        <div className="hero-eyebrow">MeetingLift</div>
        <h1>{t.teams}</h1>
        <p className="mt-lead">{t.teamLead}</p>
      </header>
      {!backend && <p className="tool-note small">{t.offline}</p>}
      <form className="tool-card mt-card" onSubmit={create}>
        <h2>{t.newTeam}</h2>
        <label className="field-label" htmlFor="tm-name">{t.teamName}</label>
        <div className="mt-inline-form">
          <input id="tm-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.teamNamePh} maxLength={60} />
          <button className="btn primary" disabled={!name.trim() || busy || !backend}><Icon name="plus" /> {t.createTeam}</button>
        </div>
      </form>
      <section className="tool-card mt-card">
        <h2>{t.teams}</h2>
        {list.length ? (
          <ul className="doc-list">
            {list.map(x => (
              <li key={x.id}>
                <span className="doc-ico"><Icon name="users" size={16} /></span>
                <a className="grow" href={`#/team/${x.id}`}><b>{x.name}</b></a>
                <button className="icon-btn" aria-label={`${t.forget}: ${x.name}`} title={t.forget} onClick={() => { forgetTeam(x.id); setList(rememberedTeams()) }}><Icon name="x" size={14} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="muted mt-empty-line">{t.teamsEmpty}</p>}
      </section>
      {nameDialog}
      <Toaster />
    </main>
  )
}

export function TeamRoom({ id }) {
  const [t, lang] = useT()
  const { identity } = useStore()
  const { status: st, doc: team, dispatch } = useLiveDoc(id, reduceTeam)
  const act = a => dispatch({ ...a, pid: identity.id })
  const ids = useMemo(() => Object.keys(team?.meetings ?? {}).sort(), [team?.meetings])
  const idsKey = ids.join(',')
  const m = useMeetings(() => ids)
  useEffect(() => { if (team) m.reload() }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (team) { rememberTeam(team); document.title = `${team.name} · MeetingLift` } }, [team?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  const meKey = `meetinglift-me:${id}`
  const [me, setMe] = useState(() => { try { return localStorage.getItem(meKey) ?? '' } catch { return '' } })
  const chooseMe = v => { setMe(v); try { localStorage.setItem(meKey, v) } catch { /* storage blocked */ } }
  const [member, setMember] = useState('')
  const today = todayStr()
  // Everyone who appears in the team's meetings (attendees, action owners) is a member, so anyone
  // can find themselves under "I am". Names are compared without case; missing ones are added once.
  const seen = useMemo(() => {
    const out = new Map()
    const add = n => { const k = (n ?? '').trim(); if (k && !out.has(k.toLowerCase())) out.set(k.toLowerCase(), k) }
    for (const n of team?.members ?? []) add(n)
    for (const d of m.docs) { d.attendees.forEach(add); d.actions.forEach(a => add(a.owner)) }
    if (identity.name) add(identity.name)
    return [...out.values()]
  }, [team?.members, m.docs, identity.name])
  const added = useRef('')
  useEffect(() => {
    if (!team || m.status !== 'ready') return
    const have = new Set(team.members.map(n => n.toLowerCase()))
    const missing = seen.filter(n => !have.has(n.toLowerCase()) && n !== identity.name)
    const key = missing.join('|')
    if (!missing.length || added.current === key) return
    added.current = key
    act({ type: 'MEMBER_ADD', names: missing })
  }, [seen, team?.members, m.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (st !== 'ready') {
    return (
      <main className="tool-page">
        <div className="empty-page">
          {st === 'loading' ? <span className="spinner" aria-hidden="true" /> : <><Icon name="users" size={30} /><h2>{t.teamMissing}</h2><a className="btn primary" href="#/team">{t.teams}</a></>}
        </div>
      </main>
    )
  }
  const docs = m.docs
  const groups = { live: [], upcoming: [], recent: [] }
  for (const d of docs) { const s = status(d, today); (s === 'live' ? groups.live : s === 'planned' ? groups.upcoming : groups.recent).push(d) }
  const key = d => `${d.date || '9999'} ${d.time || '99:99'}`
  groups.upcoming.sort((a, b) => key(a).localeCompare(key(b)))
  groups.recent.sort((a, b) => key(b).localeCompare(key(a)))
  const url = teamUrl(id)
  const newMeeting = () => { try { sessionStorage.setItem(NEW_TEAM, JSON.stringify({ id, name: team.name })) } catch { /* storage blocked */ } navigate('/m/new') }
  const people = [...seen].sort((a, b) => a.localeCompare(b))
  const addMember = e => { e.preventDefault(); const names = member.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean); if (names.length) act({ type: 'MEMBER_ADD', names }); setMember('') }

  return (
    <main className="tool-page mt-team">
      <a className="mt-back" href="#/team"><Icon name="left" size={14} /> {t.teams}</a>
      <header className="mt-team-head">
        <div className="grow">
          <div className="hero-eyebrow">{t.team}</div>
          <DraftInput className="mt-title-input" value={team.name} onSave={v => v.trim() && act({ type: 'RENAME', name: v })} aria-label={t.teamName} maxLength={60} />
        </div>
        <button className="btn primary" onClick={newMeeting}><Icon name="plus" /> {t.newTeamMeeting}</button>
      </header>
      <div className="mt-home-grid">
        <div className="mt-col">
          {groups.live.length > 0 && <MeetingList title={t.liveNow} docs={groups.live} t={t} lang={lang} today={today} live />}
          <MeetingList title={t.upcoming} docs={groups.upcoming} t={t} lang={lang} today={today} empty={ids.length ? t.noUpcoming : t.noTeamMeetings} />
          {groups.recent.length > 0 && <MeetingList title={t.recent} docs={groups.recent.slice(0, 10)} t={t} lang={lang} today={today} />}
          <section className="mt-team-actions">
            <div className="mt-card-head">
              <h2 className="mt-section-h"><Icon name="action" size={18} /> {t.teamActions}</h2>
              <label className="mt-iam"><span>{t.iAm}</span>
                <select value={me} onChange={e => chooseMe(e.target.value)} aria-label={t.iAm}>
                  <option value="">—</option>
                  {people.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <ActionsBoard {...m} members={team.members} me={me} onMe={() => showToast(t.pickMe)} emptyCta={false} />
          </section>
        </div>
        <aside className="mt-col">
          <section className="tool-card mt-card">
            <div className="mt-card-head"><h2><Icon name="link" size={18} /> {t.teamLink}</h2></div>
            <p className="muted small">{t.teamInvite}</p>
            <div className="mt-inline-form"><input readOnly value={url} onFocus={e => e.target.select()} aria-label={t.teamLink} /><button className="btn ghost sm" onClick={() => copyText(url, { ...t, copied: t.linkCopied })}>{t.copyLink}</button></div>
            <div className="invite-qr"><QR text={url} size={120} /></div>
          </section>
          <section className="tool-card mt-card">
            <div className="mt-card-head"><h2><Icon name="users" size={18} /> {t.members}</h2><span className="mt-count">{team.members.length}</span></div>
            <div className="mt-attendees">
              {team.members.map(n => <span key={n} className="mt-attendee">{n}<button className="mt-attendee-x" aria-label={`${t.remove}: ${n}`} onClick={() => { act({ type: 'MEMBER_REMOVE', name: n }); showToast(t.removed, () => act({ type: 'MEMBER_ADD', names: [n] })) }}><Icon name="x" size={12} /></button></span>)}
            </div>
            <form className="mt-inline-form" onSubmit={addMember}>
              <input value={member} onChange={e => setMember(e.target.value)} placeholder={t.addAttendeePh} aria-label={t.addAttendee} maxLength={300} />
              <button className="btn ghost sm" disabled={!member.trim()}><Icon name="plus" size={14} /> {t.add}</button>
            </form>
            <p className="muted small mt-hint">{t.membersHint}</p>
          </section>
        </aside>
      </div>
      <Toaster />
    </main>
  )
}
