import { today, addMonths } from './dates.js'
import { dateRange } from './format.js'

// Now / Next / Later: the same items grouped for stakeholders.
export function bucket(it, now, soon) {
  if (it.status === 'done') return 'done'
  if (it.status === 'progress' || it.start <= now) return 'now'
  return it.start <= soon ? 'next' : 'later'
}

export default function Board({ rm, t, showDone, selId, onSelect }) {
  const now = today(), soon = addMonths(now, 3)
  const lanes = new Map(rm.lanes.map(l => [l.id, l]))
  const cols = [['now', t.now, t.nowHint], ['next', t.next, t.nextHint], ['later', t.later, t.laterHint]]
  if (showDone) cols.push(['done', t.doneCol, t.doneHint])
  const groups = Object.fromEntries(cols.map(([k]) => [k, []]))
  const laneOrder = new Map(rm.lanes.map((l, i) => [l.id, i]))
  for (const it of [...rm.items].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : laneOrder.get(a.laneId) - laneOrder.get(b.laneId)))) {
    groups[bucket(it, now, soon)]?.push(it)
  }
  return (
    <div className={`board cols-${cols.length}`}>
      {cols.map(([k, label, hint]) => (
        <section key={k} className={`col col-${k}`} aria-label={label}>
          <header><h2>{label}</h2><span className="count">{groups[k].length}</span><p>{hint}</p></header>
          <div className="cards">
            {groups[k].length === 0 && <p className="empty">{t.empty}</p>}
            {groups[k].map(it => {
              const lane = lanes.get(it.laneId)
              return (
                <button key={it.id} className={`card st-${it.status} ${selId === it.id ? 'sel' : ''}`} style={{ '--c': lane?.color }} onClick={() => onSelect(it.id)}>
                  <span className="card-lane"><i />{lane?.name}</span>
                  <b>{it.title || t.untitledItem}</b>
                  <span className="card-meta"><span>{dateRange(t, it.start, it.end)}</span><span className={`chip st-${it.status}`}>{t.st[it.status]}</span></span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
