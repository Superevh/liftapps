import { Suspense, useEffect, useRef, useState } from 'react'
import { useStore } from './store.jsx'
import { useLang } from './lang.js'
import { Icon } from './icons.jsx'
import { rememberedDocs, forgetDoc, backend } from './live.js'
import { ago } from './tools-ui.jsx'

// The shell shared by EstimateLift, MeetingLift and PulseLift: hash routes, a tool strip under the
// family bar, an app home with tool cards and recent sessions, and the name prompt for live tools.

export const navigate = path => { window.location.hash = path }

export function useClickOutside(ref, fn, active = true) {
  useEffect(() => {
    if (!active) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) fn() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, fn, active])
}

export function Avatar({ p, size = 28 }) {
  if (!p) return null
  return <span className="avatar" title={p.name} style={{ width: size, height: size, background: p.color, fontSize: size * 0.42 }}>{p.name.replace(/\(.*\)/, '').trim().slice(0, 1).toUpperCase()}</span>
}

const T = {
  en: {
    home: 'Home', start: 'Start', recent: 'Your recent sessions', noRecent: 'Sessions you start or join on this device show up here.',
    how: 'How it works', remove: 'Remove', yourName: 'Your name', save: 'Save', guest: 'Guest', nameHint: 'Shown to others in live sessions.',
    welcome: 'What should we call you?', welcomeHint: 'Your name is shown to the others in this session. No account needed.', namePh: 'e.g. Alex', continue: 'Continue',
    tools: 'Tools', foot: 'Lift Apps by AIYun', live: 'Live', solo: 'On this device', mock: 'Test mode: sessions are stored in this browser only.',
    noBackend: 'Live sessions are not configured on this copy. Single-device tools still work.',
  },
  zh: {
    home: '首页', start: '开始', recent: '最近的会话', noRecent: '你在这台设备上发起或加入的会话会显示在这里。',
    how: '使用方式', remove: '移除', yourName: '你的名字', save: '保存', guest: '访客', nameHint: '在实时会话中显示给其他人。',
    welcome: '怎么称呼你？', welcomeHint: '名字会显示给同一会话里的其他人，无需注册。', namePh: '例如：小王', continue: '继续',
    tools: '工具', foot: 'Lift Apps · AIYun 出品', live: '多人实时', solo: '单机使用', mock: '测试模式：会话只保存在本浏览器。',
    noBackend: '此版本未配置实时会话，单机工具仍可使用。',
  },
}

function parse() {
  const [, view, id, sub] = window.location.hash.replace(/^#/, '').split('/')
  return { view: view || 'home', id, sub }
}

function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [route.view, route.id])
  return route
}

function Identity() {
  const { identity, rename } = useStore()
  const t = T[useLang()]
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(identity.name)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)
  const p = { ...identity, name: identity.name || t.guest }
  const submit = e => { e.preventDefault(); if (name.trim()) { rename(name); setOpen(false) } }
  return (
    <div className="dropdown" ref={ref}>
      <button className="participant-btn" onClick={() => { setName(identity.name); setOpen(o => !o) }} aria-label={t.yourName} aria-expanded={open}>
        <Avatar p={p} size={26} /> <span className="pname">{p.name}</span> <span className="caret">▾</span>
      </button>
      {open && (
        <div className="menu right">
          <div className="menu-title">{t.yourName}</div>
          <form className="menu-form" onSubmit={submit}>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label={t.yourName} maxLength={40} />
            <button className="btn primary sm" disabled={!name.trim()}>{t.save}</button>
          </form>
          <p className="menu-hint">{t.nameHint}</p>
        </div>
      )}
    </div>
  )
}

function NamePrompt() {
  const { rename } = useStore()
  const t = T[useLang()]
  const [name, setName] = useState('')
  return (
    <div className="modal-backdrop">
      <form className="modal welcome" role="dialog" aria-modal="true" aria-label={t.welcome} onSubmit={e => { e.preventDefault(); if (name.trim()) rename(name) }}>
        <div className="modal-head"><h2>{t.welcome}</h2></div>
        <p className="muted">{t.welcomeHint}</p>
        <label className="field-label" htmlFor="np-name">{t.yourName}</label>
        <input id="np-name" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t.namePh} />
        <div className="row end"><button className="btn primary" disabled={!name.trim()}>{t.continue}</button></div>
      </form>
    </div>
  )
}

function Loading() {
  return <div className="empty-page"><span className="spinner" aria-hidden="true" /></div>
}

function AppHome({ app, lang }) {
  const t = T[lang]
  const c = app[lang]
  const kinds = app.tools.filter(x => x.kind)
  const load = () => kinds.flatMap(tool => rememberedDocs(tool.kind).map(d => ({ ...d, tool }))).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 12)
  const [recent, setRecent] = useState(load)
  return (
    <main className="tool-page app-home">
      <section className="app-hero">
        <h1>{c.title}</h1>
        <p className="lead">{c.lead}</p>
        <p className="how"><b>{t.how}:</b> {c.how}</p>
        {backend?.kind === 'mock' && <p className="tool-note small">{t.mock}</p>}
        {!backend && <p className="tool-note small">{t.noBackend}</p>}
      </section>
      {app.Intro && <Suspense fallback={null}><app.Intro /></Suspense>}
      <section className="tool-grid" aria-label={t.tools}>
        {app.tools.map(tool => {
          const [name, line] = tool[lang]
          return (
            <article key={tool.view} className="tool-tile">
              <span className="tool-ico"><Icon name={tool.icon} size={24} /></span>
              <h2>{name}</h2>
              <p>{line}</p>
              <div className="tile-foot">
                <span className="tag">{tool.live ? t.live : t.solo}</span>
                <a className="btn primary sm" href={`#/${tool.view}`}>{t.start} <Icon name="right" size={14} /></a>
              </div>
            </article>
          )
        })}
      </section>
      {kinds.length > 0 && (
        <section className="tool-card">
          <h2>{t.recent}</h2>
          {recent.length ? (
            <ul className="doc-list">
              {recent.map(r => (
                <li key={r.id}>
                  <span className="doc-ico"><Icon name={r.tool.icon} size={16} /></span>
                  <a href={`#/${r.tool.view}/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{r.tool[lang][0]} · {ago(r.at, lang)}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(r.tool.kind, r.id); setRecent(load()) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.noRecent}</p>}
        </section>
      )}
    </main>
  )
}

// app: { key, en/zh: { title, lead, how }, tools: [{ view, icon, kind?, live, en: [name, line], zh: [...], Home, Room? }] }
// Optional: app.Home replaces the default home; app.noIdentity hides the name chip (anonymous apps); a tool with `hidden: true` stays routable but only shows in the strip while open.
export function AppShell({ app }) {
  const lang = useLang()
  const t = T[lang]
  const { identity } = useStore()
  const route = useRoute()
  // An app with a single tool has no home of its own: the tool's lobby is the front page.
  const solo = app.tools.length === 1
  const tool = app.tools.find(x => x.view === route.view) ?? (solo ? app.tools[0] : undefined)
  useEffect(() => {
    const name = app.name
    document.title = tool && !solo ? `${tool[lang][0]} · ${name} · Lift Apps` : `${name} · Lift Apps`
  }, [tool, lang, app.name, solo])
  let page
  if (!tool) page = app.Home ? <app.Home /> : <AppHome app={app} lang={lang} />
  else if (route.id && tool.Room) page = <tool.Room key={route.id} id={route.id} sub={route.sub} />
  else page = <tool.Home />
  const needsName = tool?.live && !tool.noName && backend && !identity.name
  return (
    <div className="app">
      <nav className="subnav no-print" aria-label={t.tools}>
        <div className="subnav-tabs">
          {!solo && <a className={`top-link ${!tool ? 'on' : ''}`} href="#/"><Icon name="home" size={16} /><span className="lbl">{t.home}</span></a>}
          {app.tools.filter(x => !x.hidden || x === tool).map(x => (
            <a key={x.view} className={`top-link ${tool === x ? 'on' : ''}`} href={`#/${x.view}`} aria-current={tool === x ? 'page' : undefined}>
              <Icon name={x.icon} size={16} /><span className="lbl">{x[lang][0]}</span>
            </a>
          ))}
        </div>
        {!app.noIdentity && <Identity />}
      </nav>
      {solo && !route.id && (backend?.kind === 'mock' || !backend) && <p className="tool-note small solo-note">{backend ? t.mock : t.noBackend}</p>}
      <Suspense fallback={<Loading />}>{page}</Suspense>
      <footer className="site-foot no-print"><a href="https://liftapps.com.au">{t.foot}</a></footer>
      {needsName && <NamePrompt />}
    </div>
  )
}
