import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { HowTo } from '../core/tools-ui.jsx'
import {
  CURRENCIES, TREATS, FREQUENCIES, newId, blankSetup, hourlyOf, teamRate, isRunning, start, pause, changeRate,
  elapsedMs, costOf, recurring, rescaleTreats, historyCsv, encodeSetup, decodeSetup,
} from './model.js'
import './meetingcost.css'

const T = {
  en: {
    eyebrow: 'Meeting cost', title: 'What is this meeting costing?', lead: 'Put a live price on the time in the room. Add who is there, start the meter, and watch the number climb. Then work out what a recurring meeting costs over a year, and what a shorter one would save.',
    privacy: 'Rates stay in this browser. Nothing is sent anywhere.',
    howSteps: [
      ['Say who is in the room', 'Enter a head count and an average rate, or switch to roles and give each role a count and an hourly rate or yearly salary.'],
      ['Start the meter', 'Press Start when the meeting begins. Use + and − as people join or leave; the cost so far stays exact.'],
      ['Put it on the big screen', 'Present mode shows the ticker full screen for everyone. Set a planned length to see when you run over.'],
      ['End and save', 'End & save adds the meeting to your history, which you can export as CSV.'],
      ['Plan the recurring ones', 'In the planner, see what a weekly or daily meeting costs per year and what a shorter or smaller version would save.'],
    ],
    howTips: [
      'Rates are estimates. A rough average is enough to start a useful conversation.',
      'Use the overhead multiplier (for example 1.3) if you want to include benefits, office and equipment costs.',
      'The meter keeps time from timestamps, so it stays right even if this tab is in the background or the page reloads.',
      'Share links include the rates you entered. Only share them with people who may see those numbers.',
    ],
    tabLive: 'Live meter', tabPlan: 'Recurring planner', tabHistory: 'History',
    setup: 'Who is in the room', meetingTitle: 'Meeting', titlePh: 'e.g. Sprint planning', currency: 'Currency',
    simple: 'Head count', roles: 'By role', people: 'People', rate: 'Rate', perHour: 'per hour', perYear: 'per year',
    role: 'Role', rolePh: 'Role', count: 'Count', addRole: 'Add role', remove: 'Remove',
    more: 'More settings', overhead: 'Overhead multiplier', overheadHint: 'Salary is only part of what a person costs. 1.0 counts pay only; 1.2–1.5 is a common rough allowance for benefits, office and equipment.',
    hoursYear: 'Working hours per year', hoursYearHint: 'Used to turn a yearly salary into an hourly rate. About 1,800 is common for full-time work.',
    planned: 'Planned length (minutes)', plannedHint: 'Leave at 0 for no limit.',
    share: 'Share setup', copied: 'Link copied', shareHint: 'This link contains the rates above. Anyone who opens it gets a copy of this setup.', sharedIn: 'Opened a shared setup.',
    soFar: 'Cost so far', elapsed: 'Time', perMin: 'per minute', costPerHour: 'per hour', inRoom: 'in the room', person1: 'person', persons: 'people',
    start: 'Start', pause: 'Pause', resume: 'Resume', end: 'End & save', reset: 'Reset', confirmReset: 'Click again to discard', present: 'Present', exitPresent: 'Exit',
    of: 'of {m} min', over: 'Over time by {t}', left: '{t} left',
    worth: 'That is about', treats: { coffee: 'coffees', pizza: 'pizzas', book: 'books' }, prices: 'Edit prices', price: 'Price of one',
    personHours: '{n} person-hours',
    joinLeave: 'Someone joined or left?', noPeople: 'Add at least one person with a rate to start the meter.',
    plan: 'Recurring meeting', length: 'Length (minutes)', often: 'How often', freq: { daily: 'Every working day', twice: 'Twice a week', weekly: 'Weekly', biweekly: 'Every two weeks', monthly: 'Monthly' },
    avgRate: 'Average cost per person per hour', avgFromSetup: 'From your setup: {v}. Type a number to override.', weeks: 'Working weeks per year', weeksHint: 'About 46 after holidays and leave.',
    whatIf: 'What if…', current: 'Today', changed: 'What if', saving: 'Saving',
    each: 'Per meeting', week: 'Per week', month: 'Per month', year: 'Per year', hoursYr: 'Person-hours per year',
    saveLine: 'The change would save {money} and {hours} person-hours a year.', costLine: 'The change would cost {money} and {hours} person-hours more a year.', sameLine: 'Change the length, people or frequency to compare.',
    history: 'Finished meetings', noHistory: 'Meetings you end and save appear here.', date: 'Date', duration: 'Length', cost: 'Cost', csv: 'Export CSV', clear: 'Clear history', confirmClear: 'Click again to clear',
    totalLine: '{n} meetings · {time} · {money}', untitled: 'Meeting', wake: 'Screen kept awake while the meter runs.',
    defaultRoles: ['Engineer', 'Product manager', 'Designer'],
  },
  zh: {
    eyebrow: '会议成本', title: '这场会议花了多少钱？', lead: '给会议室里的时间标上实时价格。填好参会人员，启动计价器，看着数字往上涨。再算算一个例会一年要花多少，缩短一点能省多少。',
    privacy: '费率只保存在这个浏览器里，不会发送到任何地方。',
    howSteps: [
      ['填写参会人员', '输入人数和平均费率；或切换到“按角色”，为每个角色填写人数，以及时薪或年薪。'],
      ['启动计价器', '会议开始时点“开始”。有人加入或离开时点 + 或 −，已花费的金额依然精确。'],
      ['投到大屏幕', '演示模式把计价器全屏展示给所有人。设置计划时长，就能看到是否超时。'],
      ['结束并保存', '“结束并保存”会把会议记入历史，可导出 CSV。'],
      ['规划例会', '在规划器里看看每周或每天的例会一年要花多少，缩短时间或减少人数能省多少。'],
    ],
    howTips: [
      '费率是估算值，大致的平均数就足以引发有用的讨论。',
      '想把福利、办公和设备成本算进去，可以用间接成本系数（例如 1.3）。',
      '计价器按时间戳计算，即使标签页在后台或页面刷新也不会出错。',
      '分享链接里包含你填写的费率，只分享给可以看到这些数字的人。',
    ],
    tabLive: '实时计价', tabPlan: '例会规划', tabHistory: '历史',
    setup: '参会人员', meetingTitle: '会议', titlePh: '例如：迭代计划会', currency: '币种',
    simple: '按人数', roles: '按角色', people: '人数', rate: '费率', perHour: '每小时', perYear: '每年',
    role: '角色', rolePh: '角色', count: '人数', addRole: '添加角色', remove: '移除',
    more: '更多设置', overhead: '间接成本系数', overheadHint: '工资只是用人成本的一部分。1.0 只算工资；1.2–1.5 是常见的粗略估计，包含福利、办公和设备。',
    hoursYear: '每年工作小时数', hoursYearHint: '用于把年薪换算成时薪。全职一般约 1,800 小时。',
    planned: '计划时长（分钟）', plannedHint: '填 0 表示不限时。',
    share: '分享设置', copied: '链接已复制', shareHint: '链接中包含上面的费率。打开链接的人会得到这份设置的副本。', sharedIn: '已打开分享的设置。',
    soFar: '已花费', elapsed: '时长', perMin: '每分钟', costPerHour: '每小时', inRoom: '在场', person1: '人', persons: '人',
    start: '开始', pause: '暂停', resume: '继续', end: '结束并保存', reset: '重置', confirmReset: '再点一次放弃', present: '演示', exitPresent: '退出',
    of: '计划 {m} 分钟', over: '已超时 {t}', left: '还剩 {t}',
    worth: '相当于', treats: { coffee: '杯咖啡', pizza: '个披萨', book: '本书' }, prices: '修改单价', price: '单价',
    personHours: '{n} 人·小时',
    joinLeave: '有人加入或离开？', noPeople: '至少添加一位有费率的参会者，才能启动计价器。',
    plan: '例会', length: '时长（分钟）', often: '频率', freq: { daily: '每个工作日', twice: '每周两次', weekly: '每周', biweekly: '每两周', monthly: '每月' },
    avgRate: '每人每小时平均成本', avgFromSetup: '按你的设置：{v}。输入数字可覆盖。', weeks: '每年工作周数', weeksHint: '扣除节假日和休假后约 46 周。',
    whatIf: '如果……', current: '现在', changed: '调整后', saving: '节省',
    each: '每次', week: '每周', month: '每月', year: '每年', hoursYr: '每年人·小时',
    saveLine: '这样调整每年可节省 {money}，以及 {hours} 人·小时。', costLine: '这样调整每年会多花 {money}，以及 {hours} 人·小时。', sameLine: '修改时长、人数或频率来对比。',
    history: '已结束的会议', noHistory: '结束并保存的会议会显示在这里。', date: '日期', duration: '时长', cost: '成本', csv: '导出 CSV', clear: '清空历史', confirmClear: '再点一次清空',
    totalLine: '{n} 场会议 · {time} · {money}', untitled: '会议', wake: '计价期间保持屏幕常亮。',
    defaultRoles: ['工程师', '产品经理', '设计师'],
  },
}

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
const STORE = 'lift-meetingcost'

function load(lang) {
  try {
    const s = JSON.parse(localStorage.getItem(STORE))
    if (s?.setup) return { tab: 'live', segs: [], history: [], planner: {}, ...s }
  } catch { /* storage blocked or corrupt */ }
  return { tab: 'live', setup: blankSetup(T[lang].defaultRoles), segs: [], history: [], planner: {} }
}

// A share link looks like #/meetingcost/s.<code>.
const sharedCode = () => window.location.hash.match(/^#\/meetingcost\/s\.([\w-]+)/)?.[1] ?? null

const locale = lang => (lang === 'zh' ? 'zh-CN' : 'en-US')
function money(n, currency, lang, digits) {
  const f = new Intl.NumberFormat(locale(lang), { style: 'currency', currency, ...(digits != null ? { minimumFractionDigits: 0, maximumFractionDigits: digits } : {}) })
  return f.format(n)
}
// Whole units once the number is large; cents while it is small enough to watch them move.
const tickerMoney = (n, currency, lang) => money(n, currency, lang, currency === 'JPY' || n >= 10000 ? 0 : 2)
const roundMoney = (n, currency, lang) => money(n, currency, lang, n >= 100 ? 0 : 2)
const num = v => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0 }

function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

// Re-renders ten times a second while the meter runs.
function useNow(active) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const h = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(h)
  }, [active])
  return active ? now : Date.now()
}

// Keeps the screen on while the meter runs, where the browser allows it.
function useWakeLock(active) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!active || !navigator.wakeLock) return
    let lock = null
    let gone = false
    const take = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(l => {
        if (gone) return l.release()
        lock = l
        setHeld(true)
        l.addEventListener('release', () => setHeld(false))
      }, () => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => { gone = true; document.removeEventListener('visibilitychange', take); lock?.release().catch(() => {}); setHeld(false) }
  }, [active])
  return held
}

function download(name, text, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function MeetingCost() {
  const lang = useLang()
  const t = T[lang]
  const [state, setState] = useState(() => load(lang))
  const [notice, setNotice] = useState(null)
  const { setup, segs, history, tab } = state

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { /* storage blocked */ }
  }, [state])

  // Any change to who is in the room (or their rates) starts a new segment if the meter runs.
  const updateSetup = patch => setState(st => {
    const next = { ...st.setup, ...(typeof patch === 'function' ? patch(st.setup) : patch) }
    return { ...st, setup: next, segs: changeRate(st.segs, Date.now(), teamRate(next).perHour) }
  })

  // Opening a share link imports that setup and tidies the address.
  useEffect(() => {
    const take = () => {
      const code = sharedCode()
      if (!code) return
      const s = decodeSetup(code)
      window.history.replaceState(null, '', '#/meetingcost')
      if (!s) return
      updateSetup(s)
      setNotice(t.sharedIn)
    }
    take()
    window.addEventListener('hashchange', take)
    return () => window.removeEventListener('hashchange', take)
  }, [t.sharedIn])

  const set = patch => setState(st => ({ ...st, ...patch }))

  return (
    <main className="tool-page fc mc">
      <section className="tool-hero">
        <div className="hero-eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.lead}</p>
        <p className="tool-privacy"><Icon name="shield" size={15} /> {t.privacy}</p>
      </section>

      <HowTo tool="meetingcost" steps={t.howSteps} tips={t.howTips} />

      <div className="seg mc-tabs" role="tablist">
        {[['live', t.tabLive], ['plan', t.tabPlan], ['history', `${t.tabHistory}${history.length ? ` (${history.length})` : ''}`]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set({ tab: k })}>{label}</button>
        ))}
      </div>
      {notice && <p className="tool-note" role="status" onClick={() => setNotice(null)}>{notice}</p>}

      {tab === 'live' && <Live state={state} setState={setState} updateSetup={updateSetup} setNotice={setNotice} t={t} lang={lang} />}
      {tab === 'plan' && <Planner setup={setup} planner={state.planner} setPlanner={p => setState(st => ({ ...st, planner: { ...st.planner, ...p } }))} t={t} lang={lang} />}
      {tab === 'history' && <History history={history} setHistory={h => set({ history: h })} t={t} lang={lang} />}
      {segs.length > 0 && tab !== 'live' && <p className="tool-note mc-running">{isRunning(segs) ? '● ' : '❚❚ '}{t.soFar}: <b>{tickerMoney(costOf(segs, Date.now()), setup.currency, lang)}</b> · <button className="link-btn" onClick={() => set({ tab: 'live' })}>{t.tabLive}</button></p>}
    </main>
  )
}

function Live({ state, setState, updateSetup, setNotice, t, lang }) {
  const { setup, segs } = state
  const running = isRunning(segs)
  const now = useNow(running)
  const awake = useWakeLock(running)
  const [confirmReset, setConfirmReset] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const { people, perHour } = teamRate(setup)
  const cost = costOf(segs, now)
  const ms = elapsedMs(segs, now)
  const plannedMs = num(setup.planned) * 60000
  const cur = setup.currency

  const go = () => setState(st => ({ ...st, segs: start(st.segs, Date.now(), teamRate(st.setup).perHour) }))
  const stop = () => setState(st => ({ ...st, segs: pause(st.segs, Date.now()) }))
  const end = () => setState(st => {
    const at = Date.now()
    const done = pause(st.segs, at)
    const entry = { id: newId(), title: st.setup.title.trim() || t.untitled, at: done[0].from, ms: elapsedMs(done, at), cost: costOf(done, at), people: teamRate(st.setup).people, currency: st.setup.currency }
    return { ...st, segs: [], history: [entry, ...st.history].slice(0, 500) }
  })
  const reset = () => {
    if (!confirmReset) return setConfirmReset(true)
    setConfirmReset(false)
    setState(st => ({ ...st, segs: [] }))
  }
  const share = () => {
    const url = `${window.location.origin}${window.location.pathname}#/meetingcost/s.${encodeSetup(setup)}`
    setShareUrl(url)
    navigator.clipboard?.writeText(url).then(() => { setNotice(t.copied); setTimeout(() => setNotice(n => (n === t.copied ? null : n)), 2500) }, () => {})
  }

  const controls = (
    <div className="mc-controls">
      {!running
        ? <button className="btn primary lg" disabled={!perHour} onClick={go}>▶ {segs.length ? t.resume : t.start}</button>
        : <button className="btn primary lg" onClick={stop}>❚❚ {t.pause}</button>}
      {segs.length > 0 && <button className="btn ghost lg" onClick={end}><Icon name="check" /> {t.end}</button>}
      {segs.length > 0 && <button className={`btn ghost ${confirmReset ? 'mc-danger' : ''}`} onClick={reset} onBlur={() => setConfirmReset(false)}>{confirmReset ? t.confirmReset : t.reset}</button>}
    </div>
  )

  return (
    <div className="mc-live">
      <section className="tool-card mc-meter" aria-live="off">
        <div className="mc-meter-head">
          <span className="mc-label">{setup.title.trim() || t.soFar}</span>
          <button className="btn ghost sm" onClick={() => setPresenting(true)}><Icon name="present" /> {t.present}</button>
        </div>
        <Meter cost={cost} ms={ms} perHour={perHour} people={people} plannedMs={plannedMs} running={running} setup={setup} t={t} lang={lang} />
        {controls}
        {!perHour && <p className="muted small">{t.noPeople}</p>}
        <QuickPeople setup={setup} updateSetup={updateSetup} t={t} />
        {awake && <p className="muted small mc-awake">☀ {t.wake}</p>}
        <Treats cost={cost} setup={setup} updateSetup={updateSetup} t={t} lang={lang} />
      </section>

      <section className="tool-card mc-setup">
        <h2>{t.setup}</h2>
        <div className="mc-fields">
          <label><span className="field-label">{t.meetingTitle}</span><input value={setup.title} maxLength={80} placeholder={t.titlePh} onChange={e => updateSetup({ title: e.target.value })} /></label>
          <label><span className="field-label">{t.currency}</span>
            <select value={cur} onChange={e => updateSetup(s => ({ currency: e.target.value, treats: rescaleTreats(s.treats, s.currency, e.target.value) }))}>
              {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="seg mc-mode" role="tablist">
          {[['simple', t.simple], ['roles', t.roles]].map(([k, label]) => <button key={k} role="tab" aria-selected={setup.mode === k} className={setup.mode === k ? 'on' : ''} onClick={() => updateSetup({ mode: k })}>{label}</button>)}
        </div>
        {setup.mode === 'simple' ? (
          <div className="mc-fields">
            <label><span className="field-label">{t.people}</span>
              <Stepper value={setup.simple.count} onChange={v => updateSetup(s => ({ simple: { ...s.simple, count: v } }))} label={t.people} />
            </label>
            <RateInput row={setup.simple} onChange={p => updateSetup(s => ({ simple: { ...s.simple, ...p } }))} t={t} />
          </div>
        ) : <Roles setup={setup} updateSetup={updateSetup} t={t} lang={lang} />}
        <label className="mc-planned"><span className="field-label">{t.planned}</span>
          <input type="number" min="0" max="600" step="5" value={setup.planned} onChange={e => updateSetup({ planned: e.target.value })} />
          <small className="muted">{t.plannedHint}</small>
        </label>
        <details className="mc-more">
          <summary>{t.more}</summary>
          <div className="mc-fields">
            <label><span className="field-label">{t.overhead} · ×{num(setup.overhead || 1).toFixed(2)}</span>
              <input type="range" min="1" max="2" step="0.05" value={setup.overhead} onChange={e => updateSetup({ overhead: +e.target.value })} />
              <small className="muted">{t.overheadHint}</small>
            </label>
            <label><span className="field-label">{t.hoursYear}</span>
              <input type="number" min="500" max="3000" step="10" value={setup.hoursPerYear} onChange={e => updateSetup({ hoursPerYear: e.target.value })} />
              <small className="muted">{t.hoursYearHint}</small>
            </label>
          </div>
        </details>
        <div className="row wrap">
          <button className="btn ghost sm" onClick={share}><Icon name="link" /> {t.share}</button>
        </div>
        {shareUrl && <div className="mc-share"><input readOnly value={shareUrl} onFocus={e => e.target.select()} aria-label={t.share} /><span className="muted small">{t.shareHint}</span></div>}
      </section>

      {presenting && (
        <Present onClose={() => setPresenting(false)} t={t}>
          <div className="mc-label">{setup.title.trim() || t.soFar}</div>
          <Meter cost={cost} ms={ms} perHour={perHour} people={people} plannedMs={plannedMs} running={running} setup={setup} t={t} lang={lang} big />
          {controls}
          <QuickPeople setup={setup} updateSetup={updateSetup} t={t} />
          <Treats cost={cost} setup={setup} t={t} lang={lang} />
        </Present>
      )}
    </div>
  )
}

function Meter({ cost, ms, perHour, people, plannedMs, running, setup, t, lang, big }) {
  const cur = setup.currency
  const over = plannedMs > 0 && ms - plannedMs >= 1000
  const pct = plannedMs > 0 ? Math.min(100, (ms / plannedMs) * 100) : 0
  return (
    <div className={`mc-ticker ${big ? 'big' : ''} ${over ? 'over' : ''} ${running ? 'on' : ''}`}>
      <div className="mc-cost" role="timer" aria-label={t.soFar}>{tickerMoney(cost, cur, lang)}</div>
      <div className="mc-facts">
        <span><b>{clock(ms)}</b> {t.elapsed}</span>
        <span><b>{roundMoney(perHour / 60, cur, lang)}</b> {t.perMin}</span>
        <span><b>{roundMoney(perHour, cur, lang)}</b> {t.costPerHour}</span>
        <span><b>{people}</b> {people === 1 ? t.person1 : t.persons} {t.inRoom}</span>
      </div>
      {plannedMs > 0 && (
        <div className="mc-progress">
          <div className="mc-bar"><i style={{ width: `${pct}%` }} /></div>
          <span className="small">{over ? fill(t.over, { t: clock(ms - plannedMs) }) : `${fill(t.left, { t: clock(plannedMs - ms) })} · ${fill(t.of, { m: setup.planned })}`}</span>
        </div>
      )}
    </div>
  )
}

function Stepper({ value, onChange, label, min = 0 }) {
  const n = Math.floor(num(value))
  return (
    <span className="mc-stepper">
      <button className="btn ghost sm" aria-label={`− ${label}`} disabled={n <= min} onClick={() => onChange(Math.max(min, n - 1))}>−</button>
      <input type="number" min={min} max="999" value={value} onChange={e => onChange(e.target.value)} aria-label={label} />
      <button className="btn ghost sm" aria-label={`+ ${label}`} onClick={() => onChange(n + 1)}>+</button>
    </span>
  )
}

function RateInput({ row, onChange, t }) {
  return (
    <label><span className="field-label">{t.rate}</span>
      <span className="mc-rate">
        <input type="number" min="0" step={row.unit === 'year' ? 1000 : 1} value={row.rate} onChange={e => onChange({ rate: e.target.value })} aria-label={t.rate} />
        <select value={row.unit} onChange={e => onChange({ unit: e.target.value })} aria-label={t.rate}>
          <option value="hour">{t.perHour}</option>
          <option value="year">{t.perYear}</option>
        </select>
      </span>
    </label>
  )
}

function Roles({ setup, updateSetup, t, lang }) {
  const setRole = (id, patch) => updateSetup(s => ({ roles: s.roles.map(r => (r.id === id ? { ...r, ...patch } : r)) }))
  return (
    <div className="mc-roles">
      {setup.roles.map(r => (
        <div key={r.id} className="mc-role">
          <input className="mc-role-name" value={r.name} placeholder={t.rolePh} maxLength={40} onChange={e => setRole(r.id, { name: e.target.value })} aria-label={t.role} />
          <Stepper value={r.count} onChange={v => setRole(r.id, { count: v })} label={`${t.count} ${r.name}`} />
          <RateInput row={r} onChange={p => setRole(r.id, p)} t={t} />
          <span className="muted small mc-role-hourly">{roundMoney(hourlyOf(r.rate, r.unit, setup.hoursPerYear), setup.currency, lang)}/h</span>
          <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => updateSetup(s => ({ roles: s.roles.filter(x => x.id !== r.id) }))}><Icon name="x" /></button>
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => updateSetup(s => ({ roles: [...s.roles, { id: newId(), name: '', count: 1, rate: s.roles.at(-1)?.rate ?? 60, unit: s.roles.at(-1)?.unit ?? 'hour' }] }))}><Icon name="plus" /> {t.addRole}</button>
    </div>
  )
}

// Quick +/− for people arriving late or leaving early, right under the meter.
function QuickPeople({ setup, updateSetup, t }) {
  if (setup.mode === 'simple') {
    return (
      <div className="mc-quick">
        <span className="muted small">{t.joinLeave}</span>
        <Stepper value={setup.simple.count} onChange={v => updateSetup(s => ({ simple: { ...s.simple, count: v } }))} label={t.people} />
      </div>
    )
  }
  return (
    <div className="mc-quick">
      <span className="muted small">{t.joinLeave}</span>
      {setup.roles.map(r => (
        <span key={r.id} className="mc-quick-role"><span className="ellipsis">{r.name || t.role}</span>
          <Stepper value={r.count} onChange={v => updateSetup(s => ({ roles: s.roles.map(x => (x.id === r.id ? { ...x, count: v } : x)) }))} label={r.name || t.role} />
        </span>
      ))}
    </div>
  )
}

function Treats({ cost, setup, updateSetup, t, lang }) {
  const fmt = n => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)
  return (
    <div className="mc-treats">
      <span className="muted small">{t.worth}</span>
      <div className="mc-treat-list">
        {TREATS.map(x => {
          const price = num(setup.treats?.[x.id])
          return <span key={x.id} className="mc-treat"><i>{x.emoji}</i> <b>{price ? fmt(cost / price) : '–'}</b> {t.treats[x.id]}</span>
        })}
      </div>
      {updateSetup && (
        <details className="mc-prices">
          <summary className="small">{t.prices}</summary>
          <div className="mc-price-row">
            {TREATS.map(x => (
              <label key={x.id}><span className="small">{x.emoji} {t.price}</span>
                <input type="number" min="0" step="0.5" value={setup.treats?.[x.id] ?? ''} onChange={e => updateSetup(s => ({ treats: { ...s.treats, [x.id]: e.target.value } }))} aria-label={`${t.price} ${t.treats[x.id]}`} />
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// Full-screen view for a shared screen. Falls back to a fixed overlay where fullscreen is blocked.
function Present({ onClose, t, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.requestFullscreen?.().catch(() => {})
    const onKey = e => { if (e.key === 'Escape') onClose() }
    // Leaving browser fullscreen (Esc, F11) closes the view, but only once we were really in it.
    let entered = false
    const onFs = () => {
      if (document.fullscreenElement === el) entered = true
      else if (entered) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [onClose])
  return (
    <div className="mc-present" ref={ref} role="dialog" aria-modal="true">
      <button className="btn ghost sm mc-exit" onClick={onClose}><Icon name="x" /> {t.exitPresent}</button>
      <div className="mc-present-body">{children}</div>
    </div>
  )
}

function Planner({ setup, planner, setPlanner, t, lang }) {
  const { people, perHour } = teamRate(setup)
  const avg = people ? perHour / people : 0
  const p = {
    minutes: 60, freq: 'weekly', people: people || 8, rate: '', weeks: 46,
    ...planner,
  }
  const w = { minutes: p.whatMinutes ?? 45, freq: p.whatFreq ?? p.freq, people: p.whatPeople ?? Math.max(1, num(p.people) - 2) }
  const rate = p.rate === '' || p.rate == null ? avg : num(p.rate)
  const a = recurring({ minutes: p.minutes, perWeek: FREQUENCIES[p.freq], people: p.people, rate, weeks: p.weeks })
  const b = recurring({ minutes: w.minutes, perWeek: FREQUENCIES[w.freq], people: w.people, rate, weeks: p.weeks })
  const cur = setup.currency
  const m = n => roundMoney(n, cur, lang)
  const h = n => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(n)
  const rows = [['each', 'each'], ['week', 'week'], ['month', 'month'], ['year', 'year']]
  const diff = a.year - b.year
  const max = Math.max(a.year, b.year, 1)
  const freqSelect = (value, onChange) => (
    <select value={value} onChange={e => onChange(e.target.value)}>{Object.keys(FREQUENCIES).map(k => <option key={k} value={k}>{t.freq[k]}</option>)}</select>
  )
  return (
    <div className="mc-plan">
      <section className="tool-card">
        <h2>{t.plan}</h2>
        <div className="mc-fields three">
          <label><span className="field-label">{t.length}</span><input type="number" min="1" max="600" value={p.minutes} onChange={e => setPlanner({ minutes: e.target.value })} /></label>
          <label><span className="field-label">{t.often}</span>{freqSelect(p.freq, v => setPlanner({ freq: v }))}</label>
          <label><span className="field-label">{t.people}</span><input type="number" min="1" max="999" value={p.people} onChange={e => setPlanner({ people: e.target.value })} /></label>
        </div>
        <div className="mc-fields">
          <label><span className="field-label">{t.avgRate}</span>
            <input type="number" min="0" step="1" value={p.rate ?? ''} placeholder={avg ? avg.toFixed(0) : ''} onChange={e => setPlanner({ rate: e.target.value })} />
            <small className="muted">{fill(t.avgFromSetup, { v: `${m(avg)}/h` })}</small>
          </label>
          <label><span className="field-label">{t.weeks}</span>
            <input type="number" min="1" max="52" value={p.weeks} onChange={e => setPlanner({ weeks: e.target.value })} />
            <small className="muted">{t.weeksHint}</small>
          </label>
        </div>
        <h2 className="mc-whatif">{t.whatIf}</h2>
        <div className="mc-fields three">
          <label><span className="field-label">{t.length}</span><input type="number" min="1" max="600" value={w.minutes} onChange={e => setPlanner({ whatMinutes: e.target.value })} /></label>
          <label><span className="field-label">{t.often}</span>{freqSelect(w.freq, v => setPlanner({ whatFreq: v }))}</label>
          <label><span className="field-label">{t.people}</span><input type="number" min="1" max="999" value={w.people} onChange={e => setPlanner({ whatPeople: e.target.value })} /></label>
        </div>
      </section>

      <section className="tool-card">
        <div className="mc-compare">
          <div><span>{t.current}</span><i style={{ width: `${(a.year / max) * 100}%` }} /><b>{m(a.year)}</b></div>
          <div className="alt"><span>{t.changed}</span><i style={{ width: `${(b.year / max) * 100}%` }} /><b>{m(b.year)}</b></div>
        </div>
        <p className="mc-verdict">{Math.abs(diff) < 0.005 ? t.sameLine : fill(diff > 0 ? t.saveLine : t.costLine, { money: m(Math.abs(diff)), hours: h(Math.abs(a.personHours - b.personHours)) })}</p>
        <div className="mc-table-wrap">
          <table className="fc-table mc-table">
            <thead><tr><th /><th className="num">{t.current}</th><th className="num">{t.changed}</th><th className="num">{t.saving}</th></tr></thead>
            <tbody>
              {rows.map(([k, label]) => <tr key={k}><td>{t[label]}</td><td className="num">{m(a[k])}</td><td className="num">{m(b[k])}</td><td className={`num ${a[k] - b[k] >= 0 ? 'pos' : 'neg'}`}>{m(a[k] - b[k])}</td></tr>)}
              <tr><td>{t.hoursYr}</td><td className="num">{h(a.personHours)}</td><td className="num">{h(b.personHours)}</td><td className={`num ${a.personHours - b.personHours >= 0 ? 'pos' : 'neg'}`}>{h(a.personHours - b.personHours)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function History({ history, setHistory, t, lang }) {
  const [confirm, setConfirm] = useState(false)
  const totals = useMemo(() => {
    const by = new Map()
    for (const x of history) by.set(x.currency, (by.get(x.currency) ?? 0) + x.cost)
    return { ms: history.reduce((s, x) => s + x.ms, 0), money: [...by].map(([c, n]) => roundMoney(n, c, lang)).join(' + ') }
  }, [history, lang])
  const date = at => new Date(at).toLocaleString(locale(lang), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  if (!history.length) return <section className="tool-card"><h2>{t.history}</h2><p className="muted">{t.noHistory}</p></section>
  return (
    <section className="tool-card">
      <div className="tool-card-head">
        <h2>{t.history}</h2>
        <div className="row wrap">
          <button className="btn ghost sm" onClick={() => download('meeting-costs.csv', historyCsv(history), 'text/csv')}><Icon name="download" /> {t.csv}</button>
          <button className={`btn ghost sm ${confirm ? 'mc-danger' : ''}`} onClick={() => (confirm ? (setHistory([]), setConfirm(false)) : setConfirm(true))} onBlur={() => setConfirm(false)}><Icon name="trash" /> {confirm ? t.confirmClear : t.clear}</button>
        </div>
      </div>
      <p className="muted small">{fill(t.totalLine, { n: history.length, time: clock(totals.ms), money: totals.money })}</p>
      <div className="mc-table-wrap">
        <table className="fc-table mc-table">
          <thead><tr><th>{t.meetingTitle}</th><th>{t.date}</th><th className="num">{t.duration}</th><th className="num">{t.people}</th><th className="num">{t.cost}</th><th /></tr></thead>
          <tbody>
            {history.map(x => (
              <tr key={x.id}>
                <td className="ellipsis mc-htitle">{x.title}</td><td>{date(x.at)}</td><td className="num">{clock(x.ms)}</td><td className="num">{x.people}</td><td className="num">{roundMoney(x.cost, x.currency, lang)}</td>
                <td><button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => setHistory(history.filter(y => y.id !== x.id))}><Icon name="x" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
