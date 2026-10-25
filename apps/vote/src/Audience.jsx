import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp, go } from './app-context.js'
import { LangToggle, ThemeToggle } from './App.jsx'
import { cleanError, voterId } from './backend.js'
import { Icon, Mark } from './icons.jsx'
import { useT } from './i18n.js'
import { hasQuiz, TYPES, QUIZ_COLORS, inkOn } from './slides.js'
import './audience.css'

// The audience (phone) side. Joins by code, follows the presenter's slide over the Realtime channel
// (with a slow poll as fallback) and answers through live_respond. Built to stay light with 100
// people in the room: no fast polling loops, jittered timers, one-off fetches spread over a moment.

const DICT = {
  en: {
    enterCode: 'Enter the code to join', codeHint: 'It’s on the screen in front of you', join: 'Join', codePh: '1234 5678',
    codeInvalid: 'Codes have 8 digits.', codeNotFound: 'We couldn’t find a presentation with code {code}. Check the screen and try again.',
    footer: 'VoteLift by Lift Apps · no account needed to take part', createOwn: 'Create your own',
    nickTitle: 'Pick a nickname for the leaderboard', nickHint: 'It’s shown on the big screen during the quiz.', nickPh: 'e.g. Quiz Wizard', letsGo: 'Let’s go',
    waiting: 'Waiting for the presenter…', waitingHint: 'The next question will appear here automatically.',
    lookScreen: 'Look at the screen', lookScreenHint: 'The presenter is showing something. Your next question will pop up here.',
    slideOf: '{n} of {total}', submit: 'Submit', submitting: 'Sending…', thanks: 'Thanks, your answer was sent', thanksHint: 'Keep an eye on the screen for the results.',
    closed: 'Voting is closed', closedHint: 'The presenter has closed this question.',
    pickOne: 'Pick one option', pickMany: 'Pick one or more options',
    wordPh: 'Type a word or short phrase', wordsLeft: '{n} left', youSent: 'You sent', sendWord: 'Send',
    answerPh: 'Write your answer', submitAnother: 'Submit another answer', answersLeft: 'You can send {n} more',
    notRated: 'Skip', rate: 'Tap to rate',
    rankHint: 'Move items up or down, top is your favourite', moveUp: 'Move up', moveDown: 'Move down',
    pointsLeft: '{n} points left', pointsOver: '{n} points too many', pointsHint: 'Share {total} points between the options',
    askPh: 'Ask a question…', ask: 'Ask', asked: 'Question sent', popular: 'Popular', recent: 'Recent', noQuestions: 'No questions yet. Be the first to ask!',
    answered: 'Answered', yours: 'Yours', upvote: 'Upvote',
    getReady: 'Get ready…', getReadyHint: 'The question starts in a moment.', lockedIn: 'Answer locked in', lockedInHint: 'Let’s see if you got it right…',
    timeUp: 'Time’s up!', waitReveal: 'Waiting for the answer…', correct: 'Correct!', incorrect: 'Not this time', points: '+{n} points',
    score: 'Score', rank: 'Rank', rankOf: '{rank} of {players}', yourScore: 'Your score', youAre: 'You’re in place {rank} of {players}', correctWas: 'The answer was: {a}',
    reconnecting: 'Reconnecting…', results: 'Live results', react: 'Send a reaction',
    ended: 'This presentation has ended', back: 'Join another',
  },
  zh: {
    enterCode: '输入代码加入', codeHint: '代码就显示在你面前的屏幕上', join: '加入', codePh: '1234 5678',
    codeInvalid: '代码为 8 位数字。', codeNotFound: '没有找到代码为 {code} 的演示，请核对屏幕上的代码后重试。',
    footer: 'VoteLift · Lift Apps 出品 · 参与无需注册', createOwn: '创建我的演示',
    nickTitle: '给自己起个排行榜昵称', nickHint: '抢答时会显示在大屏幕上。', nickPh: '例如：答题小能手', letsGo: '开始',
    waiting: '等待主持人开始…', waitingHint: '下一个问题会自动出现在这里。',
    lookScreen: '请看大屏幕', lookScreenHint: '主持人正在展示内容，下一个问题会自动出现在这里。',
    slideOf: '第 {n} / {total} 页', submit: '提交', submitting: '提交中…', thanks: '谢谢，你的回答已提交', thanksHint: '请留意大屏幕上的结果。',
    closed: '投票已关闭', closedHint: '主持人已关闭这个问题。',
    pickOne: '请选择一个选项', pickMany: '可选择一个或多个选项',
    wordPh: '输入一个词或短语', wordsLeft: '还可以写 {n} 个', youSent: '你已提交', sendWord: '发送',
    answerPh: '写下你的回答', submitAnother: '再提交一条', answersLeft: '还可以提交 {n} 条',
    notRated: '跳过', rate: '点击打分',
    rankHint: '上下移动选项，最上面是你最喜欢的', moveUp: '上移', moveDown: '下移',
    pointsLeft: '还剩 {n} 分', pointsOver: '超出 {n} 分', pointsHint: '把 {total} 分分配给各个选项',
    askPh: '输入你的问题…', ask: '提问', asked: '问题已发送', popular: '最热', recent: '最新', noQuestions: '还没有问题，来做第一个提问的人吧！',
    answered: '已回答', yours: '我的', upvote: '点赞',
    getReady: '准备…', getReadyHint: '题目马上开始。', lockedIn: '答案已锁定', lockedInHint: '看看你答对了没有…',
    timeUp: '时间到！', waitReveal: '等待公布答案…', correct: '答对了！', incorrect: '这次没答对', points: '+{n} 分',
    score: '得分', rank: '排名', rankOf: '{rank} / {players}', yourScore: '你的得分', youAre: '你目前排在第 {rank} 名（共 {players} 人）', correctWas: '正确答案：{a}',
    reconnecting: '正在重新连接…', results: '实时结果', react: '发送表情',
    ended: '这个演示已结束', back: '加入其他演示',
  },
}

const REACTIONS = [['heart', '❤️'], ['like', '👍'], ['laugh', '😂'], ['wow', '😮'], ['clap', '👏']]
const jitter = (ms, spread) => ms + Math.round((Math.random() * 2 - 1) * spread)
const NAME_KEY = code => `livepolls-name:${code}`
const formatCode = digits => digits.replace(/\D/g, '').slice(0, 8).replace(/^(\d{4})(\d)/, '$1 $2')

export default function Audience({ code }) {
  const valid = /^\d{8}$/.test(code ?? '')
  if (!valid) return <JoinScreen initial={code ?? ''} error={code ? 'invalid' : null} />
  return <Session key={code} code={code} />
}

// ───────────────────────── join by code ─────────────────────────

function JoinScreen({ initial = '', error: initialError = null, notFound }) {
  const t = useT(DICT)
  const [value, setValue] = useState(formatCode(initial))
  const [error, setError] = useState(initialError)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const submit = e => {
    e.preventDefault()
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return setError('invalid')
    if (digits === initial && notFound) return setError('notFound')
    go(`/${digits}`)
  }
  const msg = error === 'invalid' ? t('codeInvalid') : (error === 'notFound' || notFound) ? t('codeNotFound', { code: formatCode(initial) }) : null
  return (
    <div className="aud aud-join">
      <div className="aud-corner"><LangToggle /><ThemeToggle /></div>
      <a className="aud-create" href="#/">{t('createOwn')}</a>
      <form className="aud-join-card" onSubmit={submit} noValidate>
        <div className="aud-logo"><Mark h={40} /><span>Vote<b>Lift</b></span></div>
        <h1>{t('enterCode')}</h1>
        <p className="muted">{t('codeHint')}</p>
        <input ref={inputRef} className={`aud-code ${msg ? 'bad' : ''}`} inputMode="numeric" autoComplete="off" enterKeyHint="go"
          value={value} placeholder={t('codePh')} aria-label={t('enterCode')} aria-invalid={!!msg}
          onChange={e => { setValue(formatCode(e.target.value)); setError(null) }} />
        {msg && <p className="aud-error" role="alert">{msg}</p>}
        <button className="aud-pill" disabled={value.replace(/\D/g, '').length === 0}>{t('join')}</button>
      </form>
      <footer className="aud-foot">{t('footer')}</footer>
    </div>
  )
}

// ───────────────────────── a joined session ─────────────────────────

function Session({ code }) {
  const { api } = useApp()
  const t = useT(DICT)
  const voter = useMemo(() => voterId(), [])
  const [pres, setPres] = useState(null)        // { id, title, settings, session, slides, state, version }
  const [mine, setMine] = useState({})          // slideId -> [{ entry, value }]
  const [status, setStatus] = useState('loading') // loading | ready | notfound | error
  const [needName, setNeedName] = useState(false)
  const [netErr, setNetErr] = useState(false)
  const [chanErr, setChanErr] = useState(false)
  const offset = useRef(0)
  const presRef = useRef(null)
  presRef.current = pres

  const load = useCallback(async (name) => {
    let stored = ''
    try { stored = localStorage.getItem(NAME_KEY(code)) ?? '' } catch { /* ignore */ }
    const nick = name ?? stored
    try {
      const r = await api.join(code, voter, nick)
      offset.current = r.now - Date.now()
      const grouped = {}
      for (const m of r.mine ?? []) (grouped[m.slide] ??= []).push({ entry: m.entry, value: m.value })
      setMine(grouped)
      setPres({ id: r.id, title: r.title, settings: r.settings ?? {}, session: r.session, slides: r.slides ?? [], state: r.state ?? {}, version: r.version })
      if (r.name && !stored) { try { localStorage.setItem(NAME_KEY(code), r.name) } catch { /* ignore */ } }
      setNeedName(hasQuiz(r.slides ?? []) && !nick && !r.name)
      setStatus('ready')
      setNetErr(false)
    } catch (e) {
      const m = cleanError(e)
      if (/code not found/i.test(m)) setStatus('notfound')
      else { setStatus(s => (s === 'ready' ? s : 'error')); setNetErr(true) }
    }
  }, [api, code, voter])

  useEffect(() => { load() }, [load])

  // Restarting a quiz question wipes its answers on the server; forget ours too.
  const quizRef = useRef({})
  const quiz = pres?.state?.quiz
  useEffect(() => {
    const prev = quizRef.current
    const changed = Object.keys(quiz ?? {}).filter(k => prev[k] && prev[k] !== quiz[k])
    if (changed.length) setMine(m => { const n = { ...m }; changed.forEach(k => delete n[k]); return n })
    quizRef.current = quiz ?? {}
  }, [quiz])

  // Realtime: the presenter broadcasts state changes, resets and slide edits.
  const id = pres?.id
  useEffect(() => {
    if (!id) return
    const ch = api.channel(id)
    ch.on('state', ({ state, session } = {}) => {
      const p = presRef.current
      if (!p || !state) return
      if (session != null && session !== p.session) { load(); return }
      setPres(cur => (cur ? { ...cur, state } : cur))
    })
    ch.on('reset', () => { setMine({}); load() })
    ch.on('slides', () => load())
    ch.on('status', s => setChanErr(s !== 'SUBSCRIBED'))
    return () => ch.close()
  }, [api, id, load])

  // Fallback poll every ~10 s, and right away when the phone wakes up or comes back online.
  useEffect(() => {
    if (!id) return
    let timer, alive = true, last = 0
    const poll = async () => {
      last = Date.now()
      try {
        const r = await api.poll(id, voter)
        if (!alive) return
        offset.current = r.now - Date.now()
        setNetErr(false)
        const p = presRef.current
        if (p && (r.version !== p.version || r.session !== p.session)) {
          if (r.session !== p.session) setMine({})
          load()
        } else setPres(cur => (cur ? { ...cur, state: r.state } : cur))
      } catch {
        if (alive) setNetErr(true)
      }
    }
    const loop = () => { timer = setTimeout(async () => { await poll(); if (alive) loop() }, jitter(10000, 1500)) }
    const wake = () => { if (document.visibilityState === 'visible' && Date.now() - last > 2000) poll() }
    loop()
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [api, id, voter, load])

  if (status === 'loading') return <div className="aud aud-center"><span className="spinner" /></div>
  if (status === 'notfound') return <JoinScreen initial={code} notFound />
  if (status === 'error' && !pres) return (
    <div className="aud aud-center">
      <p className="muted">{t('reconnecting')}</p>
      <button className="aud-pill" onClick={() => load()}>{t('join')}</button>
    </div>
  )
  if (needName) return <NameScreen pres={pres} onDone={name => { try { localStorage.setItem(NAME_KEY(code), name) } catch { /* ignore */ } setNeedName(false); load(name) }} />

  const slides = pres.slides
  const idx = slides.findIndex(s => s.id === pres.state?.slide)
  const slide = idx >= 0 ? slides[idx] : null
  const serverNow = () => Date.now() + offset.current
  const addMine = (sid, item) => setMine(m => ({ ...m, [sid]: [...(m[sid] ?? []), item] }))

  return (
    <div className="aud aud-live">
      <header className="aud-head">
        <Mark h={26} />
        <span className="aud-title ellipsis">{pres.title || 'VoteLift'}</span>
        {slide && <span className="aud-progress">{t('slideOf', { n: idx + 1, total: slides.length })}</span>}
        <ThemeToggle />
      </header>
      {(netErr || chanErr) && <div className="aud-net" role="status"><span className="aud-net-dot" /> {t('reconnecting')}</div>}
      <main className="aud-main">
        <div className="aud-stage" key={slide ? `${slide.id}:${pres.session}` : 'none'}>
          {slide
            ? <SlideAnswer slide={slide} pres={pres} voter={voter} mine={mine[slide.id] ?? []} addMine={item => addMine(slide.id, item)} serverNow={serverNow} />
            : <Calm icon="present" title={t('waiting')} hint={t('waitingHint')} />}
        </div>
      </main>
      <Reactions id={pres.id} voter={voter} />
    </div>
  )
}

function NameScreen({ pres, onDone }) {
  const t = useT(DICT)
  const [name, setName] = useState('')
  return (
    <div className="aud aud-join">
      <form className="aud-join-card" onSubmit={e => { e.preventDefault(); if (name.trim()) onDone(name.trim().slice(0, 30)) }}>
        <div className="aud-logo"><Mark h={40} /><span>Vote<b>Lift</b></span></div>
        <p className="aud-kicker ellipsis">{pres.title}</p>
        <h1>{t('nickTitle')}</h1>
        <p className="muted">{t('nickHint')}</p>
        <input className="aud-code aud-nick" autoFocus maxLength={30} value={name} onChange={e => setName(e.target.value)} placeholder={t('nickPh')} aria-label={t('nickTitle')} enterKeyHint="go" />
        <button className="aud-pill" disabled={!name.trim()}>{t('letsGo')}</button>
      </form>
    </div>
  )
}

function Calm({ icon, title, hint, children, tone }) {
  return (
    <div className={`aud-calm ${tone ?? ''}`}>
      <span className="aud-calm-icon"><Icon name={icon} size={30} /></span>
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      {children}
    </div>
  )
}

// ───────────────────────── per slide type ─────────────────────────

function SlideAnswer(props) {
  const { slide } = props
  switch (slide.type) {
    case 'mc': return <ChoiceAnswer {...props} />
    case 'wordcloud': return <TextAnswer {...props} kind="word" />
    case 'open': return <TextAnswer {...props} kind="open" />
    case 'scales': return <ScalesAnswer {...props} />
    case 'ranking': return <RankingAnswer {...props} />
    case 'points': return <PointsAnswer {...props} />
    case 'qa': return <QAAnswer {...props} />
    case 'quiz': return <QuizAnswer {...props} />
    case 'leaderboard': return <LeaderboardAnswer {...props} />
    default: return <ContentSlide {...props} />
  }
}

function Question({ slide, sub }) {
  const { lang } = useT()
  return (
    <div className="aud-q">
      <span className="aud-type"><Icon name={TYPES[slide.type]?.icon ?? 'info'} size={14} /> {TYPES[slide.type]?.label[lang] ?? ''}</span>
      <h2>{slide.question || '…'}</h2>
      {sub && <p className="muted aud-sub">{sub}</p>}
    </div>
  )
}

// Shared submit plumbing: sends one answer, records it, turns server errors into a friendly line.
function useSubmit({ slide, pres, voter, addMine }) {
  const { api } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const send = async value => {
    setBusy(true); setError(null)
    try {
      const r = await api.respond(pres.id, voter, slide.id, value)
      addMine({ entry: r.entry, value: r.value })
      return true
    } catch (e) {
      const m = cleanError(e)
      setError(m)
      if (/already answered/i.test(m)) addMine({ entry: -1, value })
      return false
    } finally { setBusy(false) }
  }
  return { send, busy, error, setError }
}

function SubmitBar({ disabled, busy, onClick, label }) {
  const t = useT(DICT)
  return (
    <div className="aud-submit">
      <button className="aud-pill wide" disabled={disabled || busy} onClick={onClick}>{busy ? t('submitting') : label ?? t('submit')}</button>
    </div>
  )
}

function Thanks({ children }) {
  const t = useT(DICT)
  return <Calm icon="check" tone="ok" title={t('thanks')} hint={t('thanksHint')}>{children}</Calm>
}

function Closed() {
  const t = useT(DICT)
  return <Calm icon="lock" title={t('closed')} hint={t('closedHint')} />
}

function ErrorLine({ error }) {
  return error ? <p className="aud-error" role="alert">{error}</p> : null
}

function ChoiceAnswer(props) {
  const { slide, pres, mine } = props
  const t = useT(DICT)
  const { send, busy, error } = useSubmit(props)
  const [picked, setPicked] = useState([])
  const multiple = !!slide.multiple
  const answered = mine.length > 0
  if (answered) return <Thanks><MiniResults slide={slide} pres={pres} mine={mine} /></Thanks>
  if (pres.state?.locked) return <Closed />
  const toggle = i => setPicked(p => (multiple ? (p.includes(i) ? p.filter(x => x !== i) : [...p, i]) : [i]))
  return (
    <>
      <Question slide={slide} sub={multiple ? t('pickMany') : t('pickOne')} />
      <div className="aud-options" role={multiple ? 'group' : 'radiogroup'}>
        {slide.options.map((o, i) => (
          <button key={i} className={`aud-option ${picked.includes(i) ? 'on' : ''}`} role={multiple ? 'checkbox' : 'radio'} aria-checked={picked.includes(i)} onClick={() => toggle(i)}>
            <span className={`aud-mark ${multiple ? 'sq' : ''}`} aria-hidden="true" />
            <span className="aud-option-text">{o}</span>
          </button>
        ))}
      </div>
      <ErrorLine error={error} />
      <SubmitBar disabled={!picked.length} busy={busy} onClick={() => send({ choices: [...picked].sort((a, b) => a - b) })} />
    </>
  )
}

// Live mini-results after voting on a multiple-choice slide: once now, then every ~5 s while current.
function MiniResults({ slide, pres, mine }) {
  const { api } = useApp()
  const t = useT(DICT)
  const [counts, setCounts] = useState(null)
  const allowed = pres.settings?.phoneResults !== false && pres.state?.results !== false
  useEffect(() => {
    if (!allowed) { setCounts(null); return }
    let alive = true, timer
    const fetchIt = async () => {
      try {
        const r = await api.audienceResults(pres.id, slide.id)
        if (alive) setCounts(r?.counts ?? null)
      } catch { /* keep the last numbers */ }
      if (alive) timer = setTimeout(fetchIt, jitter(5000, 1000))
    }
    timer = setTimeout(fetchIt, Math.random() * 600)
    return () => { alive = false; clearTimeout(timer) }
  }, [api, pres.id, slide.id, allowed])
  if (!counts) return null
  const total = counts.reduce((a, b) => a + b, 0) || 1
  const chosen = new Set(mine.flatMap(m => m.value?.choices ?? []))
  return (
    <div className="aud-mini">
      <div className="aud-mini-head">{t('results')}</div>
      {slide.options.map((o, i) => {
        const pct = Math.round((counts[i] / total) * 100)
        return (
          <div key={i} className={`aud-mini-row ${chosen.has(i) ? 'mine' : ''}`}>
            <div className="aud-mini-label"><span className="ellipsis">{o}</span><b>{pct}%</b></div>
            <div className="aud-mini-track"><span style={{ width: `${pct}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function TextAnswer(props) {
  const { slide, pres, mine, kind } = props
  const t = useT(DICT)
  const { send, busy, error, setError } = useSubmit(props)
  const [text, setText] = useState('')
  const word = kind === 'word'
  const max = Math.min(Math.max(slide.maxEntries ?? (word ? 3 : 1), 1), 10)
  const limit = word ? 25 : 250
  const sent = mine.filter(m => m.entry >= 0 && m.value?.text)
  const left = max - mine.length
  const submit = async e => {
    e?.preventDefault()
    const v = text.trim()
    if (!v) return
    if (await send({ text: v })) setText('')
  }
  const chips = sent.length > 0 && (
    <div className="aud-sent">
      <div className="aud-sent-head">{t('youSent')}</div>
      <div className="aud-chips">{sent.map((m, i) => <span key={i} className={word ? 'aud-chip' : 'aud-card'}>{m.value.text}</span>)}</div>
    </div>
  )
  if (left <= 0) return <Thanks>{chips}</Thanks>
  if (pres.state?.locked) return <><Closed />{chips}</>
  return (
    <>
      <Question slide={slide} sub={max > 1 ? (word ? t('wordsLeft', { n: left }) : t('answersLeft', { n: left })) : null} />
      <form className="aud-text" onSubmit={submit}>
        {word
          ? <input value={text} maxLength={limit} onChange={e => { setText(e.target.value); setError(null) }} placeholder={t('wordPh')} aria-label={t('wordPh')} enterKeyHint="send" />
          : <textarea value={text} maxLength={limit} rows={5} onChange={e => { setText(e.target.value); setError(null) }} placeholder={t('answerPh')} aria-label={t('answerPh')} />}
        <div className="aud-count">{text.length}/{limit}</div>
      </form>
      <ErrorLine error={error} />
      {chips}
      <SubmitBar disabled={!text.trim()} busy={busy} onClick={submit} label={sent.length && !word ? t('submitAnother') : word && sent.length ? t('sendWord') : undefined} />
    </>
  )
}

function ScalesAnswer(props) {
  const { slide, pres, mine } = props
  const t = useT(DICT)
  const { send, busy, error } = useSubmit(props)
  const min = slide.min ?? 1, max = slide.max ?? 5
  const [ratings, setRatings] = useState(() => slide.statements.map(() => null))
  if (mine.length) return <Thanks />
  if (pres.state?.locked) return <Closed />
  const set = (i, v) => setRatings(r => r.map((x, k) => (k === i ? v : x)))
  const steps = Array.from({ length: max - min + 1 }, (_, k) => min + k)
  const segmented = steps.length <= 7
  return (
    <>
      <Question slide={slide} />
      <div className="aud-scales">
        {slide.statements.map((s, i) => (
          <div key={i} className="aud-scale">
            <div className="aud-scale-top">
              <span className="aud-scale-label">{s}</span>
              <button className={`aud-skip ${ratings[i] === null ? 'on' : ''}`} onClick={() => set(i, null)}>{ratings[i] === null ? t('notRated') : ratings[i]}</button>
            </div>
            {segmented ? (
              <div className="aud-seg" role="radiogroup" aria-label={s}>
                {steps.map(v => <button key={v} role="radio" aria-checked={ratings[i] === v} className={ratings[i] === v ? 'on' : ''} onClick={() => set(i, v)}>{v}</button>)}
              </div>
            ) : (
              <input type="range" className={`aud-range ${ratings[i] === null ? 'unset' : ''}`} min={min} max={max} step={1} value={ratings[i] ?? Math.round((min + max) / 2)}
                aria-label={s} onChange={e => set(i, Number(e.target.value))} onPointerDown={e => { if (ratings[i] === null) set(i, Number(e.currentTarget.value)) }} />
            )}
            <div className="aud-scale-ends"><span>{slide.lowLabel}</span><span>{slide.highLabel}</span></div>
          </div>
        ))}
      </div>
      <ErrorLine error={error} />
      <SubmitBar disabled={ratings.every(r => r === null)} busy={busy} onClick={() => send({ ratings })} />
    </>
  )
}

function RankingAnswer(props) {
  const { slide, pres, mine } = props
  const t = useT(DICT)
  const { send, busy, error } = useSubmit(props)
  const [order, setOrder] = useState(() => slide.items.map((_, i) => i))
  const [moved, setMoved] = useState(null)
  if (mine.length) return <Thanks />
  if (pres.state?.locked) return <Closed />
  const move = (pos, dir) => {
    const to = pos + dir
    if (to < 0 || to >= order.length) return
    const next = [...order]
    ;[next[pos], next[to]] = [next[to], next[pos]]
    setOrder(next)
    setMoved(next[to])
  }
  return (
    <>
      <Question slide={slide} sub={t('rankHint')} />
      <ol className="aud-rank">
        {order.map((item, pos) => (
          <li key={item} className={moved === item ? 'moved' : ''}>
            <span className="aud-rank-n">{pos + 1}</span>
            <span className="aud-rank-text">{slide.items[item]}</span>
            <button className="aud-arrow" disabled={pos === 0} onClick={() => move(pos, -1)} aria-label={t('moveUp')}><Icon name="up" size={20} /></button>
            <button className="aud-arrow" disabled={pos === order.length - 1} onClick={() => move(pos, 1)} aria-label={t('moveDown')}><Icon name="down" size={20} /></button>
          </li>
        ))}
      </ol>
      <ErrorLine error={error} />
      <SubmitBar busy={busy} onClick={() => send({ order })} />
    </>
  )
}

function PointsAnswer(props) {
  const { slide, pres, mine } = props
  const t = useT(DICT)
  const { send, busy, error } = useSubmit(props)
  const total = slide.total ?? 100
  const step = total >= 50 ? 5 : 1
  const [pts, setPts] = useState(() => slide.items.map(() => 0))
  if (mine.length) return <Thanks />
  if (pres.state?.locked) return <Closed />
  const sum = pts.reduce((a, b) => a + b, 0)
  const left = total - sum
  const set = (i, v) => setPts(p => p.map((x, k) => (k === i ? Math.max(0, Math.min(total, v)) : x)))
  return (
    <>
      <Question slide={slide} sub={t('pointsHint', { total })} />
      <div className={`aud-left ${left < 0 ? 'over' : left === 0 ? 'done' : ''}`}>{left < 0 ? t('pointsOver', { n: -left }) : t('pointsLeft', { n: left })}</div>
      <div className="aud-points">
        {slide.items.map((item, i) => (
          <div key={i} className="aud-point">
            <div className="aud-point-top"><span className="aud-point-label">{item}</span><b>{pts[i]}</b></div>
            <div className="aud-point-row">
              <button className="aud-step" onClick={() => set(i, pts[i] - step)} disabled={pts[i] <= 0} aria-label="−">−</button>
              <input type="range" className="aud-range" min={0} max={total} step={step} value={pts[i]} aria-label={item}
                onChange={e => set(i, Math.min(Number(e.target.value), pts[i] + Math.max(left, 0)))} />
              <button className="aud-step" onClick={() => set(i, pts[i] + Math.min(step, Math.max(left, 0)))} disabled={left <= 0} aria-label="+">+</button>
            </div>
          </div>
        ))}
      </div>
      <ErrorLine error={error} />
      <SubmitBar disabled={sum === 0 || left < 0} busy={busy} onClick={() => send({ points: pts })} />
    </>
  )
}

// Q&A: ask, upvote, read. The list refreshes every ~4 s only while this slide is on screen.
function QAAnswer({ slide, pres, voter }) {
  const { api } = useApp()
  const t = useT(DICT)
  const [list, setList] = useState(null)
  const [sort, setSort] = useState('popular')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const pending = useRef(new Map()) // optimistic upvotes: id -> voted

  const refresh = useCallback(async () => {
    try {
      const qs = await api.questions(pres.id, slide.id, voter)
      setList(qs.map(q => (pending.current.has(q.id) && pending.current.get(q.id) !== q.voted
        ? { ...q, voted: pending.current.get(q.id), upvotes: q.upvotes + (pending.current.get(q.id) ? 1 : -1) } : q)))
    } catch { /* keep the last list */ }
  }, [api, pres.id, slide.id, voter])

  useEffect(() => {
    let alive = true, timer
    const loop = async () => { await refresh(); if (alive) timer = setTimeout(loop, jitter(4000, 800)) }
    timer = setTimeout(loop, Math.random() * 500)
    return () => { alive = false; clearTimeout(timer) }
  }, [refresh])

  const ask = async e => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    setBusy(true); setError(null)
    try {
      await api.ask(pres.id, voter, slide.id, v)
      setText(''); setNotice(t('asked'))
      setTimeout(() => setNotice(null), 2500)
      refresh()
    } catch (err) { setError(cleanError(err)) } finally { setBusy(false) }
  }
  const upvote = async q => {
    const next = !q.voted
    pending.current.set(q.id, next)
    setList(l => l.map(x => (x.id === q.id ? { ...x, voted: next, upvotes: Math.max(0, x.upvotes + (next ? 1 : -1)) } : x)))
    try {
      const n = await api.upvote(pres.id, voter, q.id)
      setList(l => l.map(x => (x.id === q.id ? { ...x, upvotes: n } : x)))
    } catch (err) {
      setList(l => l.map(x => (x.id === q.id ? { ...x, voted: !next, upvotes: Math.max(0, x.upvotes + (next ? -1 : 1)) } : x)))
      setError(cleanError(err))
    } finally { pending.current.delete(q.id) }
  }
  const sorted = useMemo(() => {
    if (!list) return null
    const l = [...list]
    return sort === 'recent' ? l.sort((a, b) => b.id - a.id) : l.sort((a, b) => b.upvotes - a.upvotes || b.id - a.id)
  }, [list, sort])
  const closed = pres.state?.locked
  return (
    <>
      <Question slide={slide} />
      {!closed ? (
        <form className="aud-ask" onSubmit={ask}>
          <textarea rows={2} maxLength={280} value={text} onChange={e => { setText(e.target.value); setError(null) }} placeholder={t('askPh')} aria-label={t('askPh')} />
          <button className="aud-pill" disabled={busy || !text.trim()}><Icon name="send" size={16} /> {t('ask')}</button>
        </form>
      ) : <p className="aud-note"><Icon name="lock" size={14} /> {t('closed')}</p>}
      {notice && <p className="aud-ok" role="status"><Icon name="check" size={14} /> {notice}</p>}
      <ErrorLine error={error} />
      <div className="seg aud-sort" role="tablist">
        <button role="tab" aria-selected={sort === 'popular'} className={sort === 'popular' ? 'on' : ''} onClick={() => setSort('popular')}>{t('popular')}</button>
        <button role="tab" aria-selected={sort === 'recent'} className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>{t('recent')}</button>
      </div>
      {!sorted ? <div className="aud-center small"><span className="spinner" /></div> : sorted.length === 0 ? <p className="aud-empty">{t('noQuestions')}</p> : (
        <ul className="aud-qs">
          {sorted.map(q => (
            <li key={q.id} className={q.answered ? 'answered' : ''}>
              <div className="aud-qs-text">
                {q.text}
                <div className="aud-qs-tags">
                  {q.answered && <span className="pill live"><Icon name="check" size={12} /> {t('answered')}</span>}
                  {q.mine && <span className="pill gold">{t('yours')}</span>}
                </div>
              </div>
              <button className={`aud-vote ${q.voted ? 'on' : ''}`} onClick={() => upvote(q)} aria-pressed={q.voted} aria-label={t('upvote')}>
                <Icon name="thumb" size={18} /><b>{q.upvotes}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const tileStyle = i => { const c = QUIZ_COLORS[i % QUIZ_COLORS.length]; return { '--c': c, '--t': inkOn(c) } }
function Shape({ i }) {
  const s = ['M12 4 21 20H3Z', 'M12 3 21 12 12 21 3 12Z', null, 'M5 5h14v14H5Z', 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6-4.5-4.1 6-.7Z', 'M7 4h10l5 8-5 8H7l-5-8Z'][i % 6]
  return (
    <svg className="aud-shape" viewBox="0 0 24 24" aria-hidden="true">
      {s ? <path d={s} fill="currentColor" /> : <circle cx="12" cy="12" r="8.5" fill="currentColor" />}
    </svg>
  )
}

function QuizAnswer(props) {
  const { slide, pres, mine, serverNow, voter } = props
  const { api } = useApp()
  const t = useT(DICT)
  const { send, busy, error } = useSubmit(props)
  const started = pres.state?.quiz?.[slide.id] ?? null
  const revealed = !!pres.state?.reveal?.[slide.id]
  const secs = Math.max(slide.time ?? 20, 1)
  const [, tick] = useState(0)
  const [me, setMe] = useState(null)
  const [answer, setAnswer] = useState(null)

  const endsAt = started ? started + secs * 1000 : null
  const remaining = endsAt ? Math.max(0, endsAt - serverNow()) : null
  const running = started && !revealed && remaining > 0

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => tick(n => n + 1), 250)
    return () => clearInterval(iv)
  }, [running])

  // After the reveal: fetch my standing and the correct answer once, spread over a moment so
  // 100 phones don't all ask in the same millisecond.
  useEffect(() => {
    if (!revealed) { setMe(null); setAnswer(null); return }
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const [q, r] = await Promise.all([api.myQuiz(pres.id, voter), api.audienceResults(pres.id, slide.id)])
        if (alive) { setMe(q); setAnswer(r) }
      } catch { /* the presenter's screen still shows it */ }
    }, Math.random() * 800)
    return () => { alive = false; clearTimeout(timer) }
  }, [api, pres.id, slide.id, voter, revealed, started])

  // A restart of the same question (new start time) wipes earlier answers on the server.
  const myAnswer = mine.length ? mine[mine.length - 1].value?.choice : null
  const fresh = myAnswer !== null && myAnswer !== undefined

  if (!started) return <Calm icon="bolt" title={t('getReady')} hint={t('getReadyHint')}><p className="aud-quiz-q">{slide.question}</p></Calm>

  if (revealed) {
    const correctIdx = answer?.correct
    const right = me?.correct ?? (correctIdx != null && myAnswer === correctIdx)
    return (
      <div className={`aud-reveal ${me ? (right ? 'right' : 'wrong') : ''}`}>
        <span className="aud-reveal-icon"><Icon name={me ? (right ? 'check' : 'x') : 'timer'} size={40} /></span>
        <h2>{me ? (right ? t('correct') : t('incorrect')) : t('waitReveal')}</h2>
        {me && right && <p className="aud-reveal-points">{t('points', { n: me.last })}</p>}
        {correctIdx != null && !right && <p className="aud-reveal-answer">{t('correctWas', { a: slide.options[correctIdx] })}</p>}
        {me && (
          <div className="aud-standing">
            <div><span>{t('score')}</span><b>{me.score}</b></div>
            <div><span>{t('rank')}</span><b>{t('rankOf', { rank: me.rank, players: me.players })}</b></div>
          </div>
        )}
      </div>
    )
  }

  const countdown = <div className="aud-timer" style={{ '--p': endsAt ? remaining / (secs * 1000) : 1 }}><span>{Math.ceil((remaining ?? 0) / 1000)}</span></div>

  if (fresh) return (
    <Calm icon="lock" title={t('lockedIn')} hint={t('lockedInHint')}>
      <div className="aud-tile mini" style={tileStyle(myAnswer)}><Shape i={myAnswer} /><span>{slide.options[myAnswer]}</span></div>
      {running && countdown}
    </Calm>
  )
  if (!running) return <Calm icon="timer" title={t('timeUp')} hint={t('waitReveal')} />

  return (
    <>
      <div className="aud-quiz-top">
        <h2 className="aud-quiz-q">{slide.question}</h2>
        {countdown}
      </div>
      <div className={`aud-tiles n${Math.min(slide.options.length, 6)}`}>
        {slide.options.map((o, i) => (
          <button key={i} className="aud-tile" style={tileStyle(i)} disabled={busy} onClick={() => send({ choice: i })}>
            <Shape i={i} /><span>{o}</span>
          </button>
        ))}
      </div>
      <ErrorLine error={error} />
    </>
  )
}

function LeaderboardAnswer({ slide, pres, voter }) {
  const { api } = useApp()
  const t = useT(DICT)
  const [me, setMe] = useState(null)
  useEffect(() => {
    let alive = true
    const timer = setTimeout(async () => {
      try { const q = await api.myQuiz(pres.id, voter); if (alive) setMe(q) } catch { /* ignore */ }
    }, Math.random() * 800)
    return () => { alive = false; clearTimeout(timer) }
  }, [api, pres.id, voter, slide.id])
  return (
    <Calm icon="trophy" title={slide.question || t('yourScore')} hint={me ? t('youAre', { rank: me.rank, players: me.players }) : null}>
      {me && (
        <div className="aud-standing big">
          <div><span>{t('yourScore')}</span><b>{me.score}</b></div>
          <div><span>{t('rank')}</span><b>#{me.rank}</b></div>
        </div>
      )}
    </Calm>
  )
}

function ContentSlide({ slide }) {
  const t = useT(DICT)
  return (
    <Calm icon={TYPES[slide.type]?.icon ?? 'present'} title={t('lookScreen')} hint={t('lookScreenHint')}>
      {slide.question && <p className="aud-content-title">{slide.question}</p>}
    </Calm>
  )
}

// ───────────────────────── reactions ─────────────────────────

function Reactions({ id, voter }) {
  const { api } = useApp()
  const t = useT(DICT)
  const last = useRef(0)
  const [floats, setFloats] = useState([])
  const react = (kind, emoji) => {
    const now = Date.now()
    if (now - last.current < 800) return
    last.current = now
    const key = now
    setFloats(f => [...f.slice(-6), { key, emoji, x: 10 + Math.random() * 80 }])
    setTimeout(() => setFloats(f => f.filter(x => x.key !== key)), 1200)
    api.react(id, voter, kind).catch(() => {})
  }
  return (
    <div className="aud-react" role="group" aria-label={t('react')}>
      {floats.map(f => <span key={f.key} className="aud-float" style={{ left: `${f.x}%` }} aria-hidden="true">{f.emoji}</span>)}
      {REACTIONS.map(([kind, emoji]) => (
        <button key={kind} onClick={() => react(kind, emoji)} aria-label={kind}><span>{emoji}</span></button>
      ))}
    </div>
  )
}
