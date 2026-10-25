import { useState } from 'react'
import { useApp, go, joinHost } from './app-context.js'
import { Icon } from './icons.jsx'
import { useT } from './i18n.js'
import { TYPES, typeLabel } from './slides.js'
import './landing.css'

const DICT = {
  en: {
    headline: 'Every voice in the room, live.',
    sub: 'Polls, word clouds, Q&A and quizzes that your audience answers from their phones — results appear on screen as they vote.',
    create: 'Create a presentation', joinTitle: 'Joining a presentation?', joinHint: 'Enter the code on the screen in front of you',
    join: 'Join', codePh: '1234 5678', badCode: 'Codes have 8 digits',
    typesTitle: 'Thirteen ways to ask', typesSub: 'Mix interactive questions, quiz rounds and content slides in one deck.',
    howTitle: 'How it works',
    step1: 'Create', step1d: 'Start from a template or a blank deck and add your questions.',
    step2: 'Present', step2d: 'Put it on the big screen. A code and QR code show how to join.',
    step3: 'Join', step3d: 'People open {origin}/#/CODE or scan the QR code — no app, no account.',
    step4: 'See it live', step4d: 'Votes, words and questions appear instantly for up to hundreds of people.',
    free: 'Free to start · No account needed to join',
  },
  zh: {
    headline: '让现场每一个声音，实时被看见。',
    sub: '投票、词云、问答和抢答，观众用手机作答，结果随投票实时出现在屏幕上。',
    create: '创建演示', joinTitle: '要参与演示？', joinHint: '输入你面前屏幕上的代码',
    join: '加入', codePh: '1234 5678', badCode: '代码为 8 位数字',
    typesTitle: '十三种提问方式', typesSub: '在同一份演示里组合互动问题、抢答和内容页。',
    howTitle: '使用方式',
    step1: '创建', step1d: '从模板或空白演示开始，添加你的问题。',
    step2: '演示', step2d: '投到大屏幕上，屏幕会显示加入代码和二维码。',
    step3: '加入', step3d: '观众打开 {origin}/#/代码 或扫码，无需安装应用、无需账号。',
    step4: '实时呈现', step4d: '投票、词语和问题即时出现，支持数百人同时参与。',
    free: '免费开始 · 参与无需账号',
  },
}

export const formatCode = v => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 4 ? `${d.slice(0, 4)} ${d.slice(4)}` : d
}

export function JoinBox({ compact }) {
  const t = useT(DICT)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  const digits = code.replace(/\D/g, '')
  const submit = e => {
    e.preventDefault()
    if (digits.length !== 8) return setErr(true)
    go(`/${digits}`)
  }
  return (
    <form className={`join-box ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <label htmlFor="join-code"><b>{t('joinTitle')}</b><span>{t('joinHint')}</span></label>
      <div className="join-row">
        <input id="join-code" inputMode="numeric" autoComplete="off" value={code} placeholder={t('codePh')}
          onChange={e => { setCode(formatCode(e.target.value)); setErr(false) }} aria-invalid={err} />
        <button className="btn primary" disabled={!digits}>{t('join')}</button>
      </div>
      {err && <p className="join-err" role="alert">{t('badCode')}</p>}
    </form>
  )
}

export default function Landing() {
  const { openSignIn } = useApp()
  const t = useT(DICT)
  const lang = t.lang
  const steps = [['edit', 'step1'], ['present', 'step2'], ['qr', 'step3'], ['chart', 'step4']]
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker"><Icon name="sparkle" size={14} /> VoteLift · Lift Apps</span>
            <h1>{t('headline')}</h1>
            <p>{t('sub')}</p>
            <div className="hero-cta">
              <button className="btn reveal lg" onClick={openSignIn}><Icon name="plus" /> {t('create')}</button>
              <span className="hero-free">{t('free')}</span>
            </div>
          </div>
          <JoinBox />
        </div>
        <HeroDemo />
      </section>

      <section className="page land-section">
        <h2>{t('typesTitle')}</h2>
        <p className="muted">{t('typesSub')}</p>
        <div className="type-strip">
          {Object.entries(TYPES).map(([type, def]) => (
            <div key={type} className={`type-chip g-${def.group}`}>
              <span className="type-ico"><Icon name={def.icon} size={20} /></span>
              <b>{typeLabel(type, lang)}</b>
              <span>{def.hint[lang] ?? def.hint.en}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="page land-section">
        <h2>{t('howTitle')}</h2>
        <ol className="how">
          {steps.map(([icon, key], i) => (
            <li key={key}>
              <span className="how-num">{i + 1}</span>
              <Icon name={icon} size={22} />
              <b>{t(key)}</b>
              <p>{t(`${key}d`, { origin: joinHost() })}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

// A small, static picture of a live poll so the hero shows what the product does.
function HeroDemo() {
  const bars = [62, 88, 35, 51]
  return (
    <div className="hero-demo" aria-hidden="true">
      <div className="demo-screen">
        <div className="demo-join">{joinHost()}/#/ <b>4821 7390</b></div>
        <div className="demo-q" />
        <div className="demo-bars">
          {bars.map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }} />)}
        </div>
      </div>
      <div className="demo-phone">
        <span /><span className="on" /><span /><span />
      </div>
    </div>
  )
}
