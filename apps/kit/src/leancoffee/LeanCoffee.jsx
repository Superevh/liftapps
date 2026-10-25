import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, Avatar, useClickOutside } from '../core/ui.jsx'
import { sparkle } from '../core/fx.js'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, fill, ago, HowTo } from '../core/tools-ui.jsx'
import { HOWTO } from '../core/howto.js'
import { PHASES, THUMBS, newSession, reduce, queue, voteCount, votesUsed, timeLeft, tally, sessionCsv, sessionMarkdown } from './model.js'
import './leancoffee.css'

const T = {
  en: {
    eyebrow: 'Lean Coffee', title: 'Meetings where the group sets the agenda', lead: 'Everyone suggests topics, dots go to what matters most, and each topic gets a short timebox. When time is up, the room decides with a thumb whether to keep going.',
    create: 'Start a session', name: 'Session name', namePh: 'e.g. Team sync, Friday', votes: 'Dots per person', timebox: 'Minutes per topic', extend: 'Extra minutes when the room wants more', start: 'Start session',
    how: 'How it works', steps: [['Collect', 'Everyone adds topics they want to talk about.'], ['Vote', 'Spend your dots on the topics you care about most.'], ['Discuss', 'Take the top topic and talk until the timer runs out.'], ['Decide', 'Thumbs up to keep going, or move on to the next one.']],
    yourSessions: 'Your sessions', noSessions: 'Sessions you start or join show up here.', remove: 'Remove', created: 'Started {d}',
    joinTitle: 'Join {name}', joinAs: 'Join as', join: 'Join session',
    phases: { collect: 'Collect', vote: 'Vote', discuss: 'Discuss', wrap: 'Wrap up' },
    hints: { collect: 'Add the topics you would like to talk about. One idea per card.', vote: 'Put your dots on the topics you care about. You can stack several on one.', discuss: 'Talk about the topic in “Discussing” until the timer runs out.', wrap: 'Session finished. Export the notes and actions below.' },
    hostHints: { collect: 'When the ideas slow down, move on to voting.', vote: 'When everyone has used their dots, start discussing.', discuss: 'Pick the next topic with the most dots.' },
    next: { collect: 'Start voting', vote: 'Start discussing', discuss: 'Wrap up' },
    todo: 'To discuss', now: 'Discussing', done: 'Done',
    addTopic: 'Add a topic', topicPh: 'What would you like to talk about?', add: 'Add',
    dotsLeft: '{n} of {t} dots left', noDots: 'All your dots are used', yourDots: 'Your dots',
    discuss: 'Discuss', nothingNow: 'Nothing on the table yet.', nothingNowHost: 'Pick a topic from “To discuss” to start the timer.', empty: 'No topics yet. Be the first!', noneDone: 'Finished topics land here.',
    pause: 'Pause', resume: 'Resume', plus1: '+1 min', finish: 'Move on', ask: 'Ask the room now', paused: 'Paused',
    timeUp: 'Time is up! Keep talking about this?', askTitle: 'Keep talking about this?', thumbs: { up: 'Keep going', side: 'Either way', down: 'Move on' },
    waitingThumbs: '{v} of {t} have voted', keep: 'Keep going (+{m} min)', moveOn: 'Move on',
    decided: { extend: 'The room wants more: {m} extra minutes.', done: 'The room moved on.' },
    notes: 'Notes and takeaways', notePh: 'Add a takeaway…', addAction: 'Make it an action', noNotes: 'No notes yet.',
    actions: 'Action items', actionPh: 'What will happen, and who will do it?', owner: 'Who', noActions: 'No actions yet.',
    mins: '{m} min', round: 'Round {n}', reopen: 'Discuss again', edit: 'Edit', save: 'Save', cancel: 'Cancel',
    settings: 'Session settings', hostOnly: 'Only the host can change phase and pick topics', chime: 'Play a chime when time is up (this device)',
    host: 'Host', you: 'you', people: 'People', makeHost: 'Make host', removeP: 'Remove', leave: 'Leave session', deleteS: 'Delete session', confirm: 'Click again to confirm',
    hostTip: 'The host runs the phases and the timer.', back: 'All sessions', rename: 'Rename',
    exportMd: 'Notes (Markdown)', exportCsv: 'Topics (CSV)', copy: 'Copy notes', copied: 'Copied!',
    summary: '{d} topics discussed in {m} min · {a} actions', thanks: 'Thanks for the conversation ☕',
  },
  zh: {
    eyebrow: '精益咖啡', title: '由大家决定议程的会议', lead: '每个人提出话题，用圆点投给最想聊的，每个话题限时讨论。时间到了，大家用拇指决定继续还是换下一个。',
    create: '开始一场', name: '会议名称', namePh: '例如：周五团队交流', votes: '每人圆点数', timebox: '每个话题分钟数', extend: '大家想继续时延长的分钟数', start: '开始会议',
    how: '怎么玩', steps: [['收集', '每个人写下想聊的话题。'], ['投票', '把圆点投给你最关心的话题。'], ['讨论', '从票数最高的开始，聊到计时结束。'], ['决定', '拇指向上就继续，否则换下一个。']],
    yourSessions: '我的会议', noSessions: '你开始或加入的会议会显示在这里。', remove: '移除', created: '开始于 {d}',
    joinTitle: '加入 {name}', joinAs: '加入身份', join: '加入会议',
    phases: { collect: '收集', vote: '投票', discuss: '讨论', wrap: '收尾' },
    hints: { collect: '写下你想聊的话题，一张卡片一个想法。', vote: '把圆点投给你关心的话题，可以在一个话题上投多个。', discuss: '围绕“讨论中”的话题展开，直到计时结束。', wrap: '会议结束，可以在下面导出笔记和行动项。' },
    hostHints: { collect: '想法差不多了，就进入投票。', vote: '大家都投完后，开始讨论。', discuss: '选择下一个票数最高的话题。' },
    next: { collect: '开始投票', vote: '开始讨论', discuss: '收尾' },
    todo: '待讨论', now: '讨论中', done: '已完成',
    addTopic: '添加话题', topicPh: '你想聊什么？', add: '添加',
    dotsLeft: '剩余 {n}/{t} 个圆点', noDots: '圆点已用完', yourDots: '我的圆点',
    discuss: '讨论', nothingNow: '还没有正在讨论的话题。', nothingNowHost: '从“待讨论”里选一个话题开始计时。', empty: '还没有话题，来写第一个吧！', noneDone: '讨论完的话题会出现在这里。',
    pause: '暂停', resume: '继续', plus1: '+1 分钟', finish: '下一个', ask: '现在问问大家', paused: '已暂停',
    timeUp: '时间到！还要继续聊吗？', askTitle: '还要继续聊吗？', thumbs: { up: '继续', side: '都可以', down: '换下一个' },
    waitingThumbs: '{v}/{t} 人已表态', keep: '继续（+{m} 分钟）', moveOn: '换下一个',
    decided: { extend: '大家想继续：再聊 {m} 分钟。', done: '大家决定换下一个话题。' },
    notes: '笔记与收获', notePh: '记下一条收获…', addAction: '转为行动项', noNotes: '还没有笔记。',
    actions: '行动项', actionPh: '要做什么？由谁来做？', owner: '负责人', noActions: '还没有行动项。',
    mins: '{m} 分钟', round: '第 {n} 轮', reopen: '再讨论', edit: '编辑', save: '保存', cancel: '取消',
    settings: '会议设置', hostOnly: '只有主持人可以切换阶段和选择话题', chime: '时间到时播放提示音（本设备）',
    host: '主持人', you: '你', people: '参与者', makeHost: '设为主持人', removeP: '移出', leave: '离开会议', deleteS: '删除会议', confirm: '再点一次确认',
    hostTip: '由主持人控制阶段和计时。', back: '所有会议', rename: '重命名',
    exportMd: '笔记（Markdown）', exportCsv: '话题（CSV）', copy: '复制笔记', copied: '已复制！',
    summary: '讨论了 {d} 个话题，用时 {m} 分钟 · {a} 个行动项', thanks: '感谢这场交流 ☕',
  },
}

const KIND = 'leancoffee'
const CHIME_KEY = 'lift-leancoffee-chime'

// ---------- lobby ----------

export function LeanCoffeeHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [votes, setVotes] = useState(3)
  const [timebox, setTimebox] = useState(7)
  const [extra, setExtra] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sessions, setSessions] = useState(() => rememberedDocs(KIND))
  const create = e => {
    e.preventDefault()
    if (!backend) return
    const id = newDocId('lc')
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const session = newSession({ id, name: name.trim() || t.eyebrow, votes, timebox, extend: extra, owner, at: Date.now() })
    setBusy(true)
    createDoc(id, session, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: session.name, at: session.createdAt })
      navigate(`/leancoffee/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  const chips = (values, value, set, label) => (
    <div className="chip-row" role="group" aria-label={label}>
      {values.map(v => <button type="button" key={v} className={`chip-btn ${value === v ? 'sel' : ''}`} aria-pressed={value === v} onClick={() => set(v)}>{v}</button>)}
    </div>
  )
  return (
    <main className="tool-page lc-home">
      <section className="tool-hero lc-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <Cup ratio={0.68} size={118} />
      </section>
      <HowTo tool="leancoffee" content={HOWTO.leancoffee} />
      <div className="poker-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="lc-name">{t.name}</label>
          <input id="lc-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={80} />
          <span className="field-label">{t.votes}</span>
          {chips([1, 2, 3, 4, 5], votes, setVotes, t.votes)}
          <span className="field-label">{t.timebox}</span>
          {chips([5, 7, 10, 15], timebox, setTimebox, t.timebox)}
          <span className="field-label">{t.extend}</span>
          {chips([2, 3, 5], extra, setExtra, t.extend)}
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy || !backend}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <div className="lc-side">
          <section className="tool-card">
            <h2>{t.yourSessions}</h2>
            {sessions.length ? (
              <ul className="doc-list">
                {sessions.map(s => (
                  <li key={s.id}>
                    <a href={`#/leancoffee/${s.id}`} className="grow"><b>{s.name}</b><span className="muted small">{fill(t.created, { d: ago(s.at, lang) })}</span></a>
                    <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, s.id); setSessions(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{t.noSessions}</p>}
          </section>
        </div>
      </div>
    </main>
  )
}

// A coffee cup that empties as the timebox runs down.
function Cup({ ratio, size = 64, hot }) {
  const level = Math.max(0, Math.min(1, ratio ?? 0))
  const top = 18 + (1 - level) * 40
  return (
    <svg className={`lc-cup ${hot ? 'hot' : ''}`} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <defs><clipPath id="lc-cup-clip"><path d="M12 16h44l-5 46a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5Z" /></clipPath></defs>
      {level > 0.02 && <g className="lc-steam"><path d="M26 10c-3-3 3-5 0-8" /><path d="M36 10c-3-3 3-5 0-8" /><path d="M46 10c-3-3 3-5 0-8" /></g>}
      <rect className="lc-coffee" x="10" y={top} width="48" height="60" clipPath="url(#lc-cup-clip)" />
      <path className="lc-cup-line" d="M12 16h44l-5 46a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5Z" />
      <path className="lc-cup-line" d="M55 26h6a8 8 0 0 1 0 16h-8" />
      <path className="lc-cup-line" d="M6 72h56" />
    </svg>
  )
}

// ---------- session ----------

export function LeanCoffeeRoom({ id }) {
  const { identity } = useStore()
  const { status, doc: session, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const person = useMemo(() => ({ id: me, name: identity.name || 'Guest', color: identity.color }), [me, identity.name, identity.color])
  const known = session?.people[me]
  const joined = known && !known.left

  // Returning people rejoin automatically; name or colour changes are carried over.
  useEffect(() => {
    if (!session || !identity.name || !known) return
    if (!known.left && known.name === person.name && known.color === person.color) return
    dispatch({ type: 'JOIN', person })
  }, [session && known, identity.name, person, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session) rememberDoc(KIND, { id, name: session.name, at: session.createdAt })
  }, [id, session?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'ready') return <DocStatus status={status} />
  if (!joined) return <Join session={session} person={person} dispatch={dispatch} ready={!!identity.name} />
  return <Session s={session} me={me} dispatch={dispatch} error={error} />
}

function Join({ session, person, dispatch, ready }) {
  const t = T[useLang()]
  return (
    <main className="tool-page">
      <section className="tool-card join-card">
        <Cup ratio={0.7} size={72} />
        <h2>{fill(t.joinTitle, { name: session.name })}</h2>
        <p className="muted">{t.joinAs} <b>{person.name}</b></p>
        <div className="row"><button className="btn primary" disabled={!ready} onClick={() => dispatch({ type: 'JOIN', person })}>{t.join}</button></div>
      </section>
    </main>
  )
}

function useNow(active) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const h = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(h)
  }, [active])
  return active ? now : Date.now()
}

function readChime() {
  try { return localStorage.getItem(CHIME_KEY) === '1' } catch { return false }
}

// A short two-note chime made with Web Audio, so no sound file is needed.
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[660, 880].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22)
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.22 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.6)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.22)
      o.stop(ctx.currentTime + i * 0.22 + 0.65)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch { /* audio unavailable */ }
}

const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Session({ s, me, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const isHost = s.ownerId === me
  const canRun = isHost || !s.settings.hostOnly
  const [withChime, setWithChime] = useState(readChime)
  const running = !!s.timer && s.timer.pausedLeft == null
  const now = useNow(running)
  const left = timeLeft(s.timer, now)
  const timeUp = left != null && left <= 0
  const current = s.topics.find(x => x.id === s.currentId)
  const todo = queue(s)
  const done = s.topics.filter(x => x.status === 'done')
  const used = votesUsed(s, me)

  // Chime once per timebox when it runs out.
  const chimed = useRef(null)
  useEffect(() => {
    if (!timeUp || !s.timer) return
    const key = `${s.currentId}:${s.timer.endsAt}`
    if (chimed.current === key) return
    chimed.current = key
    if (withChime) chime()
  }, [timeUp, s.timer, s.currentId, withChime])

  const setChime = on => {
    setWithChime(on)
    try { localStorage.setItem(CHIME_KEY, on ? '1' : '0') } catch { /* storage blocked */ }
  }

  const step = PHASES.indexOf(s.phase)
  return (
    <main className={`lc-room phase-${s.phase}`}>
      <div className="poker-bar">
        <a className="icon-btn" href="#/leancoffee" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <Title s={s} canEdit={isHost} dispatch={dispatch} t={t} />
        <span className="spacer" />
        {s.timer && <span className={`timer-chip ${timeUp ? 'hot' : ''}`}><Icon name="timer" size={15} /> {s.timer.pausedLeft != null ? t.paused : clock(left)}</span>}
        <SessionMenu s={s} isHost={isHost} me={me} dispatch={dispatch} t={t} withChime={withChime} setChime={setChime} />
        <InviteButton primary />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}

      <nav className="lc-phases" aria-label="Phases">
        {PHASES.map((p, i) => (
          <button key={p} className={`lc-phase ${p === s.phase ? 'on' : ''} ${i < step ? 'past' : ''}`} disabled={!canRun || p === s.phase} aria-current={p === s.phase ? 'step' : undefined} onClick={() => dispatch({ type: 'PHASE', phase: p })}>
            <span className="lc-phase-n">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>{t.phases[p]}
          </button>
        ))}
      </nav>

      <div className="lc-hint">
        <p>{t.hints[s.phase]}{canRun && t.hostHints[s.phase] ? <span className="muted"> {t.hostHints[s.phase]}</span> : null}</p>
        {s.phase === 'vote' && <Dots used={used} total={s.settings.votes} t={t} />}
        {canRun && t.next[s.phase] && <button className="btn primary sm" onClick={() => dispatch({ type: 'PHASE', phase: PHASES[step + 1] })}>{t.next[s.phase]} <Icon name="right" size={14} /></button>}
      </div>

      {s.phase === 'wrap' && <Summary s={s} t={t} />}

      <div className="lc-board">
        <section className="lc-col lc-todo">
          <h2 className="lc-col-head">{t.todo} <span className="lc-count">{todo.length}</span></h2>
          {s.phase !== 'wrap' && <AddTopic dispatch={dispatch} me={me} t={t} />}
          {todo.length === 0 && <p className="muted small lc-empty">{t.empty}</p>}
          <ul className="lc-cards">
            {todo.map(x => <Topic key={x.id} x={x} s={s} me={me} canRun={canRun} used={used} dispatch={dispatch} t={t} />)}
          </ul>
        </section>

        <section className="lc-col lc-now">
          <h2 className="lc-col-head">{t.now}</h2>
          {current
            ? <Discussing x={current} s={s} me={me} canRun={canRun} left={left} timeUp={timeUp} dispatch={dispatch} t={t} />
            : <div className="lc-now-empty"><Cup ratio={0} size={60} /><p className="muted small">{canRun && s.phase !== 'wrap' ? t.nothingNowHost : t.nothingNow}</p></div>}
          {s.decision && !current && <p className="lc-decision">{fill(t.decided[s.decision.result], { m: s.settings.extend })}</p>}
        </section>

        <section className="lc-col lc-done">
          <h2 className="lc-col-head">{t.done} <span className="lc-count">{done.length}</span></h2>
          {done.length === 0 && <p className="muted small lc-empty">{t.noneDone}</p>}
          <ul className="lc-cards">
            {done.map(x => (
              <li key={x.id} className="lc-card is-done">
                <p className="lc-text">{x.text}</p>
                <div className="lc-meta">
                  <span className="lc-badge">● {voteCount(x)}</span>
                  <span className="muted small">{fill(t.mins, { m: Math.max(1, Math.round((x.spent ?? 0) / 60000)) })}</span>
                  {x.notes.length > 0 && <span className="muted small"><Icon name="comment" size={13} /> {x.notes.length}</span>}
                  <span className="spacer" />
                  {canRun && s.phase !== 'wrap' && <button className="chip-btn" onClick={() => dispatch({ type: 'START_TOPIC', topicId: x.id })}>{t.reopen}</button>}
                </div>
                {x.notes.length > 0 && <ul className="lc-notes compact">{x.notes.map(n => <li key={n.id}>{n.text}</li>)}</ul>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Actions s={s} dispatch={dispatch} t={t} />
    </main>
  )
}

function Dots({ used, total, t }) {
  return (
    <span className="lc-dots" title={t.yourDots}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < total - used ? 'full' : ''} />)}
      <span className="small">{used >= total ? t.noDots : fill(t.dotsLeft, { n: total - used, t: total })}</span>
    </span>
  )
}

function AddTopic({ dispatch, me, t }) {
  const [text, setText] = useState('')
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'ADD_TOPIC', text, pid: me })
    setText('')
  }
  return (
    <form className="lc-add" onSubmit={add}>
      <textarea rows={2} value={text} maxLength={280} onChange={e => setText(e.target.value)} placeholder={t.topicPh} aria-label={t.addTopic}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) add(e) }} />
      <button className="btn primary sm" disabled={!text.trim()}><Icon name="plus" /> {t.add}</button>
    </form>
  )
}

function Topic({ x, s, me, canRun, used, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(x.text)
  const author = s.people[x.by]
  const mine = x.votes[me] ?? 0
  const total = voteCount(x)
  const canEdit = (x.by === me || s.ownerId === me) && s.phase !== 'wrap'
  const save = () => { if (text.trim() && text.trim() !== x.text) dispatch({ type: 'EDIT_TOPIC', topicId: x.id, text }); setEditing(false) }
  return (
    <li className={`lc-card ${mine ? 'has-mine' : ''}`}>
      {editing
        ? <div className="lc-edit">
          <textarea autoFocus rows={3} value={text} maxLength={280} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') setEditing(false) }} />
          <div className="row end"><button className="btn ghost sm" onClick={() => setEditing(false)}>{t.cancel}</button><button className="btn primary sm" onClick={save}>{t.save}</button></div>
        </div>
        : <p className="lc-text">{x.text}</p>}
      <div className="lc-meta">
        {author && <span className="lc-author"><Avatar p={author} size={18} /> <span className="ellipsis">{author.name}</span></span>}
        <span className="spacer" />
        {s.phase !== 'collect' && total > 0 && <span className="lc-badge" title={String(total)}>● {total}</span>}
        {canEdit && !editing && <>
          <button className="icon-btn sm" aria-label={t.edit} title={t.edit} onClick={() => { setText(x.text); setEditing(true) }}><Icon name="edit" size={14} /></button>
          {s.phase === 'collect' && <button className="icon-btn sm" aria-label={t.remove} title={t.remove} onClick={() => dispatch({ type: 'REMOVE_TOPIC', topicId: x.id })}><Icon name="trash" size={14} /></button>}
        </>}
      </div>
      {s.phase === 'vote' && (
        <div className="lc-vote">
          <button className="icon-btn sm" aria-label="−" disabled={!mine} onClick={() => dispatch({ type: 'VOTE', topicId: x.id, pid: me, delta: -1 })}>−</button>
          <span className="lc-mine">{Array.from({ length: mine }, (_, i) => <i key={i} />)}{!mine && <span className="muted small">0</span>}</span>
          <button className="icon-btn sm lc-plus" aria-label="+" disabled={used >= s.settings.votes} onClick={e => { sparkle(e.currentTarget); dispatch({ type: 'VOTE', topicId: x.id, pid: me, delta: 1 }) }}>+</button>
        </div>
      )}
      {canRun && (s.phase === 'discuss') && <button className="btn ghost sm lc-start" onClick={() => dispatch({ type: 'START_TOPIC', topicId: x.id })}><Icon name="comment" size={14} /> {t.discuss}</button>}
    </li>
  )
}

function Discussing({ x, s, me, canRun, left, timeUp, dispatch, t }) {
  const [note, setNote] = useState('')
  const paused = s.timer?.pausedLeft != null
  const ratio = s.timer ? Math.max(0, left) / s.timer.length : 0
  const askOpen = timeUp || s.timer?.asked
  const people = Object.values(s.people).filter(p => !p.left)
  const n = tally(x.thumbs)
  const votedN = people.filter(p => x.thumbs?.[p.id]).length
  const mine = x.thumbs?.[me]
  const addNote = e => {
    e.preventDefault()
    if (!note.trim()) return
    dispatch({ type: 'ADD_NOTE', topicId: x.id, text: note, pid: me })
    setNote('')
  }
  return (
    <div className={`lc-current ${timeUp ? 'time-up' : ''}`}>
      <p className="lc-current-text">{x.text}</p>
      <div className="lc-timer">
        <Cup ratio={ratio} size={64} hot={timeUp} />
        <div>
          <div className={`lc-clock ${timeUp ? 'hot' : ''}`}>{paused ? clock(s.timer.pausedLeft) : clock(left)}</div>
          <div className="muted small">{fill(t.round, { n: x.rounds ?? 1 })} · ● {voteCount(x)}{paused ? ` · ${t.paused}` : ''}</div>
        </div>
      </div>
      {canRun && <div className="lc-controls">
        {paused
          ? <button className="btn ghost sm" onClick={() => dispatch({ type: 'RESUME' })}>{t.resume}</button>
          : <button className="btn ghost sm" disabled={timeUp} onClick={() => dispatch({ type: 'PAUSE' })}>{t.pause}</button>}
        <button className="btn ghost sm" onClick={() => dispatch({ type: 'ADD_TIME', minutes: 1 })}>{t.plus1}</button>
        {!askOpen && <button className="btn ghost sm" onClick={() => dispatch({ type: 'ASK' })}>{t.ask}</button>}
        <button className="btn ghost sm" onClick={() => dispatch({ type: 'FINISH_TOPIC' })}><Icon name="check" size={14} /> {t.finish}</button>
      </div>}

      {askOpen && (
        <div className="lc-poll" role="group" aria-label={t.askTitle}>
          <p className="lc-poll-q">{timeUp ? t.timeUp : t.askTitle}</p>
          <div className="lc-thumbs">
            {THUMBS.map(v => (
              <button key={v} className={`lc-thumb ${v} ${mine === v ? 'sel' : ''}`} aria-pressed={mine === v} onClick={() => dispatch({ type: 'THUMB', pid: me, value: v })}>
                <Icon name="thumb" size={22} /><span>{t.thumbs[v]}</span><b>{n[v] || ''}</b>
              </button>
            ))}
          </div>
          <p className="muted small">{fill(t.waitingThumbs, { v: votedN, t: people.length })}</p>
          {canRun && <div className="row center">
            <button className="btn primary sm" onClick={() => dispatch({ type: 'DECIDE', result: 'extend' })}>{fill(t.keep, { m: s.settings.extend })}</button>
            <button className="btn ghost sm" onClick={() => dispatch({ type: 'DECIDE', result: 'done' })}>{t.moveOn}</button>
          </div>}
        </div>
      )}
      {s.decision?.topicId === x.id && s.decision.result === 'extend' && !askOpen && <p className="lc-decision">{fill(t.decided.extend, { m: s.settings.extend })}</p>}

      <div className="lc-notes-box">
        <h3>{t.notes}</h3>
        {x.notes.length === 0 && <p className="muted small">{t.noNotes}</p>}
        <ul className="lc-notes">
          {x.notes.map(nt => (
            <li key={nt.id}>
              <span className="grow">{nt.text}</span>
              <button className="icon-btn sm" title={t.addAction} aria-label={t.addAction} onClick={() => dispatch({ type: 'ADD_ACTION', text: nt.text, topicId: x.id })}><Icon name="flag" size={13} /></button>
              <button className="icon-btn sm" title={t.remove} aria-label={t.remove} onClick={() => dispatch({ type: 'DELETE_NOTE', topicId: x.id, noteId: nt.id })}><Icon name="x" size={13} /></button>
            </li>
          ))}
        </ul>
        <form className="lc-note-add" onSubmit={addNote}>
          <input value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder={t.notePh} aria-label={t.notePh} />
          <button className="btn ghost sm" disabled={!note.trim()}>{t.add}</button>
        </form>
      </div>
    </div>
  )
}

function Actions({ s, dispatch, t }) {
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const add = e => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'ADD_ACTION', text, owner: owner.trim(), topicId: s.currentId })
    setText('')
    setOwner('')
  }
  return (
    <section className="tool-card lc-actions">
      <div className="tool-card-head"><h2>{t.actions} <span className="muted small">{s.actions.length || ''}</span></h2><Exports s={s} t={t} /></div>
      {s.actions.length === 0 && <p className="muted small">{t.noActions}</p>}
      <ul className="lc-action-list">
        {s.actions.map(x => (
          <li key={x.id} className={x.done ? 'done' : ''}>
            <input type="checkbox" checked={x.done} onChange={e => dispatch({ type: 'UPDATE_ACTION', actionId: x.id, patch: { done: e.target.checked } })} aria-label={x.text} />
            <span className="grow">{x.text}{x.owner && <span className="lc-owner">{x.owner}</span>}</span>
            <button className="icon-btn sm" aria-label={t.remove} title={t.remove} onClick={() => dispatch({ type: 'DELETE_ACTION', actionId: x.id })}><Icon name="x" size={13} /></button>
          </li>
        ))}
      </ul>
      <form className="lc-action-add" onSubmit={add}>
        <input className="grow" value={text} maxLength={300} onChange={e => setText(e.target.value)} placeholder={t.actionPh} aria-label={t.actionPh} />
        <input className="lc-owner-input" value={owner} maxLength={40} onChange={e => setOwner(e.target.value)} placeholder={t.owner} aria-label={t.owner} />
        <button className="btn primary sm" disabled={!text.trim()}><Icon name="plus" /> {t.add}</button>
      </form>
    </section>
  )
}

function download(name, text, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name })
  a.click()
  URL.revokeObjectURL(a.href)
}

function Exports({ s, t }) {
  const lang = useLang()
  const [copied, setCopied] = useState(false)
  const md = () => sessionMarkdown(s, lang)
  const copy = () => navigator.clipboard?.writeText(md()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  return (
    <div className="row wrap lc-exports">
      <button className="btn ghost sm" onClick={copy}><Icon name="copy" size={14} /> {copied ? t.copied : t.copy}</button>
      <button className="btn ghost sm" onClick={() => download(`${s.name || 'lean-coffee'}.md`, md(), 'text/markdown')}><Icon name="download" size={14} /> {t.exportMd}</button>
      <button className="btn ghost sm" onClick={() => download(`${s.name || 'lean-coffee'}.csv`, sessionCsv(s), 'text/csv')}><Icon name="download" size={14} /> {t.exportCsv}</button>
    </div>
  )
}

function Summary({ s, t }) {
  const done = s.topics.filter(x => x.status === 'done')
  const mins = Math.round(done.reduce((n, x) => n + (x.spent ?? 0), 0) / 60000)
  return (
    <section className="tool-card lc-summary">
      <Cup ratio={0} size={56} />
      <div>
        <h2>{t.thanks}</h2>
        <p className="muted">{fill(t.summary, { d: done.length, m: mins, a: s.actions.length })}</p>
      </div>
    </section>
  )
}

function Title({ s, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(s.name)
  if (!editing) return <h1 className="room-name" title={canEdit ? t.rename : undefined} onDoubleClick={() => canEdit && (setName(s.name), setEditing(true))}>{s.name}</h1>
  const save = () => { if (name.trim() && name.trim() !== s.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function SessionMenu({ s, isHost, me, dispatch, t, withChime, setChime }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { identity } = useStore()
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const people = Object.values(s.people).filter(p => !p.left && p.id !== me)
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(s.id, identity.secret).finally(() => { forgetDoc(KIND, s.id); navigate('/leancoffee') })
  }
  const chimeRow = <label className="menu-item check"><input type="checkbox" checked={withChime} onChange={e => setChime(e.target.checked)} /> {t.chime}</label>
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        <div className="menu-title">{t.settings}</div>
        {isHost && <label className="menu-item check"><input type="checkbox" checked={!!s.settings.hostOnly} onChange={e => dispatch({ type: 'SETTINGS', patch: { hostOnly: e.target.checked } })} /> {t.hostOnly}</label>}
        {chimeRow}
        {isHost ? <>
          {people.length > 0 && <div className="menu-title">{t.people}</div>}
          {people.map(p => (
            <div key={p.id} className="menu-item person-row">
              <Avatar p={p} size={20} /> <span className="grow ellipsis">{p.name}</span>
              <button className="chip-btn" onClick={() => { dispatch({ type: 'SET_HOST', pid: p.id }); setOpen(false) }}>{t.makeHost}</button>
              <button className="chip-btn" onClick={() => dispatch({ type: 'LEAVE', pid: p.id })}>{t.removeP}</button>
            </div>
          ))}
          {(s.creatorId ?? s.ownerId) === me && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteS}</button>}
        </> : <>
          <p className="menu-hint">{t.hostTip}</p>
          <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(KIND, s.id); navigate('/leancoffee') }}><Icon name="logout" /> {t.leave}</button>
        </>}
      </div>}
    </div>
  )
}
