import { useState } from 'react'
import { rememberedDocs, forgetDoc } from '../core/live.js'
import { ago } from '../core/tools-ui.jsx'
import { useT } from './i18n.js'
import { Icon } from './common.jsx'
import './meeting.css'

// The original stand-alone tools stay reachable (and every old link still opens), but they sit
// behind the meeting product as a secondary toolkit.
export const TOOLS = [
  { view: 'leancoffee', icon: 'coffee', kind: 'leancoffee', en: ['Lean Coffee', 'An agenda-less session: topics, dot-votes, short time-boxes.'], zh: ['精益咖啡', '没有预设议程：提话题、点投票、分段限时讨论。'] },
  { view: 'icebreakers', icon: 'balloon', kind: 'icebreakers', en: ['Icebreakers', 'Check-in questions and meeting bingo for any group.'], zh: ['破冰', '签到问题和会议宾果，适合任何场合。'] },
  { view: 'agenda', icon: 'agenda', kind: 'agendas', en: ['Workshop agenda', '37 workshop templates, run full screen with a countdown.'], zh: ['工作坊议程', '37 个工作坊模板，全屏倒计时运行。'] },
  { view: 'meetingcost', icon: 'coin', en: ['Meeting cost clock', 'A private cost ticker and a recurring-meeting calculator.'], zh: ['会议成本计时', '只在本机运行的成本计时器，和例会成本计算器。'] },
]

export function ToolkitStrip({ t, lang }) {
  return (
    <section className="mt-toolkit" aria-label={t.toolkit}>
      <div className="mt-card-head"><div><h2>{t.toolkit}</h2><p className="muted small mt-sub">{t.toolkitLead}</p></div><a className="mt-more-link" href="#/toolkit">{t.openToolkit} <Icon name="right" size={14} /></a></div>
      <div className="mt-toolkit-grid">
        {TOOLS.map(x => (
          <a key={x.view} className="mt-tool" href={`#/${x.view}`}>
            <span className="mt-tool-ico"><Icon name={x.icon} size={18} /></span>
            <span><b>{x[lang][0]}</b><span>{x[lang][1]}</span></span>
          </a>
        ))}
      </div>
    </section>
  )
}

export function ToolkitPage() {
  const [t, lang] = useT()
  const load = () => TOOLS.filter(x => x.kind).flatMap(tool => rememberedDocs(tool.kind).map(d => ({ ...d, tool }))).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 15)
  const [recent, setRecent] = useState(load)
  return (
    <main className="tool-page mt-page-narrow">
      <header className="mt-page-head">
        <div className="hero-eyebrow">{t.homeEyebrow}</div>
        <h1>{t.toolkitTitle}</h1>
        <p className="mt-lead">{t.toolkitPage}</p>
      </header>
      <div className="tool-grid">
        {TOOLS.map(x => (
          <article key={x.view} className="tool-tile">
            <span className="tool-ico"><Icon name={x.icon} size={22} /></span>
            <h2>{x[lang][0]}</h2>
            <p>{x[lang][1]}</p>
            <div className="tile-foot"><span /><a className="btn ghost sm" href={`#/${x.view}`}>{t.open2} <Icon name="right" size={14} /></a></div>
          </article>
        ))}
      </div>
      {recent.length > 0 && (
        <section className="tool-card">
          <h2>{t.recentSessions}</h2>
          <ul className="doc-list">
            {recent.map(r => (
              <li key={r.tool.kind + r.id}>
                <span className="doc-ico"><Icon name={r.tool.icon} size={16} /></span>
                <a href={`#/${r.tool.view}/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{r.tool[lang][0]} · {ago(r.at, lang)}</span></a>
                <button className="icon-btn" aria-label={t.forget} title={t.forget} onClick={() => { forgetDoc(r.tool.kind, r.id); setRecent(load()) }}><Icon name="x" size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
