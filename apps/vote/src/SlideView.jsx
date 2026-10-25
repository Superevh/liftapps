import { useEffect, useState } from 'react'
import { seriesColor, takesAnswers, typeLabel, TEXT_SERIES, TEXT_SERIES_DARK, QUIZ_COLORS, inkOn } from './slides.js'
export { QUIZ_COLORS }
import { useTheme } from './theme.js'
import { useT } from './i18n.js'
import './slideview.css'

// One slide on a 16:9 stage. Everything is sized in cqw (percent of the stage width), so the same
// component draws a 180px thumbnail, the editor preview and a full-screen projector slide.
//
// Props: slide, mode ('present' | 'preview' | 'thumb'), results (aggregate(slide, responses)),
// showResults, questions (Q&A), leaderboard [{ name, score, last }], players, participants,
// quiz { phase: 'ready' | 'running' | 'revealed', endsAt, offset /* server - local ms */ }.
const DICT = {
  en: {
    hidden: 'Results are hidden', responses: '{n} responses', joined: '{n} joined', response1: '1 response', waiting: 'Waiting for responses…',
    noQuestions: 'No questions yet. Ask from your phone!', upvotes: '{n} upvotes', answered: 'Answered',
    getReady: 'Get ready to answer', secondsLeft: 'seconds left', timeUp: 'Time’s up', answers: '{n} answers',
    noScores: 'Scores appear after the first quiz question.', pts: 'pts', avg: 'Average', avgRank: 'avg. rank {n}',
    untitled: 'Untitled slide', addImage: 'Add an image URL in the editor', points: '{n} points', players: '{n} players',
  },
  zh: {
    hidden: '结果已隐藏', responses: '{n} 份回答', joined: '{n} 人参与', response1: '1 份回答', waiting: '等待回答中…',
    noQuestions: '还没有提问，用手机来提问吧！', upvotes: '{n} 个赞', answered: '已回答',
    getReady: '准备作答', secondsLeft: '秒', timeUp: '时间到', answers: '{n} 人作答',
    noScores: '第一道抢答题之后会显示得分。', pts: '分', avg: '平均', avgRank: '平均排名 {n}',
    untitled: '未命名页面', addImage: '在编辑器中添加图片链接', points: '{n} 分', players: '{n} 名玩家',
  },
}

export default function SlideView({ slide, mode = 'preview', results, showResults = true, questions = [], leaderboard = [], players, participants, quiz }) {
  const dark = useTheme() === 'dark'
  const t = useT(DICT)
  if (!slide) return <div className={`sv sv-${mode}`}><div className="sv-stage" /></div>
  const color = i => seriesColor(i, dark)
  const count = results?.voters ?? results?.total ?? 0
  const answers = takesAnswers(slide)
  const hide = answers && !showResults && slide.type !== 'quiz'
  const p = { slide, results, t, color, mode, dark, questions, leaderboard, players, quiz }
  const Body = BODY[slide.type]
  const body = hide ? <Hidden t={t} count={count} /> : Body ? <Body key={slide.id} {...p} /> : null
  const content = ['heading', 'quote', 'image'].includes(slide.type)
  return (
    <div className={`sv sv-${mode} sv-type-${slide.type}`} data-dark={dark || undefined}>
      <div className="sv-stage">
        {!content && slide.type !== 'quiz' && (
          <header className="sv-head">
            <h2 className="sv-q">{slide.question || <span className="sv-placeholder">{typeLabel(slide.type, t.lang)}</span>}</h2>
          </header>
        )}
        <div className="sv-body">{body}</div>
        {answers && mode !== 'thumb' && slide.type !== 'quiz' && (
          <div className="sv-foot"><span className="sv-count">{count === 1 ? t('response1') : t('responses', { n: count })}</span>{participants != null && <span className="sv-count"> · {t('joined', { n: participants })}</span>}</div>
        )}
      </div>
    </div>
  )
}

function Hidden({ t, count }) {
  return (
    <div className="sv-center">
      <div className="sv-hidden">
        <svg viewBox="0 0 24 24" className="sv-hidden-ic" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>
        <strong>{t('hidden')}</strong>
        <span>{count === 1 ? t('response1') : t('responses', { n: count })}</span>
      </div>
    </div>
  )
}

const Waiting = ({ t }) => <div className="sv-center sv-waiting"><span className="sv-pulse" />{t('waiting')}</div>
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

// ───────────── multiple choice ─────────────
function Choice({ slide, results, color, mode }) {
  const counts = results?.counts ?? slide.options.map(() => 0)
  const total = counts.reduce((a, b) => a + b, 0)
  const chart = slide.chart ?? 'bars'
  if (chart === 'donut' || chart === 'pie') return <Round slide={slide} counts={counts} total={total} color={color} donut={chart === 'donut'} />
  if (chart === 'dots') return <Dots slide={slide} counts={counts} color={color} mode={mode} />
  const max = Math.max(1, ...counts)
  return (
    <div className="sv-bars" style={{ '--n': slide.options.length }}>
      {slide.options.map((o, i) => (
        <div className="sv-bar-col" key={i}>
          <div className="sv-bar-num">{counts[i]}{total > 0 && <small> {pct(counts[i], total)}%</small>}</div>
          <div className="sv-bar-track"><div className="sv-bar" style={{ height: `${(counts[i] / max) * 100}%`, background: color(i) }} /></div>
          <div className="sv-bar-label" title={o}>{o}</div>
        </div>
      ))}
    </div>
  )
}

function arcPath(cx, cy, r, a0, a1, inner) {
  const pt = (rad, a) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)]
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1)
  if (!inner) return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`
  const [x2, y2] = pt(inner, a1), [x3, y3] = pt(inner, a0)
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${large} 0 ${x3},${y3} Z`
}

function Round({ slide, counts, total, color, donut }) {
  let a = 0
  const segs = total ? counts.map((c, i) => {
    const a0 = a, a1 = a + (c / total) * Math.PI * 2
    a = a1
    if (!c) return null
    if (c === total) return donut
      ? <g key={i}><circle cx="50" cy="50" r="46" fill={color(i)} /><circle cx="50" cy="50" r="28" className="sv-hole" /></g>
      : <circle key={i} cx="50" cy="50" r="46" fill={color(i)} />
    return <path key={i} d={arcPath(50, 50, 46, a0, a1, donut ? 28 : 0)} fill={color(i)} className="sv-seg" />
  }) : [<circle key="e" cx="50" cy="50" r="46" className="sv-empty-ring" />]
  return (
    <div className="sv-round">
      <svg viewBox="0 0 100 100" className="sv-round-svg">
        {segs}
        {donut && total > 0 && <text x="50" y="50" className="sv-round-total" textAnchor="middle" dominantBaseline="central">{total}</text>}
      </svg>
      <ul className="sv-legend">
        {slide.options.map((o, i) => (
          <li key={i}><span className="sv-swatch" style={{ background: color(i) }} /><span className="sv-legend-label">{o}</span><b>{counts[i]}</b><small>{pct(counts[i], total)}%</small></li>
        ))}
      </ul>
    </div>
  )
}

function Dots({ slide, counts, color, mode }) {
  const cap = mode === 'thumb' ? 12 : 60
  return (
    <div className="sv-dots">
      {slide.options.map((o, i) => (
        <div className="sv-dots-row" key={i}>
          <div className="sv-dots-label">{o}</div>
          <div className="sv-dots-track">
            {Array.from({ length: Math.min(counts[i], cap) }, (_, k) => <span key={k} className="sv-dot" style={{ background: color(i) }} />)}
            {counts[i] > cap && <span className="sv-dots-more">+{counts[i] - cap}</span>}
          </div>
          <b className="sv-dots-n">{counts[i]}</b>
        </div>
      ))}
    </div>
  )
}

// ───────────── word cloud ─────────────
// Words keep a fixed slot ordered by a hash of the word, so the cloud grows in place instead of reshuffling.
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

function Cloud({ results, color, t, mode, dark }) {
  const words = results?.words ?? []
  if (!words.length) return <Waiting t={t} />
  const shown = words.slice(0, mode === 'thumb' ? 14 : 60)
  const max = shown[0].count, min = shown[shown.length - 1].count
  const ordered = [...shown].sort((a, b) => hash(a.text.toLowerCase()) - hash(b.text.toLowerCase()))
  // Biggest words drift to the middle: alternate placing each side of the centre by weight.
  const center = []
  ordered.sort((a, b) => b.count - a.count || hash(a.text) - hash(b.text)).forEach((w, i) => (i % 2 ? center.push(w) : center.unshift(w)))
  return (
    <div className="sv-cloud">
      {center.map(w => {
        const k = max === min ? 0.6 : (w.count - min) / (max - min)
        const h = hash(w.text.toLowerCase())
        return (
          <span key={w.text.toLowerCase()} className="sv-word" title={`${w.text} · ${w.count}`}
            style={{ fontSize: `${1.6 + k * 4.6}cqw`, color: (dark ? TEXT_SERIES_DARK : TEXT_SERIES)[h % 7], fontWeight: k > 0.2 ? 600 : 500, transform: h % 9 === 0 && k < 0.4 ? 'rotate(-6deg)' : undefined }}>
            {w.text}
          </span>
        )
      })}
    </div>
  )
}

// ───────────── open ended ─────────────
function Open({ slide, results, color, t, mode }) {
  const items = results?.items ?? []
  if (!items.length) return <Waiting t={t} />
  const shown = items.slice(0, mode === 'thumb' ? 6 : 40)
  if (slide.layout === 'list') return (
    <ol className="sv-open-list">{shown.map((it, i) => <li key={it.id ?? i}>{it.text}</li>)}</ol>
  )
  return (
    <div className="sv-wall">
      {shown.map((it, i) => <div key={it.id ?? i} className="sv-note" style={{ '--c': color(hash(String(it.id ?? i)) % 8) }}>{it.text}</div>)}
    </div>
  )
}

// ───────────── scales ─────────────
function Scales({ slide, results, color, t }) {
  const min = slide.min ?? 1, max = slide.max ?? 5
  const stats = results?.stats ?? slide.statements.map(() => ({ avg: null, count: 0, dist: [] }))
  return (
    <div className="sv-scales">
      <div className="sv-scale-ends"><span>{slide.lowLabel}</span><span>{slide.highLabel}</span></div>
      {slide.statements.map((s, i) => {
        const st = stats[i] ?? { avg: null, dist: [] }
        const dmax = Math.max(1, ...st.dist)
        // Columns per scale point; the average sits at the matching column centre.
        const pos = st.avg == null ? null : ((st.avg - min + 0.5) / (max - min + 1)) * 100
        return (
          <div className="sv-scale" key={i}>
            <div className="sv-scale-label">{s}</div>
            <div className="sv-scale-track">
              <div className="sv-scale-dist">
                {Array.from({ length: max - min + 1 }, (_, k) => <span key={k} style={{ height: `${((st.dist[k] ?? 0) / dmax) * 100}%`, background: color(i) }} />)}
              </div>
              <div className="sv-scale-line" />
              {pos != null && <div className="sv-scale-avg" style={{ left: `${pos}%`, background: color(i), color: inkOn(color(i)) }}><b>{st.avg.toFixed(1)}</b></div>}
              <div className="sv-scale-ticks">{Array.from({ length: max - min + 1 }, (_, k) => <span key={k}>{min + k}</span>)}</div>
            </div>
          </div>
        )
      })}
      {!results?.total && <div className="sv-sub-waiting">{t('waiting')}</div>}
    </div>
  )
}

// ───────────── ranking & 100 points ─────────────
function Ranking({ slide, results, color, t }) {
  const ranked = results?.ranked ?? slide.items.map((text, index) => ({ index, text, score: 0, avgRank: null }))
  const max = Math.max(1, ...ranked.map(r => r.score))
  return (
    <ol className="sv-hbars">
      {ranked.map((r, pos) => (
        <li key={r.index} className="sv-hbar-row">
          <span className="sv-rank">{pos + 1}</span>
          <div className="sv-hbar-main">
            <div className="sv-hbar-label">{slide.items[r.index] ?? r.text}{r.avgRank != null && <small>{t('avgRank', { n: r.avgRank.toFixed(1) })}</small>}</div>
            <div className="sv-hbar-track"><div className="sv-hbar" style={{ width: `${(r.score / max) * 100}%`, background: color(r.index) }} /></div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Points({ slide, results, color, t }) {
  const totals = results?.totals ?? slide.items.map(() => 0)
  const sum = totals.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...totals)
  const order = slide.items.map((_, i) => i).sort((a, b) => totals[b] - totals[a] || a - b)
  return (
    <ol className="sv-hbars">
      {order.map(i => (
        <li key={i} className="sv-hbar-row">
          <span className="sv-swatch big" style={{ background: color(i) }} />
          <div className="sv-hbar-main">
            <div className="sv-hbar-label">{slide.items[i]}<small>{t('points', { n: totals[i] })}{sum > 0 && ` · ${pct(totals[i], sum)}%`}</small></div>
            <div className="sv-hbar-track"><div className="sv-hbar" style={{ width: `${(totals[i] / max) * 100}%`, background: color(i) }} /></div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ───────────── Q&A ─────────────
function QA({ questions, t, mode, color }) {
  const list = questions.filter(q => !q.hidden).sort((a, b) => Number(a.answered) - Number(b.answered) || b.upvotes - a.upvotes || b.id - a.id)
  if (!list.length) return <div className="sv-center sv-waiting">{t('noQuestions')}</div>
  return (
    <ul className="sv-qa">
      {list.slice(0, mode === 'thumb' ? 3 : 7).map((q, i) => (
        <li key={q.id} className={`sv-qa-item ${q.answered ? 'answered' : ''} ${i === 0 && !q.answered ? 'top' : ''}`} style={{ '--c': color(i) }}>
          <span className="sv-qa-votes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v10H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1H7Z" /><path d="M7 10l4-6.5a1.8 1.8 0 0 1 3.3 1.3L13.5 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" /></svg>{q.upvotes}</span>
          <span className="sv-qa-text">{q.text}</span>
          {q.answered && <span className="sv-qa-done">{t('answered')}</span>}
        </li>
      ))}
    </ul>
  )
}

// ───────────── quiz ─────────────
export function Shape({ i }) {
  const s = i % 4
  return (
    <svg viewBox="0 0 24 24" className="sv-shape" aria-hidden="true">
      {s === 0 && <path d="M12 3.5 21 19.5H3Z" />}
      {s === 1 && <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />}
      {s === 2 && <circle cx="12" cy="12" r="9" />}
      {s === 3 && <rect x="3.5" y="3.5" width="17" height="17" rx="2" />}
    </svg>
  )
}

function useServerNow(running, offset) {
  const [now, setNow] = useState(() => Date.now() + (offset ?? 0))
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => setNow(Date.now() + (offset ?? 0)), 200)
    return () => clearInterval(iv)
  }, [running, offset])
  return running ? now : Date.now() + (offset ?? 0)
}

function Quiz({ slide, results, quiz, t, mode }) {
  const phase = quiz?.phase ?? (mode === 'present' ? 'ready' : 'revealed')
  const now = useServerNow(phase === 'running' && mode !== 'thumb', quiz?.offset)
  const total = (slide.time ?? 20) * 1000
  const left = phase === 'running' ? Math.max(0, (quiz.endsAt ?? 0) - now) : phase === 'ready' ? total : 0
  const counts = results?.counts ?? slide.options.map(() => 0)
  const max = Math.max(1, ...counts)
  const revealed = phase === 'revealed'
  const answered = results?.total ?? 0
  const R = 42, C = 2 * Math.PI * R
  return (
    <div className={`sv-quiz phase-${phase}`}>
      <div className="sv-quiz-top">
        <h2 className="sv-q">{slide.question || <span className="sv-placeholder">{typeLabel('quiz', t.lang)}</span>}</h2>
        {mode !== 'thumb' && (
          <div className="sv-ring" aria-label={`${Math.ceil(left / 1000)} ${t('secondsLeft')}`}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} className="sv-ring-bg" />
              <circle cx="50" cy="50" r={R} className="sv-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} />
            </svg>
            <span>{revealed ? '✓' : Math.ceil(left / 1000)}</span>
          </div>
        )}
      </div>
      {phase === 'ready' && mode === 'present' && <div className="sv-quiz-ready">{t('getReady')}</div>}
      {revealed && mode !== 'thumb' && (
        <div className="sv-quiz-bars">
          {slide.options.map((o, i) => (
            <div key={i} className={`sv-quiz-bar ${i === slide.correct ? 'correct' : 'wrong'}`}>
              <span className="sv-quiz-bar-n">{counts[i]}</span>
              <div className="sv-quiz-bar-fill" style={{ height: `${(counts[i] / max) * 100}%`, background: QUIZ_COLORS[i % QUIZ_COLORS.length] }} />
            </div>
          ))}
        </div>
      )}
      <div className="sv-tiles" style={{ '--n': slide.options.length }}>
        {slide.options.map((o, i) => (
          <div key={i} className={`sv-tile ${revealed ? (i === slide.correct ? 'correct' : 'wrong') : ''}`} style={{ background: QUIZ_COLORS[i % QUIZ_COLORS.length], color: inkOn(QUIZ_COLORS[i % QUIZ_COLORS.length]) }}>
            <Shape i={i} />
            <span className="sv-tile-text">{o}</span>
            {revealed && i === slide.correct && <span className="sv-tile-check">✓</span>}
          </div>
        ))}
      </div>
      {mode !== 'thumb' && phase !== 'ready' && <div className="sv-foot"><span className="sv-count">{t('answers', { n: answered })}</span></div>}
    </div>
  )
}

// ───────────── leaderboard ─────────────
function Leaderboard({ leaderboard, players, t, mode, color }) {
  const top = leaderboard.slice(0, 10)
  if (!top.length || top.every(r => !r.score)) return <div className="sv-center sv-waiting">{t('noScores')}</div>
  const max = Math.max(1, ...top.map(r => r.score))
  const podium = mode !== 'thumb' && top.length >= 3
  return (
    <div className={`sv-lb ${podium ? 'with-podium' : ''}`}>
      {podium && (
        <div className="sv-podium">
          {[1, 0, 2].map(i => (
            <div key={i} className={`sv-pod sv-pod-${i + 1}`}>
              <div className="sv-pod-name">{top[i].name || '—'}</div>
              <div className="sv-pod-score">{top[i].score} {t('pts')}</div>
              <div className="sv-pod-block"><span>{i + 1}</span></div>
            </div>
          ))}
        </div>
      )}
      <ol className="sv-lb-list">
        {top.slice(podium ? 3 : 0).map((r, k) => {
          const pos = k + (podium ? 3 : 0)
          return (
            <li key={pos} className="sv-lb-row">
              <span className="sv-rank">{pos + 1}</span>
              <span className="sv-lb-name">{r.name || '—'}</span>
              <div className="sv-hbar-track"><div className="sv-hbar" style={{ width: `${(r.score / max) * 100}%`, background: color(pos) }} /></div>
              <b className="sv-lb-score">{r.score}</b>
              {r.last > 0 && mode !== 'thumb' && <small className="sv-lb-last">+{r.last}</small>}
            </li>
          )
        })}
      </ol>
      {players != null && mode !== 'thumb' && !podium && <div className="sv-foot"><span className="sv-count">{t('players', { n: players })}</span></div>}
    </div>
  )
}

// ───────────── content ─────────────
function Heading({ slide, t }) {
  return (
    <div className="sv-heading">
      <h1>{slide.question || <span className="sv-placeholder">{t('untitled')}</span>}</h1>
      {slide.subtitle && <p>{slide.subtitle}</p>}
    </div>
  )
}
function Bullets({ slide }) {
  const items = (slide.bullets ?? []).filter(b => b.trim())
  return <ul className="sv-bullets">{items.map((b, i) => <li key={i}>{b}</li>)}</ul>
}
function Quote({ slide, t }) {
  return (
    <figure className="sv-quote">
      <blockquote>{slide.question || <span className="sv-placeholder">{t('untitled')}</span>}</blockquote>
      {slide.author && <figcaption>— {slide.author}</figcaption>}
    </figure>
  )
}
function ImageSlide({ slide, t }) {
  return (
    <figure className="sv-image">
      {slide.image ? <img src={slide.image} alt={slide.question || ''} /> : <div className="sv-image-empty">{t('addImage')}</div>}
      {slide.question && <figcaption>{slide.question}</figcaption>}
    </figure>
  )
}

const BODY = {
  mc: Choice, wordcloud: Cloud, open: Open, scales: Scales, ranking: Ranking, points: Points,
  qa: QA, quiz: Quiz, leaderboard: Leaderboard, heading: Heading, bullets: Bullets, quote: Quote, image: ImageSlide,
}
