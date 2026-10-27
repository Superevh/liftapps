import { useEffect, useMemo, useState } from 'react'
import { useStore, personalStorage, newBoardId } from '../core/store.jsx'
import { Icon } from '../core/icons.jsx'
import { navigate } from '../core/ui.jsx'
import { useLiveDoc, deleteDoc, backend } from '../core/live.js'
import { DocStatus } from '../core/tools-ui.jsx'
import { reduceTeam, reduceCheck, teamTrends, cadence, pulseWeek, pulseSeries, weekKey, actionState, markdownReport, areaTitle, TEMPLATES, MIN_ANON, summarizeSafe, ballotCount, overall, checkName, checkLabels, smallSamples, pulseProvisional } from './model.js'
import { sha256 } from './sha256.js'
import { useT, fill, plural, loadDocs, rememberTeam, forgetTeam, showToast, Toast, ShareMenu, appUrl, Score, TrendChart, PulseChart, Legend, useNow, fmtDate, copyText, Modal, Confirm, deleteVerified, useIsHost, hostKeyFor, saveHostKey, sha256hex, AnonNote, rovingKeys } from './bits.jsx'
import { StartCheckModal, QuestionPicker, CadenceSelect, parseCustom, customText } from './forms.jsx'
import { ActionForm, ActionList } from './actions.jsx'
import { DueLine } from './Home.jsx'
import './pulse.css'

const TABS = ['overview', 'checks', 'actions', 'pulse', 'report']
const isDefault = name => /^(Health check|健康检查) · /.test(name ?? '')

// Check documents of a team, reloaded whenever the team's list or cached results change.
export function useTeamChecks(team) {
  const key = team ? JSON.stringify([team.checks.map(c => c.id), team.results]) : ''
  const [state, setState] = useState({ key: null, docs: [] })
  useEffect(() => {
    if (!team) return
    let live = true
    loadDocs(team.checks.slice(-30).map(c => c.id), reduceCheck)
      .then(docs => live && setState({ key, docs: docs.filter(d => d.kind === 'health') }))
      .catch(() => live && setState({ key, docs: [] }))
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return { docs: state.docs, loading: state.key !== key }
}

export function TeamRoom({ id, sub }) {
  const { identity } = useStore()
  const [hostMsg, setHostMsg] = useState(null)
  const { status, doc: team, dispatch, error } = useLiveDoc(id, reduceTeam)
  const [t] = useT()
  const me = identity.id
  // Facilitator link: #/health/<team>/host-<key>
  useEffect(() => {
    if (!team || !sub?.startsWith('host-')) return
    const key = sub.slice(5)
    // The key stays on this device; replace() keeps it out of the back history.
    window.location.replace(`#/health/${id}`)
    if (!team.hostHash && team.hostKey && key === team.hostKey) migrate()
    else if (team.hostHash && sha256(key) === team.hostHash) { saveHostKey(id, key); rememberTeam(id, team.name, { host: true }); window.dispatchEvent(new Event('pulse:host')); showToast(t.team.hostAdded) }
    else setHostMsg(team.relinked ? 'moved' : 'bad')
  }, [!!team, sub]) // eslint-disable-line react-hooks/exhaustive-deps
  // Teams made before facilitator keys were hashed: the first facilitator to open the team (or
  // anyone with its old facilitator link) moves it to a fresh, hashed key kept on this device.
  function migrate() {
    const fresh = newBoardId() + newBoardId()
    saveHostKey(id, fresh)
    dispatch({ type: 'HOST_ROTATE', key: team.hostKey, hash: sha256(fresh) })
    rememberTeam(id, team.name, { host: true })
    setTimeout(() => window.dispatchEvent(new Event('pulse:host')), 50)
    showToast(t.team.migrated)
  }
  useEffect(() => {
    if (team && !team.hostHash && team.hostKey && team.hosts?.[me] && !sub?.startsWith('host-')) migrate()
  }, [!!team, team?.hostHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (team) rememberTeam(id, team.name) }, [id, team?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (team) document.title = `${team.name} · PulseLift` }, [team?.name])
  if (status !== 'ready') return <DocStatus status={status} />
  if (team.kind !== 'team') return <DocStatus status="missing" />
  return <Team team={team} me={me} dispatch={dispatch} error={error} tab={TABS.includes(sub) ? sub : 'overview'} hostMsg={hostMsg} onHostMsg={() => setHostMsg(null)} />
}

function Team({ team, me, dispatch, error, tab, hostMsg, onHostMsg }) {
  const [t, lang] = useT()
  const now = useNow()
  const host = useIsHost(team, me)
  const [modal, setModal] = useState(null)
  const { docs, loading } = useTeamChecks(team)
  const trends = useMemo(() => teamTrends(docs, lang), [docs, lang])
  const open = team.checks.slice().reverse().find(c => team.results[c.id]?.phase === 'vote' || (!team.results[c.id] && docs.find(d => d.id === c.id)?.phase === 'vote'))
  const openDoc = open && docs.find(d => d.id === open.id)
  const links = [
    { key: 'team', title: t.team.shareTeam, hint: t.team.shareTeamHint, url: appUrl(team.id) },
    { key: 'pulse', title: t.team.sharePulse, hint: t.team.sharePulseHint, url: appUrl(`${team.id}/pulse`) },
    ...(host ? [{ key: 'host', title: t.team.shareHost, hint: t.team.shareHostHint, url: appUrl(`${team.id}/host-${hostKeyFor(team.id)}`) }] : []),
  ]
  const go = k => navigate(k === 'overview' ? `/health/${team.id}` : `/health/${team.id}/${k}`)
  const props = { team, me, host, dispatch, now, docs, loading, trends, t, lang, setModal, open, openDoc }
  return (
    <main className="tool-page pl-page pl-team">
      <header className="pl-team-head no-print">
        <a className="icon-btn" href="#/health" aria-label={t.nav.back} title={t.nav.back}><Icon name="left" /></a>
        <div className="pl-team-title">
          <h1>{team.name}</h1>
          <span className="muted small">{t.cad[team.settings.cadenceDays]}{team.settings.size ? ` · ${fill(t.set.people, { n: team.settings.size })}` : ''}{host ? ` · ${t.team.youFacil}` : ''}</span>
        </div>
        <div className="pl-team-tools">
          <ShareMenu links={links} />
          {host && <button className="icon-btn" onClick={() => setModal('settings')} aria-label={t.team.settings} title={t.team.settings}><Icon name="settings" /></button>}
          {host && !open && <button className={`btn ${team.checks.length ? 'primary' : 'ghost'}`} onClick={() => setModal('start')}><Icon name="plus" /> {t.team.start}</button>}
        </div>
      </header>
      {error && <div className="sync-banner" role="alert">{t.err.sync}</div>}
      {hostMsg && !host && <div className="pl-banner due" role="alert"><span className="pl-banner-ico"><Icon name="link" size={20} /></span><div className="grow"><b>{hostMsg === 'moved' ? t.team.movedTitle : t.team.badHost}</b>{hostMsg === 'moved' && <span className="muted small">{t.team.movedHint}</span>}</div><button className="icon-btn" onClick={onHostMsg} aria-label={t.common.close}><Icon name="x" /></button></div>}
      <nav className="pl-tabs no-print" aria-label={team.name}>
        {TABS.map(k => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>{t.team.tabs[k]}{k === 'actions' && openCount(team) ? <span className="pl-count">{openCount(team)}</span> : null}</button>)}
      </nav>
      {tab === 'overview' && <Overview {...props} />}
      {tab === 'checks' && <Checks {...props} />}
      {tab === 'actions' && <Actions {...props} />}
      {tab === 'pulse' && <Pulse {...props} />}
      {tab === 'report' && <Report {...props} />}
      {modal === 'start' && <StartCheckModal team={team} onClose={() => setModal(null)} onCreated={c => { dispatch({ type: 'CHECK_ADD', check: { id: c.id, name: c.name, at: c.createdAt, templateId: c.templateId } }); dispatch({ type: 'CHECK_RESULT', id: c.id, score: null, votes: 0, phase: 'vote' }) }} />}
      {modal === 'settings' && <Settings team={team} dispatch={dispatch} onClose={() => setModal(null)} />}
      <Toast />
    </main>
  )
}

const openCount = team => team.actions.filter(x => x.status === 'todo' || x.status === 'doing').length

// ---------- overview ----------

function OpenCheckBanner({ open, openDoc, team, t, lang }) {
  if (!open) return null
  const votes = openDoc ? ballotCount(openDoc) : team.results[open.id]?.votes ?? 0
  return (
    <section className="pl-banner open">
      <span className="pl-banner-ico"><Icon name="timer" size={20} /></span>
      <div className="grow"><b>{t.team.openNow}: {checkName(open.name, open.at, t.create.defName, lang)}</b><span className="muted small">{plural(votes, t.team.votes1, t.team.votes)}</span></div>
      <a className="btn primary" href={`#/health/${open.id}`}>{t.team.vote} <Icon name="right" size={14} /></a>
    </section>
  )
}

function Overview(p) {
  const { team, host, now, trends, loading, t, lang, setModal, open, openDoc, docs } = p
  const { series, latest, prev, watch, improvers, decliners } = trends
  const cad = cadence(team, now)
  const week = weekKey(now)
  const pw = pulseWeek(team, week, now)
  const pub = pulseSeries(team, now, 8).filter(w => w.shown).pop()
  const mine = hasPulsed(team, week)
  const delta = latest && prev && latest.score != null && prev.score != null ? latest.score - prev.score : null
  const openN = openCount(team)
  const overdue = team.actions.filter(x => actionState(x, now) === 'overdue').length
  const doneN = team.actions.filter(x => x.status === 'done').length
  const minAnon = team.settings.minAnon ?? MIN_ANON
  const leftOut = docs.filter(d => !d.v && d.phase !== 'vote' && ballotCount(d) > 0 && ballotCount(d) < (d.minAnon ?? MIN_ANON)).length
  return (
    <>
      <OpenCheckBanner open={open} openDoc={openDoc} team={team} t={t} lang={lang} />
      {!open && cad.state !== 'none' && (
        <section className={`pl-banner ${cad.state}`}>
          <span className="pl-banner-ico"><Icon name={cad.state === 'none' || cad.state === 'off' ? 'flag' : 'timer'} size={20} /></span>
          <div className="grow"><DueLine cad={cad} t={t} icon={false} lang={lang} /><span className="muted small">{t.cad[team.settings.cadenceDays]}</span></div>
          {host && (cad.state === 'due' || cad.state === 'soon') && <button className="btn primary" onClick={() => setModal('start')}><Icon name="plus" /> {t.team.start}</button>}
        </section>
      )}
      <section className="pl-kpis">
        <div className="pl-kpi">
          <span className="pl-kpi-label">{t.kpi.score}</span>
          {latest ? <div className="pl-kpi-val"><Score value={latest.score} big /><span className="pl-kpi-sub">{delta == null ? t.kpi.first : <span className={`pl-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '± '}{delta} {t.kpi.vsPrev}</span>}</span></div> : <span className="muted">{t.kpi.noChecks}</span>}
        </div>
        <div className="pl-kpi">
          <span className="pl-kpi-label">{team.settings.size ? t.kpi.part : t.kpi.votes}</span>
          {latest ? <div className="pl-kpi-val"><b className="pl-num">{team.settings.size ? `${Math.min(100, Math.round((latest.votes / team.settings.size) * 100))}%` : latest.votes}</b>
            <span className="pl-kpi-sub">{team.settings.size ? fill(t.kpi.ofSize, { v: latest.votes, s: team.settings.size }) : (host ? <button className="link-btn pl-inline" onClick={() => setModal('settings')}>{t.kpi.setSize}</button> : '')}</span></div> : <span className="muted">{t.kpi.noChecks}</span>}
        </div>
        <div className="pl-kpi">
          <span className="pl-kpi-label">{t.kpi.pulse}</span>
          {pub ? <div className="pl-kpi-val"><b className="pl-num">{pub.mood?.toFixed(1) ?? '–'}</b><span className="pl-kpi-sub">{t.pu.of5} · {fill(t.pu.weekOf, { d: fmtDate(Date.parse(pub.week) + 43200000, lang) })}<span>{fill(t.kpi.thisWeekN, { n: pw.n })}</span></span></div>
            : <div className="pl-kpi-val"><span className="pl-kpi-sub">{pw.n ? fill(t.kpi.thisWeekN, { n: pw.n }) : t.kpi.noPulse}</span></div>}
          {!mine && <a className="link-btn pl-inline" href={`#/health/${team.id}/pulse`}>{t.team.pulseCta} →</a>}
        </div>
        <div className="pl-kpi">
          <span className="pl-kpi-label">{t.kpi.actions}</span>
          <div className="pl-kpi-val"><b className="pl-num">{openN}</b><span className="pl-kpi-sub">{t.kpi.openL}{overdue ? <span className="pl-warn-text"> · {fill(t.kpi.overdue, { n: overdue })}</span> : ''}{doneN ? ` · ${fill(t.kpi.done, { n: doneN })}` : ''}</span></div>
        </div>
      </section>
      {loading && !docs.length && team.checks.length > 0 ? <p className="muted pl-loading"><span className="spinner sm" aria-hidden="true" /> {t.dash.loading}</p> : !latest ? (
        <section className="tool-card pl-empty">
          <Icon name="chart" size={28} />
          <h2>{t.dash.empty}</h2>
          <p className="muted">{t.dash.emptyHint}</p>
          {leftOut > 0 && <p className="muted small"><Icon name="lock" size={13} className="inline" /> {fill(leftOut === 1 ? t.dash.leftOut1 : t.dash.leftOutN, { n: leftOut, m: minAnon })}</p>}
          {host && !team.checks.length && <p className="muted small">{t.dash.emptyHost}</p>}
          {host && !open && <button className="btn primary" onClick={() => setModal('start')}><Icon name="plus" /> {t.team.start}</button>}
        </section>
      ) : <>
        <div className="pl-two">
          <section className="tool-card">
            <h2>{t.dash.trend}</h2>
            <p className="muted small">{t.dash.trendHint}</p>
            <TrendChart points={series.map(s => ({ id: s.id, label: checkName(s.name, s.at, t.create.defName, lang), at: s.at, value: s.score ?? 0 }))} lang={lang} t={t} />
          </section>
          <section className="tool-card">
            <h2>{t.dash.watch}</h2>
            {watch.length ? (
              <ul className="pl-watch">
                {watch.map(w => <li key={w.area.id}><Score value={w.score} /><div><b>{w.area.emoji} {w.area.title}</b><span className="muted small">{t.why[w.reason]}{w.delta != null && w.delta !== 0 ? ` · ${w.delta > 0 ? '+' : ''}${w.delta}` : ''}</span></div></li>)}
              </ul>
            ) : <p className="muted">{t.dash.watchNone}</p>}
            <h3 className="pl-sub">{t.dash.movers}</h3>
            {!prev ? <p className="muted small">{t.dash.needTwo}</p> : (improvers.length || decliners.length) ? (
              <ul className="pl-movers">
                {improvers.map(m => <li key={m.area.id}><span className="pl-delta up">▲ +{m.delta}</span> {m.area.title}</li>)}
                {decliners.map(m => <li key={m.area.id}><span className="pl-delta down">▼ {m.delta}</span> {m.area.title}</li>)}
              </ul>
            ) : <p className="muted small">{t.dash.moversNone}</p>}
          </section>
        </div>
        <Heatmap trends={trends} t={t} lang={lang} />
        {leftOut > 0 && <p className="tool-note small" role="note"><Icon name="lock" size={14} className="inline" /> {fill(leftOut === 1 ? t.dash.leftOut1 : t.dash.leftOutN, { n: leftOut, m: minAnon })}</p>}
      </>}
    </>
  )
}

function Heatmap({ trends, t, lang }) {
  const { series, areas, cell } = trends
  const shown = series.slice(-10)
  const labels = checkLabels(shown, t.create.defName, lang)
  return (
    <section className="tool-card">
      <div className="tool-card-head"><div><h2>{t.dash.heat}</h2><p className="muted small">{t.dash.heatHint}</p></div><Legend t={t} /></div>
      <div className="pl-heat-wrap" tabIndex={0} role="region" aria-label={t.dash.heat}>
        <table className="pl-heat">
          <thead><tr><th scope="col"><span className="sr-only">{t.rp.area}</span></th>{shown.map((s, i) => <th key={s.id} scope="col"><a href={`#/health/${s.id}`} title={labels[i]}>{isDefault(s.name) ? <><span className="pl-heat-name">{labels[i].split(' · ').slice(1).join(' · ')}</span><span>{fill(t.checks.votes, { n: s.votes })}</span></> : <><span className="pl-heat-name">{s.name}</span><span>{fmtDate(s.at, lang)}</span></>}</a></th>)}</tr></thead>
          <tbody>
            {areas.map(a => (
              <tr key={a.id}>
                <th scope="row" className="pl-heat-q"><span aria-hidden="true">{a.emoji}</span> {a.title}</th>
                {shown.map(s => { const c = cell(s, a.id); return <td key={s.id}><Score value={c?.score ?? null} label={c?.score == null ? t.dash.notAsked : `${a.title}, ${checkName(s.name, s.at, t.create.defName, lang)}: ${c.score}`} /></td> })}
              </tr>
            ))}
            <tr className="pl-heat-total"><th scope="row">{t.chk.overall}</th>{shown.map(s => <td key={s.id}><b>{s.score ?? '–'}</b></td>)}</tr>
            <tr className="pl-heat-votes"><th scope="row">{t.kpi.votes}</th>{shown.map(s => <td key={s.id}>{s.votes}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------- checks ----------

function Checks({ team, host, dispatch, docs, t, lang, setModal, open }) {
  const list = [...team.checks].reverse()
  const minAnon = team.settings.minAnon ?? MIN_ANON
  const labels = checkLabels(list, t.create.defName, lang)
  const remove = c => {
    dispatch({ type: 'CHECK_REMOVE', id: c.id })
    const r = team.results[c.id]
    showToast(t.checks.removed, () => { dispatch({ type: 'CHECK_ADD', check: c }); if (r) dispatch({ type: 'CHECK_RESULT', id: c.id, ...r }) })
  }
  return (
    <section className="tool-card">
      <div className="tool-card-head"><h2>{t.checks.title}</h2>{host && !open && <button className="btn ghost sm" onClick={() => setModal('start')}><Icon name="plus" /> {t.team.start}</button>}</div>
      {!list.length ? <p className="muted">{t.checks.none}</p> : (
        <ul className="pl-check-list">
          {list.map((c, ci) => {
            const d = docs.find(x => x.id === c.id)
            const r = team.results[c.id]
            const phase = d?.phase ?? r?.phase ?? 'vote'
            const score = d ? (phase === 'vote' ? null : overall(summarizeSafe(d))) : r?.score
            const votes = d ? ballotCount(d) : r?.votes ?? 0
            return (
              <li key={c.id}>
                <Score value={score ?? null} />
                <a href={`#/health/${c.id}`} className="grow"><b>{labels[ci]}</b><span className="muted small">{fmtDate(c.at, lang, { day: 'numeric', month: 'short', year: 'numeric' })} · {TEMPLATES[c.templateId]?.[lang][0] ?? t.create.custom} · {fill(t.checks.votes, { n: votes })}</span></a>
                {d && !d.v && phase !== 'vote' && votes > 0 && votes < (d.minAnon ?? minAnon) ? <span className="pl-phase" title={fill(t.chk.legacyHidden, { m: minAnon, n: votes })}><Icon name="lock" size={11} className="inline" /> {fill(t.checks.hiddenTag, { m: minAnon })}</span>
                  : <span className={`pl-phase ${phase}`}>{phase === 'vote' ? t.checks.inProgress : phase === 'closed' ? t.checks.closed : t.checks.revealed}</span>}
                {host && <button className="icon-btn sm" onClick={() => remove(c)} aria-label={`${t.checks.remove}: ${c.name}`} title={t.checks.remove}><Icon name="x" size={14} /></button>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------- actions ----------

export function teamAreas(team, docs, lang) {
  const seen = new Map()
  for (const d of [...docs].sort((a, b) => b.createdAt - a.createdAt)) for (const q of d.questions) if (!seen.has(q.id)) seen.set(q.id, { id: q.id, title: areaTitle(q, lang) })
  return [...seen.values()]
}

function Actions({ team, dispatch, now, docs, t, lang }) {
  const areas = teamAreas(team, docs, lang)
  const order = { overdue: 0, doing: 1, todo: 2, done: 3, dropped: 4 }
  const sorted = [...team.actions].sort((a, b) => order[actionState(a, now)] - order[actionState(b, now)] || (a.due ?? '9').localeCompare(b.due ?? '9') || a.at - b.at)
  const active = sorted.filter(x => x.status === 'todo' || x.status === 'doing')
  const finished = sorted.filter(x => x.status === 'done' || x.status === 'dropped')
  const checkName = id => team.checks.find(c => c.id === id)?.name
  return (
    <>
      <section className="tool-card">
        <h2>{t.act.title}</h2>
        <p className="muted small">{t.act.hint}</p>
        <ActionForm areas={areas} dispatch={dispatch} checkId={null} />
      </section>
      <section className="tool-card">
        <h2 className="pl-h-count">{t.act.open} <span className="pl-count">{active.length}</span></h2>
        {!team.actions.length ? <div className="pl-empty-sm"><p><b>{t.act.none}</b></p><p className="muted small">{t.act.noneHint}</p></div>
          : active.length ? <ActionList items={active} dispatch={dispatch} now={now} /> : <p className="muted small">—</p>}
        {active.length > 3 && <p className="tool-note small">{t.act.limit}</p>}
      </section>
      {finished.length > 0 && (
        <section className="tool-card">
          <h2 className="pl-h-count">{t.act.finished} <span className="pl-count">{finished.length}</span></h2>
          <ActionList items={finished} dispatch={dispatch} now={now} />
        </section>
      )}
      {team.actions.some(x => x.checkId && checkName(x.checkId)) && null}
    </>
  )
}

// ---------- pulse ----------

const pulseBallot = (teamId, week) => {
  const key = `lift-pulse-${teamId}-${week}`
  try {
    let b = personalStorage().getItem(key)
    if (!b) { b = newBoardId(); personalStorage().setItem(key, b) }
    return b
  } catch { return newBoardId() }
}
const hasPulsed = (team, week) => {
  try { const b = personalStorage().getItem(`lift-pulse-${team.id}-${week}`); return !!(b && team.pulse?.[week]?.[b]) } catch { return false }
}

function Scale({ label, q, labels, value, onChange, name, faces }) {
  return (
    <fieldset className="pl-scale">
      <legend><b>{label}</b><span>{q}</span></legend>
      <div className="pl-scale-opts">
        {labels.map((l, i) => (
          <label key={i} className={`pl-scale-opt ${value === i + 1 ? 'on' : ''}`}>
            <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => onChange(i + 1)} />
            <span className="pl-scale-face" aria-hidden="true">{faces ? faces[i] : i + 1}</span>
            <span className="pl-scale-txt">{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Pulse({ team, dispatch, now, t, lang, host }) {
  const week = weekKey(now)
  const ballot = useMemo(() => pulseBallot(team.id, week), [team.id, week])
  const mine = team.pulse?.[week]?.[ballot]
  const [form, setForm] = useState(() => ({ mood: mine?.mood ?? null, energy: mine?.energy ?? null, load: mine?.load ?? null, note: mine?.note ?? '' }))
  const [editing, setEditing] = useState(!mine)
  const minAnon = team.settings.minAnon ?? MIN_ANON
  const pw = pulseWeek(team, week, now)
  const weeks = pulseSeries(team, now, 8)
  const pub = weeks.filter(w => w.shown).pop()
  const prov = host ? pulseProvisional(team, week) : null
  const send = e => {
    e.preventDefault()
    dispatch({ type: 'PULSE', week, ballot, answer: form })
    setEditing(false)
    showToast(t.pu.thanks)
  }
  const can = form.mood || form.energy || form.load
  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  return (
    <>
      <section className="tool-card pl-pulse-card">
        <div className="tool-card-head">
          <div><h2>{t.pu.title} · {fill(t.pu.weekOf, { d: fmtDate(Date.parse(week) + 43200000, lang) })}</h2><p className="muted small pl-anon-line"><Icon name="shield" size={14} /> {fill(t.pu.lead, { m: minAnon })}</p><AnonNote t={t} m={minAnon} /></div>
        </div>
        {editing ? (
          <form onSubmit={send} className="pl-pulse-form">
            <Scale name="mood" label={t.pu.mood} q={t.pu.moodQ} labels={t.pu.moodL} value={form.mood} onChange={set('mood')} faces={['😣', '😕', '😐', '🙂', '😄']} />
            <Scale name="energy" label={t.pu.energy} q={t.pu.energyQ} labels={t.pu.energyL} value={form.energy} onChange={set('energy')} />
            <Scale name="load" label={t.pu.load} q={t.pu.loadQ} labels={t.pu.loadL} value={form.load} onChange={set('load')} />
            <label><span className="field-label">{t.pu.note}</span><input value={form.note} onChange={e => set('note')(e.target.value)} maxLength={280} placeholder={t.pu.notePh} /></label>
            <div className="row end"><button className="btn primary lg" disabled={!can}>{mine ? t.pu.update : t.pu.send}</button></div>
          </form>
        ) : (
          <div className="pl-pulse-done">
            <span className="pl-done-ico"><Icon name="check" size={22} /></span>
            <div className="grow"><b>{t.pu.thanks}</b></div>
            <button className="btn ghost sm" onClick={() => setEditing(true)}>{t.pu.change}</button>
          </div>
        )}
      </section>
      <section className="tool-card">
        <div className="tool-card-head"><h2>{t.pu.published}{pub ? ` · ${fill(t.pu.weekOf, { d: fmtDate(Date.parse(pub.week) + 43200000, lang) })}` : ''}</h2><span className="muted small"><Icon name="lock" size={13} className="inline" /> {fill(t.pu.hidden, { m: minAnon, n: pw.n })}</span></div>
        {!pub ? <p className="muted">{fill(t.pu.noneYet, { m: minAnon })}</p> : (
          <>
            <div className="pl-pulse-stats">
              <div><span className="pl-kpi-label">{t.pu.mood}</span><b className="pl-num">{pub.mood?.toFixed(1) ?? '–'}</b><span className="muted small">{t.pu.of5}</span></div>
              <div><span className="pl-kpi-label">{t.pu.energy}</span><b className="pl-num">{pub.energy?.toFixed(1) ?? '–'}</b><span className="muted small">{t.pu.of5}</span></div>
              <div><span className="pl-kpi-label">{t.pu.heavy}</span><b className="pl-num">{pub.heavy == null ? '–' : `${Math.round(pub.heavy * 100)}%`}</b><span className="muted small">{plural(pub.n, t.pu.answers1, t.pu.answers)}</span></div>
            </div>
            <LoadBar load={pub.load} t={t} />
            {pub.notes.length > 0 && <><h3 className="pl-sub">{t.pu.notes}</h3><ul className="pl-notes">{pub.notes.map((n, i) => <li key={i}>“{n}”</li>)}</ul></>}
          </>
        )}
      </section>
      {prov && (
        <section className="tool-card pl-prov">
          <div className="tool-card-head"><h2>{t.pu.prov}</h2><span className="pl-tag">{t.home.facil}</span></div>
          <p className="muted small">{fill(t.pu.provHint, { k: prov.n, n: prov.total })}</p>
          <div className="pl-pulse-stats">
            <div><span className="pl-kpi-label">{t.pu.mood}</span><b className="pl-num">{prov.mood?.toFixed(1) ?? '–'}</b><span className="muted small">{t.pu.of5}</span></div>
            <div><span className="pl-kpi-label">{t.pu.energy}</span><b className="pl-num">{prov.energy?.toFixed(1) ?? '–'}</b><span className="muted small">{t.pu.of5}</span></div>
            <div><span className="pl-kpi-label">{t.pu.heavy}</span><b className="pl-num">{prov.heavy == null ? '–' : `${Math.round(prov.heavy * 100)}%`}</b><span className="muted small">{plural(prov.n, t.pu.answers1, t.pu.answers)}</span></div>
          </div>
        </section>
      )}
      <section className="tool-card">
        <h2>{t.pu.trend}</h2>
        <p className="muted small">{fill(t.pu.trendHint, { m: minAnon })}</p>
        <div className="pl-legend"><span><i className="pl-key mood" />{t.pu.mood}</span><span><i className="pl-key energy" />{t.pu.energy}</span></div>
        <PulseChart weeks={weeks} t={t} lang={lang} />
      </section>
    </>
  )
}

function LoadBar({ load, t }) {
  const n = load.light + load.right + load.heavy
  if (!n) return null
  const parts = [['light', t.pu.light], ['right', t.pu.right], ['heavy', t.pu.heavyS]]
  return (
    <div className="pl-loadbar-wrap">
      <span className="pl-kpi-label">{t.pu.loadSplit}</span>
      <div className="pl-loadbar" role="img" aria-label={parts.map(([k, l]) => `${l} ${load[k]}`).join(', ')}>
        {parts.map(([k, l]) => load[k] > 0 && <i key={k} className={k} style={{ flex: load[k] }}>{l} {load[k]}</i>)}
      </div>
    </div>
  )
}

// ---------- summary for leadership ----------

function Report({ team, now, trends, t, lang, docs }) {
  const leftOut = docs.filter(d => !d.v && d.phase !== 'vote' && ballotCount(d) > 0 && ballotCount(d) < (d.minAnon ?? MIN_ANON)).length
  const [copied, setCopied] = useState(false)
  const pulse = pulseSeries(team, now, 8)
  const md = () => markdownReport({ team, trends, pulse, t, lang, now })
  const { series, latest, prev, watch } = trends
  const open = team.actions.filter(x => x.status === 'todo' || x.status === 'doing')
  const done = team.actions.filter(x => x.status === 'done')
  const dropped = team.actions.filter(x => x.status === 'dropped')
  const delta = latest && prev && latest.score != null && prev.score != null ? latest.score - prev.score : null
  const labels = checkLabels(series, t.create.defName, lang)
  const lab = x => labels[series.indexOf(x)]
  const small = smallSamples(trends)
  const minAnon = team.settings.minAnon ?? MIN_ANON
  const okPulse = pulse.filter(w => w.shown)
  const lastPulse = okPulse[okPulse.length - 1]
  const reviewed = team.actions.filter(x => x.review)
  const helped = reviewed.filter(x => x.review.verdict !== 'no').length
  return (
    <>
      <section className="pl-report-bar no-print">
        <p className="muted grow">{t.rp.lead}</p>
        <button className="btn ghost" onClick={() => copyText(md()).then(ok => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800) } })}><Icon name="copy" /> {copied ? t.rp.copied : t.rp.copyMd}</button>
        <button className="btn ghost" onClick={() => window.print()}><Icon name="print" /> {t.rp.print}</button>
      </section>
      <article className="tool-card pl-report">
        <header className="pl-report-head">
          <div className="hero-eyebrow">{t.rp.title}</div>
          <h2>{team.name}</h2>
          <p className="muted small">{fmtDate(now, lang, { day: 'numeric', month: 'long', year: 'numeric' })}{series.length ? ` · ${fill(t.rp.period, { a: fmtDate(series[0].at, lang), b: fmtDate(latest.at, lang) })}` : ''}</p>
        </header>
        {!latest ? <p className="muted">{t.rp.noData}</p> : <>
          <div className="pl-report-kpis">
            <div><span className="pl-kpi-label">{t.kpi.score}</span><Score value={latest.score} big />{delta != null && <span className={`pl-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '± '}{delta} {t.kpi.vsPrev}</span>}</div>
            <div><span className="pl-kpi-label">{team.settings.size ? t.kpi.part : t.kpi.votes}</span><b className="pl-num">{team.settings.size ? fill(t.kpi.ofSize, { v: latest.votes, s: team.settings.size }) : latest.votes}</b></div>
            <div><span className="pl-kpi-label">{t.rp.checks}</span><b className="pl-num">{series.length}</b></div>
            <div><span className="pl-kpi-label">{t.kpi.actions}</span><b className="pl-num">{fill(t.kpi.open, { n: open.length })}</b><span className="muted small">{fill(t.kpi.done, { n: done.length })}{dropped.length ? ` · ${dropped.length} ${t.act.st.dropped.toLowerCase()}` : ''}{reviewed.length ? ` · ${t.rp.helped}: ${helped}/${reviewed.length}` : ''}</span></div>
            {lastPulse && <div><span className="pl-kpi-label">{t.kpi.pulse}</span><b className="pl-num">{lastPulse.mood?.toFixed(1)}</b><span className="muted small">{t.pu.of5} · {fill(t.pu.weekOf, { d: fmtDate(Date.parse(lastPulse.week) + 43200000, lang) })}</span></div>}
          </div>
          {small.length > 0 && <p className="tool-note small pl-small-note" role="note"><Icon name="info" size={14} className="inline" /> {fill(t.rp.small, { list: small.map(x => fill(t.rp.smallItem, { name: lab(x), n: x.votes })).join(t.rp.sep) })}</p>}
          {leftOut > 0 && <p className="tool-note small pl-small-note" role="note"><Icon name="lock" size={14} className="inline" /> {fill(leftOut === 1 ? t.dash.leftOut1 : t.dash.leftOutN, { n: leftOut, m: minAnon })}</p>}
          <h3 className="pl-sub">{t.rp.trend}</h3>
          <TrendChart points={series.map(s => ({ id: s.id, label: checkName(s.name, s.at, t.create.defName, lang), at: s.at, value: s.score ?? 0 }))} lang={lang} t={t} />
          <h3 className="pl-sub">{t.rp.part}</h3>
          <div className="pl-table-wrap"><table className="pl-table">
            <thead><tr><th scope="col">{t.rp.check}</th><th scope="col">{t.rp.date}</th><th scope="col" className="num">{t.kpi.score}</th><th scope="col" className="num">{t.kpi.votes}</th>{team.settings.size ? <th scope="col" className="num">{t.kpi.part}</th> : null}</tr></thead>
            <tbody>{series.slice(-8).map(x => <tr key={x.id}><td>{lab(x)}</td><td>{fmtDate(x.at, lang)}</td><td className="num">{x.score ?? '–'}</td><td className="num">{x.votes}</td>{team.settings.size ? <td className="num">{Math.min(100, Math.round((x.votes / team.settings.size) * 100))}%</td> : null}</tr>)}</tbody>
          </table></div>
          <div className="pl-two">
            <div>
              <h3 className="pl-sub">{t.dash.watch}</h3>
              {watch.length ? <ul className="pl-watch">{watch.map(w => <li key={w.area.id}><Score value={w.score} /><div><b>{w.area.title}</b><span className="muted small">{t.why[w.reason]}</span></div></li>)}</ul> : <p className="muted small">{t.dash.watchNone}</p>}
            </div>
            <div>
              <h3 className="pl-sub">{t.rp.areas}</h3>
              <table className="pl-table">
                <thead><tr><th scope="col">{t.rp.area}</th><th scope="col" className="num">{t.kpi.score}</th><th scope="col" className="num">{t.rp.change}</th></tr></thead>
                <tbody>{[...latest.rows].filter(r => r.n).sort((a, b) => a.score - b.score).map(r => {
                  const pr = prev?.rows.find(x => x.q.id === r.q.id)
                  const d = pr?.score != null ? r.score - pr.score : null
                  return <tr key={r.q.id}><td>{areaTitle(r.q, lang)}</td><td className="num"><Score value={r.score} /></td><td className="num">{d == null ? '–' : <span className={`pl-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{d > 0 ? '+' : ''}{d}</span>}</td></tr>
                })}</tbody>
              </table>
            </div>
          </div>
        </>}
        <h3 className="pl-sub">{t.rp.plan}</h3>
        {!team.actions.length ? <p className="muted small">{t.act.none}</p> : (
          <div className="pl-table-wrap"><table className="pl-table pl-plan">
            <thead><tr><th scope="col">{t.act.text}</th><th scope="col">{t.act.area}</th><th scope="col">{t.act.owner}</th><th scope="col">{t.act.status}</th><th scope="col">{t.rp.helped}</th></tr></thead>
            <tbody>{[...open, ...done, ...dropped].map(x => <tr key={x.id}><td>{x.text}</td><td>{x.area || '–'}</td><td>{x.owner || '–'}</td><td><span className={`pl-status ${actionState(x, now)}`}>{t.act.st[actionState(x, now)]}</span>{x.due ? <span className="muted small"> · {x.due}</span> : null}</td><td>{x.review ? t.act.v[x.review.verdict] : '–'}</td></tr>)}</tbody>
          </table></div>
        )}
        <p className="muted small pl-report-foot"><Icon name="shield" size={13} /> {fill(t.rp.anonNote, { m: minAnon })}</p>
      </article>
    </>
  )
}

// ---------- settings ----------

function Settings({ team, dispatch, onClose }) {
  const [t] = useT()
  const { identity } = useStore()
  const s = team.settings
  const [name, setName] = useState(team.name)
  const [tpl, setTpl] = useState(s.templateId)
  const [custom, setCustom] = useState(customText(s.customQuestions))
  const [cad, setCad] = useState(s.cadenceDays)
  const [size, setSize] = useState(s.size ?? '')
  const [minAnon, setMinAnon] = useState(s.minAnon ?? MIN_ANON)
  const [trendsQ, setTrendsQ] = useState(s.trends !== false)
  const [comments, setComments] = useState(s.comments !== false)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const save = e => {
    e.preventDefault()
    if (name.trim() && name.trim() !== team.name) dispatch({ type: 'TEAM_RENAME', name: name.trim() })
    dispatch({ type: 'TEAM_SETTINGS', patch: { templateId: tpl, cadenceDays: cad, size: parseInt(size, 10) || null, minAnon, trends: trendsQ, comments, ...(tpl === 'custom' ? { customQuestions: parseCustom(custom) } : {}) } })
    showToast(t.set.saved)
    onClose()
  }
  const owner = team.ownerId === identity.id
  const [rotating, setRotating] = useState(false)
  const del = () => {
    deleteVerified(team.id, identity.secret).then(ok => {
      if (!ok) { showToast(t.set.delFail); return }
      forgetTeam(team.id); navigate('/health')
    })
  }
  const rotate = async () => {
    const current = hostKeyFor(team.id)
    const key = newBoardId() + newBoardId()
    dispatch({ type: 'HOST_ROTATE', key: current, hash: sha256(key) })
    saveHostKey(team.id, key)
    setTimeout(() => window.dispatchEvent(new Event('pulse:host')), 50)
    setRotating(false)
    showToast(t.set.rotated)
  }
  return (
    <Modal title={t.set.title} onClose={onClose} wide>
      <form onSubmit={save} className="pl-form">
        <div className="pl-form-grid">
          <label><span className="field-label">{t.set.name}</span><input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></label>
          <label><span className="field-label">{t.set.cadence}</span><CadenceSelect value={cad} onChange={setCad} /></label>
          <label><span className="field-label">{t.set.size}</span><input type="number" min="1" max="999" inputMode="numeric" value={size} onChange={e => setSize(e.target.value)} /><span className="pl-hint">{t.set.sizeHint}</span></label>
          <label><span className="field-label">{t.set.minAnon}</span><select value={minAnon} onChange={e => setMinAnon(+e.target.value)}>{[3, 4, 5].map(n => <option key={n} value={n}>{fill(t.set.people, { n })}</option>)}</select></label>
        </div>
        <span className="field-label" id="st-set">{t.set.set}</span>
        <QuestionPicker idp="st" value={tpl} onChange={setTpl} custom={custom} onCustom={setCustom} />
        <div className="pl-checks">
          <label className="check"><input type="checkbox" checked={trendsQ} onChange={e => setTrendsQ(e.target.checked)} /> {t.set.trends}</label>
          <label className="check"><input type="checkbox" checked={comments} onChange={e => setComments(e.target.checked)} /> {t.set.comments}</label>
        </div>
        <div className="row end pl-modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn primary">{t.set.save}</button>
        </div>
      </form>
      <div className="pl-danger-zone">
        <h3>{t.set.facil}</h3>
        <p className="muted small">{t.set.facilHint}</p>
        {!rotating ? <button className="btn ghost sm" onClick={() => setRotating(true)}><Icon name="link" size={14} /> {t.set.rotate}</button> : (
          <div className="pl-confirm-del"><p className="small">{t.set.rotateQ}</p><div className="row"><button className="btn ghost sm" onClick={() => setRotating(false)}>{t.common.cancel}</button><button className="btn ghost sm" onClick={rotate}>{t.set.rotate}</button></div></div>
        )}
      </div>
      <div className="pl-danger-zone">
        <h3>{t.set.danger}</h3>
        <p className="muted small">{owner ? t.set.dangerHint : t.set.ownerOnly}</p>
        {!owner ? <div className="row"><button className="btn ghost sm" onClick={() => { forgetTeam(team.id); navigate('/health') }}>{t.set.forget}</button></div> : !confirm ? <div className="row"><button className="btn ghost sm pl-danger-text" onClick={() => setConfirm(true)}><Icon name="trash" size={14} /> {t.set.del}</button><button className="btn ghost sm" onClick={() => { forgetTeam(team.id); navigate('/health') }}>{t.set.forget}</button></div> : (
          <div className="pl-confirm-del">
            <label><span className="field-label">{t.set.delQ} <b>{team.name}</b></span><input autoFocus value={typed} onChange={e => setTyped(e.target.value)} /></label>
            <div className="row"><button className="btn ghost sm" onClick={() => { setConfirm(false); setTyped('') }}>{t.common.cancel}</button><button className="btn sm pl-danger-btn" disabled={typed.trim() !== team.name} onClick={del}>{t.set.del}</button></div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export { Confirm }
