import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, Avatar, useClickOutside } from '../core/ui.jsx'
import { confetti, sparkle } from '../core/fx.js'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, fill, ago, HowTo } from '../core/tools-ui.jsx'
import { HOWTO } from '../core/howto.js'
import { DECKS, DECK_IDS, THEMES, deckOf, newRoom, reduce, stats, storiesCsv } from './model.js'

const T = {
  en: {
    eyebrow: 'Planning poker', title: 'Estimate together, without anchoring', lead: 'Everyone picks a card in secret, then you reveal at once and talk about the differences. Free, no sign-up, works on phones.',
    create: 'Create a room', roomName: 'Room name', roomPh: 'e.g. Sprint 43 refinement', deck: 'Card deck', theme: 'Card theme', custom: 'Custom values', customPh: 'Comma-separated, e.g. 1, 2, 3, 5, 8, ?',
    decks: { fib: 'Fibonacci', modfib: 'Modified Fibonacci', tshirt: 'T-shirt sizes', pow2: 'Powers of 2', hours: 'Hours', custom: 'Custom' },
    themes: { classic: 'Classic', space: 'Space', jungle: 'Jungle', bakery: 'Bakery', arcade: 'Arcade', ocean: 'Ocean' },
    start: 'Create room', yourRooms: 'Your rooms', noRooms: 'Rooms you create or join will show up here.', open: 'Open', remove: 'Remove', created: 'Created {d}',
    stories: 'Stories', addStories: 'Add stories', storiesPh: 'One story per line (paste from your tracker or a sheet)', add: 'Add', noStories: 'No stories yet. You can also just vote without one.',
    current: 'Now estimating', freeRound: 'Quick round', pickStory: 'Estimate this', estimate: 'Estimate', exportCsv: 'Export CSV', total: 'Total: {n} points · {d}/{t} estimated',
    pick: 'Pick your card', voted: '{v} of {t} voted', waiting: 'Waiting for votes', reveal: 'Reveal cards', revealN: 'Reveal ({v}/{t})', again: 'Vote again', hide: 'Hide',
    average: 'Average', median: 'Median', agreement: 'Agreement', consensus: 'Consensus! 🎉', spread: 'Big spread: ask {low} and {high} to explain their thinking.',
    save: 'Save {v} & next', saveAs: 'Save as', next: 'Next story', skip: 'Skip', suggest: 'Suggested', spectator: 'Spectator', spectate: 'Watch only', play: 'Join voting',
    settings: 'Room settings', hostOnly: 'Only the host can reveal and move on', autoReveal: 'Reveal automatically when everyone has voted', showAverage: 'Show average and median', specials: 'Include the ? and ☕ cards', makeHost: 'Make host',
    timer: 'Timer', stop: 'Stop', host: 'Host', you: 'you', removeP: 'Remove', leave: 'Leave room', deleteRoom: 'Delete room', confirm: 'Click again to confirm',
    players: 'Players', spectators: 'Watching', noVoteYet: 'Thinking…', back: 'All rooms', rename: 'Rename', hostTip: 'The host controls this room.',
    joinTitle: 'Join {name}', joinAs: 'Join as', joinVoter: 'Join and vote', joinSpect: 'Join as spectator',
  },
  zh: {
    eyebrow: '计划扑克', title: '一起估算，不被锚定', lead: '每个人先私下选牌，再同时翻牌，围绕差异展开讨论。免费、无需注册、手机可用。',
    create: '新建房间', roomName: '房间名称', roomPh: '例如：第 43 迭代需求梳理', deck: '牌组', theme: '牌面主题', custom: '自定义牌值', customPh: '用逗号分隔，例如 1, 2, 3, 5, 8, ?',
    decks: { fib: '斐波那契', modfib: '改良斐波那契', tshirt: 'T 恤尺码', pow2: '2 的幂', hours: '小时', custom: '自定义' },
    themes: { classic: '经典', space: '太空', jungle: '丛林', bakery: '甜点', arcade: '街机', ocean: '海洋' },
    start: '创建房间', yourRooms: '我的房间', noRooms: '你创建或加入的房间会显示在这里。', open: '打开', remove: '移除', created: '创建于 {d}',
    stories: '故事列表', addStories: '添加故事', storiesPh: '每行一个故事（可从任务工具或表格粘贴）', add: '添加', noStories: '还没有故事。也可以不选故事直接投票。',
    current: '正在估算', freeRound: '快速一轮', pickStory: '估算这个', estimate: '估算', exportCsv: '导出 CSV', total: '合计 {n} 点 · 已估 {d}/{t}',
    pick: '选一张牌', voted: '{v}/{t} 人已投票', waiting: '等待投票', reveal: '翻牌', revealN: '翻牌（{v}/{t}）', again: '重新投票', hide: '收起',
    average: '平均', median: '中位数', agreement: '一致度', consensus: '意见一致！🎉', spread: '分歧较大：请 {low} 和 {high} 说说各自的想法。',
    save: '保存 {v} 并继续', saveAs: '保存为', next: '下一个故事', skip: '跳过', suggest: '建议', spectator: '旁观', spectate: '只旁观', play: '参与投票',
    settings: '房间设置', hostOnly: '只有主持人可以翻牌和切换故事', autoReveal: '所有人投票后自动翻牌', showAverage: '显示平均数和中位数', specials: '包含 ? 和 ☕ 牌', makeHost: '设为主持人',
    timer: '计时', stop: '停止', host: '主持人', you: '你', removeP: '移出', leave: '离开房间', deleteRoom: '删除房间', confirm: '再点一次确认',
    players: '玩家', spectators: '旁观者', noVoteYet: '思考中…', back: '所有房间', rename: '重命名', hostTip: '由主持人控制此房间。',
    joinTitle: '加入 {name}', joinAs: '加入身份', joinVoter: '加入并投票', joinSpect: '以旁观者加入',
  },
}

const KIND = 'poker-rooms'

// ---------- lobby ----------

export function PokerHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [deck, setDeck] = useState('fib')
  const [custom, setCustom] = useState('')
  const [theme, setTheme] = useState('classic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [rooms, setRooms] = useState(() => rememberedDocs(KIND))
  const create = e => {
    e.preventDefault()
    if (!backend) return
    const id = newDocId('pk')
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const customDeck = custom.split(/[,\s]+/).map(x => x.trim()).filter(Boolean).slice(0, 20)
    const room = newRoom({ id, name: name.trim() || t.eyebrow, deck: deck === 'custom' && !customDeck.length ? 'fib' : deck, customDeck, theme, owner, at: Date.now() })
    setBusy(true)
    createDoc(id, room, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: room.name, at: room.createdAt })
      navigate(`/poker/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page poker-home">
      <section className="tool-hero poker-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="pk-fan" aria-hidden="true">
          {['3', '5', '8'].map((v, i) => <span key={v} className={`pcard face theme-${theme}`} style={{ '--i': i - 1 }}><b>{v}</b><i>{THEMES[theme].emoji}</i></span>)}
        </div>
      </section>
      <HowTo tool="poker" content={HOWTO.poker} />
      <div className="poker-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="pk-name">{t.roomName}</label>
          <input id="pk-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.roomPh} maxLength={80} />
          <span className="field-label">{t.deck}</span>
          <div className="chip-row">
            {DECK_IDS.map(d => <button type="button" key={d} className={`chip-btn ${deck === d ? 'sel' : ''}`} onClick={() => setDeck(d)}>{t.decks[d]}</button>)}
          </div>
          {deck === 'custom'
            ? <input className="mt8" value={custom} onChange={e => setCustom(e.target.value)} placeholder={t.customPh} aria-label={t.custom} />
            : <p className="deck-preview">{DECKS[deck].join('  ·  ')}</p>}
          <span className="field-label">{t.theme}</span>
          <div className="theme-row">
            {Object.keys(THEMES).map(k => (
              <button type="button" key={k} className={`theme-pick ${theme === k ? 'sel' : ''}`} onClick={() => setTheme(k)} aria-pressed={theme === k}>
                <span className={`pcard back theme-${k} mini`}><i>{THEMES[k].emoji}</i></span>{t.themes[k]}
              </button>
            ))}
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy || !backend}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yourRooms}</h2>
          {rooms.length ? (
            <ul className="doc-list">
              {rooms.map(r => (
                <li key={r.id}>
                  <a href={`#/poker/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{fill(t.created, { d: ago(r.at, lang) })}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, r.id); setRooms(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.noRooms}</p>}
        </section>
      </div>
    </main>
  )
}

// ---------- room ----------

export function PokerRoom({ id }) {
  const { identity } = useStore()
  const { status, doc: room, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const person = useMemo(() => ({ id: me, name: identity.name || 'Guest', color: identity.color }), [me, identity.name, identity.color])
  const joined = room?.people[me] && !room.people[me].left
  const known = room?.people[me]

  // Returning players rejoin automatically; name or colour changes are carried over.
  useEffect(() => {
    if (!room || !identity.name) return
    if (known && !known.left && known.name === person.name && known.color === person.color) return
    if (known) dispatch({ type: 'JOIN', person })
  }, [room && known, identity.name, person, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room) rememberDoc(KIND, { id, name: room.name, at: room.createdAt })
  }, [id, room?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'ready') return <DocStatus status={status} />
  if (!joined) return <JoinRoom room={room} person={person} dispatch={dispatch} ready={!!identity.name} />
  return <Room room={room} me={me} dispatch={dispatch} error={error} />
}

function JoinRoom({ room, person, dispatch, ready }) {
  const t = T[useLang()]
  return (
    <main className="tool-page">
      <section className="tool-card join-card">
        <span className={`pcard back theme-${room.theme}`}><i>{THEMES[room.theme]?.emoji}</i></span>
        <h2>{fill(t.joinTitle, { name: room.name })}</h2>
        <p className="muted">{t.joinAs} <b>{person.name}</b></p>
        <div className="row">
          <button className="btn primary" disabled={!ready} onClick={() => dispatch({ type: 'JOIN', person, role: 'voter' })}>{t.joinVoter}</button>
          <button className="btn ghost ghost" disabled={!ready} onClick={() => dispatch({ type: 'JOIN', person, role: 'spectator' })}>{t.joinSpect}</button>
        </div>
      </section>
    </main>
  )
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

function Room({ room, me, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const deck = deckOf(room)
  const isHost = room.ownerId === me
  const canRun = isHost || !room.settings.hostOnly
  const people = Object.values(room.people).filter(p => !p.left).sort((a, b) => a.joinedAt - b.joinedAt)
  const players = people.filter(p => p.role === 'voter')
  const watchers = people.filter(p => p.role !== 'voter')
  const mine = room.people[me]
  const myVote = room.votes[me]
  const votedCount = players.filter(p => room.votes[p.id] != null).length
  const story = room.stories.find(s => s.id === room.currentId)
  const result = room.revealed ? stats(room) : null
  const left = useCountdown(room.timer.endsAt)

  // Celebrate when a reveal lands on consensus (once per reveal).
  const celebrated = useRef(null)
  useEffect(() => {
    if (result?.consensus && celebrated.current !== room.revealedAt) { celebrated.current = room.revealedAt; confetti(2400) }
  }, [result?.consensus, room.revealedAt])

  const vote = (v, el) => {
    if (mine.role !== 'voter') return
    const value = myVote === v ? null : v
    if (value != null) sparkle(el)
    dispatch({ type: 'VOTE', pid: me, value })
  }

  return (
    <main className={`poker-room theme-${room.theme}`}>
      <div className="poker-bar">
        <a className="icon-btn" href="#/poker" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <RoomTitle room={room} canEdit={isHost} dispatch={dispatch} t={t} />
        <span className="deck-chip">{t.decks[room.deck]}</span>
        <span className="spacer" />
        {canRun && <TimerControl room={room} left={left} dispatch={dispatch} t={t} />}
        {!canRun && left != null && <span className={`timer-chip ${left <= 10 ? 'hot' : ''}`}><Icon name="timer" size={15} /> {fmtClock(left)}</span>}
        <button className="btn ghost sm" onClick={() => dispatch({ type: 'SET_ROLE', pid: me, role: mine.role === 'voter' ? 'spectator' : 'voter' })}>
          <Icon name={mine.role === 'voter' ? 'eye' : 'cards'} /> {mine.role === 'voter' ? t.spectate : t.play}
        </button>
        <RoomMenu room={room} isHost={isHost} me={me} dispatch={dispatch} t={t} />
        <InviteButton primary />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}
      <div className="poker-layout">
        <section className="poker-table-wrap">
          <div className="poker-story">
            <span className="eyebrow">{story ? t.current : t.freeRound}</span>
            <h2>{story ? story.title : room.name}</h2>
            {story?.link && <a href={story.link} target="_blank" rel="noreferrer noopener" className="small">{story.link}</a>}
          </div>
          <div className="poker-table">
            <div className="seats">
              {players.map(p => {
                const v = room.votes[p.id]
                return (
                  <div key={p.id} className={`seat ${p.id === me ? 'me' : ''}`}>
                    {room.revealed && v != null
                      ? <span className={`pcard face flip theme-${room.theme} ${result.low === v || result.high === v ? (result.spread > 2 ? 'edge' : '') : ''}`}><b>{v}</b></span>
                      : v != null ? <span className={`pcard back theme-${room.theme} drop`}><i>{THEMES[room.theme]?.emoji}</i></span>
                        : <span className="pcard empty">{room.revealed ? '–' : ''}</span>}
                    <span className="seat-name"><Avatar p={p} size={20} /> <span className="ellipsis">{p.name}{p.id === me ? ` (${t.you})` : ''}</span>{p.id === room.ownerId && <span className="host-tag">{t.host}</span>}</span>
                  </div>
                )
              })}
            </div>
            <div className="table-center">
              {!room.revealed ? <>
                <p className="muted">{votedCount ? fill(t.voted, { v: votedCount, t: players.length }) : t.waiting}</p>
                {canRun && <button className="btn primary lg" disabled={!votedCount} onClick={() => dispatch({ type: 'REVEAL' })}><Icon name="eye" /> {votedCount < players.length ? fill(t.revealN, { v: votedCount, t: players.length }) : t.reveal}</button>}
              </> : <Results room={room} result={result} story={story} canRun={canRun} dispatch={dispatch} t={t} deck={deck} />}
            </div>
          </div>
          {watchers.length > 0 && <p className="watchers muted small"><Icon name="eye" size={14} /> {t.spectators}: {watchers.map(p => p.name).join(', ')}</p>}
          {mine.role === 'voter' && (
            <div className="hand" role="group" aria-label={t.pick}>
              <span className="hand-label">{t.pick}</span>
              <div className="hand-cards">
                {deck.map(v => (
                  <button key={v} className={`pcard face pick theme-${room.theme} ${myVote === v ? 'sel' : ''}`} disabled={room.revealed} aria-pressed={myVote === v} onClick={e => vote(v, e.currentTarget)}>
                    <b>{v}</b>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <Stories room={room} canRun={canRun} dispatch={dispatch} t={t} />
      </div>
    </main>
  )
}

function Results({ room, result, story, canRun, dispatch, t, deck }) {
  const [choice, setChoice] = useState(result.suggestion)
  useEffect(() => setChoice(result.suggestion), [result.suggestion])
  const max = Math.max(...result.dist.map(d => d[1]), 1)
  const fmt = n => (Math.round(n * 10) / 10).toString()
  return (
    <div className="results">
      {result.consensus && <p className="consensus">{t.consensus}</p>}
      <div className="result-stats">
        {room.settings.showAverage && result.average != null && <div><b>{fmt(result.average)}</b><span>{t.average}</span></div>}
        {room.settings.showAverage && result.median != null && <div><b>{fmt(result.median)}</b><span>{t.median}</span></div>}
        <div><b>{result.agreement}%</b><span>{t.agreement}</span></div>
      </div>
      <div className="dist">
        {result.dist.map(([v, n]) => (
          <div key={v} className="dist-row"><span className="dist-v">{v}</span><span className="dist-bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><span className="dist-n">{n}</span></div>
        ))}
      </div>
      {result.spread > 2 && !result.consensus && <p className="spread-tip">{fill(t.spread, { low: result.low, high: result.high })}</p>}
      {canRun && <>
        {story && <div className="accept">
          <span className="muted small">{t.saveAs}</span>
          <select value={choice ?? ''} onChange={e => setChoice(e.target.value)} aria-label={t.saveAs}>
            {deck.filter(v => v !== '☕').map(v => <option key={v} value={v}>{v}{v === result.suggestion ? ` · ${t.suggest}` : ''}</option>)}
          </select>
          <button className="btn primary" onClick={() => dispatch({ type: 'ACCEPT', storyId: story.id, value: choice })}>{fill(t.save, { v: choice ?? '' })}</button>
        </div>}
        <div className="row center">
          <button className="btn ghost ghost" onClick={() => dispatch({ type: 'RESET' })}><Icon name="timer" /> {t.again}</button>
          {!story && <button className="btn primary" onClick={() => dispatch({ type: 'RESET' })}>{t.next}</button>}
        </div>
      </>}
    </div>
  )
}

function RoomTitle({ room, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(room.name)
  if (!editing) return <h1 className="room-name" title={canEdit ? t.rename : undefined} onDoubleClick={() => canEdit && (setName(room.name), setEditing(true))}>{room.name}</h1>
  const save = () => { if (name.trim() && name.trim() !== room.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="room-name-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function TimerControl({ room, left, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  return (
    <div className="dropdown" ref={ref}>
      <button className={`btn ghost sm ${left != null ? (left <= 10 ? 'timer-hot' : 'on-soft') : ''}`} onClick={() => setOpen(o => !o)}><Icon name="timer" /> {left != null ? fmtClock(left) : t.timer}</button>
      {open && <div className="menu right">
        {[30, 60, 120, 300].map(s => <button key={s} className="menu-item" onClick={() => { dispatch({ type: 'TIMER', seconds: s }); setOpen(false) }}>{s < 60 ? `${s}s` : `${s / 60} min`}</button>)}
        {room.timer.endsAt && <button className="menu-item danger" onClick={() => { dispatch({ type: 'TIMER', seconds: 0 }); setOpen(false) }}>{t.stop}</button>}
      </div>}
    </div>
  )
}

function RoomMenu({ room, isHost, me, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { identity } = useStore()
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const people = Object.values(room.people).filter(p => !p.left && p.id !== me)
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(room.id, identity.secret).finally(() => { forgetDoc(KIND, room.id); navigate('/poker') })
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        {isHost ? <>
          <div className="menu-title">{t.settings}</div>
          {[['hostOnly', t.hostOnly], ['autoReveal', t.autoReveal], ['showAverage', t.showAverage], ['specials', t.specials]].map(([k, label]) => (
            <label key={k} className="menu-item check"><input type="checkbox" checked={room.settings[k] ?? k === 'specials'} onChange={e => dispatch({ type: 'SETTINGS', patch: { [k]: e.target.checked } })} /> {label}</label>
          ))}
          <div className="menu-title">{t.deck}</div>
          <div className="menu-chips">{DECK_IDS.filter(d => d !== 'custom' || room.customDeck?.length).map(d => <button key={d} className={`chip-btn ${room.deck === d ? 'sel' : ''}`} onClick={() => dispatch({ type: 'SET_DECK', deck: d })}>{t.decks[d]}</button>)}</div>
          <div className="menu-title">{t.theme}</div>
          <div className="menu-chips">{Object.keys(THEMES).map(k => <button key={k} className={`chip-btn ${room.theme === k ? 'sel' : ''}`} onClick={() => dispatch({ type: 'SET_THEME', theme: k })}>{THEMES[k].emoji} {t.themes[k]}</button>)}</div>
          {people.length > 0 && <div className="menu-title">{t.players}</div>}
          {people.map(p => (
            <div key={p.id} className="menu-item person-row">
              <Avatar p={p} size={20} /> <span className="grow ellipsis">{p.name}</span>
              <button className="chip-btn" onClick={() => { dispatch({ type: 'SET_HOST', pid: p.id }); setOpen(false) }}>{t.makeHost}</button>
              <button className="chip-btn" onClick={() => dispatch({ type: 'LEAVE', pid: p.id })}>{t.removeP}</button>
            </div>
          ))}
          {(room.creatorId ?? room.ownerId) === me && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteRoom}</button>}
        </> : <>
          <p className="menu-hint">{t.hostTip}</p>
          <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(KIND, room.id); navigate('/poker') }}><Icon name="logout" /> {t.leave}</button>
        </>}
      </div>}
    </div>
  )
}

function Stories({ room, canRun, dispatch, t }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const add = e => {
    e.preventDefault()
    const titles = text.split('\n').map(s => s.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 100)
    if (titles.length) dispatch({ type: 'ADD_STORIES', titles })
    setText('')
    setAdding(false)
  }
  const done = room.stories.filter(s => s.estimate != null)
  const points = done.reduce((sum, s) => sum + (Number(s.estimate === '½' ? 0.5 : s.estimate) || 0), 0)
  const download = () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([storiesCsv(room)], { type: 'text/csv' })), download: `${room.name || 'stories'}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <aside className="poker-stories">
      <div className="tool-card-head">
        <h2>{t.stories} <span className="muted small">{room.stories.length || ''}</span></h2>
        {canRun && <button className="btn ghost sm" onClick={() => setAdding(a => !a)}><Icon name="plus" /> {t.add}</button>}
      </div>
      {adding && <form onSubmit={add} className="story-add">
        <textarea autoFocus rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={t.storiesPh} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e) }} />
        <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>×</button><button className="btn primary sm" disabled={!text.trim()}>{t.addStories}</button></div>
      </form>}
      {room.stories.length === 0 && !adding && <p className="muted small">{t.noStories}</p>}
      <ol className="story-list">
        {room.stories.map(s => (
          <li key={s.id} className={`${s.id === room.currentId ? 'current' : ''} ${s.estimate != null ? 'done' : ''}`}>
            <button className="story-title" disabled={!canRun || s.id === room.currentId} onClick={() => dispatch({ type: 'SELECT_STORY', storyId: s.id })} title={canRun ? t.pickStory : undefined}>{s.title}</button>
            {s.estimate != null ? <span className="story-est">{s.estimate}</span> : s.id === room.currentId ? <span className="story-now">●</span> : null}
            {canRun && <button className="icon-btn story-x" aria-label={t.remove} onClick={() => dispatch({ type: 'REMOVE_STORY', storyId: s.id })}><Icon name="x" size={13} /></button>}
          </li>
        ))}
      </ol>
      {room.stories.length > 0 && <div className="story-foot">
        <span className="muted small">{fill(t.total, { n: Math.round(points * 10) / 10, d: done.length, t: room.stories.length })}</span>
        <button className="btn ghost sm" onClick={download}><Icon name="download" /> {t.exportCsv}</button>
      </div>}
    </aside>
  )
}
