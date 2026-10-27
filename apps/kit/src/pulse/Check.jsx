import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, newBoardId, personalStorage } from '../core/store.jsx'
import { Icon } from '../core/icons.jsx'
import { navigate } from '../core/ui.jsx'
import { confetti } from '../core/fx.js'
import { useLiveDoc, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { DocStatus } from '../core/tools-ui.jsx'
import { checkCsv, LIGHTS, TRENDS } from '../health/model.js'
import { reduceCheck, reduceTeam, summarizeSafe, ballotCount, overall, discussionOrder, split, localQuestion, areaTitle, toReview, isComplete, minAnonOf, checkName, moodOf } from './model.js'
import { useT, fill, plural, loadDocs, rememberTeam, showToast, Toast, ShareMenu, Score, Confirm, Modal, copyText, postAction, CHECKS, TEAMS, fmtDate, useIsHost, hostKeyFor, rovingKeys, rovingTab, AnonNote, deleteVerified } from './bits.jsx'
import { ActionForm, ActionList } from './actions.jsx'
import './pulse.css'

const TREND_ICON = { up: '↗', flat: '→', down: '↘' }
const LIGHT_MARK = { g: '●', a: '▲', r: '■' }

function ballotId(checkId) {
  const key = `lift-ballot-${checkId}`
  try {
    let b = personalStorage().getItem(key)
    if (!b) { b = newBoardId(); personalStorage().setItem(key, b) }
    return b
  } catch { return newBoardId() }
}

export function CheckRoom({ id }) {
  const { status, doc: check, dispatch, error } = useLiveDoc(id, reduceCheck)
  useEffect(() => {
    if (check) rememberDoc(CHECKS, { id, name: check.name, team: check.team, teamId: check.teamId, at: check.createdAt })
  }, [id, check?.name, check?.teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (check) document.title = `${check.name} · PulseLift` }, [check?.name])
  if (status !== 'ready') return <DocStatus status={status} />
  if (check.kind !== 'health') return <DocStatus status="missing" />
  return check.teamId
    ? <WithTeam check={check} dispatch={dispatch} error={error} />
    : <Check check={check} dispatch={dispatch} error={error} team={null} teamDispatch={null} />
}

function WithTeam({ check, dispatch, error }) {
  const { status, doc: team, dispatch: teamDispatch } = useLiveDoc(check.teamId, reduceTeam)
  useEffect(() => { if (team?.kind === 'team') rememberTeam(team.id, team.name) }, [team?.id, team?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  // A missing team (deleted) still leaves the check usable on its own.
  const ok = status === 'ready' && team?.kind === 'team'
  if (status === 'loading') return <DocStatus status="loading" />
  return <Check check={check} dispatch={dispatch} error={error} team={ok ? team : null} teamDispatch={ok ? teamDispatch : null} />
}

function Check({ check, dispatch, error, team, teamDispatch }) {
  const [t, lang] = useT()
  const { identity } = useStore()
  const me = identity.id
  const ballot = useMemo(() => ballotId(check.id), [check.id])
  const teamHost = useIsHost(team, me)
  const isHost = check.ownerId === me || teamHost
  const isOwner = check.ownerId === me
  const voters = ballotCount(check)
  const minAnon = minAnonOf(check, team)
  const phone = usePhone()
  const [modal, setModal] = useState(null)
  const prevPhase = useRef(check.phase)
  const name = checkName(check.name, check.createdAt, t.create.defName, lang)
  useEffect(() => {
    if (prevPhase.current === 'vote' && check.phase === 'reveal' && (overall(summarizeSafe(check, minAnon)) ?? 0) >= 75) confetti(2400)
    prevPhase.current = check.phase
  }, [check.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  // Facilitators keep the team's cached result in step with the check.
  useEffect(() => {
    if (!team || !teamDispatch || !isHost) return
    if (!team.checks.some(c => c.id === check.id)) { teamDispatch({ type: 'CHECK_ADD', check: { id: check.id, name: check.name, at: check.createdAt, templateId: check.templateId } }); return }
    const score = check.phase === 'vote' ? null : overall(summarizeSafe(check, minAnon))
    const r = team.results[check.id]
    if (!r || r.score !== score || r.votes !== voters || r.phase !== check.phase) teamDispatch({ type: 'CHECK_RESULT', id: check.id, score, votes: voters, phase: check.phase })
  }, [check.phase, voters, !!team, team?.checks.length, isHost]) // eslint-disable-line react-hooks/exhaustive-deps
  const canReveal = voters >= minAnon
  const reveal = () => { if (canReveal) setModal('reveal') }
  const del = () => {
    deleteVerified(check.id, identity.secret).then(ok => {
      if (!ok) { showToast(t.chk.delFail); return }
      teamDispatch?.({ type: 'CHECK_REMOVE', id: check.id })
      forgetDoc(CHECKS, check.id)
      navigate(team ? `/health/${team.id}/checks` : '/health')
    })
  }
  const back = team ? `#/health/${team.id}` : '#/health'
  return (
    <main className="tool-page pl-page pl-check">
      <header className="pl-check-head">
        <a className="icon-btn" href={back} aria-label={team ? fill(t.chk.back, { team: team.name }) : t.chk.backAll} title={team ? fill(t.chk.back, { team: team.name }) : t.chk.backAll}><Icon name="left" /></a>
        <div className="pl-team-title">
          {team && <a href={back} className="pl-crumb">{team.name}</a>}
          <h1>{name}</h1>
        </div>
        <span className={`pl-phase ${check.phase}`}>{t.chk.phases[check.phase]}</span>
        <div className="pl-team-tools">
          {check.phase === 'vote' && (isHost || !phone) && <ShareMenu links={[{ key: 'c', title: name, hint: fill(t.chk.anon, { m: minAnon }), url: window.location.href.split('#')[0] + `#/health/${check.id}` }]} />}
          {isHost && <HostControls check={check} dispatch={dispatch} t={t} onReveal={reveal} canReveal={canReveal} voters={voters} minAnon={minAnon} onDelete={isOwner ? () => setModal('delete') : null} onAttach={() => setModal('attach')} hasTeam={!!check.teamId} />}
        </div>
      </header>
      {error && <div className="sync-banner" role="alert">{t.err.sync}</div>}
      {check.phase === 'vote'
        ? <Voting check={check} ballot={ballot} isHost={isHost} dispatch={dispatch} t={t} lang={lang} voters={voters} team={team} minAnon={minAnon} onReveal={reveal} canReveal={canReveal} phone={phone} />
        : <Results check={check} isHost={isHost} dispatch={dispatch} t={t} lang={lang} team={team} teamDispatch={teamDispatch} minAnon={minAnon} />}
      {modal === 'reveal' && <Confirm title={t.chk.reveal} text={t.chk.revealQ} yes={t.chk.reveal} no={t.chk.wait} onYes={() => dispatch({ type: 'PHASE', phase: 'reveal' })} onClose={() => setModal(null)} />}
      {modal === 'delete' && <Confirm title={t.chk.deleteCheck} text={t.chk.deleteQ} yes={t.chk.del} no={t.chk.cancel} danger onYes={del} onClose={() => setModal(null)} />}
      {modal === 'attach' && <AttachModal check={check} dispatch={dispatch} onClose={() => setModal(null)} />}
      <Toast />
    </main>
  )
}

function usePhone() {
  const q = '(max-width: 640px)'
  const [m, setM] = useState(() => window.matchMedia?.(q).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(q)
    if (!mq) return
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

function HostControls({ check, dispatch, t, onReveal, canReveal, voters, minAnon, onDelete, onAttach, hasTeam }) {
  return <>
    {check.phase === 'vote' && <button className="btn primary" onClick={onReveal} disabled={!canReveal} title={canReveal ? undefined : fill(t.chk.revealNeed, { m: minAnon, n: voters })}><Icon name="eye" /> {t.chk.reveal}</button>}
    {check.phase === 'reveal' && <button className="btn ghost sm" onClick={() => dispatch({ type: 'PHASE', phase: 'closed' })}><Icon name="lock" /> {t.chk.close}</button>}
    {check.phase === 'closed' && <button className="btn ghost sm" onClick={() => dispatch({ type: 'PHASE', phase: 'reveal' })}>{t.chk.reopen}</button>}
    {!hasTeam && <button className="btn ghost sm" onClick={onAttach}><Icon name="users" size={14} /> {t.chk.addToTeam}</button>}
    {onDelete && <button className="icon-btn" title={t.chk.deleteCheck} aria-label={t.chk.deleteCheck} onClick={onDelete}><Icon name="trash" /></button>}
  </>
}

// ---------- voting ----------

function AreaCard({ q, a, answer, check, t, step }) {
  const lightIdx = LIGHTS.indexOf(a.light)
  const trendIdx = TRENDS.indexOf(a.trend)
  return (
    <section className={`pl-vcard ${a.light ? `voted ${a.light}` : ''}`} aria-label={q.title}>
      {step && <span className="pl-step-label">{step}</span>}
      <h3><span className="pl-emoji" aria-hidden="true">{q.emoji}</span> {q.title}</h3>
      {q.good && <p className="pl-good"><span className="pl-mark g" aria-hidden="true">{LIGHT_MARK.g}</span>{q.good}</p>}
      {q.bad && <p className="pl-bad"><span className="pl-mark r" aria-hidden="true">{LIGHT_MARK.r}</span>{q.bad}</p>}
      <div className="pl-lights" role="radiogroup" aria-label={q.title} onKeyDown={rovingKeys}>
        {LIGHTS.map((l, i) => (
          <button key={l} role="radio" aria-checked={a.light === l} tabIndex={rovingTab(a.light === l, i, lightIdx >= 0)} className={`pl-light ${l} ${a.light === l ? 'on' : ''}`} onClick={() => answer(q.id, { light: l })}>
            <i aria-hidden="true">{LIGHT_MARK[l]}</i>{t.chk.light[l]}
          </button>
        ))}
      </div>
      {check.settings.trends && <div className="pl-trend" role="radiogroup" aria-label={`${q.title}: ${t.chk.trendQ}`} onKeyDown={rovingKeys}>
        <span className="pl-trend-q">{t.chk.trendQ}</span>
        {TRENDS.map((x, i) => <button key={x} role="radio" aria-checked={a.trend === x} tabIndex={rovingTab(a.trend === x, i, trendIdx >= 0)} className={`chip-btn ${a.trend === x ? 'sel' : ''}`} onClick={() => answer(q.id, { trend: x })}><span aria-hidden="true">{TREND_ICON[x]}</span> {t.chk.trend[x]}</button>)}
      </div>}
      {check.settings.comments && <NoteInput value={a.note ?? ''} onSave={note => answer(q.id, { note: note || null })} placeholder={t.chk.note} label={`${q.title}: ${t.chk.note}`} />}
    </section>
  )
}

function Voting({ check, ballot, isHost, dispatch, t, lang, voters, team, minAnon, onReveal, canReveal, phone }) {
  const mine = check.ballots[ballot] ?? {}
  const answered = check.questions.filter(q => mine[q.id]?.light).length
  const total = check.questions.length
  const done = answered === total
  const answer = (qid, patch) => dispatch({ type: 'ANSWER', ballot, qid, patch })
  const size = team?.settings.size
  const [mode, setMode] = useState(phone ? 'one' : 'all')
  useEffect(() => { setMode(phone ? 'one' : 'all') }, [phone])
  const [idx, setIdx] = useState(() => Math.max(0, check.questions.findIndex(q => !mine[q.id]?.light)))
  const [summary, setSummary] = useState(false)
  const topRef = useRef(null)
  const touch = useRef(null)
  const go = i => {
    if (i >= total) { setSummary(true); return }
    setSummary(false)
    setIdx(Math.max(0, Math.min(total - 1, i)))
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const qs = check.questions.map(raw => localQuestion(raw, lang))
  return (
    <>
      <section className="pl-vote-top" ref={topRef}>
        <p className="pl-anon-line"><Icon name="shield" size={16} /> <span>{fill(t.chk.anon, { m: minAnon })}</span></p>
        <AnonNote t={t} m={minAnon} />
      </section>
      <div className="pl-vote-sticky">
        <div className="pl-vote-progress">
          <div className="pl-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label={fill(t.chk.answered, { a: answered, t: total })}><i style={{ width: `${(answered / total) * 100}%` }} /></div>
          <span className="small"><b>{fill(t.chk.answered, { a: answered, t: total })}</b> · <Icon name="users" size={13} className="inline" /> {size ? fill(t.chk.ofSize, { n: voters, s: size }) : voters === 0 ? t.chk.progress0 : plural(voters, t.chk.progress1, t.chk.progress)}</span>
          <span className="spacer" />
          <div className="seg small-seg" role="radiogroup" aria-label={t.chk.oneByOne} onKeyDown={rovingKeys}>
            <button role="radio" aria-checked={mode === 'one'} tabIndex={mode === 'one' ? 0 : -1} className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>{t.chk.oneByOne}</button>
            <button role="radio" aria-checked={mode === 'all'} tabIndex={mode === 'all' ? 0 : -1} className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>{t.chk.allAreas}</button>
          </div>
        </div>
      </div>
      {mode === 'all' ? (
        <div className="pl-vote-grid">
          {qs.map(q => <AreaCard key={q.id} q={q} a={mine[q.id] ?? {}} answer={answer} check={check} t={t} />)}
        </div>
      ) : summary ? (
        <section className="tool-card pl-vote-summary">
          <ul>
            {qs.map((q, i) => { const l = mine[q.id]?.light; return (
              <li key={q.id}><button className="pl-sum-row" onClick={() => go(i)}><span aria-hidden="true">{q.emoji}</span><span className="grow">{q.title}</span>{l ? <span className={`pl-sum-light ${l}`}><i aria-hidden="true">{LIGHT_MARK[l]}</i> {t.chk.light[l]}</span> : <span className="muted">–</span>}</button></li>
            ) })}
          </ul>
        </section>
      ) : (
        <div className="pl-stepper" onTouchStart={e => { touch.current = e.touches[0].clientX }} onTouchEnd={e => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 70 && !e.target.closest('input')) go(idx + (dx < 0 ? 1 : -1))
        }}>
          <AreaCard key={qs[idx].id} q={qs[idx]} a={mine[qs[idx].id] ?? {}} answer={answer} check={check} t={t} step={fill(t.chk.step, { i: idx + 1, n: total })} />
          <div className="pl-step-nav">
            <button className="btn ghost lg" onClick={() => go(idx - 1)} disabled={idx === 0}><Icon name="left" size={14} /> {t.chk.prev}</button>
            <div className="pl-dots" aria-hidden="true">{qs.map((q, i) => <i key={q.id} className={`${i === idx ? 'cur' : ''} ${mine[q.id]?.light ?? ''}`} />)}</div>
            <button className={`btn ${isHost ? 'ghost' : 'primary'} lg`} onClick={() => go(idx + 1)}>{idx === total - 1 ? t.chk.finish : t.chk.next} <Icon name="right" size={14} /></button>
          </div>
        </div>
      )}
      <section className={`pl-vote-foot ${done ? 'done' : ''}`}>
        {done ? <p><Icon name="check" size={16} /> {t.chk.allDone} {!isHost && t.chk.waiting}</p> : <p className="muted">{fill(t.chk.answered, { a: answered, t: total })}</p>}
        {isHost && <div className="pl-reveal-box">
          {!canReveal && <span className="small muted">{fill(t.chk.revealNeed, { m: minAnon, n: voters })}</span>}
          <button className="btn primary" onClick={onReveal} disabled={!canReveal}><Icon name="eye" /> {t.chk.reveal}</button>
        </div>}
      </section>
    </>
  )
}

function NoteInput({ value, onSave, placeholder, label }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return <input className="pl-note" value={text} maxLength={500} placeholder={placeholder} aria-label={label} onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
}

// ---------- results ----------

// The previous completed check of the same team, for "change since last check".
function usePrevious(check, team) {
  const [prev, setPrev] = useState(null)
  const ids = team
    ? team.checks.filter(c => c.id !== check.id && c.at < check.createdAt).map(c => c.id)
    : rememberedDocs(CHECKS).filter(c => c.id !== check.id && c.at < check.createdAt && !c.teamId && (c.team ?? '') === (check.team ?? '')).map(c => c.id)
  const key = ids.slice(-6).join(',')
  useEffect(() => {
    if (!key || !backend) return
    let live = true
    loadDocs(key.split(','), reduceCheck).then(docs => {
      const qids = new Set(check.questions.map(q => q.id))
      const d = docs.filter(x => isComplete(x) && x.questions.some(q => qids.has(q.id))).sort((a, b) => b.createdAt - a.createdAt)[0]
      if (live) setPrev(d ?? null)
    }).catch(() => {})
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return prev
}

function Results({ check, isHost, dispatch, t, lang, team, teamDispatch, minAnon }) {
  const [order, setOrder] = useState('discussion')
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(null)
  const prev = usePrevious(check, team)
  const rows = summarizeSafe(check, minAnon)
  const prevRows = prev ? summarizeSafe(prev) : null
  const hiddenRows = rows.filter(r => r.hidden && r.hiddenN > 0)
  const hiddenAreas = hiddenRows.length
  const delta = r => { const p = prevRows?.find(x => x.q.id === r.q.id); return p?.score != null && r.score != null ? r.score - p.score : null }
  const total = overall(rows)
  const votes = ballotCount(check)
  const safe = votes >= minAnon
  const ordered = order === 'discussion' ? discussionOrder(rows) : rows.filter(r => r.n)
  const topRed = ordered.length && order === 'discussion' ? ordered[0] : null
  const areas = check.questions.map(q => ({ id: q.id, title: areaTitle(q, lang) }))
  const mineActions = team ? team.actions.filter(x => x.checkId === check.id) : []
  const review = team ? toReview(team, check.id) : []
  const csv = () => {
    const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    return ['area,green,amber,red,score,comments', ...rows.filter(r => !r.hidden).map(r => [areaTitle(r.q, lang), r.lights.g, r.lights.a, r.lights.r, r.score ?? '', r.notes.join(' | ')].map(x => q(String(x))).join(','))].join('\n')
  }
  const download = () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv()], { type: 'text/csv' })), download: `${check.name}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const summary = () => {
    const L = [`${checkName(check.name, check.createdAt, t.create.defName, lang)}: ${t.chk.overall} ${total}/100 (${plural(votes, t.chk.votes1, t.chk.votes)})`, '']
    for (const r of discussionOrder(rows)) L.push(`- ${areaTitle(r.q, lang)}: ${r.score} (${r.lights.g}/${r.lights.a}/${r.lights.r})`)
    if (mineActions.length) { L.push('', `${t.chk.actionsHere}:`); for (const x of mineActions) L.push(`- ${x.text}${x.owner ? ` (${x.owner})` : ''}`) }
    return L.join('\n')
  }
  if (!rows.some(r => r.n)) return <section className="tool-card pl-empty"><Icon name="lock" size={24} /><h2>{!votes ? t.chk.noVotes : !check.v ? fill(t.chk.legacyHidden, { m: minAnon, n: votes }) : fill(t.chk.fewVotes, { m: minAnon })}</h2>{isHost && (votes < minAnon) && <button className="btn ghost" onClick={() => dispatch({ type: 'PHASE', phase: 'vote' })}>{t.chk.backToVote}</button>}</section>
  return (
    <>
      {check.phase === 'closed' && <p className="tool-note small">{t.chk.closedNote}</p>}
      <div className="pl-results-top">
        <section className="tool-card pl-overall">
          <span className="pl-kpi-label">{t.chk.overall}</span>
          <Score value={total} big />
          <span className="muted small">/ 100 · {plural(votes, t.chk.votes1, t.chk.votes)}{prev && overall(prevRows) != null ? ` · ${t.chk.vsPrev}: ${total - overall(prevRows) > 0 ? '+' : ''}${total - overall(prevRows)}` : ''}</span>
          <div className="row wrap center">
            <button className="btn ghost sm" onClick={() => copyText(summary()).then(ok => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800) } })}><Icon name="copy" /> {copied ? t.chk.copied : t.chk.copyText}</button>
            <button className="btn ghost sm" onClick={download}><Icon name="download" /> {t.chk.exportCsv}</button>
          </div>
        </section>
        <section className="tool-card"><h2>{t.chk.ranked}</h2><RankedBars rows={rows} lang={lang} t={t} /></section>
      </div>
      {hiddenAreas > 0 && <p className="tool-note small" role="note"><Icon name="lock" size={14} className="inline" /> {fill(hiddenAreas === 1 ? t.chk.someHidden1 : t.chk.someHiddenN, { n: hiddenAreas, m: minAnon, names: hiddenRows.map(r => areaTitle(r.q, lang)).join(lang === 'zh' ? '、' : ', ') })}</p>}
      {review.length > 0 && (
        <section className="tool-card pl-review-box-open">
          <h2>{t.chk.review} <span className="pl-count">{review.length}</span></h2>
          <p className="muted small">{isHost ? t.chk.reviewHint : t.chk.reviewRO}</p>
          <ActionList items={review} dispatch={teamDispatch} now={Date.now()} review={isHost} checkId={check.id} canEdit={isHost} />
        </section>
      )}
      <section className="tool-card">
        <div className="tool-card-head">
          <div className="seg small-seg" role="radiogroup" aria-label={t.chk.order} onKeyDown={rovingKeys}>
            <button role="radio" aria-checked={order === 'discussion'} tabIndex={order === 'discussion' ? 0 : -1} className={order === 'discussion' ? 'on' : ''} onClick={() => setOrder('discussion')}>{t.chk.order}</button>
            <button role="radio" aria-checked={order === 'original'} tabIndex={order === 'original' ? 0 : -1} className={order === 'original' ? 'on' : ''} onClick={() => setOrder('original')}>{t.chk.original}</button>
          </div>
          {order === 'discussion' && <span className="muted small">{t.chk.orderHint}</span>}
        </div>
        <div className="pl-rows">
          {ordered.map(r => {
            const focused = check.focusId === r.q.id
            const d = delta(r)
            const showNotes = safe && (focused || check.phase === 'closed') && r.notes.length > 0
            const isSplit = r.n >= 3 && split(r.lights) >= 0.38
            const title = areaTitle(r.q, lang)
            return (
              <div key={r.q.id} className={`pl-row ${focused ? 'focused' : ''}`}>
                <div className="pl-row-head">
                  <span className="pl-row-title"><span className="pl-emoji" aria-hidden="true">{r.q.emoji}</span> {title}</span>
                  {topRed === r && r.lights.r > 0 && <span className="pl-tag r">{t.chk.mostRed}</span>}
                  {isSplit && <span className="pl-tag">{t.chk.splitTag}</span>}
                  {r.trend && <span className={`pl-arrow ${r.trend}`} title={t.chk.trend[r.trend]}><span aria-hidden="true">{TREND_ICON[r.trend]}</span><span className="sr-only">{t.chk.trend[r.trend]}</span></span>}
                  {d != null && d !== 0 && <span className={`pl-delta ${d > 0 ? 'up' : 'down'}`} title={t.chk.delta}>{d > 0 ? '+' : ''}{d}</span>}
                  <Score value={r.score} />
                  {isHost && (check.phase === 'reveal' || teamDispatch) ? <span className="pl-row-btns">
                    {isHost && check.phase === 'reveal' && <button className={`btn ghost sm ${focused ? 'on-soft' : ''}`} onClick={() => dispatch({ type: 'FOCUS', qid: focused ? null : r.q.id })} aria-pressed={focused}>{focused ? t.chk.discussing : t.chk.discuss}</button>}
                    {teamDispatch && isHost && <button className="btn ghost sm" onClick={() => setAdding(adding === r.q.id ? null : r.q.id)} aria-expanded={adding === r.q.id} aria-label={fill(t.chk.addFor, { area: title })}><Icon name="plus" size={14} /> {t.chk.addAction}</button>}
                  </span> : null}
                </div>
                <div className="pl-dist" role="img" aria-label={`${t.chk.light.g} ${r.lights.g}, ${t.chk.light.a} ${r.lights.a}, ${t.chk.light.r} ${r.lights.r}`}>
                  {LIGHTS.map(l => r.lights[l] > 0 && <i key={l} className={l} style={{ flex: r.lights[l] }}><span aria-hidden="true">{LIGHT_MARK[l]}</span> {r.lights[l]}</i>)}
                </div>
                {r.notes.length > 0 && !showNotes && <span className="muted small"><Icon name="comment" size={13} className="inline" /> {plural(r.notes.length, t.chk.comment1, t.chk.comments)}{safe && !focused && check.phase !== 'closed' ? ` · ${t.chk.commentsHidden}` : ''}</span>}
                {showNotes && <ul className="pl-notes">{r.notes.map((n, i) => <li key={i}>“{n}”</li>)}</ul>}
                {adding === r.q.id && teamDispatch && <div className="pl-inline-form"><span className="small"><b>{fill(t.chk.addFor, { area: title })}</b></span><ActionForm areas={areas} dispatch={teamDispatch} checkId={check.id} defaultArea={r.q.id} compact onDone={() => setAdding(null)} /></div>}
              </div>
            )
          })}
        </div>
      </section>
      {team && teamDispatch ? (
        <section className="tool-card">
          <h2>{t.chk.actionsHere}</h2>
          {mineActions.length ? <ActionList items={mineActions} dispatch={teamDispatch} now={Date.now()} canEdit={isHost} /> : <p className="muted small">{t.act.noneHint}</p>}
          {isHost && <ActionForm areas={areas} dispatch={teamDispatch} checkId={check.id} defaultArea={check.focusId ?? ''} />}
        </section>
      ) : <LegacyActions check={check} dispatch={dispatch} t={t} locked={!isHost} lang={lang} />}
    </>
  )
}

// Checks without a team keep their own simple action list (as before team spaces).
function LegacyActions({ check, dispatch, t, locked, lang }) {
  const [text, setText] = useState('')
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'ADD_ACTION', text: text.trim(), qid: check.focusId })
    setText('')
  }
  return (
    <section className="tool-card">
      <h2>{t.act.title}</h2>
      {check.actions.length === 0 && <p className="muted small">{t.act.noneHint}</p>}
      <ul className="pl-actions">
        {check.actions.map(a => {
          const q = check.questions.find(x => x.id === a.qid)
          return (
            <li key={a.id} className="pl-action">
              <div className="pl-action-main">
                <button className={`pl-done-box ${a.done ? 'on' : ''}`} role="checkbox" aria-checked={a.done} disabled={locked} aria-label={a.text} onClick={() => dispatch({ type: 'UPDATE_ACTION', actionId: a.id, patch: { done: !a.done } })}>{a.done && <Icon name="check" size={14} />}</button>
                <div className="pl-action-body"><span className="pl-action-text">{a.text}</span>{q && <span className="pl-action-meta"><span className="pl-chip">{areaTitle(q, lang)}</span></span>}</div>
                {!locked && <button className="icon-btn sm" aria-label={`${t.act.del}: ${a.text}`} onClick={() => { dispatch({ type: 'DELETE_ACTION', actionId: a.id }); showToast(t.act.deleted) }}><Icon name="trash" size={14} /></button>}
              </div>
            </li>
          )
        })}
      </ul>
      {!locked && <form className="menu-form plain pl-legacy-form" onSubmit={add}><input value={text} onChange={e => setText(e.target.value)} placeholder={t.act.textPh} maxLength={300} aria-label={t.act.text} /><button className="btn primary sm" disabled={!text.trim()}>{t.act.add}</button></form>}
    </section>
  )
}

// Add a one-off check to one of this browser's teams.
function AttachModal({ check, dispatch, onClose }) {
  const [t] = useT()
  const { identity } = useStore()
  const [teams, setTeams] = useState(null)
  useEffect(() => {
    loadDocs(rememberedDocs(TEAMS).map(x => x.id), reduceTeam).then(ds => setTeams(ds.filter(d => d.kind === 'team' && hostKeyFor(d.id)))).catch(() => setTeams([]))
  }, [identity.id])
  const pick = async team => {
    await postAction(team.id, { type: 'CHECK_ADD', check: { id: check.id, name: check.name, at: check.createdAt, templateId: check.templateId } })
    dispatch({ type: 'ATTACH_TEAM', teamId: team.id, teamName: team.name })
    showToast(fill(t.chk.addedTo, { team: team.name }))
    onClose()
  }
  return (
    <Modal title={t.chk.addToTeam} onClose={onClose}>
      {!teams ? <p className="muted">{t.common.loading}</p> : !teams.length ? <p className="muted">{t.home.noneHint}</p> : (
        <ul className="doc-list">{teams.map(tm => <li key={tm.id}><button className="grow pl-pick" onClick={() => pick(tm)}><b>{tm.name}</b><span className="muted small">{plural(tm.checks.length, t.checks.n1, t.checks.nN)}</span></button></li>)}</ul>
      )}
    </Modal>
  )
}

// Areas ranked by score, each bar labelled with its name and number (readable without colour).
function RankedBars({ rows, lang, t }) {
  const shown = rows.filter(r => r.score != null).sort((a, b) => b.score - a.score)
  return (
    <ul className="pl-ranked" aria-label={t.chk.ranked}>
      {shown.map(r => (
        <li key={r.q.id}>
          <span className="pl-ranked-name"><span aria-hidden="true">{r.q.emoji}</span> {areaTitle(r.q, lang)}</span>
          <span className="pl-ranked-track"><i className={moodOf(r.score)} style={{ width: `${Math.max(2, r.score)}%` }} /></span>
          <b className="pl-ranked-num">{r.score}</b>
        </li>
      ))}
    </ul>
  )
}
