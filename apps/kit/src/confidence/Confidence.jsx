import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, newBoardId, personalStorage } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, Avatar, useClickOutside } from '../core/ui.jsx'
import { confetti, sparkle } from '../core/fx.js'
import { QR } from '../core/qr.jsx'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, HowTo, fill, ago } from '../core/tools-ui.jsx'
import { SCALES, SCALE_IDS, scaleValues, defaultThreshold, newSession, reduce, currentRound, tally, votedCount, roundsCsv } from './model.js'
import './confidence.css'

const T = {
  en: {
    eyebrow: 'Confidence vote', title: 'Are we really on board?', lead: 'Ask one question, everyone answers anonymously on their phone, and the result appears at once. Fist of five, meeting score or thumbs, in under a minute.',
    quick: 'One-tap votes', quickHint: 'Pick a question and the vote starts right away. Share the link or show the QR code on screen.',
    create: 'Set up your own', name: 'Session name', namePh: 'e.g. Sprint 44 planning', question: 'Question', questionPh: 'What should people answer?', scale: 'Answer with', start: 'Start voting',
    labels: 'Answer options', labelsPh: 'One option per line, lowest first (2 to 7)', threshold: 'Counts as “on board” from',
    yours: 'Your sessions', none: 'Votes you run or join will show up here.', remove: 'Remove', created: 'Created {d}',
    scales: { fist: 'Fist of five', roti: 'Meeting score', thumbs: 'Thumbs', custom: 'Your own scale' },
    scaleHint: { fist: '0 to 5 fingers', roti: 'Return on time invested, 1 to 5', thumbs: 'Up, sideways, down', custom: '2 to 7 options you write' },
    levels: {
      fist: ['Block: I can’t support this', 'Serious worries, we need to talk', 'Doubts I’d like to raise', 'OK, I can live with it', 'Good, I’m on board', 'All in, let’s go'],
      roti: ['Waste of my time', 'Some value, not worth the time', 'Break-even: got what I put in', 'Good use of my time', 'Excellent, well worth it'],
      thumbs: ['I’m against it', 'Not sure / neutral', 'I support it'],
    },
    presetShort: { sprint: 'Sprint plan', pi: 'PI / quarter plan', goal: 'Goal', meeting: 'Meeting score', decision: 'Decision' },
    presets: {
      sprint: ['How confident are we that we can deliver this sprint plan?', 'fist'],
      pi: ['How confident are we in this PI or quarter plan?', 'fist'],
      goal: ['Do we understand and believe in this goal?', 'fist'],
      meeting: ['Was this meeting worth your time?', 'roti'],
      decision: ['Can you support this decision?', 'thumbs'],
    },
    notePh: { fist: 'What would make it a 5? (optional, anonymous)', roti: 'What would have made it a 5? (optional, anonymous)', thumbs: 'What would get your thumbs up? (optional, anonymous)', custom: 'Anything to add? (optional, anonymous)' },
    anonymous: 'Votes are stored without your name. Nobody, not even the host, sees who voted what.',
    yourVote: 'Your vote', change: 'Tap again to take it back. You can change it until the results are shown.', voted: '{n} voted', votedOf: '{n} of {m} voted', waiting: 'Waiting for the host to show the results.', countLabel: 'voted', countOf: 'of {m} voted',
    reveal: 'Show results', hide: 'Back to voting', revote: 'Vote again', next: 'New question', present: 'Present', close: 'Close',
    average: 'Average', votes: '{n} votes', votes1: '1 vote', noVotes: 'Nobody has voted yet.', comments: 'Comments',
    verdict: {
      fist: { go: 'Everyone is on board. Commit with confidence.', discuss: 'Confident overall, but {b} below {th}. Hear their concerns before you commit.', stop: 'Not there yet. Talk through the concerns, adjust the plan, then vote again.', block: 'Someone is blocking (✊). Find out what would change their mind before going ahead.' },
      roti: { go: 'Time well spent for everyone.', discuss: 'Worth it on average, but {b} got less out of it. Ask what would make it better.', stop: 'Not worth the time for most people. Change the format, the agenda or who attends.' },
      thumbs: { go: 'Everyone can support it.', discuss: 'Mostly supported, but {b} against. Hear them out.', stop: 'Not enough support yet. Discuss, then vote again.' },
      custom: { go: 'Everyone answered “{l}” or higher.', discuss: 'The average reaches “{l}”, but {b} below it.', stop: 'The average is below “{l}”.' },
    },
    people1: '1 person is', peopleN: '{n} people are',
    tag: { go: 'Go', discuss: 'Talk first', stop: 'Not yet' },
    before: 'Before', after: 'After', compare: 'Compared with the first vote',
    ask: 'Ask a question', askHint: 'Starts a new round. Earlier rounds stay in the history.', askBtn: 'Ask',
    history: 'Rounds', noHistory: 'Rounds will be listed here.', show: 'Show', hidden: 'Results not shown yet', revoteTag: 're-vote',
    exportCsv: 'CSV', exportMd: 'Markdown', exportTitle: 'Download all rounds',
    settings: 'Session', host: 'Host', makeHost: 'Make host', removeP: 'Remove', deleteSession: 'Delete session', confirm: 'Click again to confirm', leave: 'Leave session', hostTip: 'The host asks the questions and shows the results.',
    people: 'People', back: 'All sessions', rename: 'Double-click to rename', noQuestion: 'No question yet', noQuestionHint: 'The host will ask one in a moment.', scan: 'Scan to vote', fewVotes: 'With fewer than 3 votes, people may be able to guess who voted what.',
    howSteps: [
      ['Pick a question', 'Tap a one-tap vote, or write your own question and choose fist of five, meeting score, thumbs or your own scale.'],
      ['Share the link', 'Use Invite, or press Present to put a big QR code on the shared screen. People vote on their phones, no account needed.'],
      ['Wait for the votes', 'Everyone taps an answer and can add an anonymous comment. You see how many have voted, not what they voted.'],
      ['Show the results', 'The host shows results for everyone at once: the spread of answers, the average and a clear go, talk-first or not-yet verdict.'],
      ['Talk, then vote again', 'After discussing the concerns, use Vote again. The new round is shown next to the first so you can see if confidence moved.'],
    ],
    howTips: [
      'Low score? Don’t argue with it. Ask the people below the line what would make it a 4 or 5, change the plan, then vote again.',
      'A fist (0) is a block. Treat it as a request to talk, not as a veto to override.',
      'Keep the question specific: “this sprint plan” works better than “the project”.',
      'With fewer than 3 voters, answers are easy to guess. Say so before you vote.',
    ],
  },
  zh: {
    eyebrow: '信心投票', title: '大家真的有信心吗？', lead: '提一个问题，每个人用手机匿名作答，结果立即揭晓。五指投票、会议评分或拇指投票，一分钟搞定。',
    quick: '一键投票', quickHint: '选一个问题，投票立即开始。分享链接，或在大屏上展示二维码。',
    create: '自定义投票', name: '会话名称', namePh: '例如：第 44 迭代规划', question: '问题', questionPh: '想让大家回答什么？', scale: '回答方式', start: '开始投票',
    labels: '选项', labelsPh: '每行一个选项，从低到高（2 到 7 个）', threshold: '从这个选项起算“有信心”',
    yours: '我的会话', none: '你发起或参加的投票会显示在这里。', remove: '移除', created: '创建于 {d}',
    scales: { fist: '五指投票', roti: '会议评分', thumbs: '拇指投票', custom: '自定义量表' },
    scaleHint: { fist: '0 到 5 根手指', roti: '时间投入回报，1 到 5', thumbs: '向上、横向、向下', custom: '自己写 2 到 7 个选项' },
    levels: {
      fist: ['反对：我无法支持', '严重担忧，需要讨论', '有些疑虑想提出', '可以，我能接受', '不错，我支持', '全力支持，开干'],
      roti: ['浪费我的时间', '有点价值，但不值这个时间', '持平：付出与收获相当', '时间花得值', '非常值得'],
      thumbs: ['我反对', '不确定 / 中立', '我支持'],
    },
    presetShort: { sprint: '迭代计划', pi: 'PI / 季度计划', goal: '目标', meeting: '会议评分', decision: '决定' },
    presets: {
      sprint: ['我们有多大信心完成这个迭代计划？', 'fist'],
      pi: ['我们对这个 PI 或季度计划有多大信心？', 'fist'],
      goal: ['我们理解并认同这个目标吗？', 'fist'],
      meeting: ['这次会议值得你花时间吗？', 'roti'],
      decision: ['你能支持这个决定吗？', 'thumbs'],
    },
    notePh: { fist: '怎样才能变成 5？（可选，匿名）', roti: '怎样才能变成 5？（可选，匿名）', thumbs: '怎样你才会竖起拇指？（可选，匿名）', custom: '还有什么想说的？（可选，匿名）' },
    anonymous: '投票不会和你的名字关联，任何人（包括主持人）都看不到谁投了什么。',
    yourVote: '你的投票', change: '再点一次可撤回。结果揭晓前都可以修改。', voted: '已有 {n} 人投票', votedOf: '{m} 人中已有 {n} 人投票', waiting: '等待主持人揭晓结果。', countLabel: '人已投票', countOf: '人已投票（共 {m} 人）',
    reveal: '揭晓结果', hide: '返回投票', revote: '重新投票', next: '新问题', present: '投屏', close: '关闭',
    average: '平均', votes: '{n} 票', votes1: '1 票', noVotes: '还没有人投票。', comments: '评论',
    verdict: {
      fist: { go: '大家都有信心，放心承诺吧。', discuss: '整体有信心，但{b}低于 {th}。承诺之前先听听他们的顾虑。', stop: '还没准备好。先讨论顾虑、调整计划，再投一次。', block: '有人反对（✊）。继续之前，先了解怎样才能改变他的想法。' },
      roti: { go: '每个人都觉得时间花得值。', discuss: '平均来看值得，但{b}收获较少。问问怎样能更好。', stop: '大多数人觉得不值得。调整形式、议程或参会人。' },
      thumbs: { go: '大家都支持。', discuss: '多数支持，但{b}反对。听听他们的想法。', stop: '支持还不够。讨论后再投一次。' },
      custom: { go: '每个人都选了“{l}”或更高。', discuss: '平均达到“{l}”，但{b}低于它。', stop: '平均低于“{l}”。' },
    },
    people1: '有 1 人', peopleN: '有 {n} 人',
    tag: { go: '通过', discuss: '先讨论', stop: '还不行' },
    before: '之前', after: '之后', compare: '与第一次投票相比',
    ask: '提问', askHint: '开始新一轮，之前的轮次会保留在历史中。', askBtn: '提问',
    history: '轮次', noHistory: '轮次会显示在这里。', show: '显示', hidden: '结果尚未揭晓', revoteTag: '重投',
    exportCsv: 'CSV', exportMd: 'Markdown', exportTitle: '下载所有轮次',
    settings: '会话', host: '主持人', makeHost: '设为主持人', removeP: '移出', deleteSession: '删除会话', confirm: '再点一次确认', leave: '离开会话', hostTip: '由主持人提问并揭晓结果。',
    people: '参与者', back: '所有会话', rename: '双击重命名', noQuestion: '还没有问题', noQuestionHint: '主持人马上就会提问。', scan: '扫码投票', fewVotes: '投票少于 3 人时，大家可能猜出谁投了什么。',
    howSteps: [
      ['选一个问题', '点一个一键投票，或自己写问题，选择五指投票、会议评分、拇指投票或自定义量表。'],
      ['分享链接', '点“邀请”，或点“投屏”把大二维码放到共享屏幕上。大家用手机投票，无需注册。'],
      ['等待投票', '每个人点选一个答案，还可以写匿名评论。你能看到有多少人投了票，但看不到投了什么。'],
      ['揭晓结果', '主持人为所有人同时揭晓：答案分布、平均分，以及“通过 / 先讨论 / 还不行”的结论。'],
      ['讨论后再投一次', '讨论完顾虑后点“重新投票”。新一轮会和第一轮并排显示，看看信心有没有变化。'],
    ],
    howTips: [
      '分数低？别去争辩。问问低于标准线的人怎样才能到 4 或 5，调整计划后再投一次。',
      '拳头（0）表示反对。把它当作“需要谈谈”的信号，而不是要被推翻的否决。',
      '问题要具体：“这个迭代计划”比“这个项目”更好回答。',
      '投票人数少于 3 人时，答案很容易被猜出来，投票前先说明。',
    ],
  },
}

const KIND = 'confidence'
const PRESETS = ['sprint', 'pi', 'goal', 'meeting', 'decision']

const labelOf = (t, r, v) => r.scale === 'custom' ? r.labels[v - 1] ?? String(v) : t.levels[r.scale][SCALES[r.scale].values.indexOf(v)]
const picOf = (r, v) => r.scale === 'custom' ? String(v) : SCALES[r.scale].pics[SCALES[r.scale].values.indexOf(v)]
const fmt = n => (Math.round(n * 10) / 10).toString()
const parseLabels = s => s.split(/\n|,/).map(x => x.trim()).filter(Boolean).slice(0, 7)

function verdictText(t, r, s) {
  if (!s.verdict) return ''
  if (r.scale === 'fist' && s.verdict === 'stop' && s.low === 0) return t.verdict.fist.block
  const b = s.below === 1 ? t.people1 : fill(t.peopleN, { n: s.below })
  return fill(t.verdict[r.scale][s.verdict], { b, th: r.threshold, l: labelOf(t, r, r.threshold) })
}

// ---------- lobby ----------

export function ConfidenceHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [scale, setScale] = useState('fist')
  const [labels, setLabels] = useState('')
  const [threshold, setThreshold] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sessions, setSessions] = useState(() => rememberedDocs(KIND))
  const customLabels = parseLabels(labels)
  const values = scale === 'custom' ? customLabels.map((_, i) => i + 1) : SCALES[scale].values
  const th = values.includes(threshold) ? threshold : defaultThreshold(scale, customLabels)

  const start = (sessionName, round) => {
    if (!backend) return
    const id = newDocId('cv')
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const doc = newSession({ id, name: sessionName, owner, at: Date.now(), firstRound: round })
    setBusy(true)
    createDoc(id, doc, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt })
      navigate(`/confidence/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  const quick = p => start(t.presets[p][0], { question: t.presets[p][0], scale: t.presets[p][1] })
  const create = e => {
    e.preventDefault()
    if (scale === 'custom' && customLabels.length < 2) return
    const q = question.trim()
    start(name.trim() || q || t.eyebrow, q ? { question: q, scale, labels: customLabels, threshold: th } : null)
  }

  return (
    <main className="tool-page cv-home">
      <section className="tool-hero cv-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="cv-hands" aria-hidden="true">{SCALES.fist.pics.map((p, i) => <span key={i} style={{ '--i': i }}>{p}</span>)}</div>
      </section>
      <HowTo tool="confidence" steps={t.howSteps} tips={t.howTips} />
      <section className="tool-card">
        <h2>{t.quick}</h2>
        <p className="muted small">{t.quickHint}</p>
        <div className="cv-quick">
          {PRESETS.map(p => (
            <button key={p} className="cv-quick-btn" disabled={busy || !backend} onClick={() => quick(p)}>
              <span className="cv-quick-pic">{SCALES[t.presets[p][1]].pics.at(-1)}</span>
              <b>{t.presets[p][0]}</b>
              <small>{t.scales[t.presets[p][1]]}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="poker-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="cv-name">{t.name}</label>
          <input id="cv-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={80} />
          <label className="field-label" htmlFor="cv-q">{t.question}</label>
          <input id="cv-q" value={question} onChange={e => setQuestion(e.target.value)} placeholder={t.questionPh} maxLength={200} />
          <span className="field-label">{t.scale}</span>
          <div className="cv-scales">
            {SCALE_IDS.map(s => (
              <button type="button" key={s} className={`hc-tpl ${scale === s ? 'sel' : ''}`} aria-pressed={scale === s} onClick={() => { setScale(s); setThreshold(null) }}>
                <b>{s === 'custom' ? '✏️' : SCALES[s].pics.at(-1)} {t.scales[s]}</b><span>{t.scaleHint[s]}</span>
              </button>
            ))}
          </div>
          {scale === 'custom' && <>
            <label className="field-label" htmlFor="cv-labels">{t.labels}</label>
            <textarea id="cv-labels" rows={4} value={labels} onChange={e => setLabels(e.target.value)} placeholder={t.labelsPh} />
          </>}
          {values.length > 1 && <>
            <label className="field-label" htmlFor="cv-th">{t.threshold}</label>
            <select id="cv-th" value={th} onChange={e => setThreshold(Number(e.target.value))}>
              {values.map(v => <option key={v} value={v}>{scale === 'custom' ? customLabels[v - 1] : `${picOf({ scale }, v)} ${v} · ${labelOf(t, { scale }, v)}`}</option>)}
            </select>
          </>}
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy || !backend || (scale === 'custom' && customLabels.length < 2)}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yours}</h2>
          {sessions.length ? (
            <ul className="doc-list">
              {sessions.map(s => (
                <li key={s.id}>
                  <a href={`#/confidence/${s.id}`} className="grow"><b>{s.name}</b><span className="muted small">{fill(t.created, { d: ago(s.at, lang) })}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, s.id); setSessions(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.none}</p>}
        </section>
      </div>
    </main>
  )
}

// ---------- session ----------

function ballotId(docId) {
  const key = `lift-ballot-${docId}`
  try {
    let b = personalStorage().getItem(key)
    if (!b) { b = newBoardId(); personalStorage().setItem(key, b) }
    return b
  } catch { return newBoardId() }
}

export function ConfidenceVote({ id }) {
  const { identity } = useStore()
  const { status, doc, dispatch, error } = useLiveDoc(id, reduce)
  const ballot = useMemo(() => ballotId(id), [id])
  const me = identity.id
  useEffect(() => {
    if (!doc || !identity.name) return
    const p = doc.people[me]
    if (!p || p.left || p.name !== identity.name || p.color !== identity.color) dispatch({ type: 'JOIN', person: { id: me, name: identity.name, color: identity.color } })
  }, [!!doc, identity.name, identity.color]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (doc) rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt })
  }, [id, doc?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  if (status !== 'ready') return <DocStatus status={status} />
  return <Session doc={doc} me={me} ballot={ballot} dispatch={dispatch} error={error} />
}

function Session({ doc, me, ballot, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const isHost = doc.ownerId === me
  const round = currentRound(doc)
  const [presenting, setPresenting] = useState(false)
  const people = Object.values(doc.people).filter(p => !p.left)

  // Celebrate a unanimous "go" once per reveal.
  const celebrated = useRef(null)
  useEffect(() => {
    if (!round?.revealed || celebrated.current === round.revealedAt) return
    celebrated.current = round.revealedAt
    if (tally(round).verdict === 'go') confetti(2400)
  }, [round?.revealed, round?.revealedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="tool-page cv-page">
      <div className="poker-bar">
        <a className="icon-btn" href="#/confidence" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <Title doc={doc} canEdit={isHost} dispatch={dispatch} t={t} />
        {round && <span className="deck-chip">{t.scales[round.scale]}</span>}
        <span className="spacer" />
        {round && !round.revealed && <span className="muted small icon-text"><Icon name="users" size={14} /> {votedText(t, votedCount(round), people.length)}</span>}
        {round && <button className="btn ghost sm" onClick={() => setPresenting(true)}><Icon name="present" /> {t.present}</button>}
        <SessionMenu doc={doc} isHost={isHost} me={me} dispatch={dispatch} t={t} />
        <InviteButton primary={!!round && !round.revealed} />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}
      <div className="poker-layout cv-layout">
        <section className="cv-main">
          {round
            ? <RoundView doc={doc} round={round} ballot={ballot} isHost={isHost} dispatch={dispatch} t={t} people={people.length} />
            : <div className="tool-card cv-empty"><span className="cv-big-pic">🖐️</span><h2>{t.noQuestion}</h2>{!isHost && <p className="muted">{t.noQuestionHint}</p>}</div>}
        </section>
        <aside className="cv-side">
          {isHost && <AskForm dispatch={dispatch} t={t} />}
          <History doc={doc} isHost={isHost} dispatch={dispatch} t={t} lang={lang} />
        </aside>
      </div>
      {presenting && round && <Present doc={doc} round={round} isHost={isHost} dispatch={dispatch} t={t} people={people.length} onClose={() => setPresenting(false)} />}
    </main>
  )
}

const votedText = (t, n, m) => m >= n && m > 1 ? fill(t.votedOf, { n, m }) : fill(t.voted, { n })
// The words next to a big vote count.
const countLabel = (t, n, m) => m >= n && m > 1 ? fill(t.countOf, { m }) : t.countLabel

function Title({ doc, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(doc.name)
  if (!editing) return <h1 className="room-name" title={canEdit ? t.rename : undefined} onDoubleClick={() => canEdit && (setName(doc.name), setEditing(true))}>{doc.name}</h1>
  const save = () => { if (name.trim() && name.trim() !== doc.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function RoundView({ doc, round, ballot, isHost, dispatch, t, people }) {
  const mine = round.ballots[ballot] ?? {}
  const n = votedCount(round)
  const vote = (v, el) => {
    const next = mine.v === v ? null : v
    if (next != null) sparkle(el)
    dispatch({ type: 'VOTE', roundId: round.id, ballot, v: next })
  }
  return (
    <div className="tool-card cv-round">
      <div className="cv-q">
        <span className="cv-eyebrow">{round.revoteOf ? `${t.revote} · ` : ''}{t.scales[round.scale]}</span>
        <h2>{round.question || t.scales[round.scale]}</h2>
      </div>
      {!round.revealed ? <>
        <div className={`cv-options s-${round.scale} n${scaleValues(round).length}`} role="radiogroup" aria-label={t.yourVote}>
          {scaleValues(round).map(v => (
            <button key={v} role="radio" aria-checked={mine.v === v} className={`cv-opt ${mine.v === v ? 'on' : ''} ${v < round.threshold ? 'under' : ''}`} onClick={e => vote(v, e.currentTarget)}>
              {round.scale !== 'custom' && <span className="cv-opt-pic">{picOf(round, v)}</span>}
              {round.scale !== 'custom' && round.scale !== 'thumbs' && <b className="cv-opt-n">{v}</b>}
              <span className="cv-opt-label">{labelOf(t, round, v)}</span>
            </button>
          ))}
        </div>
        <Note value={mine.note ?? ''} placeholder={t.notePh[round.scale]} onSave={note => dispatch({ type: 'NOTE', roundId: round.id, ballot, note: note || null })} />
        <p className="muted small cv-anon"><Icon name="shield" size={14} /> {t.anonymous}{mine.v != null ? ` ${t.change}` : ''}</p>
        <div className="cv-status">
          <span className="cv-count"><b>{n}</b> {countLabel(t, n, people)}</span>
          {isHost
            ? <button className="btn primary lg" disabled={!n} onClick={() => dispatch({ type: 'REVEAL', roundId: round.id })}><Icon name="eye" /> {t.reveal}</button>
            : mine.v != null && <span className="muted">✅ {t.waiting}</span>}
        </div>
      </> : <Results doc={doc} round={round} isHost={isHost} dispatch={dispatch} t={t} />}
    </div>
  )
}

function Note({ value, placeholder, onSave }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return <input className="cv-note" value={text} maxLength={300} placeholder={placeholder} aria-label={placeholder} onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
}

function Dist({ round, s, t, big }) {
  return (
    <div className={`cv-dist ${big ? 'big' : ''}`}>
      {scaleValues(round).map(v => (
        <div key={v} className={`cv-dist-row ${v < round.threshold ? 'under' : ''}`}>
          <span className="cv-dist-v" title={labelOf(t, round, v)}>{round.scale === 'custom' ? labelOf(t, round, v) : `${picOf(round, v)}${round.scale === 'thumbs' ? '' : ` ${v}`}`}</span>
          <span className="cv-dist-bar"><i style={{ width: `${s.n ? (s.counts[v] / s.n) * 100 : 0}%` }} /></span>
          <span className="cv-dist-n">{s.counts[v]}</span>
        </div>
      ))}
    </div>
  )
}

function Verdict({ round, s, t }) {
  if (!s.verdict) return <p className="tool-note">{t.noVotes}</p>
  return (
    <div className={`cv-verdict ${s.verdict}`}>
      <span className="cv-verdict-tag">{t.tag[s.verdict]}</span>
      <p>{verdictText(t, round, s)}</p>
    </div>
  )
}

function Results({ doc, round, isHost, dispatch, t }) {
  const s = tally(round)
  // A re-vote is compared with the first round of its chain.
  let first = round.revoteOf ? doc.rounds.find(r => r.id === round.revoteOf) : null
  while (first?.revoteOf) first = doc.rounds.find(r => r.id === first.revoteOf) ?? first
  const before = first ? tally(first) : null
  return (
    <div className="cv-results">
      <div className="cv-results-top">
        <div className="cv-avg">
          <b>{s.average == null ? '–' : fmt(s.average)}</b>
          <span>{t.average} · {s.n === 1 ? t.votes1 : fill(t.votes, { n: s.n })}</span>
        </div>
        <Dist round={round} s={s} t={t} />
      </div>
      <Verdict round={round} s={s} t={t} />
      {s.n > 0 && s.n < 3 && <p className="muted small">🔒 {t.fewVotes}</p>}
      {before && (
        <div className="cv-compare">
          <span className="field-label">{t.compare}</span>
          <div className="cv-compare-row">
            <div><span className="muted small">{t.before}</span><b>{before.average == null ? '–' : fmt(before.average)}</b><span className={`cv-dot ${before.verdict ?? ''}`}>{before.verdict ? t.tag[before.verdict] : ''}</span></div>
            <span className="cv-arrow">→</span>
            <div><span className="muted small">{t.after}</span><b>{s.average == null ? '–' : fmt(s.average)}</b><span className={`cv-dot ${s.verdict ?? ''}`}>{s.verdict ? t.tag[s.verdict] : ''}</span></div>
            {before.average != null && s.average != null && s.average !== before.average && <span className={`hc-delta ${s.average > before.average ? 'up' : 'down'}`}>{s.average > before.average ? '+' : ''}{fmt(s.average - before.average)}</span>}
          </div>
        </div>
      )}
      {s.notes.length > 0 && <>
        <span className="field-label">{t.comments}</span>
        <ul className="cv-notes">{s.notes.map((n, i) => <li key={i}>“{n}”</li>)}</ul>
      </>}
      {isHost && (
        <div className="row wrap cv-actions">
          <button className="btn primary" onClick={() => dispatch({ type: 'ASK', revoteOf: round.id })}><Icon name="timer" /> {t.revote}</button>
          <button className="btn ghost" onClick={() => dispatch({ type: 'HIDE', roundId: round.id })}>{t.hide}</button>
        </div>
      )}
    </div>
  )
}

function AskForm({ dispatch, t }) {
  const [question, setQuestion] = useState('')
  const [scale, setScale] = useState('fist')
  const [labels, setLabels] = useState('')
  const customLabels = parseLabels(labels)
  const ok = scale !== 'custom' || customLabels.length >= 2
  const ask = e => {
    e.preventDefault()
    if (!ok) return
    dispatch({ type: 'ASK', question: question.trim(), scale, labels: customLabels })
    setQuestion('')
  }
  return (
    <form className="tool-card cv-ask" onSubmit={ask}>
      <h2>{t.ask}</h2>
      <p className="muted small">{t.askHint}</p>
      <div className="chip-row">
        {PRESETS.map(p => <button type="button" key={p} className="chip-btn" title={t.presets[p][0]} onClick={() => { setQuestion(t.presets[p][0]); setScale(t.presets[p][1]) }}>{SCALES[t.presets[p][1]].pics.at(-1)} {t.presetShort[p]}</button>)}
      </div>
      <input className="mt8" value={question} onChange={e => setQuestion(e.target.value)} placeholder={t.questionPh} maxLength={200} aria-label={t.question} />
      <div className="seg small-seg cv-seg">
        {SCALE_IDS.map(s => <button type="button" key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>{t.scales[s]}</button>)}
      </div>
      {scale === 'custom' && <textarea rows={3} value={labels} onChange={e => setLabels(e.target.value)} placeholder={t.labelsPh} aria-label={t.labels} />}
      <div className="row end"><button className="btn primary sm" disabled={!ok}><Icon name="plus" /> {t.askBtn}</button></div>
    </form>
  )
}

function download(name, text, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name })
  a.click()
  URL.revokeObjectURL(a.href)
}

function markdown(doc, t) {
  const out = [`# ${doc.name}`, '']
  doc.rounds.forEach((r, i) => {
    const s = tally(r)
    out.push(`## ${i + 1}. ${r.question || t.scales[r.scale]}${r.revoteOf ? ` (${t.revoteTag})` : ''}`, '')
    out.push(`${t.scales[r.scale]} · ${s.n === 1 ? t.votes1 : fill(t.votes, { n: s.n })}${s.average == null ? '' : ` · ${t.average} ${fmt(s.average)}`}${r.revealed && s.verdict ? ` · ${t.tag[s.verdict]}` : ''}`, '')
    for (const v of scaleValues(r)) out.push(`- ${r.scale === 'custom' ? '' : `${v} `}${labelOf(t, r, v)}: ${s.counts[v]}`)
    if (r.revealed && s.verdict) out.push('', `> ${verdictText(t, r, s)}`)
    if (s.notes.length) out.push('', `**${t.comments}**`, '', ...s.notes.map(n => `- “${n}”`))
    out.push('')
  })
  return out.join('\n')
}

function History({ doc, isHost, dispatch, t, lang }) {
  const rounds = [...doc.rounds].reverse()
  const num = r => doc.rounds.indexOf(r) + 1
  return (
    <section className="tool-card cv-history">
      <div className="tool-card-head">
        <h2>{t.history}</h2>
        {doc.rounds.length > 0 && <div className="row" title={t.exportTitle}>
          <button className="btn ghost sm" onClick={() => download(`${doc.name}.csv`, roundsCsv(doc, (r, v) => labelOf(t, r, v)), 'text/csv')}><Icon name="download" /> {t.exportCsv}</button>
          <button className="btn ghost sm" onClick={() => download(`${doc.name}.md`, markdown(doc, t), 'text/markdown')}>{t.exportMd}</button>
        </div>}
      </div>
      {!rounds.length && <p className="muted small">{t.noHistory}</p>}
      <ol className="cv-rounds">
        {rounds.map(r => {
          const s = tally(r)
          const live = r.id === doc.currentId
          return (
            <li key={r.id} className={live ? 'live' : ''}>
              <div className="cv-round-head">
                <span className="cv-round-n">{num(r)}</span>
                <span className="grow cv-round-q">{r.question || t.scales[r.scale]}{r.revoteOf && <span className="deck-chip">{t.revoteTag} #{doc.rounds.findIndex(x => x.id === r.revoteOf) + 1}</span>}</span>
                {isHost && !live && <button className="btn ghost sm" onClick={() => dispatch({ type: 'SELECT', roundId: r.id })}>{t.show}</button>}
                {isHost && <button className="icon-btn sm" aria-label={t.remove} title={t.remove} onClick={() => dispatch({ type: 'DELETE_ROUND', roundId: r.id })}><Icon name="x" size={13} /></button>}
              </div>
              {r.revealed
                ? <div className="cv-round-sum"><b>{s.average == null ? '–' : fmt(s.average)}</b><span className={`cv-dot ${s.verdict ?? ''}`}>{s.verdict ? t.tag[s.verdict] : ''}</span><span className="muted small">{s.n === 1 ? t.votes1 : fill(t.votes, { n: s.n })} · {ago(r.at, lang)}</span></div>
                : <div className="cv-round-sum"><span className="muted small">{t.hidden} · {fill(t.voted, { n: s.n })}</span></div>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function SessionMenu({ doc, isHost, me, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { identity } = useStore()
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const others = Object.values(doc.people).filter(p => !p.left && p.id !== me)
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(doc.id, identity.secret).finally(() => { forgetDoc(KIND, doc.id); navigate('/confidence') })
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        {isHost ? <>
          {others.length > 0 && <div className="menu-title">{t.people}</div>}
          {others.map(p => (
            <div key={p.id} className="menu-item person-row">
              <Avatar p={p} size={20} /> <span className="grow ellipsis">{p.name}</span>
              <button className="chip-btn" onClick={() => { dispatch({ type: 'SET_HOST', pid: p.id }); setOpen(false) }}>{t.makeHost}</button>
              <button className="chip-btn" onClick={() => dispatch({ type: 'LEAVE', pid: p.id })}>{t.removeP}</button>
            </div>
          ))}
          {(doc.creatorId ?? doc.ownerId) === me && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteSession}</button>}
          {others.length === 0 && (doc.creatorId ?? doc.ownerId) !== me && <p className="menu-hint">{t.hostTip}</p>}
        </> : <>
          <p className="menu-hint">{t.hostTip}</p>
          <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(KIND, doc.id); navigate('/confidence') }}><Icon name="logout" /> {t.leave}</button>
        </>}
      </div>}
    </div>
  )
}

// Full-screen view for the shared screen: a big QR code while voting, big results after.
function Present({ doc, round, isHost, dispatch, t, people, onClose }) {
  const s = tally(round)
  const url = window.location.href
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cv-present" role="dialog" aria-modal="true" aria-label={round.question}>
      <button className="icon-btn cv-present-close" onClick={onClose} aria-label={t.close} title={t.close}><Icon name="x" /></button>
      <div className="cv-present-inner">
        <span className="cv-eyebrow">{doc.name !== round.question ? `${doc.name} · ` : ''}{t.scales[round.scale]}</span>
        <h1>{round.question || t.scales[round.scale]}</h1>
        {!round.revealed ? (
          <div className="cv-present-vote">
            <div className="cv-present-qr"><QR text={url} size={280} /><span>{t.scan}</span><code>{url.replace(/^https?:\/\//, '')}</code></div>
            <div className="cv-present-count"><b>{votedCount(round)}</b><span>{countLabel(t, votedCount(round), people)}</span>
              {isHost && <button className="btn primary lg" disabled={!votedCount(round)} onClick={() => dispatch({ type: 'REVEAL', roundId: round.id })}><Icon name="eye" /> {t.reveal}</button>}
            </div>
          </div>
        ) : (
          <div className="cv-present-results">
            <div className="cv-avg huge"><b>{s.average == null ? '–' : fmt(s.average)}</b><span>{t.average} · {s.n === 1 ? t.votes1 : fill(t.votes, { n: s.n })}</span></div>
            <Dist round={round} s={s} t={t} big />
            <Verdict round={round} s={s} t={t} />
            {isHost && <div className="row center"><button className="btn primary lg" onClick={() => dispatch({ type: 'ASK', revoteOf: round.id })}><Icon name="timer" /> {t.revote}</button></div>}
          </div>
        )}
      </div>
    </div>
  )
}
