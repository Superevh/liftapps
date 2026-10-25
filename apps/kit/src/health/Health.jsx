import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, newBoardId, personalStorage } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate } from '../core/ui.jsx'
import { confetti } from '../core/fx.js'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, fill, ago, HowTo } from '../core/tools-ui.jsx'
import { HOWTO } from '../core/howto.js'
import './health.css'
import { TEMPLATES, templateQuestions, newCheck, reduce, summarize, ballotCount, overall, checkCsv, LIGHTS, TRENDS } from './model.js'

const T = {
  en: {
    eyebrow: 'Team health check', title: 'How is the team really doing?', lead: 'Everyone rates each area green, amber or red in private. Reveal together, spot patterns over time, and turn the weak spots into your next retrospective.',
    create: 'Start a health check', name: 'Name', namePh: 'e.g. October health check', team: 'Team', teamPh: 'e.g. Payments squad', template: 'Questions', start: 'Start check',
    custom: 'Write your own', customPh: 'One area per line: Title | what healthy looks like | what unhealthy looks like', areas: '{n} areas',
    yours: 'Your health checks', none: 'Health checks you run or join will show up here.', trends: 'Team trends', trendsHint: 'Score per area across your checks (100 = all green).', remove: 'Remove', loadingTrends: 'Loading…',
    light: { g: 'Healthy', a: 'Some problems', r: 'Unhealthy' }, trend: { up: 'Getting better', flat: 'Same', down: 'Getting worse' },
    phases: { vote: 'Voting', reveal: 'Results', closed: 'Closed' }, anonymous: 'Your answers are stored without your name, so nobody (not even the facilitator) can see who voted what.',
    yourVote: 'Your answers', answered: '{a} of {t} areas answered', note: 'Add a comment (optional, anonymous)', progress: '{n} people have voted', progress1: '1 person has voted', waiting: 'Waiting for the facilitator to reveal the results.',
    reveal: 'Reveal results', backToVote: 'Back to voting', close: 'Close check', reopen: 'Reopen', overall: 'Overall health', score: 'score', votes: '{n} votes', votes1: '1 vote',
    comments: 'Comments', commentOne: 'comment', commentMany: 'comments', discuss: 'Discuss', discussing: 'Discussing', actions: 'Action items', actionPh: 'What will we try?', addAction: 'Add', noActions: 'No action items yet.',
    retro: 'Copy the weak spots', copied: 'Copied!', exportCsv: 'Export CSV', worst: 'Needs attention', best: 'Going well', radar: 'Health radar',
    facilitator: 'Facilitator', deleteCheck: 'Delete check', confirm: 'Click again to confirm', retroContext: 'From the health check “{name}”. Areas to talk about:\n{areas}',
    noVotes: 'No votes yet.', fewVotes: 'Fewer than 3 people have voted, so teammates may be able to guess who answered what.', vsPrev: 'Change compared with “{name}”', worstFirst: 'Worst first', back: 'All health checks', trendsCol: 'Trend', closedNote: 'This check is closed. Results are final.',
  },
  zh: {
    eyebrow: '团队健康检查', title: '团队现在真实的状态如何？', lead: '每个人私下给每个方面打红黄绿灯，一起揭晓，长期观察趋势，再把薄弱环节变成一次复盘。',
    create: '开始健康检查', name: '名称', namePh: '例如：十月健康检查', team: '团队', teamPh: '例如：支付小队', template: '问题集', start: '开始检查',
    custom: '自定义', customPh: '每行一个方面：标题 | 健康的样子 | 不健康的样子', areas: '{n} 个方面',
    yours: '我的健康检查', none: '你发起或参加的健康检查会显示在这里。', trends: '团队趋势', trendsHint: '各次检查中每个方面的得分（100 = 全绿）。', remove: '移除', loadingTrends: '加载中…',
    light: { g: '健康', a: '有些问题', r: '不健康' }, trend: { up: '变好', flat: '不变', down: '变差' },
    phases: { vote: '投票中', reveal: '结果', closed: '已结束' }, anonymous: '回答不会和你的名字关联，任何人（包括主持人）都看不到谁投了什么。',
    yourVote: '你的回答', answered: '已回答 {a}/{t} 个方面', note: '补充说明（可选，匿名）', progress: '已有 {n} 人投票', progress1: '已有 1 人投票', waiting: '等待主持人揭晓结果。',
    reveal: '揭晓结果', backToVote: '返回投票', close: '结束检查', reopen: '重新打开', overall: '整体健康度', score: '分', votes: '{n} 票', votes1: '1 票',
    comments: '评论', commentOne: '条评论', commentMany: '条评论', discuss: '讨论', discussing: '正在讨论', actions: '行动项', actionPh: '我们打算尝试什么？', addAction: '添加', noActions: '还没有行动项。',
    retro: '复制薄弱项', copied: '已复制！', exportCsv: '导出 CSV', worst: '需要关注', best: '表现良好', radar: '健康雷达',
    facilitator: '主持人', deleteCheck: '删除检查', confirm: '再点一次确认', retroContext: '来自健康检查“{name}”。需要讨论的方面：\n{areas}',
    noVotes: '还没有投票。', fewVotes: '投票人数少于 3 人，队友可能猜出谁投了什么。', vsPrev: '与“{name}”相比的变化', worstFirst: '最差的排前面', back: '所有健康检查', trendsCol: '趋势', closedNote: '此检查已结束，结果为最终结果。',
  },
}

const KIND = 'health-checks'
const TREND_ICON = { up: '↗', flat: '→', down: '↘' }

// ---------- lobby ----------

export function HealthHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [team, setTeam] = useState(() => rememberedDocs(KIND)[0]?.team ?? '')
  const [tpl, setTpl] = useState('squad')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checks, setChecks] = useState(() => rememberedDocs(KIND))
  const customQs = custom.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).slice(0, 20)
    .map(([title, good = '', bad = ''], i) => ({ id: `c${i}`, emoji: '•', title: title.slice(0, 60), good, bad }))
  const questions = tpl === 'custom' ? customQs : templateQuestions(tpl, lang)
  const create = e => {
    e.preventDefault()
    if (!backend || !questions.length) return
    const id = newDocId('hc')
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const check = newCheck({ id, name: name.trim() || (tpl === 'custom' ? t.eyebrow : TEMPLATES[tpl][lang][0]), team: team.trim(), templateId: tpl, questions, owner, at: Date.now() })
    setBusy(true)
    createDoc(id, check, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: check.name, team: check.team, at: check.createdAt })
      navigate(`/health/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page health-home">
      <section className="tool-hero health-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="hero-lights" aria-hidden="true"><i className="hl g" /><i className="hl a" /><i className="hl r" /></div>
      </section>
      <div className="poker-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <div className="fc-inputs">
            <label><span className="field-label">{t.name}</span><input value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={80} /></label>
            <label><span className="field-label">{t.team}</span><input value={team} onChange={e => setTeam(e.target.value)} placeholder={t.teamPh} maxLength={60} list="hc-teams" /></label>
            <datalist id="hc-teams">{[...new Set(checks.map(c => c.team).filter(Boolean))].map(x => <option key={x} value={x} />)}</datalist>
          </div>
          <span className="field-label">{t.template}</span>
          <div className="hc-templates">
            {Object.keys(TEMPLATES).map(k => (
              <button type="button" key={k} className={`hc-tpl ${tpl === k ? 'sel' : ''}`} onClick={() => setTpl(k)} aria-pressed={tpl === k}>
                <b>{TEMPLATES[k][lang][0]}</b><span>{TEMPLATES[k][lang][1]}</span><small>{fill(t.areas, { n: templateQuestions(k, lang).length })}</small>
              </button>
            ))}
            <button type="button" className={`hc-tpl ${tpl === 'custom' ? 'sel' : ''}`} onClick={() => setTpl('custom')} aria-pressed={tpl === 'custom'}><b>{t.custom}</b><span>{t.customPh.split(':')[0]}</span></button>
          </div>
          {tpl === 'custom'
            ? <textarea className="mt8" rows={5} value={custom} onChange={e => setCustom(e.target.value)} placeholder={t.customPh} />
            : <div className="hc-preview">{questions.map(q => <span key={q.id} title={q.good}>{q.emoji} {q.title}</span>)}</div>}
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy || !backend || !questions.length}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yours}</h2>
          {checks.length ? (
            <ul className="doc-list">
              {checks.map(c => (
                <li key={c.id}>
                  <a href={`#/health/${c.id}`} className="grow"><b>{c.name}</b><span className="muted small">{[c.team, ago(c.at, lang)].filter(Boolean).join(' · ')}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, c.id); setChecks(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.none}</p>}
        </section>
      </div>
      <HowTo tool="health" content={HOWTO.health} />
      {checks.length > 1 && <TeamTrends checks={checks} t={t} lang={lang} />}
    </main>
  )
}

// Heatmap of area scores across this browser's checks, one table per team.
function TeamTrends({ checks, t, lang }) {
  const [docs, setDocs] = useState(null)
  useEffect(() => {
    let live = true
    backend?.getBoards(checks.slice(0, 40).map(c => c.id)).then(rows => {
      if (!live) return
      // Recent events are folded in so results match what people see in the check itself.
      setDocs(rows.map(r => r.events.reduce((d, e) => reduce(d, e.action), r.snapshot)).filter(d => d?.kind === 'health'))
    }).catch(() => live && setDocs([]))
    return () => { live = false }
  }, [checks])
  if (!docs) return <section className="tool-card"><h2>{t.trends}</h2><p className="muted">{t.loadingTrends}</p></section>
  const teams = new Map()
  for (const d of docs.sort((a, b) => a.createdAt - b.createdAt)) {
    const key = `${d.team || '—'}::${d.templateId}`
    if (!teams.has(key)) teams.set(key, [])
    teams.get(key).push(d)
  }
  const groups = [...teams.values()].filter(g => g.length > 1)
  if (!groups.length) return null
  return (
    <section className="tool-card">
      <h2>{t.trends}</h2>
      <p className="muted small">{t.trendsHint}</p>
      {groups.map(g => {
        const rows = g.map(summarize)
        return (
          <div key={g[0].id} className="hc-heat-wrap">
            <h3 className="hc-heat-title">{g[0].team || '—'}</h3>
            <table className="hc-heat">
              <thead><tr><th />{g.map(d => <th key={d.id}><a href={`#/health/${d.id}`} title={d.name}><span className="hc-heat-name">{d.name}</span>{ago(d.createdAt, lang)}</a></th>)}</tr></thead>
              <tbody>
                {g[g.length - 1].questions.map((q, qi) => (
                  <tr key={q.id}>
                    <td className="hc-heat-q">{q.emoji} {q.title}</td>
                    {rows.map((r, di) => { const cell = r.find(x => x.q.id === q.id) ?? r[qi]; return <td key={di}><span className={`heat ${cell?.mood ?? ''}`}>{cell?.score ?? '–'}</span></td> })}
                  </tr>
                ))}
                <tr className="hc-heat-total"><td>{t.overall}</td>{rows.map((r, i) => <td key={i}><b>{overall(r) ?? '–'}</b></td>)}</tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
}

// ---------- check ----------

function ballotId(checkId) {
  const key = `lift-ballot-${checkId}`
  try {
    let b = personalStorage().getItem(key)
    if (!b) { b = newBoardId(); personalStorage().setItem(key, b) }
    return b
  } catch { return newBoardId() }
}

export function HealthCheck({ id }) {
  const { identity } = useStore()
  const { status, doc: check, dispatch, error } = useLiveDoc(id, reduce)
  const ballot = useMemo(() => ballotId(id), [id])
  const me = identity.id
  useEffect(() => {
    if (!check || !identity.name) return
    const p = check.people[me]
    if (!p || p.name !== identity.name || p.color !== identity.color) dispatch({ type: 'JOIN', person: { id: me, name: identity.name, color: identity.color } })
  }, [!!check, identity.name, identity.color]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (check) rememberDoc(KIND, { id, name: check.name, team: check.team, at: check.createdAt })
  }, [id, check?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  if (status !== 'ready') return <DocStatus status={status} />
  return <Check check={check} me={me} ballot={ballot} dispatch={dispatch} error={error} />
}

function Check({ check, me, ballot, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const isHost = check.ownerId === me
  const voters = ballotCount(check)
  const mine = check.ballots[ballot] ?? {}
  const answered = check.questions.filter(q => mine[q.id]?.light).length
  const prevPhase = useRef(check.phase)
  useEffect(() => {
    if (prevPhase.current === 'vote' && check.phase === 'reveal' && (overall(summarize(check)) ?? 0) >= 75) confetti(2400)
    prevPhase.current = check.phase
  }, [check.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className="tool-page hc-page">
      <div className="poker-bar">
        <a className="icon-btn" href="#/health" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <h1 className="room-name">{check.name}</h1>
        {check.team && <span className="deck-chip">{check.team}</span>}
        <span className={`phase-chip ${check.phase}`}>{t.phases[check.phase]}</span>
        <span className="spacer" />
        <span className="muted small icon-text"><Icon name="users" size={14} /> {voters === 1 ? t.progress1 : fill(t.progress, { n: voters })}</span>
        {isHost && <HostControls check={check} dispatch={dispatch} t={t} />}
        <InviteButton primary={check.phase === 'vote'} />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}
      {check.phase === 'vote'
        ? <Voting check={check} mine={mine} ballot={ballot} answered={answered} isHost={isHost} dispatch={dispatch} t={t} />
        : <Results check={check} isHost={isHost} dispatch={dispatch} t={t} lang={lang} />}
    </main>
  )
}

function HostControls({ check, dispatch, t }) {
  const { identity } = useStore()
  const [confirm, setConfirm] = useState(false)
  const del = () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return }
    deleteDoc(check.id, identity.secret).finally(() => { forgetDoc(KIND, check.id); navigate('/health') })
  }
  return <>
    {check.phase === 'vote' && <button className="btn primary" onClick={() => dispatch({ type: 'PHASE', phase: 'reveal' })}><Icon name="eye" /> {t.reveal}</button>}
    {check.phase === 'reveal' && <>
      <button className="btn ghost sm" onClick={() => dispatch({ type: 'PHASE', phase: 'vote' })}>{t.backToVote}</button>
      <button className="btn ghost sm" onClick={() => dispatch({ type: 'PHASE', phase: 'closed' })}><Icon name="lock" /> {t.close}</button>
    </>}
    {check.phase === 'closed' && <button className="btn ghost sm" onClick={() => dispatch({ type: 'PHASE', phase: 'reveal' })}>{t.reopen}</button>}
    <button className="icon-btn" title={confirm ? t.confirm : t.deleteCheck} aria-label={t.deleteCheck} onClick={del}><Icon name="trash" className={confirm ? 'danger' : ''} /></button>
  </>
}

function Voting({ check, mine, ballot, answered, isHost, dispatch, t }) {
  const answer = (qid, patch) => dispatch({ type: 'ANSWER', ballot, qid, patch })
  const done = answered === check.questions.length
  return (
    <>
      <div className="hc-intro">
        <p className="muted small"><Icon name="shield" size={14} /> {t.anonymous}</p>
        <div className="hc-progress"><i style={{ width: `${(answered / check.questions.length) * 100}%` }} /></div>
        <span className="small">{fill(t.answered, { a: answered, t: check.questions.length })}</span>
      </div>
      <div className="hc-grid">
        {check.questions.map(q => {
          const a = mine[q.id] ?? {}
          return (
            <section key={q.id} className={`hc-card ${a.light ? `voted ${a.light}` : ''}`}>
              <h3><span className="hc-emoji">{q.emoji}</span> {q.title}</h3>
              <p className="hc-good"><span className="hc-dot g" />{q.good}</p>
              <p className="hc-bad"><span className="hc-dot r" />{q.bad}</p>
              <div className="hc-lights" role="radiogroup" aria-label={q.title}>
                {LIGHTS.map(l => (
                  <button key={l} role="radio" aria-checked={a.light === l} className={`hc-light ${l} ${a.light === l ? 'on' : ''}`} onClick={() => answer(q.id, { light: a.light === l ? null : l })}>
                    <i />{t.light[l]}
                  </button>
                ))}
              </div>
              {check.settings.trends && <div className="hc-trend" role="radiogroup" aria-label={t.trendsCol}>
                {TRENDS.map(x => <button key={x} role="radio" aria-checked={a.trend === x} className={`chip-btn ${a.trend === x ? 'sel' : ''}`} onClick={() => answer(q.id, { trend: a.trend === x ? null : x })}>{TREND_ICON[x]} {t.trend[x]}</button>)}
              </div>}
              {check.settings.comments && <NoteInput value={a.note ?? ''} onSave={note => answer(q.id, { note: note || null })} placeholder={t.note} />}
            </section>
          )
        })}
      </div>
      {done && !isHost && <p className="tool-note center-text">✅ {t.waiting}</p>}
    </>
  )
}

function NoteInput({ value, onSave, placeholder }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return <input className="hc-note" value={text} maxLength={500} placeholder={placeholder} onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
}

// The team's previous check with the same questions, if this browser knows it.
function usePrevious(check) {
  const [prev, setPrev] = useState(null)
  useEffect(() => {
    const candidates = rememberedDocs(KIND).filter(c => c.id !== check.id && c.at < check.createdAt && (c.team ?? '') === (check.team ?? '')).map(c => c.id)
    if (!candidates.length || !backend) return
    let live = true
    backend.getBoards(candidates.slice(0, 20)).then(rows => {
      const docs = rows.map(r => r.events.reduce((d, e) => reduce(d, e.action), r.snapshot))
        .filter(d => d?.kind === 'health' && d.templateId === check.templateId && d.phase !== 'vote' && ballotCount(d) > 0)
        .sort((a, b) => b.createdAt - a.createdAt)
      if (live && docs[0]) setPrev(docs[0])
    }).catch(() => {})
    return () => { live = false }
  }, [check.id, check.team, check.templateId, check.createdAt])
  return prev
}

function Results({ check, isHost, dispatch, t, lang }) {
  const [copied, setCopied] = useState(false)
  const [worstFirst, setWorstFirst] = useState(false)
  const prev = usePrevious(check)
  const prevRows = prev ? summarize(prev) : null
  const delta = r => { const p = prevRows?.find(x => x.q.id === r.q.id); return p?.score != null && r.score != null ? r.score - p.score : null }
  const rows = summarize(check)
  const total = overall(rows)
  const sorted = [...rows].filter(r => r.n).sort((a, b) => a.score - b.score)
  const weak = sorted.filter(r => r.score < 67)
  const download = () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([checkCsv(check)], { type: 'text/csv' })), download: `${check.name}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  // Hands the weak spots over as plain text, ready for a retrospective (e.g. in RetroLift).
  const copyWeak = () => {
    const areas = (weak.length ? weak : sorted.slice(0, 3)).map(r => `- ${r.q.title} (${r.score}/100)`).join('\n')
    navigator.clipboard?.writeText(fill(t.retroContext, { name: check.name, areas })).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  if (!rows.some(r => r.n)) return <p className="tool-note">{t.noVotes}</p>
  return (
    <>
      {check.phase === 'closed' && <p className="tool-note">{t.closedNote}</p>}
      <div className="hc-results-top">
        <section className="tool-card hc-overall">
          <span className="field-label">{t.overall}</span>
          <b className={`hc-big ${total >= 67 ? 'g' : total >= 40 ? 'a' : 'r'}`}>{total}</b>
          <span className="muted small">/ 100 · {ballotCount(check) === 1 ? t.votes1 : fill(t.votes, { n: ballotCount(check) })}</span>
          <div className="row wrap center">
            <button className="btn primary sm" onClick={copyWeak}><Icon name="copy" /> {copied ? t.copied : t.retro}</button>
            <button className="btn ghost sm" onClick={download}><Icon name="download" /> {t.exportCsv}</button>
          </div>
        </section>
        <section className="tool-card"><h2>{t.radar}</h2><Radar rows={rows} /></section>
      </div>
      {ballotCount(check) < 3 && <p className="tool-note small">🔒 {t.fewVotes}</p>}
      <section className="tool-card">
        <div className="tool-card-head">
          <span className="muted small">{prev ? fill(t.vsPrev, { name: prev.name }) : ''}</span>
          <label className="check"><input type="checkbox" checked={worstFirst} onChange={e => setWorstFirst(e.target.checked)} /> {t.worstFirst}</label>
        </div>
        <div className="hc-rows">
          {(worstFirst ? [...rows].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)) : rows).map(r => {
            const focused = check.focusId === r.q.id
            return (
              <div key={r.q.id} className={`hc-row ${focused ? 'focused' : ''}`}>
                <div className="hc-row-head">
                  <span className="hc-row-title"><span className="hc-emoji">{r.q.emoji}</span> {r.q.title}</span>
                  {r.trend && <span className={`hc-arrow ${r.trend}`} title={t.trend[r.trend]}>{TREND_ICON[r.trend]}</span>}
                  {delta(r) != null && delta(r) !== 0 && <span className={`hc-delta ${delta(r) > 0 ? 'up' : 'down'}`}>{delta(r) > 0 ? '+' : ''}{delta(r)}</span>}
                  <span className={`heat ${r.mood ?? ''}`}>{r.score ?? '–'}</span>
                  {isHost && check.phase === 'reveal' && <button className={`btn ghost sm ${focused ? 'on-soft' : ''}`} onClick={() => dispatch({ type: 'FOCUS', qid: focused ? null : r.q.id })}>{focused ? t.discussing : t.discuss}</button>}
                </div>
                <div className="hc-bar" aria-label={`${r.lights.g} / ${r.lights.a} / ${r.lights.r}`}>
                  {LIGHTS.map(l => r.lights[l] > 0 && <i key={l} className={l} style={{ flex: r.lights[l] }}>{r.lights[l]}</i>)}
                </div>
                {(focused || check.phase === 'closed') && r.notes.length > 0 && <ul className="hc-notes">{r.notes.map((n, i) => <li key={i}>“{n}”</li>)}</ul>}
                {!focused && check.phase !== 'closed' && r.notes.length > 0 && <span className="muted small">💬 {r.notes.length} {r.notes.length === 1 ? t.commentOne : t.commentMany}</span>}
              </div>
            )
          })}
        </div>
      </section>
      <Actions check={check} dispatch={dispatch} t={t} locked={check.phase === 'closed' && !isHost} />
    </>
  )
}

function Actions({ check, dispatch, t, locked }) {
  const [text, setText] = useState('')
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'ADD_ACTION', text: text.trim(), qid: check.focusId })
    setText('')
  }
  const title = qid => check.questions.find(q => q.id === qid)
  return (
    <section className="tool-card">
      <h2>{t.actions}</h2>
      {check.actions.length === 0 && <p className="muted small">{t.noActions}</p>}
      <ul className="hc-actions">
        {check.actions.map(a => (
          <li key={a.id} className={a.done ? 'done' : ''}>
            <input type="checkbox" checked={a.done} disabled={locked} onChange={e => dispatch({ type: 'UPDATE_ACTION', actionId: a.id, patch: { done: e.target.checked } })} aria-label={a.text} />
            <span className="grow">{a.text}</span>
            {title(a.qid) && <span className="deck-chip">{title(a.qid).emoji} {title(a.qid).title}</span>}
            {!locked && <button className="icon-btn" aria-label="Delete" onClick={() => dispatch({ type: 'DELETE_ACTION', actionId: a.id })}><Icon name="x" size={13} /></button>}
          </li>
        ))}
      </ul>
      {!locked && <form className="menu-form plain" onSubmit={add}><input value={text} onChange={e => setText(e.target.value)} placeholder={t.actionPh} maxLength={300} /><button className="btn primary sm" disabled={!text.trim()}>{t.addAction}</button></form>}
    </section>
  )
}

// Spider chart of area scores; the shape fills out as the team gets healthier.
function Radar({ rows }) {
  const n = rows.length
  if (n < 3) return null
  const S = 300
  const c = S / 2
  const R = 104
  const pt = (i, v) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2
    return [c + Math.cos(ang) * R * v, c + Math.sin(ang) * R * v]
  }
  const poly = rows.map((r, i) => pt(i, (r.score ?? 0) / 100).join(',')).join(' ')
  return (
    <svg className="hc-radar" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Radar">
      {[0.25, 0.5, 0.75, 1].map(k => <polygon key={k} points={rows.map((_, i) => pt(i, k).join(',')).join(' ')} className="hc-radar-ring" />)}
      {rows.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="hc-radar-ring" /> })}
      <polygon points={poly} className="hc-radar-shape" />
      {rows.map((r, i) => { const [x, y] = pt(i, 1.2); return <text key={i} x={x} y={y + 4} textAnchor="middle" className="hc-radar-label">{r.q.emoji}</text> })}
    </svg>
  )
}
