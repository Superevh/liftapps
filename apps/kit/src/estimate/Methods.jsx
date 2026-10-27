import { Suspense, lazy, useEffect, useState } from 'react'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { rememberedDocs } from '../core/live.js'
import { ago } from '../core/tools-ui.jsx'
import { T } from './i18n.js'

// "Methods & tools": the field guide to estimation methods (with the PERT calculator) and the
// stand-alone tools that are not part of a backlog session.

const Guide = lazy(() => import('../guide/EstimateGuide.jsx'))
const TOOLS = [['sizing', 'grid', 'sizing'], ['confidence', 'thumb', 'confidence'], ['fpa', 'layers', 'fpa-counts']]

export default function Methods({ focus }) {
  const lang = useLang()
  const t = T[lang]
  // Deep link to the calculator: open the guide first, then scroll to it.
  if (focus === 'pert') { try { localStorage.setItem('lift-estimate-guide', 'open') } catch { /* private mode */ } }
  useEffect(() => {
    if (focus !== 'pert') return
    let n = 0
    const h = setInterval(() => {
      const el = document.getElementById('pert')
      if (el || ++n > 40) { clearInterval(h); el?.scrollIntoView({ block: 'center' }); el?.querySelector('input')?.focus({ preventScroll: true }) }
    }, 50)
    return () => clearInterval(h)
  }, [focus])
  const [recent] = useState(() => TOOLS.flatMap(([view, icon, kind]) => rememberedDocs(kind).map(d => ({ ...d, view, icon }))).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 8))
  return (
    <main className="tool-page es-methods">
      <div className="es-page-head">
        <a className="icon-btn" href="#/" aria-label={t.sessions} title={t.sessions}><Icon name="left" /></a>
        <div><h1>{t.toolsTitle}</h1><p className="muted">{t.toolsLead}</p></div>
      </div>
      <section className="es-tools three">
        {TOOLS.map(([k, icon]) => (
          <a key={k} className="es-tool" href={`#/${k}`}>
            <Icon name={icon} size={18} />
            <span><b>{t.tools[k][0]}</b><span className="muted small">{t.tools[k][1]}</span></span>
          </a>
        ))}
      </section>
      {recent.length > 0 && (
        <section className="tool-card">
          <h2 className="es-h3">{t.recentBoards}</h2>
          <ul className="doc-list">
            {recent.map(r => (
              <li key={r.id}>
                <span className="doc-ico"><Icon name={r.icon} size={16} /></span>
                <a href={`#/${r.view}/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{t.tools[r.view][0]} · {ago(r.at, lang)}</span></a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Suspense fallback={<div className="empty-page"><span className="spinner" aria-hidden="true" /></div>}><Guide /></Suspense>
    </main>
  )
}
