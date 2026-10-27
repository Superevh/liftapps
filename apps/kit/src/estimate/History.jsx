import { useState } from 'react'
import { fill } from './i18n.js'

// Estimation history: points accepted per finished session against capacity (a velocity-style
// trend, oldest to newest), plus rounds per story and how often the first reveal already agreed.
// items: [{ id, name, at, points, capacity, done, numeric, rps, consensus, href }]. Used on the home
// page (sessions on this device) and on a team page (sessions recorded in the team, any device).
export function History({ items, t, lang, lead, title }) {
  const list = items.filter(e => e.numeric !== false && e.done > 0).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).slice(-8)
  const [pick, setPick] = useState(null)
  if (!list.length) return null
  const max = Math.max(...list.map(e => Math.max(e.points ?? 0, e.capacity ?? 0)), 1)
  const avg = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  const r1 = n => (n == null ? '–' : (Math.round(n * 10) / 10).toString())
  const velocity = avg(list.map(e => e.points ?? 0))
  const fit = avg(list.filter(e => e.capacity).map(e => (e.points ?? 0) / e.capacity))
  const rps = avg(list.filter(e => e.rps != null).map(e => e.rps))
  const cons = avg(list.filter(e => e.consensus != null).map(e => e.consensus))
  const day = at => new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short' })
  const sel = list.find(e => e.id === pick)
  return (
    <section className="es-section" aria-labelledby="es-hist">
      <div className="es-section-head">
        <div><h2 id="es-hist">{title ?? t.histTitle}</h2><p className="muted es-sub">{lead(list.length)}</p></div>
      </div>
      <div className="tool-card es-histcard">
        <dl className="es-hist-stats">
          <div><dt>{t.histVelocity}</dt><dd>{r1(velocity)}<small> {t.pts}</small></dd></div>
          <div><dt>{t.histFit}</dt><dd>{fit == null ? '–' : `${Math.round(fit * 100)}%`}</dd></div>
          <div><dt>{t.histRounds}</dt><dd>{r1(rps)}</dd></div>
          <div><dt>{t.histConsensus}</dt><dd>{cons == null ? '–' : `${Math.round(cons * 100)}%`}</dd></div>
        </dl>
        <ol className="es-trend" aria-label={t.histChart}>
          {list.map(e => {
            const over = e.capacity && e.points > e.capacity
            const label = `${e.name} · ${e.points} ${t.pts}${e.capacity ? ` / ${e.capacity}` : ''} · ${day(e.at)}`
            return (
              <li key={e.id} className={pick === e.id ? 'on' : ''}>
                <button className="es-trend-btn" onClick={() => setPick(p => (p === e.id ? null : e.id))} aria-pressed={pick === e.id} aria-label={label} title={label}>
                  <span className="es-trend-n">{e.points}</span>
                  <span className="es-trend-col">
                    {e.capacity ? <i className="es-trend-cap" style={{ bottom: `${(e.capacity / max) * 100}%` }} /> : null}
                    <b className={over ? 'over' : ''} style={{ height: `${Math.max(2, ((e.points ?? 0) / max) * 100)}%` }} />
                  </span>
                  <span className="es-trend-name">{e.name}</span>
                  <span className="es-trend-d">{day(e.at)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {sel ? (
          <p className="es-trend-sel" aria-live="polite">
            <b>{sel.name}</b> · {fill(sel.capacity ? t.capFit : t.histPtsOnly, { p: sel.points, c: sel.capacity })} · {day(sel.at)}
            {sel.href && <> · <a href={sel.href}>{t.open}</a></>}
          </p>
        ) : (
          <p className="muted small es-trend-key"><span className="es-key-bar" /> {t.histPoints} <span className="es-key-cap" /> {t.histCap} <span className="es-trend-tip">{t.histTap}</span></p>
        )}
      </div>
    </section>
  )
}
