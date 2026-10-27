import { useMemo, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { backend } from '../core/live.js'
import { navigate } from '../core/ui.jsx'
import { useT } from './i18n.js'
import { Icon, Toaster, itemIcon, useNameGate } from './common.jsx'
import { createMeeting, rememberedTeams } from './store.js'
import { NEW_TEAM } from './TeamPage.jsx'
import { MEETING_TEMPLATES, BLANK, LIBRARY_CATS, templateById, templateItems, templateMinutes, searchLibrary, LIBRARY } from './templates.js'
import { CADENCES, todayStr, clockAt } from './model.js'
import './meeting.css'

export function NewMeeting({ tpl: initial }) {
  const [t, lang] = useT()
  const { identity } = useStore()
  const first = templateById(initial) ? initial : 'weekly'
  const [tplId, setTplId] = useState(first)
  const tpl = templateById(tplId) ?? BLANK
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [cadence, setCadence] = useState(tpl.cadence ?? 'none')
  const [touchedCadence, setTouchedCadence] = useState(false)
  const [libOpen, setLibOpen] = useState(() => !MEETING_TEMPLATES.some(x => x.id === first) && first !== 'blank')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [gate, nameDialog] = useNameGate()
  // Coming from a team page preselects that team; any team remembered on this device can be picked.
  const [teams] = useState(() => {
    let handed = null
    try { handed = JSON.parse(sessionStorage.getItem(NEW_TEAM)) } catch { /* none */ }
    const list = rememberedTeams().map(x => ({ id: x.id, name: x.name }))
    return { list: handed && !list.some(x => x.id === handed.id) ? [handed, ...list] : list, handed }
  })
  const [teamId, setTeamId] = useState(teams.handed?.id ?? '')
  const items = useMemo(() => templateItems(tpl, lang), [tpl, lang])
  const total = templateMinutes(tpl)
  const shown = useMemo(() => searchLibrary(query, cat), [query, cat])

  const pick = id => {
    setTplId(id)
    const x = templateById(id)
    if (!touchedCadence) setCadence(x?.cadence ?? 'none')
  }
  const create = e => { e?.preventDefault(); if (!busy && backend) gate(doCreate) }
  const doCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const goal = tpl.goal ? tpl.goal[lang === 'zh' ? 1 : 0] : ''
      const team = teams.list.find(x => x.id === teamId) ?? null
      try { sessionStorage.removeItem(NEW_TEAM) } catch { /* storage blocked */ }
      const doc = await createMeeting({ team, title: title.trim() || (tplId === 'blank' ? t.untitled : tpl[lang][0]), date, time, cadence, goal, items }, identity)
      navigate(`/m/${doc.id}/plan`)
    } catch (err) { setBusy(false); setError(err.message) }
  }

  const card = x => (
    <button key={x.id} type="button" className={`mt-tpl ${tplId === x.id ? 'sel' : ''}`} aria-pressed={tplId === x.id} onClick={() => pick(x.id)} data-tpl={x.id}>
      <span className="mt-tpl-meta">{x.id === 'blank' ? '—' : t.minutes(templateMinutes(x))}{x.cadence && x.cadence !== 'none' ? ` · ${t.cadence[x.cadence]}` : ''}</span>
      <b>{x[lang][0]}</b>
      <span>{x[lang][1]}</span>
    </button>
  )

  return (
    <main className="tool-page mt-new">
      <a className="mt-back" href="#/"><Icon name="left" size={14} /> {t.back}</a>
      <header className="mt-page-head">
        <h1>{t.newTitle}</h1>
        <p className="mt-lead">{t.newLead}</p>
      </header>
      {!backend && <p className="tool-note small">{t.offline}</p>}
      <form className="mt-new-grid" onSubmit={create}>
        <div className="mt-col">
          <section className="tool-card mt-card">
            <label className="field-label" htmlFor="mt-title">{t.title}</label>
            <input id="mt-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={tplId === 'blank' ? t.titlePh : tpl[lang][0]} maxLength={120} />
            <div className="mt-fields3">
              <div><label className="field-label" htmlFor="mt-date">{t.date}</label><input id="mt-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><label className="field-label" htmlFor="mt-time">{t.time}</label><input id="mt-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
              <div><label className="field-label" htmlFor="mt-cad">{t.repeats}</label>
                <select id="mt-cad" value={cadence} onChange={e => { setCadence(e.target.value); setTouchedCadence(true) }}>
                  {CADENCES.map(c => <option key={c} value={c}>{t.cadence[c]}</option>)}
                </select>
              </div>
            </div>
            {teams.list.length > 0 && (
              <>
                <label className="field-label" htmlFor="mt-team">{t.linkTeam}</label>
                <select id="mt-team" value={teamId} onChange={e => setTeamId(e.target.value)}>
                  <option value="">{t.noTeam}</option>
                  {teams.list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </>
            )}
          </section>
          <section className="tool-card mt-card">
            <h2>{t.meetingTemplates}</h2>
            <div className="mt-tpl-grid">
              {MEETING_TEMPLATES.map(card)}
              {card(BLANK)}
            </div>
          </section>
          <section className="tool-card mt-card">
            <button type="button" className="mt-disclose" aria-expanded={libOpen} onClick={() => setLibOpen(o => !o)}>
              <Icon name={libOpen ? 'down' : 'right'} size={14} /> {t.workshopLibrary} <span className="mt-count">{LIBRARY.length}</span>
            </button>
            {libOpen && (
              <>
                <p className="muted small">{t.libraryHint(LIBRARY.length)}</p>
                <input type="search" className="mt-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPh} aria-label={t.searchPh} />
                <div className="chip-row mt-cats">
                  <button type="button" className={`chip-btn ${!cat ? 'sel' : ''}`} aria-pressed={!cat} onClick={() => setCat(null)}>{t.allCats}</button>
                  {LIBRARY_CATS.map(c => <button type="button" key={c.id} className={`chip-btn ${cat === c.id ? 'sel' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c[lang]}</button>)}
                </div>
                {shown.length ? <div className="mt-tpl-grid">{shown.map(card)}</div> : <p className="muted">{t.noMatch}</p>}
              </>
            )}
          </section>
        </div>
        <aside className="mt-col mt-sticky">
          <section className="tool-card mt-card mt-preview">
            <div className="mt-card-head"><h2>{t.preview}</h2><span className="mt-total">{t.minutes(total)}</span></div>
            <p className="mt-preview-name">{tpl[lang][0]}</p>
            {items.length ? (
              <ol className="mt-preview-list">
                {items.map((x, i) => {
                  const from = items.slice(0, i).reduce((n, y) => n + y.minutes, 0)
                  return (
                    <li key={i}>
                      <span className="mt-preview-ico"><Icon name={itemIcon(x)} size={14} /></span>
                      <span className="grow">{x.title}<em>{x.type === 'activity' && x.activity ? t.acts[x.activity] : t.types[x.type]}</em></span>
                      <span className="mt-preview-min">{time ? clockAt(time, from) : t.minutes(x.minutes)}</span>
                    </li>
                  )
                })}
              </ol>
            ) : <p className="muted">{t.emptyAgenda}</p>}
            {error && <p className="mt-error" role="alert">{error}</p>}
            <button className="btn primary lg mt-create" disabled={busy || !backend}>{busy ? t.creating : <><Icon name="plus" /> {t.create}</>}</button>
          </section>
        </aside>
      </form>
      {nameDialog}
      <Toaster />
    </main>
  )
}
