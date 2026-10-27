import { TEMPLATE_IDS, colorVar } from './store.js'
import { depInfo } from './logic.js'
import { today, toDay } from './dates.js'
import { dayMonth } from './format.js'
import { ChangeRow } from './Changes.jsx'
import Icon from './icons.jsx'

// A small picture of a roadmap: one line per lane, bars in lane colours, today marked.
function MiniMap({ rm }) {
  const dated = rm.items.filter(i => i.start)
  const now = today()
  if (!dated.length) return <div className="mini-map empty" aria-hidden="true" />
  const lo = Math.min(toDay(now) - 30, ...dated.map(i => toDay(i.start))), hi = Math.max(toDay(now) + 60, ...dated.map(i => toDay(i.end) + 1))
  const lanes = rm.lanes.slice(0, 5), W = 300, H = 10 + lanes.length * 10
  const x = d => ((d - lo) / (hi - lo)) * W
  return (
    <svg className="mini-map" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {lanes.map((l, k) => dated.filter(i => i.laneId === l.id).map(i => (
        <rect key={i.id} x={x(toDay(i.start))} y={5 + k * 10} width={Math.max(3, x(toDay(i.end) + 1) - x(toDay(i.start)) - 1.5)} height="6" rx="3" style={{ fill: colorVar(l.color) }} opacity={i.status === 'done' ? 0.45 : i.status === 'idea' ? 0.55 : 1} />
      )))}
      <line x1={x(toDay(now))} x2={x(toDay(now))} y1="0" y2={H} className="mini-today" />
    </svg>
  )
}

export default function Home({ ws, t, onOpen, onTemplate, meId }) {
  const now = today()
  const recent = [...ws.log].sort((a, b) => b.at - a.at).slice(0, 8)
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <span className="eyebrow">{t.workspace}</span>
          <h2>{ws.name || t.untitledWs}</h2>
          <p>{t.overviewSub(ws.roadmaps.length)}</p>
        </header>

        {ws.roadmaps.length === 0 && (
          <div className="home-empty">
            <Icon name="map" size={28} />
            <h3>{t.noRoadmaps}</h3>
            <p>{t.noRoadmapsBody}</p>
          </div>
        )}

        {ws.roadmaps.length > 0 && (
          <div className="rm-cards">
            {ws.roadmaps.map(r => {
              const n = r.items.length, prog = r.items.filter(i => i.status === 'progress').length, risk = r.items.filter(i => i.status === 'risk').length
              const done = n ? Math.round((r.items.filter(i => i.status === 'done').length / n) * 100) : 0
              const next = [...r.milestones].filter(m => m.date >= now).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
              const conflicts = depInfo(r).conflicts.size
              return (
                <button key={r.id} className="rm-card" onClick={() => onOpen(r.id)}>
                  <span className="rm-card-top"><b>{r.name || t.untitled}</b><Icon name="chevronR" size={16} /></span>
                  {r.desc && <span className="rm-card-desc">{r.desc}</span>}
                  <MiniMap rm={r} />
                  <span className="rm-stats">
                    <span>{t.statItems(n)}</span>
                    {prog > 0 && <span>{t.statProgress(prog)}</span>}
                    {risk > 0 && <span className="warn"><Icon name="warn" size={12} sw={2.2} />{t.statRisk(risk)}</span>}
                    {conflicts > 0 && <span className="warn">{t.conflictsCount(conflicts)}</span>}
                    <span>{t.statDone(done)}</span>
                  </span>
                  <span className="rm-next"><Icon name="diamond" size={12} />{next ? <>{t.nextMs}: <b>{next.title || t.untitledMilestone}</b> · {dayMonth(t, next.date)}</> : t.noMs}</span>
                </button>
              )
            })}
          </div>
        )}

        <section className="home-sec">
          <h3>{t.startFromTemplate}</h3>
          <div className="tpl-cards">
            {TEMPLATE_IDS.map(id => (
              <button key={id} className={`tpl-card tpl-${id}`} onClick={() => onTemplate(id)}>
                <span className="tpl-art" aria-hidden="true"><i /><i /><i /></span>
                <b>{t.tpl[id][0]}</b><span>{t.tpl[id][1]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-sec">
          <h3>{t.recentChanges}</h3>
          {recent.length ? <ul className="chg-list">{recent.map(e => <ChangeRow key={e.id} e={e} t={t} ws={ws} meId={meId} showRm />)}</ul> : <p className="muted">{t.noChanges}</p>}
        </section>
      </div>
    </div>
  )
}
