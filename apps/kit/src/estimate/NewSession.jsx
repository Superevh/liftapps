import { useMemo, useState } from 'react'
import { useStore } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { backend, rememberedDocs } from '../core/live.js'
import { TEAM_KIND } from './team.js'
import { T, fill } from './i18n.js'
import { DECKS, DECK_IDS, parseBacklog } from './model.js'
import { createSession } from './App.jsx'

// Creating a session: name, scale, optional capacity and pre-voting, and the backlog in one paste.
const PRESETS = {
  sprint: { deck: 'fib', async: false, capacity: true },
  refine: { deck: 'modfib', async: true, capacity: false },
  roadmap: { deck: 'tshirt', async: false, capacity: false },
  quick: { deck: 'fib', async: false, capacity: false },
}

export default function NewSession({ template, teamId }) {
  const lang = useLang()
  const t = T[lang]
  const { identity, rename } = useStore()
  const preset = PRESETS[template] ?? PRESETS.sprint
  const [name, setName] = useState('')
  const [me, setMe] = useState(identity.name)
  const [deck, setDeck] = useState(preset.deck)
  const [custom, setCustom] = useState('')
  const [capacity, setCapacity] = useState('')
  const [async, setAsync] = useState(preset.async)
  const [text, setText] = useState('')
  const teams = useMemo(() => rememberedDocs(TEAM_KIND), [])
  const [team, setTeam] = useState(teamId && teams.some(x => x.id === teamId) ? teamId : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const items = useMemo(() => parseBacklog(text), [text])
  const customDeck = custom.split(/[,，\s]+/).map(x => x.trim()).filter(Boolean).slice(0, 20)
  const numeric = deck !== 'tshirt'
  const placeholderName = PRESETS[template] ? t.tpl[template][0] : t.sNamePh

  const submit = e => {
    e?.preventDefault()
    if (!backend || busy) return
    if (me.trim() && me.trim() !== identity.name) rename(me)
    setBusy(true)
    const who = { ...identity, name: me.trim() || identity.name }
    createSession({
      identity: who, name: name.trim() || (PRESETS[template] ? t.tpl[template][0] : t.newTitle),
      deck: deck === 'custom' && !customDeck.length ? 'fib' : deck, customDeck,
      capacity: numeric ? Number(capacity) || null : null, async, items, team: teams.find(x => x.id === team) ?? null,
    }).catch(err => { setBusy(false); setError(err.message) })
  }

  return (
    <main className="tool-page es-new">
      <div className="es-page-head">
        <a className="icon-btn" href="#/" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <div><h1>{t.newTitle}</h1><p className="muted">{t.newLead}</p></div>
      </div>
      <form className="es-new-grid" onSubmit={submit} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }}>
        <section className="tool-card es-form">
          <label className="field-label" htmlFor="ns-name">{t.sName}</label>
          <input id="ns-name" value={name} onChange={e => setName(e.target.value)} placeholder={placeholderName} maxLength={80} autoFocus />
          <label className="field-label" htmlFor="ns-me">{t.yourNameOpt}</label>
          <input id="ns-me" value={me} onChange={e => setMe(e.target.value)} placeholder={t.yourNamePh} maxLength={40} />

          <fieldset className="es-fieldset">
            <legend className="field-label">{t.deck}</legend>
            <div className="chip-row" role="radiogroup" aria-label={t.deck}>
              {DECK_IDS.map(d => <button type="button" role="radio" aria-checked={deck === d} key={d} className={`chip-btn ${deck === d ? 'sel' : ''}`} onClick={() => setDeck(d)}>{t.decks[d]}</button>)}
            </div>
            {deck === 'custom'
              ? <input className="mt8" value={custom} onChange={e => setCustom(e.target.value)} placeholder={t.customPh} aria-label={t.custom} />
              : <p className="deck-preview">{DECKS[deck].join('  ·  ')}</p>}
          </fieldset>

          {numeric && <>
            <label className="field-label" htmlFor="ns-cap">{t.capacity}</label>
            <div className="es-inline">
              <input id="ns-cap" type="number" inputMode="decimal" min="0" step="any" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={t.capacityPh} className="es-num" aria-describedby="ns-cap-hint" />
              <span className="muted small">{t.pts}</span>
            </div>
            <p className="muted small es-hint" id="ns-cap-hint">{t.capacityHint}</p>
          </>}

          {teams.length > 0 && <>
            <label className="field-label" htmlFor="ns-team">{t.team}</label>
            <select id="ns-team" value={team} onChange={e => setTeam(e.target.value)}>
              <option value="">{t.noTeam}</option>
              {teams.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <p className="muted small es-hint">{t.teamPick}</p>
          </>}

          <label className="es-switch">
            <input type="checkbox" checked={async} onChange={e => setAsync(e.target.checked)} />
            <span><b>{t.asyncLabel}</b><span className="muted small">{t.asyncHint}</span></span>
          </label>
        </section>

        <section className="tool-card es-form">
          <label className="field-label" htmlFor="ns-backlog">{t.backlog}</label>
          <textarea id="ns-backlog" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder={t.backlogPh} aria-describedby="ns-backlog-hint" spellCheck={false} />
          <p className="muted small es-hint" id="ns-backlog-hint">{t.backlogHint}</p>
          {items.length > 0 ? (
            <div className="es-preview" aria-live="polite">
              <span className="es-preview-head"><Icon name="check" size={15} /> {t.parsed(items.length)}</span>
              <ol>
                {items.slice(0, 6).map((x, i) => <li key={i}>{x.key && <span className="es-key">{x.key}</span>}<span className="ellipsis">{x.title}</span>{x.estimate && <span className="es-est sm">{x.estimate}</span>}</li>)}
              </ol>
              {items.length > 6 && <span className="muted small">{fill(t.more, { n: items.length - 6 })}</span>}
            </div>
          ) : <p className="muted small es-hint">{t.noBacklog}</p>}
        </section>

        <div className="es-new-foot">
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn primary lg" disabled={busy || !backend}><Icon name="plus" /> {busy ? t.creating : t.create}</button>
        </div>
      </form>
    </main>
  )
}
