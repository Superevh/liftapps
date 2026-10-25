import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp, go, joinUrl, joinHost } from './app-context.js'
import { ThemeToggle } from './App.jsx'
import { cleanError } from './backend.js'
import { aggregate, takesAnswers } from './slides.js'
import { Icon } from './icons.jsx'
import { QR } from './qr.jsx'
import { useT } from './i18n.js'
import { useTheme } from './theme.js'
import SlideView from './SlideView.jsx'
import './present.css'

// Full-screen presenter. Load model (see supabase/live.sql): the presenter pulls new responses for the
// current slide once a second (one request in flight, backing off on errors) and pushes control changes
// to the audience as one Realtime broadcast each; the audience never broadcasts.
const DICT = {
  en: {
    goTo: 'Go to', useCode: 'and use the code', join: 'Join at', prev: 'Previous slide', next: 'Next slide',
    showResults: 'Show results', hideResults: 'Hide results', lock: 'Close voting', unlock: 'Open voting', locked: 'Voting closed',
    reset: 'Reset results', confirmReset: 'Click again to clear all results', fullscreen: 'Full screen', qr: 'QR code', exit: 'Back to editor',
    participants: '{n} joined', responses: '{n} responses', startQuiz: 'Start question', showAnswer: 'Show answer', restartQuiz: 'Ask again',
    reconnecting: 'Reconnecting…', notFound: 'This presentation could not be opened.', back: 'Back to my presentations', loading: 'Loading presentation…',
    questions: 'Questions', sortTop: 'Top', sortNew: 'Newest', answer: 'Mark answered', unanswer: 'Mark unanswered', hide: 'Hide', show: 'Show',
    del: 'Delete', confirmDel: 'Confirm', noQuestions: 'No questions yet', hiddenTag: 'Hidden', panel: 'Moderate Q&A', closeQr: 'Close',
    emptyDeck: 'This presentation has no slides yet.', scanToJoin: 'Scan to join', resetDone: 'Results cleared. A new session has started.',
  },
  zh: {
    goTo: '打开', useCode: '输入代码', join: '参与地址', prev: '上一页', next: '下一页',
    showResults: '显示结果', hideResults: '隐藏结果', lock: '关闭投票', unlock: '开放投票', locked: '投票已关闭',
    reset: '重置结果', confirmReset: '再次点击以清空所有结果', fullscreen: '全屏', qr: '二维码', exit: '返回编辑',
    participants: '{n} 人已加入', responses: '{n} 份回答', startQuiz: '开始答题', showAnswer: '公布答案', restartQuiz: '重新作答',
    reconnecting: '正在重新连接…', notFound: '无法打开这个演示。', back: '返回我的演示', loading: '正在加载演示…',
    questions: '提问', sortTop: '最热', sortNew: '最新', answer: '标记为已回答', unanswer: '标记为未回答', hide: '隐藏', show: '显示',
    del: '删除', confirmDel: '确认', noQuestions: '还没有提问', hiddenTag: '已隐藏', panel: '管理问答', closeQr: '关闭',
    emptyDeck: '这个演示还没有页面。', scanToJoin: '扫码参与', resetDone: '结果已清空，已开始新的一轮。',
  },
}

const EMOJI = { heart: '❤️', like: '👍', laugh: '😂', wow: '😮', clap: '👏' }
const fmtCode = c => String(c ?? '').replace(/^(\d{4})(\d{4})$/, '$1 $2')

export default function Present({ id }) {
  const { api, toast } = useApp()
  const t = useT(DICT)
  const dark = useTheme() === 'dark'
  const [deck, setDeck] = useState(null)
  // Effects that only need the deck to exist key on this, so slide edits don't reconnect or restart them.
  const loaded = !!deck
  const [failed, setFailed] = useState(null)
  const [live, setLive] = useState({})
  const [session, setSession] = useState(1)
  const [data, setData] = useState({ responses: [], questions: [], participants: 0, leaderboard: [], players: null })
  const [offset, setOffset] = useState(0)
  const [offline, setOffline] = useState(false)
  const [bubbles, setBubbles] = useState([])
  const [qrBig, setQrBig] = useState(false)
  const [banner, setBanner] = useState(true)
  const [barVisible, setBarVisible] = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const [panel, setPanel] = useState(true)

  const liveRef = useRef(live)
  liveRef.current = live
  const sessionRef = useRef(session)
  sessionRef.current = session
  const chRef = useRef(null)
  const feed = useRef({ slide: null, session: null, after: 0, list: [], ids: new Set(), reactionHead: null })
  const kickRef = useRef(() => {})

  // ── load ──
  useEffect(() => {
    let alive = true
    api.get(id).then(row => {
      if (!alive) return
      setDeck(row)
      setSession(row.session)
      const state = row.state ?? {}
      setLive(state)
      // The stored current slide was deleted in the editor: move everyone to the first slide.
      const first = row.slides[0]?.id
      if (first && !row.slides.some(s => s.id === state.slide)) {
        setLive({ ...state, slide: first })
        api.setState(id, { slide: first }).then(s => alive && setLive(s), () => {})
      }
    }, e => alive && setFailed(cleanError(e)))
    return () => { alive = false }
  }, [api, id])

  // ── realtime channel (presenter → audience) ──
  useEffect(() => {
    if (!loaded) return
    const ch = api.channel(id)
    chRef.current = ch
    // Bring phones that are already open in line with this presenter.
    ch.on('status', s => { if (s === 'SUBSCRIBED') ch.send('state', { state: liveRef.current, session: sessionRef.current }) })
    // The editor announces saved changes; refresh the slides without touching the live state.
    ch.on('slides', () => { api.get(id).then(row => setDeck(d => ({ ...d, title: row.title, slides: row.slides, settings: row.settings })), () => {}) })
    return () => { ch.close(); chRef.current = null }
  }, [api, id, loaded])

  const broadcast = useCallback((state, sess = sessionRef.current) => chRef.current?.send('state', { state, session: sess }), [])

  // ── polling results: one request in flight, 1 s apart, exponential backoff on errors ──
  useEffect(() => {
    if (!loaded) return
    let stop = false, timer = null, inflight = false, again = false, delay = 1000
    const tick = async () => {
      if (stop) return
      if (inflight) { again = true; return }
      clearTimeout(timer)
      inflight = true
      const sid = liveRef.current.slide
      const f = feed.current
      if (f.slide !== sid) Object.assign(f, { slide: sid, after: 0, list: [], ids: new Set() })
      const askedAfter = f.after
      const t0 = Date.now()
      try {
        const r = await api.results(id, sid, askedAfter, f.reactionHead ?? 0)
        if (stop) return
        const rtt = Date.now() - t0
        setOffset(r.now - (t0 + rtt / 2))
        setOffline(false)
        delay = 1000
        if (f.slide === sid) {
          if (f.session !== null && f.session !== r.session) Object.assign(f, { after: 0, list: [], ids: new Set() })
          f.session = r.session
          if (r.session !== sessionRef.current) setSession(r.session)
          if (f.after === askedAfter) {
            let added = false
            for (const row of r.responses) {
              if (!f.ids.has(row.id)) { f.ids.add(row.id); f.list.push(row); added = true }
              if (row.id > f.after) f.after = row.id
            }
            if (added) f.list = [...f.list]
          }
          setData({ responses: f.list, questions: r.questions ?? [], participants: r.participants ?? 0, leaderboard: r.leaderboard ?? [], players: r.players })
        }
        if (f.reactionHead == null) f.reactionHead = r.reactionHead ?? 0
        else {
          if (r.reactions?.length) spawn(r.reactions)
          f.reactionHead = Math.max(f.reactionHead, r.reactionHead ?? 0, ...r.reactions.map(x => x.id))
        }
      } catch {
        if (stop) return
        setOffline(true)
        delay = Math.min(delay * 2, 16000)
      } finally {
        inflight = false
      }
      if (stop) return
      if (again) { again = false; timer = setTimeout(tick, 0) } else timer = setTimeout(tick, delay)
    }
    const spawn = list => setBubbles(b => [...b, ...list.slice(-12).map((x, i) => ({ key: `${x.id}`, emoji: EMOJI[x.kind] ?? '✨', left: 6 + ((x.id * 37) % 88), delay: i * 0.12 }))].slice(-30))
    kickRef.current = tick
    tick()
    return () => { stop = true; clearTimeout(timer); kickRef.current = () => {} }
  }, [api, id, loaded])

  // Bubbles float for 3.2 s.
  useEffect(() => {
    if (!bubbles.length) return
    const timer = setTimeout(() => setBubbles(b => b.slice(1)), 3200 / Math.max(1, bubbles.length / 3))
    return () => clearTimeout(timer)
  }, [bubbles])

  const slides = deck?.slides ?? []
  const index = Math.max(0, slides.findIndex(s => s.id === live.slide))
  const slide = slides[index]
  const results = useMemo(() => (slide ? aggregate(slide, data.responses) : null), [slide, data.responses])

  const patchState = useCallback(async patch => {
    setLive(prev => ({ ...prev, ...patch }))
    try {
      const next = await api.setState(id, patch)
      setLive(next)
      broadcast(next)
      return next
    } catch (e) {
      toast(cleanError(e))
    }
  }, [api, id, broadcast, toast])

  const goTo = useCallback(i => {
    const s = slides[i]
    if (!s || s.id === liveRef.current.slide) return
    feed.current = { ...feed.current, slide: s.id, after: 0, list: [], ids: new Set() }
    setData(d => ({ ...d, responses: [], questions: [], leaderboard: [] }))
    patchState({ slide: s.id, locked: false }).then(() => kickRef.current())
  }, [slides, patchState])

  // ── quiz ──
  const quizStart = slide?.type === 'quiz' ? live.quiz?.[slide.id] : null
  const quizRevealed = slide?.type === 'quiz' && !!live.reveal?.[slide.id]
  const quizEnds = quizStart ? quizStart + (slide.time ?? 20) * 1000 : null
  const phase = quizRevealed ? 'revealed' : quizStart ? 'running' : 'ready'
  const startQuiz = () => {
    feed.current = { ...feed.current, after: 0, list: [], ids: new Set() }
    setData(d => ({ ...d, responses: [] }))
    patchState({ startQuiz: slide.id })
  }
  const reveal = useCallback(() => slide && patchState({ reveal: slide.id }).then(() => kickRef.current()), [slide, patchState])
  useEffect(() => {
    if (phase !== 'running' || !quizEnds) return
    const wait = quizEnds - (Date.now() + offset) + 400
    const timer = setTimeout(reveal, Math.max(0, wait))
    return () => clearTimeout(timer)
  }, [phase, quizEnds, offset, reveal])
  // Everyone has answered: reveal early.
  useEffect(() => {
    if (phase === 'running' && data.participants > 0 && results?.total >= data.participants) reveal()
  }, [phase, data.participants, results?.total, reveal])

  // ── controls ──
  const toggleResults = () => patchState({ results: !(live.results ?? true) })
  const toggleLock = () => patchState({ locked: !live.locked })
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {})
  const doReset = async () => {
    if (!confirmReset) { setConfirmReset(true); return }
    setConfirmReset(false)
    try {
      const r = await api.reset(id)
      setSession(r.session)
      setLive(r.state)
      feed.current = { ...feed.current, session: r.session, after: 0, list: [], ids: new Set() }
      setData(d => ({ ...d, responses: [], questions: [], leaderboard: [], participants: 0 }))
      chRef.current?.send('reset', { session: r.session, state: r.state })
      toast(t('resetDone'))
      kickRef.current()
    } catch (e) { toast(cleanError(e)) }
  }
  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmReset])

  // Keyboard: ←/→, Space, PageUp/PageDown (clickers), H results, L lock, F full screen, Q QR.
  useEffect(() => {
    const on = e => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      const k = e.key
      if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(k)) { e.preventDefault(); goTo(index + 1) }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(k)) { e.preventDefault(); goTo(index - 1) }
      else if (k === 'h' || k === 'H') toggleResults()
      else if (k === 'l' || k === 'L') toggleLock()
      else if (k === 'f' || k === 'F') fullscreen()
      else if (k === 'q' || k === 'Q') setQrBig(v => !v)
      else if (k === 'Escape') setQrBig(false)
      else return
      wake()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  // The control bar hides after 3 s without mouse movement.
  const idle = useRef(null)
  const wake = useCallback(() => {
    setBarVisible(true)
    clearTimeout(idle.current)
    idle.current = setTimeout(() => setBarVisible(false), 3000)
  }, [])
  useEffect(() => { wake(); return () => clearTimeout(idle.current) }, [wake])

  if (failed) return (
    <div className="pr-page pr-message">
      <p>{t('notFound')}</p><p className="muted">{failed}</p>
      <a className="btn primary" href="#/">{t('back')}</a>
    </div>
  )
  if (!deck) return <div className="pr-page pr-message"><span className="spinner" /> {t('loading')}</div>
  if (!slides.length) return (
    <div className="pr-page pr-message">
      <p>{t('emptyDeck')}</p>
      <button className="btn primary" onClick={() => go(`/edit/${id}`)}>{t('exit')}</button>
    </div>
  )

  const joinLink = joinUrl(deck.code)
  const host = `${joinHost()}/#/join`
  const answers = takesAnswers(slide)
  const showResults = live.results ?? true
  const count = results?.voters ?? 0
  const isQA = slide.type === 'qa'

  return (
    <div className={`pr-page ${barVisible ? '' : 'idle'}`} onMouseMove={wake}>
      {banner && (
        <header className="pr-banner">
          <span className="pr-banner-text">
            {t('goTo')} <b>{host}</b> {t('useCode')} <b className="pr-code">{fmtCode(deck.code)}</b>
          </span>
          <button className="pr-qr-mini" onClick={() => setQrBig(true)} title={t('qr')} aria-label={t('qr')}>
            <QR text={joinLink} size={44} dark={dark ? '#F7F1E6' : '#2B1E14'} light={dark ? '#271B12' : '#F7F1E6'} />
          </button>
        </header>
      )}

      <main className={`pr-main ${isQA && panel ? 'with-panel' : ''}`}>
        <div className="pr-stage-wrap">
          <div className="pr-stage">
            <SlideView slide={slide} mode="present" results={results} showResults={showResults}
              questions={data.questions} leaderboard={data.leaderboard} players={data.players}
              quiz={slide.type === 'quiz' ? { phase, endsAt: quizEnds, offset } : undefined} />
            {live.locked && answers && <div className="pr-locked"><Icon name="lock" size={14} /> {t('locked')}</div>}
            {slide.type === 'quiz' && (
              <div className="pr-quiz-actions">
                {phase === 'ready' && <button className="btn reveal pr-big" onClick={startQuiz}><Icon name="play" /> {t('startQuiz')}</button>}
                {phase === 'running' && <button className="btn primary pr-big" onClick={reveal}>{t('showAnswer')}</button>}
                {phase === 'revealed' && <button className="btn ghost" onClick={startQuiz}><Icon name="reset" /> {t('restartQuiz')}</button>}
              </div>
            )}
          </div>
        </div>
        {isQA && panel && <QAPanel api={api} id={id} questions={data.questions} t={t} onChange={() => kickRef.current()} onClose={() => setPanel(false)} toast={toast} />}
      </main>

      <div className="pr-bubbles" aria-hidden="true">
        {bubbles.map(b => <span key={b.key} className="pr-bubble" style={{ left: `${b.left}%`, animationDelay: `${b.delay}s` }}>{b.emoji}</span>)}
      </div>

      <nav className="pr-bar" onMouseEnter={() => { clearTimeout(idle.current); setBarVisible(true) }} onMouseLeave={wake}>
        <div className="pr-bar-left">
          <span className="pr-stat" title={t('participants', { n: data.participants })}><Icon name="users" /> {data.participants}</span>
          {answers && <span className="pr-stat" title={t('responses', { n: count })}><Icon name="chart" /> {count}</span>}
          {offline && <span className="pr-stat pr-offline">{t('reconnecting')}</span>}
        </div>
        <div className="pr-bar-mid">
          <button className="icon-btn" onClick={() => goTo(index - 1)} disabled={index === 0} title={t('prev')} aria-label={t('prev')}><Icon name="left" size={20} /></button>
          <span className="pr-pos">{index + 1} / {slides.length}</span>
          <button className="icon-btn" onClick={() => goTo(index + 1)} disabled={index === slides.length - 1} title={t('next')} aria-label={t('next')}><Icon name="right" size={20} /></button>
        </div>
        <div className="pr-bar-right">
          {answers && slide.type !== 'quiz' && (
            <button className={`icon-btn ${showResults ? '' : 'on'}`} onClick={toggleResults} title={showResults ? t('hideResults') : t('showResults')} aria-label={showResults ? t('hideResults') : t('showResults')}>
              <Icon name={showResults ? 'eye' : 'eyeOff'} size={18} />
            </button>
          )}
          {(answers || isQA) && (
            <button className={`icon-btn ${live.locked ? 'on' : ''}`} onClick={toggleLock} title={live.locked ? t('unlock') : t('lock')} aria-label={live.locked ? t('unlock') : t('lock')}>
              <Icon name="lock" size={18} />
            </button>
          )}
          {isQA && <button className={`icon-btn ${panel ? 'on' : ''}`} onClick={() => setPanel(p => !p)} title={t('panel')} aria-label={t('panel')}><Icon name="comment" size={18} /></button>}
          <button className={`btn sm ${confirmReset ? 'pr-danger' : 'ghost'}`} onClick={doReset} title={t('reset')}>
            <Icon name="reset" /> <span className="pr-lbl">{confirmReset ? t('confirmReset') : t('reset')}</span>
          </button>
          <button className={`icon-btn ${banner ? '' : 'on'}`} onClick={() => setBanner(b => !b)} title={t('qr')} aria-label={t('qr')}><Icon name="qr" size={18} /></button>
          <ThemeToggle />
          <button className="icon-btn" onClick={fullscreen} title={t('fullscreen')} aria-label={t('fullscreen')}><Icon name="expand" size={18} /></button>
          <button className="icon-btn" onClick={() => go(`/edit/${id}`)} title={t('exit')} aria-label={t('exit')}><Icon name="x" size={18} /></button>
        </div>
      </nav>

      {qrBig && (
        <div className="pr-qr-overlay" onClick={() => setQrBig(false)} role="dialog" aria-label={t('scanToJoin')}>
          <div className="pr-qr-card" onClick={e => e.stopPropagation()}>
            <h2>{t('scanToJoin')}</h2>
            <QR text={joinLink} size={340} />
            <p>{t('goTo')} <b>{host}</b><br />{t('useCode')} <b className="pr-code">{fmtCode(deck.code)}</b></p>
            <button className="btn ghost" onClick={() => setQrBig(false)}>{t('closeQr')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Q&A moderation beside the slide: answer, hide or delete questions; sorted by votes or time.
function QAPanel({ api, id, questions, t, onChange, onClose, toast }) {
  const [sort, setSort] = useState('top')
  const [pending, setPending] = useState({})
  const [confirm, setConfirm] = useState(null)
  const list = [...questions].map(q => ({ ...q, ...pending[q.id] })).filter(q => !q._deleted)
    .sort((a, b) => (sort === 'top' ? Number(a.answered) - Number(b.answered) || b.upvotes - a.upvotes || b.id - a.id : b.id - a.id))
  const act = async (q, action) => {
    const optimistic = { answer: { answered: true }, unanswer: { answered: false }, hide: { hidden: true }, show: { hidden: false }, delete: { _deleted: true } }[action]
    setPending(p => ({ ...p, [q.id]: { ...p[q.id], ...optimistic } }))
    try { await api.moderate(id, q.id, action); onChange() } catch (e) { toast(cleanError(e)) }
  }
  return (
    <aside className="pr-panel">
      <div className="pr-panel-head">
        <h3>{t('questions')} <span className="muted">{list.length}</span></h3>
        <div className="seg">
          <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>{t('sortTop')}</button>
          <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>{t('sortNew')}</button>
        </div>
        <button className="icon-btn sm" onClick={onClose} aria-label={t('closeQr')}><Icon name="x" /></button>
      </div>
      <ul className="pr-panel-list">
        {!list.length && <li className="pr-panel-empty">{t('noQuestions')}</li>}
        {list.map(q => (
          <li key={q.id} className={`pr-q ${q.answered ? 'answered' : ''} ${q.hidden ? 'hidden' : ''}`}>
            <div className="pr-q-top"><span className="pr-q-votes"><Icon name="thumb" size={14} /> {q.upvotes}</span>{q.hidden && <span className="pill">{t('hiddenTag')}</span>}</div>
            <p>{q.text}</p>
            <div className="pr-q-actions">
              <button className="chip-btn" onClick={() => act(q, q.answered ? 'unanswer' : 'answer')}><Icon name="check" size={13} /> {q.answered ? t('unanswer') : t('answer')}</button>
              <button className="chip-btn" onClick={() => act(q, q.hidden ? 'show' : 'hide')}><Icon name={q.hidden ? 'eye' : 'eyeOff'} size={13} /> {q.hidden ? t('show') : t('hide')}</button>
              {confirm === q.id
                ? <button className="chip-btn pr-chip-danger" onClick={() => { setConfirm(null); act(q, 'delete') }}>{t('confirmDel')}</button>
                : <button className="chip-btn" onClick={() => setConfirm(q.id)} aria-label={t('del')}><Icon name="trash" size={13} /></button>}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
