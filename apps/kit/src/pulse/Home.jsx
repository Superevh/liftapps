import { useEffect, useMemo, useState } from 'react'
import { useStore, newBoardId } from '../core/store.jsx'
import { Icon } from '../core/icons.jsx'
import { navigate } from '../core/ui.jsx'
import { backend, rememberedDocs, rememberDoc, forgetDoc, createDoc, newDocId } from '../core/live.js'
import { HowTo } from '../core/tools-ui.jsx'
import { T } from './i18n.js'
import { checkName } from './model.js'
import { reduceTeam, reduceCheck, newTeam, cadence, pulseWeek, weekKey, summarizeSafe, overall, ballotCount, isComplete, actionState } from './model.js'
import { useT, fill, plural, TEAMS, CHECKS, loadDocs, rememberTeam, forgetTeam, showToast, postAction, Score, Spark, useNow, fmtDate, hostKeyFor, saveHostKey, sha256hex, AnonNote, Toast } from './bits.jsx'
import { CreateTeamModal, StartCheckModal } from './forms.jsx'
import './pulse.css'

export function PulseHome() {
  const [t, lang] = useT()
  const { identity } = useStore()
  const now = useNow()
  const [list, setList] = useState(() => rememberedDocs(TEAMS))
  const [teams, setTeams] = useState(null)
  const [failed, setFailed] = useState(false)
  const [modal, setModal] = useState(null)
  const [checks, setChecks] = useState(() => rememberedDocs(CHECKS).filter(c => !c.teamId))
  useEffect(() => { document.title = 'PulseLift · Lift Apps' }, [])
  useEffect(() => {
    let live = true
    if (!list.length) { setTeams([]); return }
    loadDocs(list.map(x => x.id), reduceTeam)
      .then(docs => { if (live) setTeams(docs.filter(d => d.kind === 'team')) })
      .catch(() => { if (live) { setTeams([]); setFailed(true) } })
    return () => { live = false }
  }, [list])
  const byId = useMemo(() => new Map((teams ?? []).map(d => [d.id, d])), [teams])
  const hosted = list.filter(e => byId.has(e.id) && hostKeyFor(e.id))
  const joined = list.filter(e => byId.has(e.id) && !hostKeyFor(e.id))
  const forget = e => {
    forgetTeam(e.id)
    setList(rememberedDocs(TEAMS))
    showToast(t.home.removed, () => { rememberDoc(TEAMS, e); setList(rememberedDocs(TEAMS)) })
  }
  const groups = useMemo(() => {
    const m = new Map()
    for (const c of checks) { const k = c.team || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(c) }
    return [...m.entries()]
  }, [checks])
  const empty = teams && !hosted.length && !joined.length
  return (
    <main className="tool-page pl-page pl-home">
      <section className={`pl-hero ${empty ? '' : 'compact'}`}>
        <div className="pl-hero-text">
          <div className="hero-eyebrow">{t.home.eyebrow}</div>
          <h1>{t.home.title}</h1>
          <p className="pl-lead">{t.home.lead}</p>
          <div className="pl-cta">
            <button className="btn primary lg" onClick={() => setModal('team')} disabled={!backend}><Icon name="plus" /> {t.home.create}</button>
            <button className="btn ghost lg" onClick={() => setModal('quick')} disabled={!backend}><Icon name="pulse" /> {t.home.quick}</button>
          </div>
          {!backend && <p className="pl-hint">{t.err.offline}</p>}
        </div>
        {empty && <HeroArt t={t} />}
      </section>

      {!teams && <p className="muted pl-loading"><span className="spinner sm" aria-hidden="true" /> {t.home.loading}</p>}
      {failed && <p className="tool-note small" role="alert">{t.home.unavailable}</p>}

      {hosted.length > 0 && <TeamSection title={t.home.yourTeams} entries={hosted} byId={byId} now={now} t={t} lang={lang} onForget={forget} me={identity.id} />}
      {joined.length > 0 && <TeamSection title={t.home.joined} entries={joined} byId={byId} now={now} t={t} lang={lang} onForget={forget} me={identity.id} />}

      {empty && (
        <section className="pl-steps" aria-label={t.home.none}>
          {t.home.steps.map(([title, text], i) => (
            <div key={i} className="pl-step"><span className="howto-n">{i + 1}</span><div><b>{title}</b><p>{text}</p></div></div>
          ))}
        </section>
      )}

      <section className="pl-privacy">
        <span className="pl-privacy-ico"><Icon name="shield" size={20} /></span>
        <div><h2>{t.home.privacyTitle}</h2><p>{t.home.privacy}</p><AnonNote t={t} m={3} /></div>
      </section>

      {groups.length > 0 && (
        <section className="tool-card">
          <h2>{t.home.earlier}</h2>
          <p className="muted small">{t.home.earlierHint}</p>
          {groups.map(([name, items]) => (
            <div key={name || '-'} className="pl-earlier">
              <div className="pl-earlier-head">
                <b>{name || '—'}</b>
                <ImportButton name={name} items={items} t={t} identity={identity} onDone={() => setChecks(rememberedDocs(CHECKS).filter(c => !c.teamId))} />
              </div>
              <ul className="doc-list">
                {items.map(c => (
                  <li key={c.id}>
                    <a href={`#/health/${c.id}`} className="grow"><b>{checkName(c.name, c.at, t.create.defName, lang)}</b><span className="muted small">{fmtDate(c.at, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span></a>
                    <button className="icon-btn" aria-label={`${t.home.remove}: ${c.name}`} title={t.home.remove} onClick={() => {
                      forgetDoc(CHECKS, c.id); setChecks(rememberedDocs(CHECKS).filter(x => !x.teamId))
                      showToast(t.home.removed, () => { rememberDoc(CHECKS, c); setChecks(rememberedDocs(CHECKS).filter(x => !x.teamId)) })
                    }}><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <HowTo tool="pulse-teams" content={{ en: T.en.how, zh: T.zh.how }} />
      {modal === 'team' && <CreateTeamModal onClose={() => setModal(null)} />}
      {modal === 'quick' && <StartCheckModal onClose={() => setModal(null)} />}
      <Toast />
    </main>
  )
}

function HeroArt({ t }) {
  // A quiet sketch of the product: a heat strip and a rising line. Decorative only.
  const rows = [['g', 'a', 'g', 'g'], ['a', 'a', 'g', 'g'], ['r', 'a', 'a', 'g'], ['a', 'g', 'g', 'g']]
  return (
    <div className="pl-hero-art" aria-hidden="true">
      <div className="pl-art-heat">{rows.map((r, i) => <div key={i}>{r.map((c, j) => <i key={j} className={`pl-score ${c} mini`} />)}</div>)}</div>
      <svg viewBox="0 0 160 60" className="pl-art-line"><path d="M4 48 L44 40 L84 30 L124 22 L156 12" /><circle cx="156" cy="12" r="4" /></svg>
      <span className="pl-art-cap">{t.dash.trend}</span>
    </div>
  )
}

function TeamSection({ title, entries, byId, now, t, lang, onForget, me }) {
  return (
    <section>
      <h2 className="pl-section-title">{title}</h2>
      <div className="pl-team-grid">
        {entries.map(e => <TeamCard key={e.id} team={byId.get(e.id)} entry={e} now={now} t={t} lang={lang} onForget={() => onForget(e)} host={!!hostKeyFor(e.id)} />)}
      </div>
    </section>
  )
}

function TeamCard({ team, entry, now, t, lang, onForget, host }) {
  const done = team.checks.filter(c => team.results[c.id] && team.results[c.id].phase !== 'vote' && team.results[c.id].score != null)
  const scores = done.map(c => team.results[c.id].score).filter(x => x != null)
  const last = scores[scores.length - 1]
  const delta = scores.length > 1 ? last - scores[scores.length - 2] : null
  const cad = cadence(team, now)
  const pw = pulseWeek(team, weekKey(now), now)
  const open = team.actions.filter(x => x.status === 'todo' || x.status === 'doing').length
  const overdue = team.actions.filter(x => actionState(x, now) === 'overdue').length
  return (
    <article className="pl-team-card">
      <div className="pl-team-top">
        <a href={`#/health/${team.id}`} className="pl-team-name"><h3>{team.name}</h3></a>
        {host && <span className="pl-tag">{t.home.facil}</span>}
        <button className="icon-btn sm" aria-label={`${t.home.remove}: ${team.name}`} title={t.home.remove} onClick={onForget}><Icon name="x" size={13} /></button>
      </div>
      <div className="pl-team-score">
        {last != null ? <>
          <Score value={last} big />
          <div className="pl-team-score-meta">
            <span className="muted small">{t.home.lastCheck}</span>
            {delta != null && delta !== 0 && <span className={`pl-delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? '▲ +' : '▼ '}{delta}</span>}
          </div>
          <Spark values={scores.slice(-8)} />
        </> : <span className="muted">{t.home.noCheck}</span>}
      </div>
      <ul className="pl-team-facts">
        <li><DueLine cad={cad} t={t} lang={lang} /></li>
        <li><Icon name="pulse" size={14} /> {t.home.pulseWeek}: {pw.n ? plural(pw.n, t.pu.answers1, t.pu.answers) : t.kpi.noPulse}</li>
        <li><Icon name="check" size={14} /> {plural(open, t.home.openAction1, t.home.openActions)}{overdue ? <span className="pl-warn-text"> · {fill(t.kpi.overdue, { n: overdue })}</span> : null}</li>
      </ul>
      <a className="btn ghost sm pl-team-open" href={`#/health/${team.id}`}>{t.checks.open} <Icon name="right" size={14} /></a>
    </article>
  )
}

export function DueLine({ cad, t, icon = true, lang }) {
  const d = t.team.due
  const ico = icon ? <Icon name={cad.state === 'none' || cad.state === 'off' ? 'flag' : 'timer'} size={14} /> : null
  if (cad.state === 'open') return <span className="pl-due open">{ico} {t.team.openNow}</span>
  if (cad.state === 'none') return <span className="pl-due">{ico} {d.none}</span>
  if (cad.state === 'off') return <span className="pl-due">{ico} {d.off}</span>
  if (cad.state === 'due') return <span className="pl-due due">{ico} {-cad.days === 1 ? d.due1 : fill(d.due, { n: -cad.days })}</span>
  return <span className={`pl-due ${cad.state}`}>{ico} {cad.days === 0 ? d.soon0 : fill(d[cad.state], { n: cad.days })}{cad.at ? <span className="muted"> · {fmtDate(cad.at, lang)}</span> : null}</span>
}

// Groups one-off checks from before team spaces into a new team, keeping their links.
function ImportButton({ name, items, t, identity, onDone }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const docs = (await loadDocs(items.map(x => x.id), reduceCheck)).filter(d => d.kind === 'health')
      if (!docs.length) { setBusy(false); return }
      const id = newDocId('tm')
      const at = Date.now()
      docs.sort((a, b) => a.createdAt - b.createdAt)
      const key = newBoardId() + newBoardId()
      const team = newTeam({ id, name: name || docs[0].name, owner: identity.id, at, templateId: docs[docs.length - 1].templateId === 'custom' ? 'squad' : docs[docs.length - 1].templateId, hostHash: await sha256hex(key) })
      saveHostKey(id, key)
      team.checks = docs.map(d => ({ id: d.id, name: d.name, at: d.createdAt, templateId: d.templateId }))
      for (const d of docs) team.results[d.id] = { score: d.phase === 'vote' ? null : overall(summarizeSafe(d)), votes: ballotCount(d), phase: d.phase, at }
      team.actions = docs.flatMap(d => (d.actions ?? []).map(x => ({ id: `${x.id}i`, text: x.text, qid: x.qid, area: d.questions.find(q => q.id === x.qid)?.title ?? '', owner: '', due: null, status: x.done ? 'done' : 'todo', checkId: d.id, at: x.at, review: null })))
      await createDoc(id, team, identity.secret)
      await Promise.all(docs.map(d => postAction(d.id, { type: 'ATTACH_TEAM', teamId: id, teamName: team.name }).catch(() => {})))
      for (const it of items) rememberDoc(CHECKS, { ...it, teamId: id })
      rememberTeam(id, team.name, { host: true })
      onDone()
      navigate(`/health/${id}`)
    } catch (err) {
      setBusy(false)
      showToast(fill(t.err.generic, { m: err.message }))
    }
  }
  if (!items.some(x => x)) return null
  return <button className="btn ghost sm" onClick={run} disabled={busy || !backend}><Icon name="users" size={14} /> {t.home.makeTeam}</button>
}

export { isComplete }
