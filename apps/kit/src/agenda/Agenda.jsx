import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, uid } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, useClickOutside } from '../core/ui.jsx'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, HowTo, fill, ago } from '../core/tools-ui.jsx'
import { STARTERS, starterBlocks, newAgenda, reduce, totalMinutes, remainingMs, fmtClock, fmtDuration, clockAt, agendaMarkdown, MAX_BLOCKS } from './model.js'
import './agenda.css'

const T = {
  en: {
    eyebrow: 'Workshop agenda', title: 'Plan the time, then keep to it', lead: 'Build your agenda as time-boxed blocks, share a view link with the room, then run it full screen with a countdown, the next block in sight and a gentle chime when time is up.',
    create: 'New agenda', name: 'Agenda name', namePh: 'e.g. Q3 planning workshop', starter: 'Start from', start: 'Create agenda', yours: 'Your agendas', none: 'Agendas you create or open show up here.', remove: 'Remove', created: 'Created {d}',
    back: 'All agendas', total: 'Total', blocks: '{n} blocks', block1: '1 block', startAt: 'Starts at', startAtHint: 'Optional: shows clock times', run: 'Run', runFull: 'Run full screen', resume: 'Back to run view',
    addBlock: 'Add block', blockTitle: 'Block title', blockTitlePh: 'e.g. Brainstorm in pairs', minutes: 'min', notes: 'Goal / notes', notesPh: 'What should this block achieve? Instructions, materials…',
    up: 'Move up', down: 'Move down', del: 'Remove block', empty: 'No blocks yet. Add the first one below, or start from a template.', limit: 'This agenda has the maximum number of blocks.',
    now: 'Now', next: 'Next', upNext: 'Up next', last: 'Last block', pause: 'Pause', play: 'Resume', skip: 'Skip', prev: 'Previous', plus1: '+1 min', exit: 'Exit', stop: 'Stop the run', timeUp: 'Time is up', over: 'over time',
    paused: 'Paused', done: 'All blocks done', doneHint: 'Nice work. You finished {n} blocks.', restart: 'Run again', viewing: 'Live view: the facilitator controls the timer.', chimeOn: 'Sound on', chimeOff: 'Sound off',
    of: 'Block {i} of {n}', ends: 'Planned end {t}', copyMd: 'Copy as text', copied: 'Copied!', deleteAgenda: 'Delete agenda', confirm: 'Click again to confirm', more: 'More', fullscreen: 'Full screen',
    localOnly: 'Saved in this browser only (live sharing is not configured).', notFound: 'Not found', keys: 'Space: pause · →: next · ←: previous · +: one more minute · Esc: exit',
    steps: [
      ['Create an agenda', 'Name it and pick a starter, or begin with a blank list.'],
      ['Shape the blocks', 'Give each block a title, minutes and a goal. Reorder with the arrows; the total updates as you go.'],
      ['Share the view link', 'Invite the room with the link or QR code. They see the agenda and the live countdown.'],
      ['Run it', 'Start full screen. Pause, skip or add a minute; a soft chime marks the end of each block.'],
    ],
    tips: ['Leave a few minutes of slack: workshops almost always run long.', 'Put a short break in anything over an hour.', 'Set a start time to see the clock time of every block.'],
  },
  zh: {
    eyebrow: '工作坊议程', title: '先规划时间，再守住时间', lead: '把议程拆成限时的议程块，和现场分享查看链接，然后全屏运行：大号倒计时、提示下一项，时间到时有温和的提示音。',
    create: '新建议程', name: '议程名称', namePh: '例如：第三季度规划工作坊', starter: '从模板开始', start: '创建议程', yours: '我的议程', none: '你创建或打开的议程会显示在这里。', remove: '移除', created: '创建于 {d}',
    back: '所有议程', total: '总时长', blocks: '{n} 个议程块', block1: '1 个议程块', startAt: '开始时间', startAtHint: '可选：显示每块的钟点', run: '运行', runFull: '全屏运行', resume: '回到运行视图',
    addBlock: '添加议程块', blockTitle: '议程块标题', blockTitlePh: '例如：两两头脑风暴', minutes: '分钟', notes: '目标 / 备注', notesPh: '这一块要达成什么？说明、材料……',
    up: '上移', down: '下移', del: '删除议程块', empty: '还没有议程块。在下面添加第一个，或者从模板开始。', limit: '议程块数量已达上限。',
    now: '当前', next: '下一项', upNext: '接下来', last: '最后一块', pause: '暂停', play: '继续', skip: '跳过', prev: '上一项', plus1: '+1 分钟', exit: '退出', stop: '结束运行', timeUp: '时间到', over: '已超时',
    paused: '已暂停', done: '所有议程块已完成', doneHint: '辛苦了，一共完成了 {n} 个议程块。', restart: '重新运行', viewing: '实时查看：计时由主持人控制。', chimeOn: '声音开', chimeOff: '声音关',
    of: '第 {i} / {n} 块', ends: '计划结束 {t}', copyMd: '复制为文本', copied: '已复制！', deleteAgenda: '删除议程', confirm: '再点一次确认', more: '更多', fullscreen: '全屏',
    localOnly: '只保存在本浏览器（未配置实时分享）。', notFound: '没有找到', keys: '空格：暂停 · →：下一项 · ←：上一项 · +：加一分钟 · Esc：退出',
    steps: [
      ['创建议程', '起个名字，选一个模板，或从空白开始。'],
      ['安排议程块', '为每块填写标题、时长和目标，用箭头调整顺序，总时长会自动更新。'],
      ['分享查看链接', '用链接或二维码邀请现场的人，他们能看到议程和实时倒计时。'],
      ['开始运行', '全屏开始。可以暂停、跳过或加一分钟，每块结束时有温和的提示音。'],
    ],
    tips: ['留几分钟余量：工作坊几乎总会超时。', '超过一小时的议程，安排一次短休息。', '设置开始时间，就能看到每一块的具体钟点。'],
  },
}

const KIND = 'agendas'

// ---------- storage: live document, or this browser when no backend is configured ----------

const LOCAL = id => `lift-agenda-local:${id}`
const readLocal = id => { try { return JSON.parse(localStorage.getItem(LOCAL(id))) } catch { return null } }
const writeLocal = (id, doc) => { try { localStorage.setItem(LOCAL(id), JSON.stringify(doc)) } catch { /* storage full or blocked */ } }

function useLocalDoc(id) {
  const [doc, setDoc] = useState(() => readLocal(id))
  useEffect(() => {
    const h = e => { if (e.key === LOCAL(id)) setDoc(readLocal(id)) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [id])
  const dispatch = useCallback(raw => {
    const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
    setDoc(prev => { const next = reduce(prev, action); writeLocal(id, next); return next })
  }, [id])
  return { status: doc ? 'ready' : 'missing', doc, dispatch, error: null, local: true }
}

// `backend` never changes during a page's life, so the hook choice is stable.
const useAgendaDoc = backend ? id => useLiveDoc(id, reduce) : useLocalDoc

// ---------- sound: a soft two-tone bell made with Web Audio ----------

let audio = null
function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch { audio = null }
}
function bell() {
  if (!audio) return
  try {
    const t0 = audio.currentTime + 0.02
    ;[[587.33, 0], [880, 0.28]].forEach(([f, d]) => {
      ;[1, 2.01].forEach((mult, k) => {
        const o = audio.createOscillator()
        const g = audio.createGain()
        o.type = 'sine'
        o.frequency.value = f * mult
        const peak = k ? 0.025 : 0.12
        g.gain.setValueAtTime(0.0001, t0 + d)
        g.gain.exponentialRampToValueAtTime(peak, t0 + d + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.8)
        o.connect(g).connect(audio.destination)
        o.start(t0 + d)
        o.stop(t0 + d + 1.9)
      })
    })
  } catch { /* audio unavailable */ }
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

// ---------- lobby ----------

export function AgendaHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [starter, setStarter] = useState('retro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [list, setList] = useState(() => rememberedDocs(KIND))
  const create = e => {
    e.preventDefault()
    const id = newDocId('ag')
    const owner = { id: identity.id }
    const doc = newAgenda({ id, name: name.trim() || (starter === 'blank' ? t.eyebrow : STARTERS[starter][lang][0].split(' · ')[0]), owner, blocks: starterBlocks(starter, lang), at: Date.now() })
    const done = () => { rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt }); navigate(`/agenda/${id}`) }
    if (!backend) { writeLocal(id, doc); done(); return }
    setBusy(true)
    createDoc(id, doc, identity.secret).then(done, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page ag-home">
      <section className="tool-hero ag-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="ag-hero-art" aria-hidden="true">
          {[['0:10', 70], ['0:25', 100], ['0:15', 55], ['0:10', 40]].map(([m, w], i) => <span key={i} className={i === 1 ? 'on' : ''}><i style={{ width: `${w}%` }} /><b>{m}</b></span>)}
        </div>
      </section>
      <HowTo tool="agenda" steps={t.steps} tips={t.tips} />
      <div className="ag-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="ag-name">{t.name}</label>
          <input id="ag-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={120} />
          <span className="field-label">{t.starter}</span>
          <div className="ag-starters">
            {Object.keys(STARTERS).map(k => (
              <button type="button" key={k} className={`ag-starter ${starter === k ? 'sel' : ''}`} aria-pressed={starter === k} onClick={() => setStarter(k)}>
                <b>{STARTERS[k][lang][0]}</b><span>{STARTERS[k][lang][1]}</span>
              </button>
            ))}
          </div>
          {!backend && <p className="muted small">{t.localOnly}</p>}
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yours}</h2>
          {list.length ? (
            <ul className="doc-list">
              {list.map(r => (
                <li key={r.id}>
                  <a href={`#/agenda/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{fill(t.created, { d: ago(r.at, lang) })}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, r.id); setList(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.none}</p>}
        </section>
      </div>
    </main>
  )
}

// ---------- agenda ----------

export function AgendaRoom({ id }) {
  const { identity } = useStore()
  const { status, doc, dispatch, error, local } = useAgendaDoc(id)
  const lang = useLang()
  const t = T[lang]
  const canEdit = !!doc && (local || doc.ownerId === identity.id)
  const live = doc && (doc.run.status === 'running' || doc.run.status === 'paused')
  // Viewers follow the run automatically; the facilitator can step out to edit.
  const [runOpen, setRunOpen] = useState(null)
  const showRun = runOpen ?? (!canEdit && !!live)

  useEffect(() => {
    if (doc) rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt })
  }, [id, doc?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'ready') return status === 'missing' && !backend ? <div className="empty-page"><h2>{t.notFound}</h2></div> : <DocStatus status={status} />
  return (
    <>
      <Editor doc={doc} dispatch={dispatch} canEdit={canEdit} t={t} lang={lang} error={error} local={local} onRun={full => {
        unlockAudio()
        if (doc.run.status === 'idle' || doc.run.status === 'done') dispatch({ type: 'START', index: 0 })
        if (full) document.documentElement.requestFullscreen?.().catch(() => {})
        setRunOpen(true)
      }} />
      {showRun && <RunView doc={doc} dispatch={dispatch} canEdit={canEdit} t={t} lang={lang} onExit={() => { setRunOpen(false); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }} />}
    </>
  )
}

function Editor({ doc, dispatch, canEdit, t, lang, error, local, onRun }) {
  const total = totalMinutes(doc)
  const run = doc.run
  const live = run.status === 'running' || run.status === 'paused'
  let offset = 0
  return (
    <main className="tool-page ag-page">
      <div className="ag-bar">
        <a className="icon-btn" href="#/agenda" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <Title doc={doc} dispatch={dispatch} canEdit={canEdit} />
        <span className="ag-total"><Icon name="timer" size={15} /> {fmtDuration(total, lang)} · {doc.blocks.length === 1 ? t.block1 : fill(t.blocks, { n: doc.blocks.length })}</span>
        <span className="spacer" />
        {!local && <InviteButton />}
        {canEdit ? (
          <>
            <button className="btn ghost" onClick={() => onRun(false)} disabled={!doc.blocks.length}><Icon name="play" /> {live ? t.resume : t.run}</button>
            <button className="btn primary" onClick={() => onRun(true)} disabled={!doc.blocks.length}><Icon name="expand" /> {t.runFull}</button>
          </>
        ) : live && <button className="btn primary" onClick={() => onRun(false)}><Icon name="play" /> {t.resume}</button>}
        <AgendaMenu doc={doc} canEdit={canEdit} t={t} lang={lang} dispatch={dispatch} />
      </div>
      {error && <p className="auth-error">{error}</p>}
      {!canEdit && <p className="tool-note small">{t.viewing}</p>}
      {canEdit && (
        <div className="ag-start">
          <label htmlFor="ag-start">{t.startAt}</label>
          <input id="ag-start" type="time" value={doc.startAt} onChange={e => dispatch({ type: 'SET_START', startAt: e.target.value })} />
          <span className="muted small">{t.startAtHint}</span>
        </div>
      )}
      {doc.blocks.length === 0 && <p className="tool-note">{t.empty}</p>}
      <ol className="ag-blocks">
        {doc.blocks.map((b, i) => {
          const from = offset
          offset += b.minutes
          const isNow = live && run.index === i
          return <BlockRow key={b.id} b={b} i={i} n={doc.blocks.length} from={from} startAt={doc.startAt} isNow={isNow} done={live && i < run.index} canEdit={canEdit} dispatch={dispatch} t={t} />
        })}
      </ol>
      {canEdit && (doc.blocks.length < MAX_BLOCKS ? <AddBlock dispatch={dispatch} t={t} /> : <p className="muted small">{t.limit}</p>)}
      {doc.startAt && doc.blocks.length > 0 && <p className="muted small ag-endline">{fill(t.ends, { t: clockAt(doc.startAt, total) })}</p>}
    </main>
  )
}

function Title({ doc, dispatch, canEdit }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(doc.name)
  if (!canEdit) return <h1 className="ag-name">{doc.name}</h1>
  if (editing) {
    const save = () => { if (v.trim() && v.trim() !== doc.name) dispatch({ type: 'RENAME', name: v.trim() }); setEditing(false) }
    return <input className="ag-name-input" autoFocus value={v} maxLength={120} onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
  }
  return <h1 className="ag-name editable" tabIndex={0} onClick={() => { setV(doc.name); setEditing(true) }} onKeyDown={e => { if (e.key === 'Enter') { setV(doc.name); setEditing(true) } }}>{doc.name}</h1>
}

// Text fields save on blur so typing does not send one event per key.
function useDraft(value) {
  const [v, setV] = useState(value)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setV(value) }, [value])
  return [v, setV, focused]
}

function BlockRow({ b, i, n, from, startAt, isNow, done, canEdit, dispatch, t }) {
  const [title, setTitle, tf] = useDraft(b.title)
  const [notes, setNotes, nf] = useDraft(b.notes)
  const when = startAt ? `${clockAt(startAt, from)}–${clockAt(startAt, from + b.minutes)}` : `${fmtClock(from * 60000)}`
  const setMin = m => dispatch({ type: 'UPDATE_BLOCK', bid: b.id, minutes: m })
  return (
    <li className={`ag-block ${isNow ? 'now' : ''} ${done ? 'done' : ''}`}>
      <div className="ag-num"><b>{i + 1}</b><span>{when}</span></div>
      <div className="ag-main">
        {canEdit ? (
          <>
            <input className="ag-title" value={title} placeholder={t.blockTitlePh} aria-label={t.blockTitle} maxLength={160}
              onFocus={() => { tf.current = true }} onChange={e => setTitle(e.target.value)}
              onBlur={() => { tf.current = false; if (title !== b.title) dispatch({ type: 'UPDATE_BLOCK', bid: b.id, title }) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <textarea className="ag-notes" rows={notes ? 2 : 1} value={notes} placeholder={t.notesPh} aria-label={t.notes} maxLength={1000}
              onFocus={() => { nf.current = true }} onChange={e => setNotes(e.target.value)}
              onBlur={() => { nf.current = false; if (notes !== b.notes) dispatch({ type: 'UPDATE_BLOCK', bid: b.id, notes }) }} />
          </>
        ) : (
          <>
            <h3 className="ag-title-ro">{b.title || '—'}</h3>
            {b.notes && <p className="ag-notes-ro">{b.notes}</p>}
          </>
        )}
      </div>
      <div className="ag-side">
        {isNow && <span className="ag-now-tag">{t.now}</span>}
        {canEdit ? (
          <div className="ag-min" role="group" aria-label={t.minutes}>
            <button className="icon-btn sm" onClick={() => setMin(b.minutes - (b.minutes > 10 ? 5 : 1))} disabled={b.minutes <= 1} aria-label="−">−</button>
            <input type="number" min="1" max="480" value={b.minutes} onChange={e => e.target.value && setMin(e.target.value)} aria-label={t.minutes} />
            <button className="icon-btn sm" onClick={() => setMin(b.minutes + (b.minutes >= 10 ? 5 : 1))} aria-label="+">+</button>
            <span className="muted small">{t.minutes}</span>
          </div>
        ) : <span className="ag-min-ro">{b.minutes} {t.minutes}</span>}
        {canEdit && (
          <div className="ag-tools">
            <button className="icon-btn sm" onClick={() => dispatch({ type: 'MOVE_BLOCK', bid: b.id, dir: -1 })} disabled={i === 0} aria-label={t.up} title={t.up}><Icon name="up" size={15} /></button>
            <button className="icon-btn sm" onClick={() => dispatch({ type: 'MOVE_BLOCK', bid: b.id, dir: 1 })} disabled={i === n - 1} aria-label={t.down} title={t.down}><Icon name="down" size={15} /></button>
            <button className="icon-btn sm" onClick={() => dispatch({ type: 'REMOVE_BLOCK', bid: b.id })} aria-label={t.del} title={t.del}><Icon name="trash" size={15} /></button>
          </div>
        )}
      </div>
    </li>
  )
}

function AddBlock({ dispatch, t }) {
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [notes, setNotes] = useState('')
  const add = e => {
    e.preventDefault()
    if (!title.trim()) return
    dispatch({ type: 'ADD_BLOCK', title: title.trim(), minutes, notes: notes.trim() })
    setTitle(''); setNotes('')
  }
  return (
    <form className="tool-card ag-add" onSubmit={add}>
      <h2>{t.addBlock}</h2>
      <div className="ag-add-row">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.blockTitlePh} aria-label={t.blockTitle} maxLength={160} />
        <label className="ag-add-min"><input type="number" min="1" max="480" value={minutes} onChange={e => setMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))} aria-label={t.minutes} /> {t.minutes}</label>
      </div>
      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.notesPh} aria-label={t.notes} maxLength={1000} />
      <div className="row end"><button className="btn primary" disabled={!title.trim()}><Icon name="plus" /> {t.addBlock}</button></div>
    </form>
  )
}

function AgendaMenu({ doc, canEdit, t, lang, dispatch }) {
  const { identity } = useStore()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const copy = () => navigator.clipboard?.writeText(agendaMarkdown(doc, lang)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  const del = () => {
    if (!confirm) { setConfirm(true); return }
    const after = () => { forgetDoc(KIND, doc.id); navigate('/agenda') }
    if (!backend) { try { localStorage.removeItem(LOCAL(doc.id)) } catch { /* ignore */ } after(); return }
    deleteDoc(doc.id, identity.secret).finally(after)
  }
  const live = doc.run.status !== 'idle'
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(o => !o)} aria-label={t.more} title={t.more} aria-expanded={open}><Icon name="more" /></button>
      {open && (
        <div className="menu right">
          <button className="menu-item" onClick={copy}><Icon name="copy" /> {copied ? t.copied : t.copyMd}</button>
          {canEdit && live && <button className="menu-item" onClick={() => { dispatch({ type: 'STOP' }); setOpen(false) }}><Icon name="x" /> {t.stop}</button>}
          {canEdit && (doc.creatorId ?? doc.ownerId) === identity.id && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteAgenda}</button>}
        </div>
      )}
    </div>
  )
}

// ---------- run mode ----------

function RunView({ doc, dispatch, canEdit, t, lang, onExit }) {
  const run = doc.run
  const now = useNow(run.status === 'running')
  const left = remainingMs(run, now)
  const block = doc.blocks[run.index]
  const next = doc.blocks[run.index + 1]
  const [sound, setSound] = useState(canEdit)
  const chimed = useRef(null)
  const key = `${run.index}:${run.endsAt ?? run.remaining}`
  const over = left != null && left <= 0
  useEffect(() => {
    if (run.status !== 'running' || !over) return
    // Ring once each time a block runs out (+1 min gives a new end, so it can ring again), never for an end long past.
    if (chimed.current === key) return
    chimed.current = key
    if (sound && left > -5000) bell()
  }, [over, key, sound, run.status, left])

  // A field left focused behind the overlay would swallow the shortcuts.
  useEffect(() => { document.activeElement?.blur?.() }, [])
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('.ag-run input, .ag-run textarea')) return
      if (e.key === 'Escape') { onExit(); return }
      if (!canEdit) return
      if (e.key === ' ') { e.preventDefault(); dispatch({ type: run.status === 'paused' ? 'RESUME' : 'PAUSE' }) }
      else if (e.key === 'ArrowRight') dispatch({ type: 'NEXT' })
      else if (e.key === 'ArrowLeft') dispatch({ type: 'PREV' })
      else if (e.key === '+' || e.key === '=') dispatch({ type: 'ADD_MINUTE' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, dispatch, onExit, run.status])

  const toggleSound = () => { unlockAudio(); setSound(s => !s) }

  if (run.status === 'done' || run.status === 'idle') {
    return (
      <div className="ag-run" role="dialog" aria-modal="true" aria-label={t.eyebrow}>
        <button className="icon-btn ag-run-x" onClick={onExit} aria-label={t.exit} title={t.exit}><Icon name="x" size={20} /></button>
        <div className="ag-run-body ag-run-done">
          <span className="ag-run-eyebrow">{doc.name}</span>
          <h1>{run.status === 'done' ? t.done : t.eyebrow}</h1>
          {run.status === 'done' && <p className="muted">{fill(t.doneHint, { n: doc.blocks.length })}</p>}
          {canEdit && <div className="row center"><button className="btn primary" onClick={() => { unlockAudio(); dispatch({ type: 'START', index: 0 }) }}><Icon name="play" /> {t.restart}</button><button className="btn ghost" onClick={onExit}>{t.exit}</button></div>}
        </div>
      </div>
    )
  }

  const pct = block ? Math.min(100, Math.max(0, 100 - (left / (block.minutes * 60000)) * 100)) : 0
  return (
    <div className={`ag-run ${over ? 'over' : ''} ${run.status}`} role="dialog" aria-modal="true" aria-label={t.eyebrow}>
      <div className="ag-run-top">
        <span className="ag-run-eyebrow">{doc.name} · {fill(t.of, { i: run.index + 1, n: doc.blocks.length })}</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={toggleSound} aria-pressed={sound}>{sound ? t.chimeOn : t.chimeOff}</button>
        <button className="icon-btn" onClick={onExit} aria-label={t.exit} title={t.exit}><Icon name="x" size={20} /></button>
      </div>
      <div className="ag-run-body">
        <span className="ag-run-label">{run.status === 'paused' ? t.paused : over ? t.timeUp : t.now}</span>
        <h1 className="ag-run-title">{block?.title || '—'}</h1>
        <div className="ag-run-clock" aria-live="off">{fmtClock(left)}</div>
        {over && <span className="ag-run-over">{t.over}</span>}
        <div className="ag-run-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        {block?.notes && <p className="ag-run-notes">{block.notes}</p>}
        {canEdit ? (
          <div className="ag-run-controls">
            <button className="btn ghost" onClick={() => dispatch({ type: 'PREV' })} disabled={run.index === 0}><Icon name="left" /> {t.prev}</button>
            {run.status === 'paused'
              ? <button className="btn primary lg" onClick={() => dispatch({ type: 'RESUME' })}><Icon name="play" /> {t.play}</button>
              : <button className="btn primary lg" onClick={() => dispatch({ type: 'PAUSE' })}><Icon name="pause" /> {t.pause}</button>}
            <button className="btn ghost" onClick={() => dispatch({ type: 'ADD_MINUTE' })}>{t.plus1}</button>
            <button className="btn ghost" onClick={() => dispatch({ type: 'NEXT' })}>{next ? t.skip : t.last} <Icon name="skip" /></button>
          </div>
        ) : <p className="muted small">{t.viewing}</p>}
      </div>
      <div className="ag-run-next">
        {next ? <><span>{t.upNext}</span><b>{next.title || '—'}</b><em>{fmtDuration(next.minutes, lang)}</em></> : <span>{t.last}</span>}
      </div>
      {canEdit && <p className="ag-run-keys">{t.keys}</p>}
    </div>
  )
}
