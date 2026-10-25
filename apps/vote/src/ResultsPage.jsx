import { useEffect, useMemo, useState } from 'react'
import { useApp, go } from './app-context.js'
import { cleanError } from './backend.js'
import { aggregate, describeValue, takesAnswers, typeLabel, TYPES } from './slides.js'
import { Icon } from './icons.jsx'
import { useT } from './i18n.js'
import SlideView from './SlideView.jsx'
import './results.css'

// After the session: every slide's results for one session (the current one by default),
// with CSV downloads for the whole presentation or a single slide.
const DICT = {
  en: {
    results: 'Results', session: 'Session', sessionN: 'Session {n}', current: '(current)', participants: 'Participants', responses: 'Responses',
    questions: 'Questions', downloadAll: 'Download CSV', downloadSlide: 'CSV', edit: 'Edit', present: 'Present', back: 'My presentations',
    noResponses: 'No responses in this session.', nResponses: '{n} responses', nQuestions: '{n} questions', slideN: 'Slide {n}', allAnswers: 'All answers ({n})', words: 'Words', count: 'Count',
    leaderboard: 'Quiz leaderboard', rank: '#', name: 'Name', score: 'Score', anonymous: 'Anonymous', upvotes: 'Upvotes', answered: 'Answered', hidden: 'Hidden',
    loading: 'Loading results…', failed: 'Could not load results: {e}', content: 'Content slide — no answers', noQuestions: 'No questions were asked.',
    csvSlide: 'Slide', csvType: 'Type', csvQuestion: 'Question', csvParticipant: 'Participant', csvAnswer: 'Answer', csvTime: 'Time', yes: 'yes',
  },
  zh: {
    results: '结果', session: '轮次', sessionN: '第 {n} 轮', current: '（当前）', participants: '参与人数', responses: '回答数',
    questions: '提问', downloadAll: '下载 CSV', downloadSlide: 'CSV', edit: '编辑', present: '演示', back: '我的演示',
    noResponses: '这一轮还没有回答。', nResponses: '{n} 份回答', nQuestions: '{n} 个提问', slideN: '第 {n} 页', allAnswers: '全部回答（{n}）', words: '词语', count: '次数',
    leaderboard: '抢答排行榜', rank: '名次', name: '名字', score: '得分', anonymous: '匿名', upvotes: '点赞', answered: '已回答', hidden: '已隐藏',
    loading: '正在加载结果…', failed: '无法加载结果：{e}', content: '内容页，无需作答', noQuestions: '没有人提问。',
    csvSlide: '页码', csvType: '类型', csvQuestion: '问题', csvParticipant: '参与者', csvAnswer: '回答', csvTime: '时间', yes: '是',
  },
}

export default function ResultsPage({ id }) {
  const { api } = useApp()
  const t = useT(DICT)
  const [deck, setDeck] = useState(null)
  const [sessionSel, setSessionSel] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(id).then(row => { setDeck(row); setSessionSel(row.session) }, e => setError(cleanError(e)))
  }, [api, id])
  useEffect(() => {
    if (sessionSel == null) return
    setData(null)
    api.exportData(id, sessionSel).then(setData, e => setError(cleanError(e)))
  }, [api, id, sessionSel])

  const names = useMemo(() => new Map((data?.participants ?? []).map(p => [p.voter, p.name])), [data])
  const bySlide = useMemo(() => {
    const m = new Map()
    for (const r of data?.responses ?? []) { if (!m.has(r.slide)) m.set(r.slide, []); m.get(r.slide).push(r) }
    return m
  }, [data])

  if (error) return <div className="page"><p className="auth-error">{t('failed', { e: error })}</p><a className="btn ghost" href="#/">{t('back')}</a></div>
  if (!deck) return <div className="spinner-page"><span className="spinner" /> {t('loading')}</div>

  const who = voter => names.get(voter) || `${t('anonymous')} ${String(voter).slice(0, 4)}`
  const rowsFor = (slide, n) => (bySlide.get(slide.id) ?? []).map(r => [n, typeLabel(slide.type, t.lang), slide.question ?? '', who(r.voter), describeValue(slide, r.value), new Date(r.at).toISOString()])
  const header = [t('csvSlide'), t('csvType'), t('csvQuestion'), t('csvParticipant'), t('csvAnswer'), t('csvTime')]
  const qaRows = (slide, n) => (data?.questions ?? []).filter(q => q.slide === slide.id)
    .map(q => [n, typeLabel('qa', t.lang), slide.question ?? '', '', `${q.text} (${t('upvotes')}: ${q.upvotes}${q.answered ? `, ${t('answered')}` : ''}${q.hidden ? `, ${t('hidden')}` : ''})`, ''])
  const fileBase = `${(deck.title || 'presentation').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}-${t('session')}${sessionSel}`
  const downloadAll = () => download(`${fileBase}.csv`, [header, ...deck.slides.flatMap((s, i) => (s.type === 'qa' ? qaRows(s, i + 1) : rowsFor(s, i + 1)))])
  const downloadSlide = (s, i) => download(`${fileBase}-${i + 1}.csv`, [header, ...(s.type === 'qa' ? qaRows(s, i + 1) : rowsFor(s, i + 1))])

  return (
    <div className="page rs-page">
      <div className="rs-head">
        <div className="rs-title">
          <a className="rs-crumb" href="#/"><Icon name="left" size={14} /> {t('back')}</a>
          <h1>{deck.title || '—'}</h1>
          <div className="rs-meta">
            <span className="pill gold"><Icon name="users" size={13} /> {t('participants')}: {data?.participants.length ?? '…'}</span>
            <span className="pill"><Icon name="chart" size={13} /> {t('responses')}: {data?.responses.length ?? '…'}</span>
            <label className="rs-session">
              <span>{t('session')}</span>
              <select value={sessionSel ?? ''} onChange={e => setSessionSel(Number(e.target.value))}>
                {Array.from({ length: deck.session }, (_, k) => deck.session - k).map(n => (
                  <option key={n} value={n}>{t('sessionN', { n })} {n === deck.session ? t('current') : ''}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="rs-actions">
          <button className="btn ghost" onClick={() => go(`/edit/${id}`)}><Icon name="edit" /> {t('edit')}</button>
          <button className="btn ghost" onClick={() => go(`/present/${id}`)}><Icon name="present" /> {t('present')}</button>
          <button className="btn primary" onClick={downloadAll} disabled={!data}><Icon name="download" /> {t('downloadAll')}</button>
        </div>
      </div>

      {!data ? <div className="spinner-page"><span className="spinner" /> {t('loading')}</div> : (
        <div className="rs-list">
          {data.leaderboard?.length > 0 && deck.slides.some(s => s.type === 'quiz') && (
            <section className="rs-card">
              <div className="rs-card-head"><span className="rs-n"><Icon name="trophy" size={16} /></span><h2>{t('leaderboard')}</h2></div>
              <table className="rs-table">
                <thead><tr><th>{t('rank')}</th><th>{t('name')}</th><th className="num">{t('score')}</th></tr></thead>
                <tbody>{data.leaderboard.slice(0, 20).map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name || t('anonymous')}</td><td className="num">{r.score}</td></tr>)}</tbody>
              </table>
            </section>
          )}
          {deck.slides.map((s, i) => {
            const rows = bySlide.get(s.id) ?? []
            const results = aggregate(s, rows)
            const qs = (data.questions ?? []).filter(q => q.slide === s.id)
            const answers = takesAnswers(s)
            const n = s.type === 'qa' ? qs.length : results.voters
            return (
              <section className="rs-card" key={s.id}>
                <div className="rs-card-head">
                  <span className="rs-n">{i + 1}</span>
                  <div className="grow">
                    <div className="rs-type"><Icon name={TYPES[s.type]?.icon ?? 'grid'} size={13} /> {typeLabel(s.type, t.lang)}</div>
                    <h2>{s.question || '—'}</h2>
                  </div>
                  {(answers || s.type === 'qa') && <span className="pill">{t(s.type === 'qa' ? 'nQuestions' : 'nResponses', { n })}</span>}
                  {(answers || s.type === 'qa') && <button className="btn ghost sm" onClick={() => downloadSlide(s, i)} disabled={!n}><Icon name="download" /> {t('downloadSlide')}</button>}
                </div>
                <div className="rs-body">
                  <div className="rs-chart">
                    <SlideView slide={s} mode="preview" results={results} questions={qs} leaderboard={data.leaderboard ?? []}
                      quiz={s.type === 'quiz' ? { phase: 'revealed' } : undefined} />
                  </div>
                  <Details slide={s} results={results} questions={qs} t={t} answers={answers} />
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Details({ slide, results, questions, t, answers }) {
  if (slide.type === 'qa') return (
    <div className="rs-details">
      {!questions.length ? <p className="muted">{t('noQuestions')}</p> : (
        <table className="rs-table">
          <thead><tr><th>{t('questions')}</th><th className="num">{t('upvotes')}</th></tr></thead>
          <tbody>{[...questions].sort((a, b) => b.upvotes - a.upvotes).map(q => (
            <tr key={q.id} className={q.hidden ? 'dim' : ''}><td>{q.text}{q.answered && <span className="pill rs-tag">{t('answered')}</span>}{q.hidden && <span className="pill rs-tag">{t('hidden')}</span>}</td><td className="num">{q.upvotes}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
  if (!answers) return <div className="rs-details"><p className="muted">{t('content')}</p></div>
  if (!results.total) return <div className="rs-details"><p className="muted">{t('noResponses')}</p></div>
  if (slide.type === 'open') return (
    <div className="rs-details">
      <h3>{t('allAnswers', { n: results.items.length })}</h3>
      <ul className="rs-answers">{results.items.map(it => <li key={it.id}>{it.text}</li>)}</ul>
    </div>
  )
  if (slide.type === 'wordcloud') return (
    <div className="rs-details">
      <table className="rs-table">
        <thead><tr><th>{t('words')}</th><th className="num">{t('count')}</th></tr></thead>
        <tbody>{results.words.map(w => <tr key={w.text}><td>{w.text}</td><td className="num">{w.count}</td></tr>)}</tbody>
      </table>
    </div>
  )
  if (slide.type === 'mc' || slide.type === 'quiz') return (
    <div className="rs-details">
      <table className="rs-table">
        <tbody>{slide.options.map((o, i) => (
          <tr key={i}><td>{o}{slide.type === 'quiz' && i === slide.correct && ' ✓'}</td><td className="num">{results.counts[i]}</td><td className="num muted">{results.total ? Math.round((results.counts[i] / results.total) * 100) : 0}%</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
  if (slide.type === 'scales') return (
    <div className="rs-details">
      <table className="rs-table">
        <tbody>{slide.statements.map((s, i) => <tr key={i}><td>{s}</td><td className="num">{results.stats[i].avg?.toFixed(2) ?? '–'}</td><td className="num muted">n={results.stats[i].count}</td></tr>)}</tbody>
      </table>
    </div>
  )
  if (slide.type === 'ranking') return (
    <div className="rs-details">
      <table className="rs-table">
        <tbody>{results.ranked.map((r, k) => <tr key={r.index}><td>{k + 1}. {slide.items[r.index]}</td><td className="num">{r.score}</td><td className="num muted">{r.avgRank?.toFixed(2)}</td></tr>)}</tbody>
      </table>
    </div>
  )
  if (slide.type === 'points') return (
    <div className="rs-details">
      <table className="rs-table">
        <tbody>{slide.items.map((s, i) => <tr key={i}><td>{s}</td><td className="num">{results.totals[i]}</td><td className="num muted">{results.sum ? Math.round((results.totals[i] / results.sum) * 100) : 0}%</td></tr>)}</tbody>
      </table>
    </div>
  )
  return null
}

// CSV with a BOM so Excel opens Chinese text correctly.
function download(name, rows) {
  const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
