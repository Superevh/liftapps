import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp, go, joinUrl } from './app-context.js'
import { Spinner } from './App.jsx'
import { Icon } from './icons.jsx'
import { QR } from './qr.jsx'
import { useT } from './i18n.js'
import { cleanError } from './backend.js'
import { TYPES, GROUPS, typeLabel, newSlide, changeType, aggregate, sampleResponses, takesAnswers, uid } from './slides.js'
import SlideView from './SlideView.jsx'
import { fmtCode } from './Dashboard.jsx'
import './editor.css'

const DICT = {
  en: {
    back: 'My presentations', untitled: 'Untitled presentation', saving: 'Saving…', saved: 'All changes saved', unsaved: 'Unsaved changes', saveFailed: 'Couldn’t save — retrying',
    share: 'Share', present: 'Present', results: 'Results', newSlide: 'New slide', duplicate: 'Duplicate', del: 'Delete slide', moveUp: 'Move up', moveDown: 'Move down',
    sample: 'Sample results', empty: 'Empty', previewHint: 'Preview — this is how the slide looks on the big screen.',
    slideType: 'Slide type', content: 'Content', question: 'Question', heading: 'Heading', caption: 'Caption', quoteText: 'Quote', subtitle: 'Subtitle', author: 'Who said it',
    options: 'Options', items: 'Items', statements: 'Statements', bullets: 'Bullet points', addOption: 'Add option', addItem: 'Add item', addStatement: 'Add statement', addBullet: 'Add point',
    remove: 'Remove', multiple: 'Let people pick more than one', chart: 'Result layout', bars: 'Bars', donut: 'Donut', pie: 'Pie', dots: 'Dots',
    maxEntries: 'Answers per person', layout: 'Layout', cards: 'Cards', list: 'List', range: 'Scale range', from: 'From', to: 'To', lowLabel: 'Lowest label', highLabel: 'Highest label',
    total: 'Points to distribute', correct: 'Correct answer', markCorrect: 'Mark as correct', time: 'Time to answer', seconds: '{n}s', imageUrl: 'Image URL', imageHint: 'Paste a link to a .jpg, .png or .gif image.',
    notes: 'Speaker notes', notesHint: 'Only you see these — never shown to the audience.', presentation: 'Presentation', presTitle: 'Title',
    phoneResults: 'Show results on phones after voting', phoneResultsHint: 'Multiple choice results appear on people’s phones once they vote.',
    qaHint: 'People ask questions from their phones and upvote each other’s. You can hide or mark questions answered while presenting.',
    leaderboardHint: 'Shows the top quiz scores so far. Put it after one or more quiz questions.',
    joinAt: 'Join at', copyLink: 'Copy link', copied: 'Link copied', code: 'Code', shareHint: 'People join on their phones — no app or account needed.',
    warnOptions: 'Add at least two options.', warnEmptyOption: 'Some options are empty.', warnQuestion: 'Write a question.', warnCorrect: 'Pick the correct answer.',
    warnImage: 'Add an image link.', warnStatements: 'Add at least one statement.', warnRange: '“From” must be lower than “to”.', warnQuizBefore: 'Add a quiz question before the leaderboard.',
    notFound: 'This presentation doesn’t exist or isn’t yours.', slideN: 'Slide {n}', settings: 'Settings',
  },
  zh: {
    back: '我的演示', untitled: '未命名演示', saving: '保存中…', saved: '所有更改已保存', unsaved: '有未保存的更改', saveFailed: '保存失败，正在重试',
    share: '分享', present: '演示', results: '结果', newSlide: '新建页面', duplicate: '复制', del: '删除页面', moveUp: '上移', moveDown: '下移',
    sample: '示例结果', empty: '空白', previewHint: '预览：这就是该页在大屏幕上的样子。',
    slideType: '页面类型', content: '内容', question: '问题', heading: '标题', caption: '说明文字', quoteText: '引言', subtitle: '副标题', author: '出处',
    options: '选项', items: '选项', statements: '陈述', bullets: '要点', addOption: '添加选项', addItem: '添加选项', addStatement: '添加陈述', addBullet: '添加要点',
    remove: '移除', multiple: '允许多选', chart: '结果样式', bars: '柱状', donut: '环形', pie: '饼图', dots: '圆点',
    maxEntries: '每人可回答次数', layout: '布局', cards: '卡片', list: '列表', range: '量表范围', from: '从', to: '到', lowLabel: '最低分标签', highLabel: '最高分标签',
    total: '可分配分数', correct: '正确答案', markCorrect: '设为正确答案', time: '答题时间', seconds: '{n} 秒', imageUrl: '图片链接', imageHint: '粘贴 .jpg、.png 或 .gif 图片链接。',
    notes: '演讲备注', notesHint: '只有你能看到，不会展示给观众。', presentation: '演示设置', presTitle: '标题',
    phoneResults: '投票后在手机上显示结果', phoneResultsHint: '观众投票后，单选/多选题的结果会显示在他们的手机上。',
    qaHint: '观众在手机上提问并为彼此的问题点赞。演示时你可以隐藏问题或标记为已回答。',
    leaderboardHint: '显示目前的抢答得分排名，放在一道或多道抢答题之后。',
    joinAt: '加入网址', copyLink: '复制链接', copied: '链接已复制', code: '代码', shareHint: '观众用手机加入，无需安装应用或注册账号。',
    warnOptions: '至少添加两个选项。', warnEmptyOption: '有选项是空的。', warnQuestion: '请填写问题。', warnCorrect: '请选择正确答案。',
    warnImage: '请添加图片链接。', warnStatements: '至少添加一条陈述。', warnRange: '“从”必须小于“到”。', warnQuizBefore: '请在排行榜之前添加抢答题。',
    notFound: '该演示不存在，或不属于你。', slideN: '第 {n} 页', settings: '设置',
  },
}

const MAX_ITEMS = 10
const TIMES = [5, 10, 20, 30, 60, 90, 120]

// Problems that would make a slide confusing or unanswerable when presented.
function validate(slide, index, slides) {
  const w = []
  const needsQuestion = !['leaderboard', 'image', 'quote'].includes(slide.type)
  if (needsQuestion && !slide.question?.trim()) w.push('warnQuestion')
  const list = slide.options ?? slide.items
  if (list) {
    if (list.length < 2) w.push('warnOptions')
    else if (list.some(o => !String(o).trim())) w.push('warnEmptyOption')
  }
  if (slide.type === 'quiz' && !(slide.correct >= 0 && slide.correct < (slide.options?.length ?? 0))) w.push('warnCorrect')
  if (slide.type === 'scales') {
    if (!slide.statements?.length) w.push('warnStatements')
    if ((slide.min ?? 1) >= (slide.max ?? 5)) w.push('warnRange')
  }
  if (slide.type === 'image' && !slide.image?.trim()) w.push('warnImage')
  if (slide.type === 'leaderboard' && !slides.slice(0, index).some(s => s.type === 'quiz')) w.push('warnQuizBefore')
  return w
}

export default function Editor({ id }) {
  const { api } = useApp()
  const t = useT(DICT)
  const [pres, setPres] = useState(null)
  const [error, setError] = useState(null)
  const [doc, setDoc] = useState(null) // { title, slides, settings } — what the person edits
  const [sel, setSel] = useState(0)
  const [status, setStatus] = useState('saved') // saved | dirty | saving | error
  const [sample, setSample] = useState(true)
  const latest = useRef(null)
  const savedJson = useRef('')
  const timer = useRef(null)
  const saving = useRef(null)

  useEffect(() => {
    let live = true
    api.get(id).then(p => {
      if (!live) return
      const d = { title: p.title, slides: p.slides?.length ? p.slides : [newSlide('mc', t.lang)], settings: p.settings ?? {} }
      setPres(p)
      setDoc(d)
      latest.current = d
      savedJson.current = JSON.stringify(d)
    }, e => live && setError(cleanError(e)))
    return () => { live = false }
  }, [api, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const chRef = useRef(null)
  useEffect(() => () => { chRef.current?.close(); chRef.current = null }, [])

  // Save whatever is newest; if more edits arrive while a save is in flight, save again afterwards.
  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (saving.current) { await saving.current; }
    const d = latest.current
    if (!d) return
    const json = JSON.stringify(d)
    if (json === savedJson.current) { setStatus('saved'); return }
    setStatus('saving')
    saving.current = api.save(id, d).then(() => {
      savedJson.current = json
      // Open phones and the presenter screen reload the slides (one small broadcast per save).
      ;(chRef.current ??= api.channel(id)).send('slides', { at: Date.now() })
      setStatus(JSON.stringify(latest.current) === json ? 'saved' : 'dirty')
    }, () => {
      setStatus('error')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => flush(), 3000)
    }).finally(() => { saving.current = null })
    await saving.current
    if (JSON.stringify(latest.current) !== savedJson.current) return flush()
  }, [api, id])

  const update = useCallback(fn => {
    setDoc(prev => {
      const next = fn(prev)
      latest.current = next
      return next
    })
    setStatus('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(), 700)
  }, [flush])

  // Never lose edits: save on leaving the page, switching routes or hiding the tab.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    const onUnload = e => {
      if (latest.current && JSON.stringify(latest.current) !== savedJson.current) { flush(); e.preventDefault(); e.returnValue = '' }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      flush()
    }
  }, [flush])

  const slides = doc?.slides ?? []
  const cur = Math.min(sel, Math.max(slides.length - 1, 0))
  const slide = slides[cur]

  const setSlides = (fn, nextSel) => { update(d => ({ ...d, slides: fn(d.slides) })); if (nextSel !== undefined) setSel(nextSel) }
  const patchSlide = patch => setSlides(list => list.map((s, i) => (i === cur ? { ...s, ...patch } : s)))
  const addSlide = type => setSlides(list => [...list.slice(0, cur + 1), newSlide(type, t.lang), ...list.slice(cur + 1)], cur + 1)
  const dupSlide = i => setSlides(list => [...list.slice(0, i + 1), { ...structuredClone(list[i]), id: uid() }, ...list.slice(i + 1)], i + 1)
  const delSlide = i => setSlides(list => (list.length > 1 ? list.filter((_, k) => k !== i) : list), Math.max(0, i < cur ? cur - 1 : Math.min(cur, slides.length - 2)))
  const moveSlide = (from, to) => {
    if (to < 0 || to >= slides.length || from === to) return
    setSlides(list => { const next = [...list]; const [s] = next.splice(from, 1); next.splice(to, 0, s); return next }, to)
  }

  // ↑/↓ moves between slides when the person is not typing.
  useEffect(() => {
    const on = e => {
      const el = document.activeElement
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, slides.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [slides.length])

  const preview = useMemo(() => {
    if (!slide) return null
    return takesAnswers(slide) && sample ? aggregate(slide, sampleResponses(slide)) : aggregate(slide, [])
  }, [slide, sample])

  if (error) return <div className="page narrow center-page"><Icon name="info" size={32} /><h2>{t('notFound')}</h2><p className="muted">{error}</p><a className="btn primary" href="#/">{t('back')}</a></div>
  if (!doc) return <Spinner />

  const present = async () => { await flush(); go(`/present/${id}`) }
  const warnings = slide ? validate(slide, cur, slides) : []

  return (
    <div className="editor">
      <div className="ed-toolbar">
        <a className="icon-btn" href="#/" title={t('back')} aria-label={t('back')}><Icon name="left" /></a>
        <input className="ed-title" value={doc.title} placeholder={t('untitled')} aria-label={t('presTitle')}
          onChange={e => update(d => ({ ...d, title: e.target.value }))} onBlur={flush} />
        <SaveState status={status} t={t} />
        <span className="spacer" />
        <SharePopover code={pres.code} t={t} />
        <a className="btn ghost" href={`#/results/${id}`} onClick={() => flush()}><Icon name="chart" /> <span className="lbl">{t('results')}</span></a>
        <button className="btn primary" onClick={present}><Icon name="play" /> {t('present')}</button>
      </div>

      <div className="ed-body">
        <SlideRail slides={slides} cur={cur} t={t} onSelect={setSel} onMove={moveSlide} onDup={dupSlide} onDel={delSlide} onAdd={addSlide} />

        <section className="ed-canvas" aria-label={t('slideN', { n: cur + 1 })}>
          <div className="canvas-head">
            <span className="pill"><Icon name={TYPES[slide.type]?.icon} size={13} /> {typeLabel(slide.type, t.lang)}</span>
            <span className="muted small canvas-hint">{t('previewHint')}</span>
            <span className="spacer" />
            {takesAnswers(slide) && (
              <div className="seg sm" role="group">
                <button className={sample ? 'on' : ''} onClick={() => setSample(true)}>{t('sample')}</button>
                <button className={!sample ? 'on' : ''} onClick={() => setSample(false)}>{t('empty')}</button>
              </div>
            )}
          </div>
          <div className="canvas-frame">
            <div className="stage-box">
              <SlideView slide={slide} mode="preview" results={preview} showResults questions={[]} leaderboard={[]} participants={sample ? 24 : 0} />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="ed-warnings" role="status">
              {warnings.map(w => <li key={w}><Icon name="info" size={14} /> {t(w)}</li>)}
            </ul>
          )}
        </section>

        <aside className="ed-panel">
          <SlidePanel key={slide.id} slide={slide} t={t} onPatch={patchSlide} onType={type => setSlides(list => list.map((s, i) => (i === cur ? changeType(s, type, t.lang) : s)))} />
          <section className="panel-sec">
            <h3>{t('presentation')}</h3>
            <label className="field"><span>{t('presTitle')}</span>
              <input value={doc.title} onChange={e => update(d => ({ ...d, title: e.target.value }))} placeholder={t('untitled')} />
            </label>
            <Toggle checked={doc.settings.phoneResults !== false} label={t('phoneResults')} hint={t('phoneResultsHint')}
              onChange={v => update(d => ({ ...d, settings: { ...d.settings, phoneResults: v } }))} />
          </section>
        </aside>
      </div>
    </div>
  )
}

function SaveState({ status, t }) {
  const map = { saved: ['check', 'saved'], dirty: ['edit', 'unsaved'], saving: ['cloud', 'saving'], error: ['info', 'saveFailed'] }
  const [icon, key] = map[status]
  return <span className={`save-state ${status}`} role="status"><Icon name={icon} size={14} /> <span className="lbl">{t(key)}</span></span>
}

function SharePopover({ code, t }) {
  const { toast } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const link = joinUrl(code)
  useEffect(() => {
    if (!open) return
    const on = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const key = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', on)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', on); window.removeEventListener('keydown', key) }
  }, [open])
  const copy = () => navigator.clipboard?.writeText(link).then(() => toast(t('copied')), () => {})
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ghost ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="qr" /> <span className="lbl">{t('share')}</span></button>
      {open && (
        <div className="menu right share-pop" role="dialog" aria-label={t('share')}>
          <div className="share-code"><span>{t('code')}</span><b>{fmtCode(code)}</b></div>
          <div className="share-qr"><QR text={link} size={168} /></div>
          <label className="field"><span>{t('joinAt')}</span>
            <div className="share-link"><input readOnly value={link} onFocus={e => e.target.select()} /><button className="btn primary sm" onClick={copy}><Icon name="copy" size={14} /> {t('copyLink')}</button></div>
          </label>
          <p className="muted small">{t('shareHint')}</p>
        </div>
      )}
    </div>
  )
}

function AddSlideMenu({ onAdd, t, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const on = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])
  return (
    <div className={`dropdown add-slide ${className}`} ref={ref}>
      <button className="btn primary add-slide-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="plus" /> {t('newSlide')}</button>
      {open && <TypeMenu t={t} onPick={type => { setOpen(false); onAdd(type) }} />}
    </div>
  )
}

function TypeMenu({ t, onPick, current }) {
  return (
    <div className="menu type-menu" role="menu">
      {GROUPS.map(g => (
        <div key={g.id}>
          <div className="menu-group">{g.label[t.lang] ?? g.label.en}</div>
          {Object.entries(TYPES).filter(([, d]) => d.group === g.id).map(([type, d]) => (
            <button key={type} role="menuitem" className={`menu-item type-item ${current === type ? 'sel' : ''}`} onClick={() => onPick(type)}>
              <span className={`type-ico g-${d.group}`}><Icon name={d.icon} size={16} /></span>
              <span className="type-txt"><b>{typeLabel(type, t.lang)}</b><span>{d.hint[t.lang] ?? d.hint.en}</span></span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function SlideRail({ slides, cur, t, onSelect, onMove, onDup, onDel, onAdd }) {
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const selRef = useRef(null)
  useEffect(() => { selRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [cur])
  return (
    <nav className="ed-rail" aria-label="Slides">
      <AddSlideMenu onAdd={onAdd} t={t} />
      <ol className="rail-list">
        {slides.map((s, i) => (
          <li key={s.id} ref={i === cur ? selRef : null}
            className={`rail-item ${i === cur ? 'sel' : ''} ${drag === i ? 'dragging' : ''} ${over === i && drag !== null && drag !== i ? (drag < i ? 'drop-after' : 'drop-before') : ''}`}
            draggable onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { e.preventDefault(); setOver(i) }} onDragLeave={() => setOver(o => (o === i ? null : o))}
            onDrop={e => { e.preventDefault(); if (drag !== null) onMove(drag, i); setDrag(null); setOver(null) }}
            onDragEnd={() => { setDrag(null); setOver(null) }}>
            <span className="rail-num">{i + 1}</span>
            <button className="rail-thumb" onClick={() => onSelect(i)} aria-current={i === cur} aria-label={`${t('slideN', { n: i + 1 })}: ${typeLabel(s.type, t.lang)}`}>
              <span className="thumb-box"><SlideView slide={s} mode="thumb" /></span>
              <span className="rail-type"><Icon name={TYPES[s.type]?.icon} size={12} /></span>
            </button>
            <span className="rail-actions">
              <button className="icon-btn sm" title={t('moveUp')} aria-label={t('moveUp')} disabled={i === 0} onClick={() => onMove(i, i - 1)}><Icon name="up" size={14} /></button>
              <button className="icon-btn sm" title={t('moveDown')} aria-label={t('moveDown')} disabled={i === slides.length - 1} onClick={() => onMove(i, i + 1)}><Icon name="down" size={14} /></button>
              <button className="icon-btn sm" title={t('duplicate')} aria-label={t('duplicate')} onClick={() => onDup(i)}><Icon name="dup" size={14} /></button>
              <button className="icon-btn sm" title={t('del')} aria-label={t('del')} disabled={slides.length < 2} onClick={() => onDel(i)}><Icon name="trash" size={14} /></button>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function SlidePanel({ slide, t, onPatch, onType }) {
  const [typeOpen, setTypeOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!typeOpen) return
    const on = e => { if (!ref.current?.contains(e.target)) setTypeOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [typeOpen])
  const def = TYPES[slide.type]
  const qLabel = { heading: 'heading', bullets: 'heading', quote: 'quoteText', image: 'caption' }[slide.type] ?? 'question'
  const s = slide
  return <>
    <section className="panel-sec">
      <h3>{t('slideType')}</h3>
      <div className="dropdown type-switch" ref={ref}>
        <button className="type-current" onClick={() => setTypeOpen(o => !o)} aria-expanded={typeOpen}>
          <span className={`type-ico g-${def.group}`}><Icon name={def.icon} size={16} /></span>
          <b>{typeLabel(slide.type, t.lang)}</b>
          <Icon name="down" size={14} />
        </button>
        {typeOpen && <TypeMenu t={t} current={slide.type} onPick={type => { setTypeOpen(false); if (type !== slide.type) onType(type) }} />}
      </div>
    </section>

    <section className="panel-sec">
      <h3>{t('content')}</h3>
      {s.type !== 'leaderboard' && (
        <label className="field"><span>{t(qLabel)}</span>
          <textarea rows={s.type === 'quote' ? 3 : 2} value={s.question ?? ''} maxLength={250} onChange={e => onPatch({ question: e.target.value })} />
        </label>
      )}
      {s.type === 'leaderboard' && <p className="muted small">{t('leaderboardHint')}</p>}
      {s.type === 'qa' && <p className="muted small">{t('qaHint')}</p>}

      {s.type === 'mc' && <>
        <ListEditor label={t('options')} addLabel={t('addOption')} items={s.options} onChange={options => onPatch({ options })} t={t} min={2} />
        <Toggle checked={!!s.multiple} label={t('multiple')} onChange={multiple => onPatch({ multiple })} />
        <div className="field"><span>{t('chart')}</span>
          <Seg value={s.chart ?? 'bars'} options={['bars', 'donut', 'pie', 'dots'].map(v => [v, t(v)])} onChange={chart => onPatch({ chart })} />
        </div>
      </>}

      {s.type === 'quiz' && <>
        <ListEditor label={t('options')} addLabel={t('addOption')} items={s.options} t={t} min={2} max={6}
          onChange={(options, change) => {
            let correct = s.correct
            if (change?.removed !== undefined) correct = change.removed === correct ? 0 : change.removed < correct ? correct - 1 : correct
            if (change?.moved) { const [a, b] = change.moved; correct = correct === a ? b : correct === b ? a : correct }
            onPatch({ options, correct })
          }}
          lead={i => (
            <button className={`correct-mark ${s.correct === i ? 'on' : ''}`} onClick={() => onPatch({ correct: i })} title={t('markCorrect')} aria-label={t('markCorrect')} aria-pressed={s.correct === i}>
              <Icon name="check" size={16} />
            </button>
          )} />
        <div className="field"><span>{t('time')}</span>
          <Seg value={s.time ?? 20} options={TIMES.map(n => [n, t('seconds', { n })])} onChange={time => onPatch({ time })} />
        </div>
      </>}

      {(s.type === 'wordcloud' || s.type === 'open') && <>
        <div className="field"><span>{t('maxEntries')}</span>
          <Seg value={s.maxEntries ?? (s.type === 'wordcloud' ? 3 : 1)} options={[1, 2, 3, 5, 10].map(n => [n, String(n)])} onChange={maxEntries => onPatch({ maxEntries })} />
        </div>
        {s.type === 'open' && <div className="field"><span>{t('layout')}</span>
          <Seg value={s.layout ?? 'cards'} options={[['cards', t('cards')], ['list', t('list')]]} onChange={layout => onPatch({ layout })} />
        </div>}
      </>}

      {s.type === 'scales' && <>
        <ListEditor label={t('statements')} addLabel={t('addStatement')} items={s.statements} onChange={statements => onPatch({ statements })} t={t} min={1} />
        <div className="field"><span>{t('range')}</span>
          <div className="range-row">
            <label>{t('from')} <select value={s.min ?? 1} onChange={e => onPatch({ min: Number(e.target.value) })}>{[0, 1].map(n => <option key={n}>{n}</option>)}</select></label>
            <label>{t('to')} <select value={s.max ?? 5} onChange={e => onPatch({ max: Number(e.target.value) })}>{[3, 4, 5, 6, 7, 10].map(n => <option key={n}>{n}</option>)}</select></label>
          </div>
        </div>
        <label className="field"><span>{t('lowLabel')}</span><input value={s.lowLabel ?? ''} maxLength={40} onChange={e => onPatch({ lowLabel: e.target.value })} /></label>
        <label className="field"><span>{t('highLabel')}</span><input value={s.highLabel ?? ''} maxLength={40} onChange={e => onPatch({ highLabel: e.target.value })} /></label>
      </>}

      {s.type === 'ranking' && <ListEditor label={t('items')} addLabel={t('addItem')} items={s.items} onChange={items => onPatch({ items })} t={t} min={2} />}

      {s.type === 'points' && <>
        <ListEditor label={t('items')} addLabel={t('addItem')} items={s.items} onChange={items => onPatch({ items })} t={t} min={2} />
        <div className="field"><span>{t('total')}</span>
          <Seg value={s.total ?? 100} options={[10, 50, 100, 1000].map(n => [n, String(n)])} onChange={total => onPatch({ total })} />
        </div>
      </>}

      {s.type === 'heading' && <label className="field"><span>{t('subtitle')}</span><textarea rows={2} value={s.subtitle ?? ''} maxLength={200} onChange={e => onPatch({ subtitle: e.target.value })} /></label>}
      {s.type === 'bullets' && <ListEditor label={t('bullets')} addLabel={t('addBullet')} items={s.bullets} onChange={bullets => onPatch({ bullets })} t={t} min={1} />}
      {s.type === 'quote' && <label className="field"><span>{t('author')}</span><input value={s.author ?? ''} maxLength={80} onChange={e => onPatch({ author: e.target.value })} /></label>}
      {s.type === 'image' && <label className="field"><span>{t('imageUrl')}</span>
        <input type="url" value={s.image ?? ''} placeholder="https://…" onChange={e => onPatch({ image: e.target.value })} />
        <small className="muted">{t('imageHint')}</small>
      </label>}
    </section>

    <section className="panel-sec">
      <label className="field"><span>{t('notes')}</span>
        <textarea rows={3} value={s.notes ?? ''} maxLength={2000} onChange={e => onPatch({ notes: e.target.value })} />
        <small className="muted">{t('notesHint')}</small>
      </label>
    </section>
  </>
}

// Edits a list of short strings: rename, reorder, add (up to `max`), remove (down to `min`).
// onChange(next, change) reports { removed: index } or { moved: [a, b] } so callers can keep indexes in step.
function ListEditor({ label, addLabel, items = [], onChange, t, min = 1, max = MAX_ITEMS, lead }) {
  const refs = useRef([])
  const [focus, setFocus] = useState(null)
  useEffect(() => { if (focus !== null) { refs.current[focus]?.focus(); setFocus(null) } }, [focus])
  const set = (i, v) => onChange(items.map((x, k) => (k === i ? v : x)))
  const add = (at = items.length) => { if (items.length < max) { onChange([...items.slice(0, at), '', ...items.slice(at)]); setFocus(at) } }
  const remove = i => onChange(items.filter((_, k) => k !== i), { removed: i })
  const move = (i, j) => { if (j < 0 || j >= items.length) return; const next = [...items];[next[i], next[j]] = [next[j], next[i]]; onChange(next, { moved: [i, j] }) }
  return (
    <div className="field list-ed">
      <span>{label}</span>
      {items.map((v, i) => (
        <div key={i} className="list-row">
          {lead ? lead(i) : <span className="list-num">{i + 1}</span>}
          <input ref={el => { refs.current[i] = el }} value={v} maxLength={120} onChange={e => set(i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(i + 1) } if (e.key === 'Backspace' && !v && items.length > min) { e.preventDefault(); remove(i); setFocus(Math.max(0, i - 1)) } }} />
          <span className="list-btns">
            <button className="icon-btn sm" title={t('moveUp')} aria-label={t('moveUp')} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="up" size={13} /></button>
            <button className="icon-btn sm" title={t('moveDown')} aria-label={t('moveDown')} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><Icon name="down" size={13} /></button>
            <button className="icon-btn sm" title={t('remove')} aria-label={t('remove')} disabled={items.length <= min} onClick={() => remove(i)}><Icon name="x" size={13} /></button>
          </span>
        </div>
      ))}
      {items.length < max && <button className="link-btn list-add" onClick={() => add()}><Icon name="plus" size={14} /> {addLabel}</button>}
    </div>
  )
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg wrap" role="group">
      {options.map(([v, label]) => <button key={v} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  )
}

function Toggle({ checked, label, hint, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
      <span className="toggle-txt"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </label>
  )
}
