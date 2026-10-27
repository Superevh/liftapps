import { useState } from 'react'
import { Icon } from '../core/icons.jsx'
import { fill } from './i18n.js'
import { progress, statusOf, isSplitInto, stageOf, nameOf, confidenceTally, sessionCsv, sessionTsv, sessionMarkdown, sessionJiraText, jiraUpdateCsv, jiraUpdateCount } from './model.js'
import { copyText, download, Bar } from './bits.jsx'
import { StatusBadge } from './Session.jsx'

// The session summary: totals, capacity fit, flagged stories, the full table with vote history,
// and exports for spreadsheets, Markdown, Jira comments and Jira's CSV importer.

export default function Summary({ doc, t, lang, canRun, dispatch, show }) {
  const p = progress(doc)
  const who = pid => nameOf(doc, doc.people[pid], t.guest)
  const conf = doc.confidence ? confidenceTally(doc.confidence) : null
  const confShown = doc.confidence?.revealed && conf?.average != null
  const over = p.capacity && p.points > p.capacity
  const [cap, setCap] = useState('')
  const copy = text => copyText(text).then(() => show(t.copiedT), () => {})
  const file = (doc.name || 'estimates').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const groups = [['split', t.tooBig], ['skipped', t.skippedT], ['open', t.openT]]
    .map(([st, label]) => [st, label, doc.stories.filter(s => statusOf(s) === st && !isSplitInto(doc, s))]).filter(([, , list]) => list.length)
  const historyOf = s => (doc.history ?? []).filter(h => h.storyId === s.id && Object.keys(h.votes ?? {}).length)
  const jira = jiraUpdateCount(doc)
  const rounds = doc.stories.reduce((n, s) => n + (s.rounds ?? 0), 0)
  const agreed = (doc.history ?? []).filter(h => h.kind === 'agreed').length
  const date = new Date(doc.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="es-body es-summary">
      <section className="es-sum-head">
        <div>
          <span className="es-eyebrow">{t.sumTitle} · {date}</span>
          <h2>{doc.name}</h2>
        </div>
        {canRun && (stageOf(doc) !== 'done'
          ? <button className="btn primary" onClick={() => dispatch({ type: 'STAGE', stage: 'done' })}><Icon name="check" /> {t.finish}</button>
          : <button className="btn ghost sm" onClick={() => dispatch({ type: 'STAGE', stage: 'estimate' })}>{t.reopenS}</button>)}
      </section>

      <section className="es-tiles">
        <div className="es-tile">
          <span>{p.numeric ? t.totalPts : t.estimated}</span>
          <b>{p.numeric ? p.points : p.done}</b>
          <small className="muted">{p.numeric ? (p.capacity ? fill(t.capOf, { p: p.points, c: p.capacity }) : t.storiesN(p.done)) : p.sizes.filter(([, n]) => n).map(([v, n]) => `${v}×${n}`).join(' · ') || '–'}</small>
        </div>
        <div className="es-tile">
          <span>{t.estimated}</span>
          <b>{p.done}<em>/{p.total}</em></b>
          <small className="muted">{[t.rounds(rounds), agreed ? `${agreed} ${t.agreedAheadTag}` : null].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="es-tile">
          <span>{t.flagged}</span>
          <b>{p.split + p.skipped + p.open || '–'}</b>
          <small className="muted">{[p.split && `${t.st.split} ${p.split}`, p.skipped && `${t.st.skipped} ${p.skipped}`, p.open && `${t.st.open} ${p.open}`].filter(Boolean).join(' · ') || '–'}</small>
        </div>
        <div className="es-tile">
          <span>{t.confidence}</span>
          <b>{confShown ? (Math.round(conf.average * 10) / 10).toString() : '–'}<em>{confShown ? '/5' : ''}</em></b>
          <small className="muted">{confShown ? t.confVoted(conf.n) : t.confNotStarted}</small>
        </div>
      </section>

      {p.numeric && (
        <section className={`tool-card es-capcard ${over ? 'over' : ''}`}>
          <div className="es-capcard-head">
            <h3>{t.capacityFit}</h3>
            {p.capacity ? <b>{fill(t.capOf, { p: p.points, c: p.capacity })}</b> : <span className="muted">{t.noCap}</span>}
          </div>
          {p.capacity ? <>
            <Bar value={p.points} max={p.capacity} over={over} />
            <p className={over ? 'es-over-text' : 'muted'}>{over ? fill(t.over, { n: Math.round((p.points - p.capacity) * 10) / 10 }) : `${t.fits} · ${fill(t.capLeft, { n: Math.round((p.capacity - p.points) * 10) / 10 })}`}</p>
          </> : canRun && (
            <form className="es-inline" onSubmit={e => { e.preventDefault(); dispatch({ type: 'CAPACITY', points: Number(cap) || 0 }) }}>
              <input type="number" min="0" step="any" value={cap} onChange={e => setCap(e.target.value)} placeholder={t.capacityPh} aria-label={t.capacity} className="es-num" />
              <button className="btn ghost sm" disabled={!(Number(cap) > 0)}>{t.setCap}</button>
            </form>
          )}
        </section>
      )}

      <section className="tool-card es-export">
        <div className="es-export-row">
          <button className="btn ghost sm" onClick={() => copy(sessionTsv(doc, who, t.head, t.st))}><Icon name="copy" /> {t.copyTable}</button>
          <button className="btn ghost sm" onClick={() => copy(sessionMarkdown(doc, who, t.head, t.st))}><Icon name="copy" /> {t.copyMd}</button>
          <button className="btn ghost sm" onClick={() => copy(sessionJiraText(doc, p.numeric ? t.pts : '', t.st))}><Icon name="copy" /> {t.copyJira}</button>
          <button className="btn ghost sm" onClick={() => download(`${file}.csv`, sessionCsv(doc, who))}><Icon name="download" /> {t.csv}</button>
          {p.numeric && jira > 0 && <button className="btn ghost sm" onClick={() => download(`${file} (Jira).csv`, jiraUpdateCsv(doc))}><Icon name="download" /> {t.jiraCsv}</button>}
        </div>
        <p className="muted small">{p.numeric ? (jira > 0 ? `${t.exportHint} ${t.jiraCsvHint(jira)}` : t.exportHint) : t.exportHintSizes}</p>
      </section>

      {groups.length > 0 && (
        <section className="es-flags">
          {groups.map(([st, label, list]) => (
            <div key={st} className={`tool-card es-flagcard st-${st}`}>
              <h3><Icon name={st === 'split' ? 'flag' : st === 'skipped' ? 'skip' : 'timer'} size={16} /> {label} <span className="muted">{list.length}</span></h3>
              <ul>{list.map(s => <li key={s.id}>{s.key && <span className="es-key">{s.key}</span>}{s.title}</li>)}</ul>
            </div>
          ))}
        </section>
      )}

      <section className="tool-card es-table-card">
        {doc.stories.length === 0 ? <p className="muted">{t.nothingYet}</p> : (
          <table className="es-sumtable">
            <thead><tr><th className="num">#</th><th>{t.head[0]}</th><th>{t.head[1]}</th><th className="num">{t.head[2]}</th></tr></thead>
            <tbody>
              {doc.stories.map((s, i) => {
                const hist = historyOf(s)
                return (
                  <tr key={s.id} className={`st-${statusOf(s)}`}>
                    <td className="num muted">{i + 1}</td>
                    <td className="es-td-key">{s.key || <span className="muted">–</span>}</td>
                    <td>
                      <span className="es-td-title">{s.title}</span>
                      {hist.length > 0 && (
                        <details className="es-hist">
                          <summary>{t.history} · {t.rounds(hist.length)}</summary>
                          <ol>
                            {hist.map((h, j) => (
                              <li key={j}>
                                <span className="muted small">{h.kind === 'agreed' ? t.agreedAheadTag : fill(t.round, { n: h.round || j + 1 })}{h.value ? ` → ${h.value}` : ''}</span>
                                <span className="es-hist-votes">{Object.entries(h.votes).map(([pid, v]) => <span key={pid}>{who(pid)} <b>{v}</b></span>)}</span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </td>
                    <td className="num">{statusOf(s) === 'open' ? <span className="muted">–</span> : <StatusBadge s={s} t={t} doc={doc} />}</td>
                  </tr>
                )
              })}
            </tbody>
            {p.numeric && p.done > 0 && <tfoot><tr><td /><td /><td>{t.totalPts}</td><td className="num"><b>{p.points}</b></td></tr></tfoot>}
          </table>
        )}
      </section>
    </div>
  )
}
