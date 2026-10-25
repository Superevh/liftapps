import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, Avatar, useClickOutside } from '../core/ui.jsx'
import { confetti, sparkle } from '../core/fx.js'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, fill, ago, HowTo } from '../core/tools-ui.jsx'
import { HOWTO } from '../core/howto.js'
import { CATEGORIES, BINGO_SETS } from './questions.js'
import { qidsOf, questionOf, drawQuestion, optionsOf, bingoCard, bingoWord, linesDone, cellsToGo, FREE, newRoom, reduce } from './model.js'
import './icebreakers.css'

const T = {
  en: {
    eyebrow: 'Icebreakers & bingo', title: 'Warm up the room in a minute', lead: 'Draw a question for the whole team, run a check-in where everyone answers before the reveal, or play meeting bingo. Free, no sign-up.',
    startCheckin: 'Live check-in room', startBingo: 'Bingo game', checkinRoom: 'Team check-in', bingoRoom: 'Meeting bingo',
    cats: { quick: 'Quick & fun', know: 'Get to know you', work: 'Work style', deeper: 'Deeper', checkin: 'Check-ins', remote: 'Remote teams', wyr: 'Would you rather', tot: 'This or that' },
    favs: 'Favourites', deck: 'Question deck', draw: 'Draw a question', drawFirst: 'Pick one or more categories and draw your first question.', back: 'Previous', fav: 'Save to favourites', unfav: 'Remove from favourites',
    copy: 'Copy', copied: 'Copied!', present: 'Present', exitPresent: 'Close', presentHint: 'Click or press → for the next question · Esc to close', allSeen: 'You’ve seen every question here, so they’re back in the deck.', noFavs: 'Star questions to collect them here.',
    left: '{n} not seen yet', resetSeen: 'Reset', kindHint: { word: 'Answer in one word', scale: 'Answer from 1 to 5', weather: 'Answer with a weather', esvp: 'Explorer, shopper, vacationer or prisoner?' },
    speakers: 'Speaker order', speakersHint: 'One name per line. Shuffle for a fair order and keep everyone to time.', namesPh: 'Alex\nSam\nPriya', shuffle: 'Shuffle', perPerson: 'Each', start: 'Start', next: 'Next speaker', done: 'Everyone has spoken 🎉', timeUp: 'Time’s up', pause: 'Pause', resume: 'Resume', restart: 'Restart',
    bingo: 'Meeting bingo', bingoLead: 'Spot the moments, mark your card, shout BINGO for a full line.', sets: { meeting: 'Video calls', agile: 'Agile buzzwords', retro: 'Retro moments', office: 'Office life' },
    playHere: 'Play a card here', newCard: 'New card', print: 'Print cards', cards: 'Cards', free: 'Free', bingoWin: 'BINGO!',
    yourRooms: 'Your rooms', noRooms: 'Rooms you create or join show up here.', remove: 'Remove', created: 'Created {d}',
    tabCheckin: 'Check-in', tabBingo: 'Bingo', answered: '{n} of {t} answered', noAnswers: 'No answers yet', reveal: 'Reveal answers', nextQ: 'Next question', categories: 'Categories',
    waitHost: 'Waiting for {name} to draw a question…', yourAnswer: 'Your answer', share: 'Share', update: 'Update', change: 'Change', hidden: 'Answers stay hidden until the reveal.', anon: 'Someone',
    esvp: { explorer: ['Explorer', 'Keen to find new ideas'], shopper: ['Shopper', 'Happy to take home one useful thing'], vacationer: ['Vacationer', 'Glad of a break from the usual'], prisoner: ['Prisoner', 'Would rather be somewhere else'] },
    weather: { sun: 'Sunny', part: 'Some clouds', rain: 'Rainy', storm: 'Stormy', rainbow: 'Rainbow after rain' },
    earlier: 'Earlier questions', startGame: 'Start a game', waitGame: 'Waiting for {name} to start a game…', newGame: 'New game', endGame: 'End game', winners: 'Winners', noWinners: 'No one has a line yet.', closest: 'Closest to bingo', toGo: '{n} to go', youWon: 'You got a line!', wonBy: 'BINGO for {name}!',
    settings: 'Room settings', anonymous: 'Hide names on revealed answers', open: 'Anyone can draw and reveal', leave: 'Leave room', deleteRoom: 'Delete room', confirm: 'Click again to confirm', hostTip: 'The host runs this room.', rename: 'Rename', you: 'you', host: 'Host', allRooms: 'All rooms', people: 'In the room',
  },
  zh: {
    eyebrow: '破冰与宾果', title: '一分钟让会议热起来', lead: '为整个团队抽一个问题，做一次人人作答、同时揭晓的签到，或者玩会议宾果。免费，无需注册。',
    startCheckin: '实时签到房间', startBingo: '宾果游戏', checkinRoom: '团队签到', bingoRoom: '会议宾果',
    cats: { quick: '轻松趣味', know: '彼此认识', work: '工作方式', deeper: '深入交流', checkin: '会前签到', remote: '远程团队', wyr: '你更愿意', tot: '二选一' },
    favs: '收藏', deck: '问题卡组', draw: '抽一个问题', drawFirst: '选一个或多个分类，抽出第一个问题。', back: '上一个', fav: '收藏', unfav: '取消收藏',
    copy: '复制', copied: '已复制！', present: '投屏', exitPresent: '关闭', presentHint: '点击或按 → 换下一个问题 · Esc 关闭', allSeen: '这里的问题都看过了，已重新放回卡组。', noFavs: '给问题点星标，就会收藏到这里。',
    left: '还有 {n} 个没看过', resetSeen: '重置', kindHint: { word: '用一个词回答', scale: '用 1 到 5 回答', weather: '用一种天气回答', esvp: '探索者、购物者、度假者还是囚徒？' },
    speakers: '发言顺序', speakersHint: '每行一个名字。随机排序更公平，还能给每人计时。', namesPh: '小王\n小李\n小张', shuffle: '打乱', perPerson: '每人', start: '开始', next: '下一位', done: '大家都发过言了 🎉', timeUp: '时间到', pause: '暂停', resume: '继续', restart: '重新开始',
    bingo: '会议宾果', bingoLead: '留意会上的瞬间，在卡上标记，连成一条线就喊宾果！', sets: { meeting: '视频会议', agile: '敏捷术语', retro: '复盘瞬间', office: '办公室日常' },
    playHere: '在这里玩一张', newCard: '换一张', print: '打印卡片', cards: '张数', free: '免费格', bingoWin: '宾果！',
    yourRooms: '我的房间', noRooms: '你创建或加入的房间会显示在这里。', remove: '移除', created: '创建于 {d}',
    tabCheckin: '签到', tabBingo: '宾果', answered: '{n}/{t} 人已回答', noAnswers: '还没有人回答', reveal: '揭晓答案', nextQ: '下一个问题', categories: '分类',
    waitHost: '等待 {name} 抽题…', yourAnswer: '你的回答', share: '提交', update: '更新', change: '修改', hidden: '揭晓前，答案对其他人隐藏。', anon: '某人',
    esvp: { explorer: ['探索者', '渴望发现新想法'], shopper: ['购物者', '能带走一点有用的就满足'], vacationer: ['度假者', '很高兴能换换脑子'], prisoner: ['囚徒', '其实更想去别处'] },
    weather: { sun: '晴天', part: '多云', rain: '下雨', storm: '暴风雨', rainbow: '雨后彩虹' },
    earlier: '之前的问题', startGame: '开始游戏', waitGame: '等待 {name} 开始游戏…', newGame: '新一局', endGame: '结束游戏', winners: '赢家', noWinners: '还没有人连成一线。', closest: '离宾果最近', toGo: '还差 {n} 格', youWon: '你连成一线了！', wonBy: '{name} 宾果了！',
    settings: '房间设置', anonymous: '揭晓时隐藏名字', open: '任何人都能抽题和揭晓', leave: '离开房间', deleteRoom: '删除房间', confirm: '再点一次确认', hostTip: '由主持人控制此房间。', rename: '重命名', you: '你', host: '主持人', allRooms: '所有房间', people: '房间里的人',
  },
}

const KIND = 'icebreakers'
const FAVS = 'lift-ib-favs'
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage blocked */ } }
const useSaved = (key, fallback) => {
  const [value, setValue] = useState(() => load(key, fallback))
  useEffect(() => save(key, value), [key, value])
  return [value, setValue]
}
const catOf = id => CATEGORIES.find(c => c.id === id)

// ---------- home ----------

export function IcebreakersHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [rooms, setRooms] = useState(() => rememberedDocs(KIND))
  const [setId, setSetId] = useSaved('lift-ib-set', 'meeting')
  const create = mode => {
    if (!backend) return
    const id = newDocId('ib')
    const owner = { id: identity.id, name: identity.name || 'Host', color: identity.color }
    const room = newRoom({ id, name: mode === 'bingo' ? t.bingoRoom : t.checkinRoom, owner, at: Date.now(), mode, setId })
    setBusy(true)
    createDoc(id, room, identity.secret).then(() => {
      rememberDoc(KIND, { id, name: room.name, at: room.createdAt })
      navigate(`/icebreakers/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page ib-home">
      <section className="tool-hero ib-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
          <div className="row wrap ib-hero-actions">
            <button className="btn primary lg" disabled={busy || !backend} onClick={() => create('checkin')}><Icon name="users" /> {t.startCheckin}</button>
            <button className="btn light-outline lg" disabled={busy || !backend} onClick={() => create('bingo')}><Icon name="grid" /> {t.startBingo}</button>
          </div>
          {error && <p className="auth-error">{error}</p>}
        </div>
        <div className="ib-hero-cards" aria-hidden="true">
          <span className="ib-mini">🌈</span><span className="ib-mini">🧭</span><span className="ib-mini">☕</span>
        </div>
      </section>
      <HowTo tool="icebreakers" content={HOWTO.icebreakers} />
      <div className="ib-home-grid">
        <Deck t={t} lang={lang} />
        <div className="ib-side">
          <SpeakerOrder t={t} />
          <section className="tool-card">
            <h2>{t.yourRooms}</h2>
            {rooms.length ? (
              <ul className="doc-list">
                {rooms.map(r => (
                  <li key={r.id}>
                    <a href={`#/icebreakers/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{fill(t.created, { d: ago(r.at, lang) })}</span></a>
                    <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, r.id); setRooms(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{t.noRooms}</p>}
          </section>
        </div>
      </div>
      <SoloBingo t={t} lang={lang} setId={setId} setSetId={setSetId} />
    </main>
  )
}

function CategoryChips({ cats, onToggle, t, extra }) {
  return (
    <div className="chip-row ib-cats">
      {CATEGORIES.map(c => (
        <button type="button" key={c.id} className={`chip-btn ${cats.includes(c.id) ? 'sel' : ''}`} aria-pressed={cats.includes(c.id)} onClick={() => onToggle(c.id)}>{c.emoji} {t.cats[c.id]}</button>
      ))}
      {extra}
    </div>
  )
}

// Solo deck: draws without repeats (remembered in this browser), with favourites and a present mode.
function Deck({ t, lang }) {
  const [cats, setCats] = useSaved('lift-ib-cats', ['quick'])
  const [favs, setFavs] = useSaved(FAVS, [])
  const [seen, setSeen] = useSaved('lift-ib-seen', [])
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [trail, setTrail] = useState([])
  const [note, setNote] = useState(null)
  const [copied, setCopied] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const qid = trail[trail.length - 1]
  const q = qid ? questionOf(qid, lang) : null
  const pool = onlyFavs ? favs : cats.flatMap(qidsOf)
  const unseen = pool.filter(x => !seen.includes(x)).length

  const draw = () => {
    if (!pool.length) return
    const fresh = pool.filter(x => !seen.includes(x) && x !== qid)
    const from = fresh.length ? fresh : pool.filter(x => x !== qid)
    const next = (from.length ? from : pool)[Math.floor(Math.random() * (from.length || pool.length))]
    setNote(fresh.length ? null : t.allSeen)
    setSeen(s => fresh.length ? [...s, next] : [...s.filter(x => !pool.includes(x)), next])
    setTrail(tr => [...tr, next].slice(-50))
  }
  const toggleCat = id => { setOnlyFavs(false); setCats(cs => cs.includes(id) ? (cs.length > 1 ? cs.filter(c => c !== id) : cs) : [...cs, id]) }
  const isFav = qid && favs.includes(qid)
  const copy = () => navigator.clipboard?.writeText(q.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) })

  // → or N draws the next question when the focus isn't in a text field.
  const drawRef = useRef(draw)
  drawRef.current = draw
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'n') { e.preventDefault(); drawRef.current() }
      if (e.key === 'Escape') setPresenting(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="tool-card ib-deck">
      <div className="tool-card-head">
        <h2>{t.deck}</h2>
        <span className="muted small">{fill(t.left, { n: unseen })} · <button className="link-btn" onClick={() => setSeen(s => s.filter(x => !pool.includes(x)))}>{t.resetSeen}</button></span>
      </div>
      <CategoryChips cats={onlyFavs ? [] : cats} onToggle={toggleCat} t={t}
        extra={<button type="button" className={`chip-btn ${onlyFavs ? 'sel' : ''}`} aria-pressed={onlyFavs} onClick={() => setOnlyFavs(f => !f)}>★ {t.favs} ({favs.length})</button>} />
      <QuestionCard q={q} t={t} empty={onlyFavs && !favs.length ? t.noFavs : t.drawFirst} flipKey={trail.length} onClick={draw} />
      {note && <p className="muted small ib-note">{note}</p>}
      <div className="row wrap ib-deck-actions">
        <button className="btn primary" onClick={draw} disabled={!pool.length}><Icon name="sparkle" /> {t.draw}</button>
        <button className="btn ghost" onClick={() => setTrail(tr => tr.slice(0, -1))} disabled={trail.length < 2}><Icon name="left" /> {t.back}</button>
        <span className="spacer" />
        {q && <>
          <button className={`icon-btn ${isFav ? 'ib-fav-on' : ''}`} aria-pressed={!!isFav} aria-label={isFav ? t.unfav : t.fav} title={isFav ? t.unfav : t.fav} onClick={() => setFavs(f => isFav ? f.filter(x => x !== qid) : [...f, qid])}><Icon name="star" /></button>
          <button className="icon-btn" aria-label={t.copy} title={copied ? t.copied : t.copy} onClick={copy}><Icon name={copied ? 'check' : 'copy'} /></button>
          <button className="btn ghost" onClick={() => { setPresenting(true); document.documentElement.requestFullscreen?.().catch(() => {}) }}><Icon name="present" /> {t.present}</button>
        </>}
      </div>
      {presenting && q && (
        <div className="ib-present" role="dialog" aria-modal="true" onClick={draw}>
          <button className="btn light-outline ib-present-x" onClick={e => { e.stopPropagation(); setPresenting(false); if (document.fullscreenElement) document.exitFullscreen?.() }}><Icon name="x" /> {t.exitPresent}</button>
          <div key={trail.length} className="ib-present-q ib-flip">
            <span className="ib-q-cat">{catOf(q.cat).emoji} {t.cats[q.cat]}</span>
            <p>{q.text}</p>
            {t.kindHint[q.kind] && <span className="ib-q-hint">{t.kindHint[q.kind]}</span>}
          </div>
          <span className="ib-present-hint">{t.presentHint}</span>
        </div>
      )}
    </section>
  )
}

function QuestionCard({ q, t, empty, flipKey, onClick }) {
  if (!q) return <div className="ib-qcard empty"><p className="muted">{empty}</p></div>
  return (
    <div key={flipKey} className={`ib-qcard ib-flip cat-${q.cat}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <span className="ib-q-cat">{catOf(q.cat).emoji} {t.cats[q.cat]}</span>
      <p className="ib-q-text">{q.text}</p>
      {t.kindHint[q.kind] && <span className="ib-q-hint">{t.kindHint[q.kind]}</span>}
    </div>
  )
}

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Shuffled speaking order with a per-person countdown (local only).
function SpeakerOrder({ t }) {
  const [names, setNames] = useSaved('lift-ib-names', '')
  const [secs, setSecs] = useSaved('lift-ib-secs', 60)
  const [order, setOrder] = useState([])
  const [at, setAt] = useState(-1)
  const [endsAt, setEndsAt] = useState(null)
  const [pausedLeft, setPausedLeft] = useState(null)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const h = setInterval(() => tick(x => x + 1), 250)
    return () => clearInterval(h)
  }, [endsAt])
  const left = pausedLeft ?? (endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null)
  const list = names.split('\n').map(s => s.trim()).filter(Boolean)
  const shuffled = () => {
    const a = [...list]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    return a
  }
  const go = i => { setAt(i); setPausedLeft(null); setEndsAt(i < order.length ? Date.now() + secs * 1000 : null) }
  const start = () => { const o = order.length ? order : shuffled(); setOrder(o); setAt(0); setPausedLeft(null); setEndsAt(Date.now() + secs * 1000) }
  const pause = () => { if (pausedLeft != null) { setEndsAt(Date.now() + pausedLeft * 1000); setPausedLeft(null) } else setPausedLeft(left) }
  return (
    <section className="tool-card ib-speakers">
      <h2>{t.speakers}</h2>
      <p className="muted small">{t.speakersHint}</p>
      {at < 0 ? <>
        <textarea rows={4} value={names} onChange={e => { setNames(e.target.value); setOrder([]) }} placeholder={t.namesPh} aria-label={t.speakers} />
        {order.length > 0 && <ol className="ib-order">{order.map((n, i) => <li key={i}>{n}</li>)}</ol>}
        <div className="row wrap">
          <button className="btn ghost" disabled={list.length < 2} onClick={() => setOrder(shuffled())}><Icon name="sparkle" /> {t.shuffle}</button>
          <label className="muted small ib-secs">{t.perPerson}
            <select value={secs} onChange={e => setSecs(Number(e.target.value))}>{[30, 60, 90, 120, 180].map(s => <option key={s} value={s}>{clock(s)}</option>)}</select>
          </label>
          <span className="spacer" />
          <button className="btn primary" disabled={!list.length} onClick={start}><Icon name="timer" /> {t.start}</button>
        </div>
      </> : <>
        <ol className="ib-order live">
          {order.map((n, i) => <li key={i} className={i === at ? 'now' : i < at ? 'done' : ''}>{n}{i === at && left != null && <span className={`ib-clock ${left === 0 ? 'hot' : ''}`}>{left === 0 ? t.timeUp : clock(left)}</span>}</li>)}
        </ol>
        {at >= order.length && <p className="ib-note">{t.done}</p>}
        <div className="row wrap">
          {at < order.length && <button className="btn primary" onClick={() => go(at + 1)}><Icon name="right" /> {t.next}</button>}
          {at < order.length && <button className="btn ghost" onClick={pause}>{pausedLeft != null ? t.resume : t.pause}</button>}
          <span className="spacer" />
          <button className="btn ghost" onClick={() => { setAt(-1); setEndsAt(null); setPausedLeft(null) }}>{t.restart}</button>
        </div>
      </>}
    </section>
  )
}

// ---------- bingo (solo and print) ----------

function SetChips({ setId, onPick, t }) {
  return (
    <div className="chip-row">
      {BINGO_SETS.map(s => <button type="button" key={s.id} className={`chip-btn ${setId === s.id ? 'sel' : ''}`} aria-pressed={setId === s.id} onClick={() => onPick(s.id)}>{s.emoji} {t.sets[s.id]}</button>)}
    </div>
  )
}

function BingoGrid({ setId, seed, marks, onMark, lang, t, small }) {
  const card = useMemo(() => bingoCard(setId, seed), [setId, seed])
  const on = new Set(marks)
  const lit = new Set(linesDone(marks).flat())
  return (
    <div className={`ib-bingo ${small ? 'small' : ''}`} role="grid">
      {['B', 'I', 'N', 'G', 'O'].map(l => <span key={l} className="ib-bingo-head" aria-hidden="true">{l}</span>)}
      {card.map((w, i) => i === FREE
        ? <span key={i} className="ib-cell free on">⭐<small>{t.free}</small></span>
        : <button key={i} type="button" disabled={!onMark} className={`ib-cell ${on.has(i) ? 'on' : ''} ${lit.has(i) ? 'lit' : ''}`} aria-pressed={on.has(i)} onClick={e => onMark?.(i, e.currentTarget)}>{bingoWord(setId, w, lang)}</button>)}
    </div>
  )
}

const newSeed = () => Math.random().toString(36).slice(2, 10)

function SoloBingo({ t, lang, setId, setSetId }) {
  const [solo, setSolo] = useSaved('lift-ib-solo', null)
  const [count, setCount] = useState(8)
  const [printing, setPrinting] = useState(null)
  const won = solo && linesDone(solo.marks).length > 0
  const wasWon = useRef(won)
  useEffect(() => { if (won && !wasWon.current) confetti(2400); wasWon.current = won }, [won])

  // Renders the printable sheet, prints it, then tidies up.
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('ib-printing')
    const done = () => { document.body.classList.remove('ib-printing'); setPrinting(null) }
    window.addEventListener('afterprint', done, { once: true })
    const h = setTimeout(() => window.print(), 50)
    return () => { clearTimeout(h); window.removeEventListener('afterprint', done); document.body.classList.remove('ib-printing') }
  }, [printing])

  const pick = id => { setSetId(id); if (solo) setSolo({ setId: id, seed: newSeed(), marks: [] }) }
  const mark = (i, el) => {
    const marks = solo.marks.includes(i) ? solo.marks.filter(x => x !== i) : [...solo.marks, i]
    if (!solo.marks.includes(i)) sparkle(el)
    setSolo({ ...solo, marks })
  }
  return (
    <section className="tool-card ib-solo-bingo">
      <div className="tool-card-head"><h2>{t.bingo}</h2></div>
      <p className="muted">{t.bingoLead}</p>
      <SetChips setId={setId} onPick={pick} t={t} />
      <div className="row wrap">
        <button className="btn primary" onClick={() => setSolo({ setId, seed: newSeed(), marks: [] })}><Icon name="grid" /> {solo ? t.newCard : t.playHere}</button>
        <span className="spacer" />
        <label className="muted small ib-secs">{t.cards}
          <select value={count} onChange={e => setCount(Number(e.target.value))}>{[1, 4, 8, 12, 16, 24, 30].map(n => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <button className="btn ghost" onClick={() => setPrinting(Array.from({ length: count }, newSeed))}><Icon name="print" /> {t.print}</button>
      </div>
      {solo && <>
        {won && <p className="ib-win" role="status">{t.bingoWin} 🎉</p>}
        <BingoGrid setId={solo.setId} seed={solo.seed} marks={solo.marks} onMark={mark} lang={lang} t={t} />
      </>}
      {printing && (
        <div className="ib-print">
          {printing.map(seed => (
            <div key={seed} className="ib-print-card">
              <h3>{BINGO_SETS.find(s => s.id === setId).emoji} {t.bingo} · {t.sets[setId]}</h3>
              <BingoGrid setId={setId} seed={seed} marks={[]} lang={lang} t={t} small />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- live room ----------

export function IcebreakerRoom({ id }) {
  const { identity } = useStore()
  const { status, doc: room, dispatch, error } = useLiveDoc(id, reduce)
  const me = identity.id
  const person = useMemo(() => ({ id: me, name: identity.name || 'Guest', color: identity.color }), [me, identity.name, identity.color])
  const known = room?.people[me]

  // Everyone joins on arrival (once they have a name); name or colour changes are carried over.
  useEffect(() => {
    if (!room || !identity.name) return
    if (known && !known.left && known.name === person.name && known.color === person.color) return
    dispatch({ type: 'JOIN', person })
  }, [room && known, identity.name, person, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room) rememberDoc(KIND, { id, name: room.name, at: room.createdAt })
  }, [id, room?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'ready') return <DocStatus status={status} />
  return <Room room={room} me={me} dispatch={dispatch} error={error} />
}

function Room({ room, me, dispatch, error }) {
  const lang = useLang()
  const t = T[lang]
  const [tab, setTab] = useState(room.startMode === 'bingo' ? 'bingo' : 'checkin')
  const isHost = room.ownerId === me
  const canLead = isHost || room.settings.open
  const people = Object.values(room.people).filter(p => !p.left).sort((a, b) => a.joinedAt - b.joinedAt)
  const host = room.people[room.ownerId]
  const nameOf = pid => room.people[pid]?.name ?? '?'

  // Celebrate each new bingo winner for everyone in the room (not the ones already there on load).
  const seenWinners = useRef(room.bingo ? `${room.bingo.id}:${room.bingo.winners.length}` : '')
  const [toast, setToast] = useState(null)
  useEffect(() => {
    const g = room.bingo
    const key = g ? `${g.id}:${g.winners.length}` : ''
    if (key === seenWinners.current) return
    const prev = seenWinners.current.split(':')
    seenWinners.current = key
    if (!g || !g.winners.length || (prev[0] === g.id && Number(prev[1]) >= g.winners.length)) return
    const w = g.winners[g.winners.length - 1]
    confetti(2600)
    setToast(w.pid === me ? t.youWon : fill(t.wonBy, { name: nameOf(w.pid) }))
    const h = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(h)
  }, [room.bingo?.id, room.bingo?.winners.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="tool-page ib-room">
      <div className="ib-bar">
        <a className="icon-btn" href="#/icebreakers" aria-label={t.allRooms} title={t.allRooms}><Icon name="left" /></a>
        <RoomTitle room={room} canEdit={isHost} dispatch={dispatch} t={t} />
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'checkin'} className={tab === 'checkin' ? 'on' : ''} onClick={() => setTab('checkin')}>{t.tabCheckin}</button>
          <button role="tab" aria-selected={tab === 'bingo'} className={tab === 'bingo' ? 'on' : ''} onClick={() => setTab('bingo')}>{t.tabBingo}</button>
        </div>
        <span className="spacer" />
        <div className="ib-faces" title={people.map(p => p.name).join(', ')} aria-label={`${t.people}: ${people.length}`}>
          {people.slice(0, 6).map(p => <Avatar key={p.id} p={p} size={26} />)}
          {people.length > 6 && <span className="ib-more">+{people.length - 6}</span>}
        </div>
        <RoomMenu room={room} isHost={isHost} me={me} dispatch={dispatch} t={t} />
        <InviteButton primary />
      </div>
      {error && <div className="sync-banner" role="alert">{error}</div>}
      {toast && <div className="ib-toast" role="status">🎉 {toast}</div>}
      {tab === 'checkin'
        ? <Checkin room={room} me={me} people={people} canLead={canLead} host={host} dispatch={dispatch} t={t} lang={lang} nameOf={nameOf} />
        : <Bingo room={room} me={me} people={people} canLead={canLead} host={host} dispatch={dispatch} t={t} lang={lang} nameOf={nameOf} />}
    </main>
  )
}

function RoomTitle({ room, canEdit, dispatch, t }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(room.name)
  if (!editing) return <h1 className="ib-room-name" title={canEdit ? t.rename : undefined} onDoubleClick={() => canEdit && (setName(room.name), setEditing(true))}>{room.name}</h1>
  const done = () => { if (name.trim() && name.trim() !== room.name) dispatch({ type: 'RENAME', name: name.trim() }); setEditing(false) }
  return <input className="ib-room-input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={done} onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') setEditing(false) }} aria-label={t.rename} />
}

function RoomMenu({ room, isHost, me, dispatch, t }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { identity } = useStore()
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const del = () => {
    if (!confirm) return setConfirm(true)
    deleteDoc(room.id, identity.secret).finally(() => { forgetDoc(KIND, room.id); navigate('/icebreakers') })
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" aria-label={t.settings} title={t.settings} onClick={() => setOpen(o => !o)}><Icon name="settings" /></button>
      {open && <div className="menu right room-menu">
        {isHost ? <>
          <div className="menu-title">{t.settings}</div>
          {[['anonymous', t.anonymous], ['open', t.open]].map(([k, label]) => (
            <label key={k} className="menu-item check"><input type="checkbox" checked={!!room.settings[k]} onChange={e => dispatch({ type: 'SETTINGS', patch: { [k]: e.target.checked } })} /> {label}</label>
          ))}
          <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteRoom}</button>
        </> : <>
          <p className="menu-hint">{t.hostTip}</p>
          <button className="menu-item" onClick={() => { dispatch({ type: 'LEAVE', pid: me }); forgetDoc(KIND, room.id); navigate('/icebreakers') }}><Icon name="logout" /> {t.leave}</button>
        </>}
      </div>}
    </div>
  )
}

// How one answer reads: option answers get their emoji and label, text answers are shown as typed.
function answerLabel(q, value, t) {
  if (q.kind === 'scale') return `${optionsOf(q).find(o => o.value === value)?.emoji ?? ''} ${value}`
  if (q.kind === 'weather') return `${optionsOf(q).find(o => o.value === value)?.emoji ?? ''} ${t.weather[value] ?? value}`
  if (q.kind === 'esvp') return `${optionsOf(q).find(o => o.value === value)?.emoji ?? ''} ${t.esvp[value]?.[0] ?? value}`
  if (q.kind === 'choice') return q.options[value] ?? String(value)
  return String(value)
}

function Checkin({ room, me, people, canLead, host, dispatch, t, lang, nameOf }) {
  const round = room.round
  const q = round ? questionOf(round.qid, lang) : null
  const answered = round ? Object.keys(round.answers).length : 0
  const draw = () => {
    const qid = drawQuestion(room.cats.length ? room.cats : ['checkin'], room.asked)
    if (qid) dispatch({ type: 'DRAW', qid })
  }
  const toggleCat = id => dispatch({ type: 'CATS', cats: room.cats.includes(id) ? room.cats.filter(c => c !== id) : [...room.cats, id] })
  return (
    <div className="ib-checkin">
      {canLead && (
        <section className="tool-card ib-lead">
          <span className="field-label">{t.categories}</span>
          <CategoryChips cats={room.cats} onToggle={toggleCat} t={t} />
          <div className="row end">
            <button className="btn primary" onClick={draw} disabled={!room.cats.length}><Icon name="sparkle" /> {round ? t.nextQ : t.draw}</button>
          </div>
        </section>
      )}
      {!q ? <div className="ib-qcard empty"><p className="muted">{canLead ? t.drawFirst : fill(t.waitHost, { name: host?.name ?? t.host })}</p></div> : <>
        <QuestionCard q={q} t={t} flipKey={round.id} />
        <section className="tool-card ib-round">
          <div className="ib-progress">
            <span className="muted">{answered ? fill(t.answered, { n: answered, t: people.length }) : t.noAnswers}</span>
            <span className="ib-faces">{people.map(p => <span key={p.id} className={`ib-face ${round.answers[p.id] != null ? 'in' : ''}`} title={p.name}><Avatar p={p} size={24} /></span>)}</span>
            <span className="spacer" />
            {canLead && !round.revealed && <button className="btn reveal" disabled={!answered} onClick={() => dispatch({ type: 'REVEAL' })}><Icon name="eye" /> {t.reveal}</button>}
          </div>
          {!round.revealed
            ? <AnswerBox key={round.id} q={q} value={round.answers[me]} onAnswer={v => dispatch({ type: 'ANSWER', pid: me, value: v })} t={t} />
            : <Answers q={q} round={round} anonymous={round.anon || room.settings.anonymous} t={t} nameOf={nameOf} room={room} />}
        </section>
      </>}
      {room.history.length > 0 && (
        <details className="tool-card ib-history">
          <summary>{t.earlier} ({room.history.length})</summary>
          {room.history.map(h => {
            const hq = questionOf(h.qid, lang)
            return hq && (
              <div key={`${h.qid}${h.at}`} className="ib-history-item">
                <b>{hq.text}</b>
                <ul>{Object.entries(h.answers).sort((h.anon ?? room.settings.anonymous) ? (x, y) => String(x[1]).localeCompare(String(y[1])) : () => 0).map(([pid, v]) => <li key={pid}><span className="muted">{(h.anon ?? room.settings.anonymous) ? t.anon : nameOf(pid)}:</span> {answerLabel(hq, v, t)}</li>)}</ul>
              </div>
            )
          })}
        </details>
      )}
    </div>
  )
}

function AnswerBox({ q, value, onAnswer, t }) {
  const [text, setText] = useState(typeof value === 'string' ? value : '')
  const opts = optionsOf(q)
  if (opts) {
    return (
      <div className={`ib-options kind-${q.kind}`} role="group" aria-label={t.yourAnswer}>
        {opts.map(o => (
          <button key={o.value} type="button" className={`ib-option ${value === o.value ? 'sel' : ''}`} aria-pressed={value === o.value} onClick={e => { if (value !== o.value) sparkle(e.currentTarget); onAnswer(value === o.value ? null : o.value) }}>
            {o.emoji && <span className="ib-option-emoji">{o.emoji}</span>}
            <span className="ib-option-label">
              {q.kind === 'scale' ? o.value : q.kind === 'weather' ? t.weather[o.value] : q.kind === 'esvp' ? t.esvp[o.value][0] : o.label}
              {q.kind === 'esvp' && <small>{t.esvp[o.value][1]}</small>}
            </span>
          </button>
        ))}
        <p className="muted small ib-hidden-note"><Icon name="lock" size={13} /> {t.hidden}</p>
      </div>
    )
  }
  const word = q.kind === 'word'
  const submit = e => { e.preventDefault(); onAnswer(text.trim() || null) }
  return (
    <form className="ib-text-answer" onSubmit={submit}>
      {word
        ? <input value={text} maxLength={30} onChange={e => setText(e.target.value)} placeholder={t.kindHint.word} aria-label={t.yourAnswer} />
        : <textarea rows={2} value={text} maxLength={280} onChange={e => setText(e.target.value)} placeholder={t.yourAnswer} aria-label={t.yourAnswer} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }} />}
      <div className="row">
        <span className="muted small ib-hidden-note"><Icon name="lock" size={13} /> {t.hidden}</span>
        <span className="spacer" />
        {value != null && <span className="ib-saved"><Icon name="check" size={14} /></span>}
        <button className="btn primary" disabled={!text.trim() || text.trim() === value}>{value != null ? t.update : t.share}</button>
      </div>
    </form>
  )
}

function Answers({ q, round, anonymous, t, nameOf, room }) {
  // Hidden names are shown in answer order, not the order people answered in.
  const entries = Object.entries(round.answers).sort(anonymous ? (x, y) => String(x[1]).localeCompare(String(y[1])) : () => 0)
  const opts = optionsOf(q)
  const name = pid => anonymous ? t.anon : nameOf(pid)
  return (
    <div className="ib-answers">
      {opts && (
        <div className="ib-dist">
          {opts.map(o => {
            const n = entries.filter(([, v]) => v === o.value).length
            return (
              <div key={o.value} className="ib-dist-row">
                <span className="ib-dist-v">{answerLabel(q, o.value, t)}</span>
                <span className="ib-dist-bar"><i style={{ width: `${entries.length ? (n / entries.length) * 100 : 0}%` }} /></span>
                <span className="ib-dist-n">{n}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="ib-answer-grid">
        {entries.map(([pid, v], i) => (
          <div key={pid} className="ib-answer" style={{ '--i': i }}>
            <span className="ib-answer-who">{anonymous ? <span className="ib-anon">?</span> : <Avatar p={room.people[pid] ?? { name: '?' }} size={22} />} {name(pid)}</span>
            <span className="ib-answer-text">{answerLabel(q, v, t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bingo({ room, me, people, canLead, host, dispatch, t, lang, nameOf }) {
  const g = room.bingo
  const [setId, setSetId] = useState(g?.setId ?? 'meeting')
  if (!g) {
    return (
      <section className="tool-card ib-bingo-start">
        <h2>{t.bingo}</h2>
        <p className="muted">{t.bingoLead}</p>
        {canLead ? <>
          <SetChips setId={setId} onPick={setSetId} t={t} />
          <div className="row end"><button className="btn primary" onClick={() => dispatch({ type: 'BINGO_START', setId })}><Icon name="grid" /> {t.startGame}</button></div>
        </> : <p className="muted">{fill(t.waitGame, { name: host?.name ?? t.host })}</p>}
      </section>
    )
  }
  const mine = g.marks[me] ?? []
  const ranking = people.filter(p => !g.winners.some(w => w.pid === p.id)).map(p => [p, cellsToGo(g.marks[p.id] ?? [])]).sort((a, b) => a[1] - b[1]).slice(0, 5)
  return (
    <div className="ib-bingo-room">
      <section className="tool-card ib-bingo-card">
        <div className="tool-card-head">
          <h2>{BINGO_SETS.find(s => s.id === g.setId)?.emoji} {t.sets[g.setId]}</h2>
          {canLead && <div className="row">
            <select value={setId} onChange={e => setSetId(e.target.value)} aria-label={t.newGame}>{BINGO_SETS.map(s => <option key={s.id} value={s.id}>{t.sets[s.id]}</option>)}</select>
            <button className="btn ghost sm" onClick={() => dispatch({ type: 'BINGO_START', setId })}>{t.newGame}</button>
            <button className="btn ghost sm" onClick={() => dispatch({ type: 'BINGO_END' })}>{t.endGame}</button>
          </div>}
        </div>
        <BingoGrid setId={g.setId} seed={`${g.id}:${me}`} marks={mine} lang={lang} t={t}
          onMark={(i, el) => { if (!mine.includes(i)) sparkle(el); dispatch({ type: 'MARK', gameId: g.id, pid: me, cell: i }) }} />
      </section>
      <aside className="ib-bingo-side">
        <section className="tool-card">
          <h2><Icon name="trophy" /> {t.winners}</h2>
          {g.winners.length
            ? <ol className="ib-winners">{g.winners.map((w, i) => <li key={w.pid}><span className="ib-medal">{['🥇', '🥈', '🥉'][i] ?? '🎉'}</span><Avatar p={room.people[w.pid] ?? { name: '?' }} size={22} /> {nameOf(w.pid)}{w.pid === me ? ` (${t.you})` : ''}</li>)}</ol>
            : <p className="muted">{t.noWinners}</p>}
        </section>
        {ranking.length > 0 && <section className="tool-card">
          <h2>{t.closest}</h2>
          <ul className="ib-closest">{ranking.map(([p, n]) => <li key={p.id}><Avatar p={p} size={22} /> <span className="grow ellipsis">{p.name}{p.id === me ? ` (${t.you})` : ''}</span><span className={`ib-togo ${n === 1 ? 'hot' : ''}`}>{fill(t.toGo, { n })}</span></li>)}</ul>
        </section>}
      </aside>
    </div>
  )
}
