import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, Avatar, useClickOutside } from '../core/ui.jsx'
import { confetti } from '../core/fx.js'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, HowTo, fill, ago } from '../core/tools-ui.jsx'
import { parseCsv } from '../core/forecast/csv.js'
import { SCALES, SCALE_IDS, PHASES, scaleOf, newBoard, reduce, column, flagCount, isContested, summary, parseTitles, boardCsv } from './model.js'
import './sizing.css'

const T = {
  en: {
    eyebrow: 'Silent sizing', title: 'Size a whole backlog in minutes', lead: 'Everyone drags story cards into size columns at the same time, without talking. Cards that keep bouncing between sizes get flagged, and only those need a conversation.',
    create: 'New sizing board', name: 'Board name', namePh: 'e.g. Checkout revamp backlog', scale: 'Size scale', custom: 'Your sizes', customPh: 'Comma-separated, smallest first, e.g. 1, 2, 4, 8',
    scales: { tshirt: 'T-shirt sizes', fib: 'Fibonacci', modfib: 'Modified Fibonacci', pow2: 'Powers of 2', custom: 'Custom' },
    stories: 'Stories', storiesPh: 'One story per line, or paste a CSV with a “Title” or “Summary” column', storiesCount: '{n} stories', start: 'Create board',
    yourBoards: 'Your boards', noBoards: 'Boards you create or join show up here.', remove: 'Remove', created: 'Created {d}',
    howSteps: [
      ['Create a board', 'Pick a size scale and paste your stories, one per line or straight from a CSV export.'],
      ['Sort in silence', 'Share the link. Everyone drags cards from “Unsized” into a column at the same time. No talking: if you disagree, just move the card.'],
      ['Challenge', 'Flag any card you are unsure about. Cards moved back and forth more than twice are flagged for you.'],
      ['Discuss only the flagged ones', 'Talk through the contested cards. The host settles each one on a size.'],
      ['Export', 'Check the totals per size and download a CSV for your tracker.'],
    ],
    howTips: [
      'Start by placing one well-known story as a reference in the middle of the scale.',
      'Set a 5–10 minute timer for the silent round so the team keeps a brisk pace.',
      'On a phone, drag cards by their ⋮⋮ handle, or tap a card to pick a size.',
      'Use planning poker afterwards for the few stories that stay contested.',
    ],
    phases: { sort: 'Silent sort', challenge: 'Challenge', discuss: 'Discuss', done: 'Done' },
    hints: {
      sort: 'Drag each card into the size that feels right. No talking — if you disagree, move the card.',
      challenge: 'Flag cards you are not sure about. Cards moved often are flagged automatically.',
      discuss: 'Talk through the contested cards one by one; the host settles each on a size.',
      done: 'Sizing is finished. Check the totals and export the result.',
    },
    next: { sort: 'Start challenge', challenge: 'Discuss flagged cards', discuss: 'Finish' },
    shh: 'Shh… silent round', unsized: 'Unsized', addStories: 'Add stories', add: 'Add', cancel: 'Cancel',
    moves: { one: 'moved once', many: 'moved {n}×' }, flags: '{n} flagged', contested: 'Contested', settled: 'Settled',
    moveTo: 'Move to', flag: 'Flag for discussion', unflag: 'Remove my flag', settle: 'Settle on this size', settleOn: 'Settle on', reopen: 'Reopen',
    details: 'Details', titleL: 'Title', link: 'Link', notes: 'Notes', notesPh: 'Context, assumptions, questions…', save: 'Save', delete: 'Delete card',
    history: 'Moves', noHistory: 'Not moved between sizes yet.', placed: 'placed', by: '{from} → {to}',
    contestedList: 'Contested cards', noContested: 'Nothing contested — the team agrees. You can finish.',
    flaggedBy: 'Flagged by {names}', movedBy: 'Last moved by {name}',
    total: 'Total', points: '{n} points', points1: '1 point', cards: '{n} cards', leftUnsized: '{n} still unsized', exportCsv: 'Export CSV', copied: 'Copied!', copyList: 'Copy as list',
    settings: 'Board settings', hostOnly: 'Only the host can change phase and add stories', contestAt: 'Flag a card after this many moves',
    timer: 'Timer', stop: 'Stop', host: 'Host', you: 'you', people: 'People', makeHost: 'Make host', removeP: 'Remove',
    leave: 'Leave board', deleteB: 'Delete board', confirm: 'Click again to confirm', hostTip: 'The host runs the phases and settles contested cards.',
    back: 'All boards', rename: 'Rename', dragHandle: 'Drag to move', open: 'Open card', empty: 'Drop cards here',
    keyHelp: 'Arrow keys: ← → change size, ↑ ↓ reorder. Enter opens the card.',
  },
  zh: {
    eyebrow: '静默估算', title: '几分钟内给整个待办估好尺寸', lead: '所有人同时、不说话地把故事卡拖进尺寸列。在不同尺寸之间来回跳的卡片会被标记，只需讨论这些卡片。',
    create: '新建估算板', name: '名称', namePh: '例如：结账改版待办', scale: '尺寸刻度', custom: '自定义尺寸', customPh: '用逗号分隔，从小到大，例如 1, 2, 4, 8',
    scales: { tshirt: 'T 恤尺码', fib: '斐波那契', modfib: '改良斐波那契', pow2: '2 的幂', custom: '自定义' },
    stories: '故事', storiesPh: '每行一个故事，或粘贴含“Title”或“Summary”列的 CSV', storiesCount: '{n} 个故事', start: '创建估算板',
    yourBoards: '我的估算板', noBoards: '你创建或加入的估算板会显示在这里。', remove: '移除', created: '创建于 {d}',
    howSteps: [
      ['创建估算板', '选择尺寸刻度，粘贴故事：每行一个，或直接粘贴 CSV 导出。'],
      ['静默排序', '分享链接。所有人同时把卡片从“未估算”拖到某一列。不要说话：不同意就直接移动卡片。'],
      ['提出质疑', '给没把握的卡片插旗。来回移动超过两次的卡片会被自动标记。'],
      ['只讨论被标记的卡片', '逐一讨论有争议的卡片，由主持人确定最终尺寸。'],
      ['导出', '查看每个尺寸的合计，下载 CSV 导入你的工具。'],
    ],
    howTips: [
      '先把一个大家都熟悉的故事放在刻度中间作为参照。',
      '给静默环节设置 5–10 分钟计时，保持节奏。',
      '在手机上可以按住 ⋮⋮ 拖动卡片，或点卡片选择尺寸。',
      '仍有争议的少数故事，可以之后用计划扑克再估一次。',
    ],
    phases: { sort: '静默排序', challenge: '质疑', discuss: '讨论', done: '完成' },
    hints: {
      sort: '把每张卡拖到你觉得合适的尺寸。不要说话——不同意就移动卡片。',
      challenge: '给没把握的卡片插旗。移动次数多的卡片会被自动标记。',
      discuss: '逐一讨论有争议的卡片，由主持人确定尺寸。',
      done: '估算完成。查看合计并导出结果。',
    },
    next: { sort: '开始质疑', challenge: '讨论被标记的卡片', discuss: '完成' },
    shh: '嘘……静默进行中', unsized: '未估算', addStories: '添加故事', add: '添加', cancel: '取消',
    moves: { one: '移动 1 次', many: '移动 {n} 次' }, flags: '{n} 面旗', contested: '有争议', settled: '已确定',
    moveTo: '移到', flag: '插旗讨论', unflag: '撤回我的旗', settle: '确定为这个尺寸', settleOn: '确定为', reopen: '重新打开',
    details: '详情', titleL: '标题', link: '链接', notes: '备注', notesPh: '背景、假设、问题……', save: '保存', delete: '删除卡片',
    history: '移动记录', noHistory: '还没有在尺寸之间移动过。', placed: '放入', by: '{from} → {to}',
    contestedList: '有争议的卡片', noContested: '没有争议——大家意见一致，可以完成了。',
    flaggedBy: '{names} 插了旗', movedBy: '最后由 {name} 移动',
    total: '合计', points: '{n} 点', points1: '1 点', cards: '{n} 张', leftUnsized: '还有 {n} 张未估算', exportCsv: '导出 CSV', copied: '已复制！', copyList: '复制为列表',
    settings: '估算板设置', hostOnly: '只有主持人可以切换阶段和添加故事', contestAt: '移动超过几次后自动标记',
    timer: '计时', stop: '停止', host: '主持人', you: '你', people: '成员', makeHost: '设为主持人', removeP: '移出',
    leave: '离开估算板', deleteB: '删除估算板', confirm: '再点一次确认', hostTip: '由主持人切换阶段并确定有争议卡片的尺寸。',
    back: '所有估算板', rename: '重命名', dragHandle: '拖动', open: '打开卡片', empty: '把卡片拖到这里',
    keyHelp: '方向键：← → 换尺寸，↑ ↓ 调整顺序，回车打开卡片。',
  },
}

const KIND = 'sizing'
const PILE = '__pile'
const colKey = v => v ?? PILE
const colOf = k => k === PILE ? null : k

// ---------- lobby ----------

export function SizingHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [scale, setScale] = useState('tshirt')
  const [custom, setCustom] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [boards, setBoards] = useState(() => rememberedDocs(KIND))
  const titles = useMemo(() => parseTitles(text, parseCsv), [text])
  const customScale = custom.split(/[,\s]+/).map(x => x.trim().slice(0, 6)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 12)
  const create = e => {
    e.preventDefault()
    if (!backend) return
    const id = newDocId('sz')
    const at = Date.now()
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const useCustom = scale === 'custom' && customScale.length > 1
    const board = newBoard({ id, name: name.trim() || t.eyebrow, scale: scale === 'custom' && !useCustom ? 'tshirt' : scale, customScale: useCustom ? customScale : [], titles, owner, at, nonce: id })
    setBusy(true)
    createDoc(id, board, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: board.name, at })
      navigate(`/sizing/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page sz-home">
      <section className="tool-hero sz-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="sz-hero-art" aria-hidden="true">
          {['S', 'M', 'L'].map((v, i) => (
            <div key={v} className="sz-hero-col"><b>{v}</b>{Array.from({ length: [2, 3, 1][i] }, (_, j) => <span key={j} className={i === 1 && j === 2 ? 'moving' : ''} />)}</div>
          ))}
        </div>
      </section>
      <HowTo tool="sizing" steps={t.howSteps} tips={t.howTips} />
      <div className="sz-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="sz-name">{t.name}</label>
          <input id="sz-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={80} />
          <span className="field-label">{t.scale}</span>
          <div className="chip-row">
            {SCALE_IDS.map(s => <button type="button" key={s} className={`chip-btn ${scale === s ? 'sel' : ''}`} onClick={() => setScale(s)}>{t.scales[s]}</button>)}
          </div>
          {scale === 'custom'
            ? <input className="mt8" value={custom} onChange={e => setCustom(e.target.value)} placeholder={t.customPh} aria-label={t.custom} />
            : <p className="deck-preview">{SCALES[scale].join('  ·  ')}</p>}
          <label className="field-label" htmlFor="sz-stories">{t.stories} {titles.length > 0 && <span className="sz-count">{fill(t.storiesCount, { n: titles.length })}</span>}</label>
          <textarea id="sz-stories" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={t.storiesPh} />
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy || !backend}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yourBoards}</h2>
          {boards.length ? (
            <ul className="doc-list">
              {boards.map(r => (
                <li key={r.id}>
                  <a href={`#/sizing/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{fill(t.created, { d: ago(r.at, lang) })}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, r.id); setBoards(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.noBoards}</p>}
        </section>
      </div>
    </main>
  )
}

// ---------- board ----------

export function SizingBoard({ id }) {
  const { identity } = useStore()
  const { status, doc: board, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const person = useMemo(() => ({ id: me, name: identity.name || 'Guest', color: identity.color }), [me, identity.name, identity.color])
  const known = board?.people[me]

  // Anyone who opens the link joins (the app asks for a name first); name or colour changes carry over.
  useEffect(() => {
    if (!board || !identity.name) return
    if (known && !known.left && known.name === person.name && known.color === person.color) return
    dispatch({ type: 'JOIN', person })
  }, [board && known, identity.name, person, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (board) rememberDoc(KIND, { id, name: board.name, at: board.createdAt })
  }, [id, board?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'ready') return <DocStatus status={status} />
  return <Board board={board} me={me} dispatch={dispatch} error={error} />
}

function useCountdown(endsAt) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const h = setInterval(() => tick(x => x + 1), 250)
    return () => clearInterval(h)
  }, [endsAt])
  return endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null
}

const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Board({ board, me, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const values = scaleOf(board)
  const isHost = board.ownerId === me
  const canRun = isHost || !board.settings.hostOnly
  const step = PHASES.indexOf(board.phase)
  const left = useCountdown(board.timer.endsAt)
  const [openId, setOpenId] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const contested = board.cards.filter(c => isContested(board, c))
  const canMove = c => board.phase === 'sort' || board.phase === 'challenge' ? !c.settled : board.phase === 'discuss' && canRun
  const move = (cardId, col, index) => dispatch({ type: 'MOVE', cardId, col, index, pid: me })
  const drag = useDrag(board, canMove, move)

  // Keep keyboard focus on a card after it moves to another column.
  useEffect(() => {
    if (focusId) document.querySelector(`[data-card="${focusId}"]`)?.focus()
  }, [board.cards, focusId])

  const celebrated = useRef(false)
  useEffect(() => {
    if (board.phase === 'done' && !celebrated.current && board.cards.length) { celebrated.current = true; confetti(1800) }
  }, [board.phase, board.cards.length])

  const onKey = (e, c) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(c.id); return }
    if (!canMove(c)) return
    const cols = [null, ...values]
    const list = column(board, c.col)
    const at = list.findIndex(x => x.id === c.id)
    const ci = cols.indexOf(c.col)
    if (e.key === 'ArrowRight' && ci < cols.length - 1) move(c.id, cols[ci + 1])
    else if (e.key === 'ArrowLeft' && ci > 0) move(c.id, cols[ci - 1])
    else if (e.key === 'ArrowUp' && at > 0) move(c.id, c.col, at - 1)
    else if (e.key === 'ArrowDown' && at < list.length - 1) move(c.id, c.col, at + 1)
    else return
    e.preventDefault()
    setFocusId(c.id)
  }

  const open = board.cards.find(c => c.id === openId)
  const sum = summary(board)
  return (
    <main className="tool-page sz-room">
      <div className="poker-bar">
        <a className="icon-btn" href="#/sizing" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <BoardTitle board={board} canEdit={isHost} dispatch={dispatch} t={t} />
        <span className="deck-chip">{t.scales[board.scale]}</span>
        <span className="spacer" />
        {canRun && <TimerControl board={board} left={left} dispatch={dispatch} t={t} />}
        {!canRun && left != null && <span className={`timer-chip ${left <= 10 ? 'hot' : ''}`}><Icon name="timer" size={15} /> {fmtClock(left)}</span>}
        <BoardMenu board={board} isHost={isHost} me={me} dispatch={dispatch} t={t} />
        <InviteButton primary />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}

      <nav className="sz-phases" aria-label="Phases">
        {PHASES.map((p, i) => (
          <button key={p} className={`sz-phase ${p === board.phase ? 'on' : ''} ${i < step ? 'past' : ''}`} disabled={!canRun || p === board.phase} aria-current={p === board.phase ? 'step' : undefined} onClick={() => dispatch({ type: 'PHASE', phase: p })}>
            <span className="sz-phase-n">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>{t.phases[p]}
          </button>
        ))}
      </nav>

      <div className="sz-hint">
        {board.phase === 'sort' && <span className="sz-shh">🤫 {t.shh}</span>}
        <p>{t.hints[board.phase]}</p>
        {canRun && t.next[board.phase] && <button className="btn primary sm" onClick={() => dispatch({ type: 'PHASE', phase: PHASES[step + 1] })}>{t.next[board.phase]} <Icon name="right" size={14} /></button>}
      </div>

      {board.phase === 'discuss' && <Contested board={board} cards={contested} canRun={canRun} values={values} dispatch={dispatch} setOpenId={setOpenId} t={t} />}
      {board.phase === 'done' && <Summary board={board} t={t} />}

      <div className="sz-board" ref={drag.boardRef}>
        {[null, ...values].map(v => {
          const cards = column(board, v)
          const pts = sum.cols.find(c => c.value === v)?.points
          return (
            <section key={colKey(v)} className={`sz-col ${v == null ? 'pile' : ''} ${drag.over?.col === colKey(v) ? 'over' : ''}`}>
              <header className="sz-col-head">
                <b>{v ?? t.unsized}</b>
                <span className="sz-col-count">{cards.length}</span>
                {pts != null && cards.length > 0 && <span className="muted small">{pts === 1 ? t.points1 : fill(t.points, { n: pts })}</span>}
                {v == null && canRun && board.phase !== 'done' && <AddStories dispatch={dispatch} t={t} />}
              </header>
              <ul className="sz-cards" data-col={colKey(v)}>
                {cards.map((c, i) => <Fragment key={c.id}>
                  {drag.over?.col === colKey(v) && drag.over.index === i && <li className="sz-drop" aria-hidden="true" />}
                  <Card c={c} board={board} me={me} t={t} movable={canMove(c)} dragging={drag.id === c.id} contested={isContested(board, c)}
                    onPointerDown={e => drag.start(e, c)} onKeyDown={e => onKey(e, c)} onOpen={() => { if (!drag.justDragged.current) setOpenId(c.id) }} />
                </Fragment>)}
                {drag.over?.col === colKey(v) && drag.over.index >= cards.length && <li className="sz-drop" aria-hidden="true" />}
                {cards.length === 0 && !drag.over && <li className="sz-empty muted small">{t.empty}</li>}
              </ul>
            </section>
          )
        })}
      </div>
      {board.phase !== 'done' && <p className="muted small sz-keys">{t.keyHelp}</p>}
      {drag.ghost}
      {open && <CardSheet c={open} board={board} me={me} values={values} canRun={canRun} movable={canMove(open)} move={move} dispatch={dispatch} onClose={() => setOpenId(null)} t={t} />}
    </main>
  )
}

function Card({ c, board, me, t, movable, dragging, contested, onPointerDown, onKeyDown, onOpen }) {
  const last = c.moves[c.moves.length - 1]
  const mover = last && board.people[last.pid]
  const flags = flagCount(c)
  return (
    <li data-card={c.id} tabIndex={0} role="button" aria-label={`${c.title}${c.col ? ` · ${c.col}` : ''}`}
      className={`sz-card ${dragging ? 'dragging' : ''} ${contested ? 'contested' : ''} ${c.settled ? 'settled' : ''} ${movable ? 'movable' : ''}`}
      onPointerDown={onPointerDown} onKeyDown={onKeyDown} onClick={onOpen}
      title={mover ? fill(t.movedBy, { name: last.pid === me ? t.you : mover.name }) : undefined}>
      {movable && <span className="sz-grip" data-grip aria-hidden="true" title={t.dragHandle}>⋮⋮</span>}
      <span className="sz-card-title">{c.title}</span>
      {(c.moveCount > 0 || flags > 0 || c.settled || c.notes || c.link) && (
        <span className="sz-card-meta">
          {c.settled && <span className="sz-tag ok"><Icon name="check" size={11} /> {t.settled}</span>}
          {contested && <span className="sz-tag hot">{t.contested}</span>}
          {c.moveCount > 0 && <span className="sz-tag">↔ {c.moveCount === 1 ? t.moves.one : fill(t.moves.many, { n: c.moveCount })}</span>}
          {flags > 0 && <span className="sz-tag">⚑ {flags}{c.flags?.[me] ? ` (${t.you})` : ''}</span>}
          {(c.notes || c.link) && <Icon name="comment" size={12} />}
        </span>
      )}
    </li>
  )
}

// Pointer-based dragging that works for mouse, pen and touch. Mouse drags from anywhere on a card;
// touch drags only from the ⋮⋮ grip so the board can still scroll sideways with a finger.
function useDrag(board, canMove, move) {
  const [state, setState] = useState(null)
  const boardRef = useRef(null)
  const pending = useRef(null)
  const justDragged = useRef(false)
  const boardRefState = useRef(board)
  boardRefState.current = board

  const start = (e, c) => {
    if (e.button !== 0 || !canMove(c) || e.target.closest('button, a, input, textarea')) return
    if (e.pointerType !== 'mouse' && !e.target.closest('[data-grip]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    pending.current = { id: c.id, title: c.title, x0: e.clientX, y0: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, started: false }
    if (e.pointerType !== 'mouse') e.preventDefault()
  }

  useEffect(() => {
    const target = (x, y, id) => {
      const el = document.elementFromPoint(x, y)?.closest('.sz-col')?.querySelector('[data-col]')
      if (!el) return null
      const cards = [...el.querySelectorAll('[data-card]')].filter(n => n.dataset.card !== id)
      const index = cards.findIndex(n => { const r = n.getBoundingClientRect(); return y < r.top + r.height / 2 })
      return { col: el.dataset.col, index: index < 0 ? cards.length : index }
    }
    const onMove = e => {
      const p = pending.current
      if (!p) return
      if (!p.started) {
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 5) return
        p.started = true
      }
      e.preventDefault()
      // Scroll the board sideways when dragging near its edges.
      const b = boardRef.current?.getBoundingClientRect()
      if (b) {
        if (e.clientX > b.right - 48) boardRef.current.scrollLeft += 14
        else if (e.clientX < b.left + 48) boardRef.current.scrollLeft -= 14
      }
      setState({ id: p.id, title: p.title, x: e.clientX - p.dx, y: e.clientY - p.dy, w: p.w, over: target(e.clientX, e.clientY, p.id) })
    }
    const onUp = e => {
      const p = pending.current
      pending.current = null
      if (!p?.started) return
      // The click that may follow a drag should not open the card sheet.
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 0)
      const over = target(e.clientX, e.clientY, p.id)
      setState(null)
      if (!over) return
      const col = colOf(over.col)
      const b = boardRefState.current
      const card = b.cards.find(c => c.id === p.id)
      // Indexes are counted without the dragged card, which is what the reducer expects.
      if (card && (card.col !== col || column(b, col).findIndex(c => c.id === p.id) !== over.index)) move(p.id, col, over.index)
    }
    const onCancel = () => { pending.current = null; setState(null) }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [move])

  const ghost = state && <div className="sz-ghost" style={{ left: state.x, top: state.y, width: state.w }} aria-hidden="true">{state.title}</div>
  return { start, boardRef, justDragged, id: state?.id, over: state?.over, ghost }
}

function AddStories({ dispatch, t }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const add = e => {
    e.preventDefault()
    const titles = parseTitles(text, parseCsv)
    if (titles.length) dispatch({ type: 'ADD_CARDS', titles })
    setText('')
    setOpen(false)
  }
  if (!open) return <button className="icon-btn sz-add" aria-label={t.addStories} title={t.addStories} onClick={() => setOpen(true)}><Icon name="plus" size={15} /></button>
  return (
    <form className="sz-add-form" onSubmit={add}>
      <textarea autoFocus rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={t.storiesPh} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e) }} />
      <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{t.cancel}</button><button className="btn primary sm" disabled={!text.trim()}>{t.add}</button></div>
    </form>
  )
}

function CardSheet({ c, board, me, values, canRun, movable, move, dispatch, onClose, t }) {
  const [title, setTitle] = useState(c.title)
  const [link, setLink] = useState(c.link ?? '')
  const [notes, setNotes] = useState(c.notes ?? '')
  const dirty = title.trim() !== c.title || link !== (c.link ?? '') || notes !== (c.notes ?? '')
  const save = e => {
    e.preventDefault()
    if (dirty && title.trim()) dispatch({ type: 'EDIT_CARD', cardId: c.id, patch: { title: title.trim(), link: link.trim(), notes } })
    onClose()
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const name = pid => pid === me ? t.you : board.people[pid]?.name ?? '?'
  const flagged = !!c.flags?.[me]
  const canFlag = board.phase === 'challenge' || board.phase === 'discuss'
  const settling = board.phase === 'discuss' && canRun
  const sizes = [null, ...values]
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal sz-sheet" onSubmit={save} role="dialog" aria-label={t.details}>
        <button type="button" className="icon-btn modal-x" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        <h2 className="sz-sheet-title">{c.title}</h2>
        {(movable || settling) && <>
          <span className="field-label">{settling ? t.settleOn : t.moveTo}</span>
          <div className="chip-row">
            {sizes.filter(v => v != null || !settling).map(v => (
              <button type="button" key={colKey(v)} className={`chip-btn ${c.col === v ? 'sel' : ''}`}
                onClick={() => { settling ? dispatch({ type: 'SETTLE', cardId: c.id, col: v }) : move(c.id, v); onClose() }}>{v ?? t.unsized}</button>
            ))}
          </div>
        </>}
        <div className="row sz-sheet-actions">
          {canFlag && !c.settled && <button type="button" className={`btn ghost sm ${flagged ? 'on-soft' : ''}`} onClick={() => dispatch({ type: 'FLAG', cardId: c.id, pid: me, on: !flagged })}>⚑ {flagged ? t.unflag : t.flag}</button>}
          {canRun && c.settled && board.phase !== 'done' && <button type="button" className="btn ghost sm" onClick={() => dispatch({ type: 'UNSETTLE', cardId: c.id })}>{t.reopen}</button>}
        </div>
        {flagCount(c) > 0 && <p className="muted small">{fill(t.flaggedBy, { names: Object.keys(c.flags).map(name).join(', ') })}</p>}
        <span className="field-label">{t.history}</span>
        {c.moves.length ? (
          <ol className="sz-history">
            {c.moves.slice().reverse().map((m, i) => (
              <li key={i}><Avatar p={board.people[m.pid] ?? { name: '?' }} size={18} /> <b>{name(m.pid)}</b> <span>{m.from == null ? `${t.placed} ${m.to}` : fill(t.by, { from: m.from ?? t.unsized, to: m.to ?? t.unsized })}</span></li>
            ))}
          </ol>
        ) : <p className="muted small">{t.noHistory}</p>}
        <span className="field-label">{t.details}</span>
        <label className="sz-field"><span>{t.titleL}</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={300} /></label>
        <label className="sz-field"><span>{t.link}</span><input value={link} onChange={e => setLink(e.target.value)} placeholder="https://" /></label>
        {c.link && /^https?:\/\//.test(c.link) && <a className="small sz-link" href={c.link} target="_blank" rel="noreferrer noopener">{c.link}</a>}
        <label className="sz-field"><span>{t.notes}</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.notesPh} maxLength={1000} /></label>
        <div className="row sz-sheet-foot">
          {canRun && <button type="button" className="btn ghost sm danger-text" onClick={() => { dispatch({ type: 'REMOVE_CARD', cardId: c.id }); onClose() }}><Icon name="trash" /> {t.delete}</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" disabled={!title.trim()}>{t.save}</button>
        </div>
      </form>
    </div>
  )
}

function Contested({ board, cards, canRun, values, dispatch, setOpenId, t }) {
  const name = pid => board.people[pid]?.name ?? '?'
  return (
    <section className="tool-card sz-contested">
      <h2>{t.contestedList} <span className="sz-col-count">{cards.length}</span></h2>
      {cards.length === 0 ? <p className="muted">{t.noContested}</p> : (
        <ul>
          {cards.map(c => (
            <li key={c.id}>
              <button className="sz-contested-title" onClick={() => setOpenId(c.id)}>{c.title}</button>
              <span className="sz-trail">
                {c.moves.filter(m => m.from != null).slice(-6).map((m, i) => <span key={i} className="sz-tag">{name(m.pid)}: {m.from}→{m.to ?? '·'}</span>)}
                {flagCount(c) > 0 && <span className="sz-tag hot">⚑ {Object.keys(c.flags).map(name).join(', ')}</span>}
              </span>
              {canRun && <div className="chip-row sz-settle" role="group" aria-label={t.settleOn}>
                {values.map(v => <button key={v} className={`chip-btn ${c.col === v ? 'sel' : ''}`} onClick={() => dispatch({ type: 'SETTLE', cardId: c.id, col: v })}>{v}</button>)}
              </div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Summary({ board, t }) {
  const s = summary(board)
  const [copied, setCopied] = useState(false)
  const max = Math.max(1, ...s.cols.map(c => c.count))
  const download = () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([boardCsv(board)], { type: 'text/csv' })), download: `${board.name || 'sizing'}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const copy = () => {
    const text = s.cols.filter(c => c.count).map(c => `${c.value}\n${column(board, c.value).map(x => `- ${x.title}`).join('\n')}`).join('\n\n')
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  }
  return (
    <section className="tool-card sz-summary">
      <div className="sz-bars">
        {s.cols.map(c => (
          <div key={c.value} className="sz-bar">
            <span className="sz-bar-n">{c.count}</span>
            <i style={{ height: `${(c.count / max) * 100}%` }} />
            <b>{c.value}</b>
          </div>
        ))}
      </div>
      <div className="sz-summary-side">
        <div className="sz-big">{s.numeric ? fill(t.points, { n: Math.round(s.total * 10) / 10 }) : fill(t.cards, { n: board.cards.length - s.unsized })}<span>{t.total}</span></div>
        {s.unsized > 0 && <p className="sz-warn">{fill(t.leftUnsized, { n: s.unsized })}</p>}
        <div className="row">
          <button className="btn primary sm" onClick={download}><Icon name="download" /> {t.exportCsv}</button>
          <button className="btn ghost sm" onClick={copy}><Icon name="copy" /> {copied ? t.copied : t.copyList}</button>
        </div>
      </div>
    </section>
  )
}

function BoardTitle({ board, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(board.name)
  if (!editing) return <h1 className="room-name" title={canEdit ? t.rename : undefined} onDoubleClick={() => canEdit && (setName(board.name), setEditing(true))}>{board.name}</h1>
  const save = () => { if (name.trim() && name.trim() !== board.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function TimerControl({ board, left, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ghost sm ${left != null ? (left <= 10 ? 'timer-hot' : 'on-soft') : ''}`} onClick={() => setOpen(o => !o)}><Icon name="timer" /> {left != null ? fmtClock(left) : t.timer}</button>
      {open && <div className="menu right">
        {[180, 300, 600, 900].map(s => <button key={s} className="menu-item" onClick={() => { dispatch({ type: 'TIMER', seconds: s }); setOpen(false) }}>{s / 60} min</button>)}
        {board.timer.endsAt && <button className="menu-item danger" onClick={() => { dispatch({ type: 'TIMER', seconds: 0 }); setOpen(false) }}>{t.stop}</button>}
      </div>}
    </div>
  )
}

function BoardMenu({ board, isHost, me, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { identity } = useStore()
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const people = Object.values(board.people).filter(p => !p.left && p.id !== me)
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(board.id, identity.secret).finally(() => { forgetDoc(KIND, board.id); navigate('/sizing') })
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        {isHost ? <>
          <div className="menu-title">{t.settings}</div>
          <label className="menu-item check"><input type="checkbox" checked={!!board.settings.hostOnly} onChange={e => dispatch({ type: 'SETTINGS', patch: { hostOnly: e.target.checked } })} /> {t.hostOnly}</label>
          <div className="menu-title">{t.contestAt}</div>
          <div className="menu-chips">{[1, 2, 3, 4].map(n => <button key={n} className={`chip-btn ${board.settings.contestAt === n ? 'sel' : ''}`} onClick={() => dispatch({ type: 'SETTINGS', patch: { contestAt: n } })}>{n}</button>)}</div>
          {board.phase === 'sort' && <>
            <div className="menu-title">{t.scale}</div>
            <div className="menu-chips">{SCALE_IDS.filter(s => s !== 'custom' || board.customScale?.length).map(s => <button key={s} className={`chip-btn ${board.scale === s ? 'sel' : ''}`} onClick={() => dispatch({ type: 'SET_SCALE', scale: s })}>{t.scales[s]}</button>)}</div>
          </>}
          {people.length > 0 && <div className="menu-title">{t.people}</div>}
          {people.map(p => (
            <div key={p.id} className="menu-item person-row">
              <Avatar p={p} size={20} /> <span className="grow ellipsis">{p.name}</span>
              <button className="chip-btn" onClick={() => { dispatch({ type: 'SET_HOST', pid: p.id }); setOpen(false) }}>{t.makeHost}</button>
              <button className="chip-btn" onClick={() => dispatch({ type: 'LEAVE', pid: p.id })}>{t.removeP}</button>
            </div>
          ))}
          {(board.creatorId ?? board.ownerId) === me && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteB}</button>}
        </> : <>
          <p className="menu-hint">{t.hostTip}</p>
          <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(KIND, board.id); navigate('/sizing') }}><Icon name="logout" /> {t.leave}</button>
        </>}
      </div>}
    </div>
  )
}
