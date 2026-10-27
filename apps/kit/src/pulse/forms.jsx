import { useState } from 'react'
import { useStore, newBoardId } from '../core/store.jsx'
import { createDoc, newDocId, rememberDoc, backend } from '../core/live.js'
import { navigate } from '../core/ui.jsx'
import { Icon } from '../core/icons.jsx'
import { newCheck } from '../health/model.js'
import { TEMPLATES, templateQuestions, newTeam, CADENCES, MIN_ANON } from './model.js'
import { useT, fill, Modal, rememberTeam, CHECKS, fmtDate, sha256hex, saveHostKey, rovingKeys } from './bits.jsx'

export function parseCustom(text) {
  return text.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).slice(0, 20)
    .map(([title, good = '', bad = ''], i) => ({ id: `c${i}`, emoji: '•', title: title.slice(0, 60), good: good.slice(0, 200), bad: bad.slice(0, 200) }))
}
export const customText = qs => (qs ?? []).map(q => [q.title, q.good, q.bad].filter(Boolean).join(' | ')).join('\n')

// Question-set picker shared by every form.
export function QuestionPicker({ value, onChange, custom, onCustom, idp }) {
  const [t, lang] = useT()
  const keys = Object.keys(TEMPLATES)
  const qs = value === 'custom' ? parseCustom(custom) : templateQuestions(value, lang)
  return (
    <>
      <div className="pl-tpls" role="radiogroup" aria-labelledby={`${idp}-set`} onKeyDown={rovingKeys}>
        {keys.map(k => (
          <button type="button" key={k} role="radio" aria-checked={value === k} tabIndex={value === k ? 0 : -1} className={`pl-tpl ${value === k ? 'sel' : ''}`} onClick={() => onChange(k)}>
            <b>{TEMPLATES[k][lang][0]}</b><span>{TEMPLATES[k][lang][1]}</span><small>{fill(t.create.areas, { n: templateQuestions(k, lang).length })}</small>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={value === 'custom'} tabIndex={value === 'custom' ? 0 : -1} className={`pl-tpl ${value === 'custom' ? 'sel' : ''}`} onClick={() => onChange('custom')}>
          <b>{t.create.custom}</b><span>{t.create.customPh.split(':')[0]}</span>
        </button>
      </div>
      {value === 'custom'
        ? <textarea className="mt8" rows={5} value={custom} onChange={e => onCustom(e.target.value)} placeholder={t.create.customPh} aria-label={t.create.custom} />
        : <div className="pl-preview">{qs.map(q => <span key={q.id} title={q.good}>{q.emoji} {q.title}</span>)}</div>}
    </>
  )
}

export function CadenceSelect({ value, onChange, id }) {
  const [t] = useT()
  return <select id={id} value={value} onChange={e => onChange(+e.target.value)}>{CADENCES.map(c => <option key={c} value={c}>{t.cad[c]}</option>)}</select>
}

export function CreateTeamModal({ onClose }) {
  const [t] = useT()
  const { identity } = useStore()
  const [name, setName] = useState('')
  const [tpl, setTpl] = useState('squad')
  const [custom, setCustom] = useState('')
  const [cad, setCad] = useState(14)
  const [size, setSize] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ok = name.trim() && (tpl !== 'custom' || parseCustom(custom).length)
  const submit = e => {
    e.preventDefault()
    if (!ok || !backend) return
    const id = newDocId('tm')
    const key = newBoardId() + newBoardId()
    setBusy(true)
    sha256hex(key).then(hostHash => {
      const team = newTeam({ id, name: name.trim(), owner: identity.id, at: Date.now(), templateId: tpl, cadenceDays: cad, size: parseInt(size, 10) || null, hostHash })
      if (tpl === 'custom') team.settings.customQuestions = parseCustom(custom)
      saveHostKey(id, key)
      return createDoc(id, team, identity.secret).then(() => team)
    }).then(team => {
      rememberTeam(id, team.name, { host: true })
      navigate(`/health/${id}`)
    }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <Modal title={t.create.title} onClose={onClose} wide>
      <form onSubmit={submit} className="pl-form">
        <div className="pl-form-grid">
          <label><span className="field-label">{t.create.name}</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t.create.namePh} maxLength={60} required /></label>
          <label><span className="field-label">{t.create.cadence}</span><CadenceSelect value={cad} onChange={setCad} /></label>
          <label><span className="field-label">{t.create.size}</span><input type="number" min="1" max="999" inputMode="numeric" value={size} onChange={e => setSize(e.target.value)} placeholder="8" /><span className="pl-hint">{t.create.sizeHint}</span></label>
        </div>
        <span className="field-label" id="ct-set">{t.create.set}</span>
        <QuestionPicker idp="ct" value={tpl} onChange={setTpl} custom={custom} onCustom={setCustom} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="row end pl-modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t.create.cancel}</button>
          <button className="btn primary" disabled={!ok || busy || !backend}><Icon name="plus" /> {t.create.go}</button>
        </div>
      </form>
    </Modal>
  )
}

// Creates a health check document, optionally inside a team. Resolves to the new check.
export async function createCheck({ identity, name, templateId, questions, team, lang }) {
  const id = newDocId('hc')
  const at = Date.now()
  const check = newCheck({ id, name, team: team?.name ?? '', templateId, questions, owner: { id: identity.id, name: '', color: identity.color }, at })
  // v2: sealed results (see reduceCheck). Nobody is listed as a participant.
  check.v = 2
  check.people = {}
  check.minAnon = team?.settings.minAnon ?? MIN_ANON
  if (team) {
    check.teamId = team.id
    check.settings = { trends: team.settings.trends !== false, comments: team.settings.comments !== false }
  }
  await createDoc(id, check, identity.secret)
  rememberDoc(CHECKS, { id, name: check.name, team: check.team, teamId: team?.id, at })
  return check
}

export const defaultCheckName = (t, lang) => `${t.create.defName} · ${fmtDate(Date.now(), lang)}`

// Start a check: from a team (questions default to the team's) or a one-off.
export function StartCheckModal({ team, onClose, onCreated }) {
  const [t, lang] = useT()
  const { identity } = useStore()
  const [name, setName] = useState(() => defaultCheckName(t, lang))
  const [tpl, setTpl] = useState(team?.settings.templateId ?? 'squad')
  const [custom, setCustom] = useState(() => customText(team?.settings.customQuestions))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const questions = tpl === 'custom' ? parseCustom(custom) : templateQuestions(tpl, lang)
  const submit = e => {
    e.preventDefault()
    if (!questions.length || !backend) return
    setBusy(true)
    createCheck({ identity, name: name.trim() || defaultCheckName(t, lang), templateId: tpl, questions, team, lang })
      .then(check => { onCreated?.(check); navigate(`/health/${check.id}`) }, err => { setBusy(false); setError(err.message) })
  }
  return (
    <Modal title={team ? t.team.start : t.create.quickTitle} onClose={onClose} wide>
      <form onSubmit={submit} className="pl-form">
        {!team && <p className="muted">{t.create.quickHint}</p>}
        <label><span className="field-label">{t.create.checkName}</span><input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label>
        <span className="field-label" id="sc-set">{t.create.set}</span>
        <QuestionPicker idp="sc" value={tpl} onChange={setTpl} custom={custom} onCustom={setCustom} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="row end pl-modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t.create.cancel}</button>
          <button className="btn primary" disabled={busy || !questions.length || !backend}><Icon name="plus" /> {t.create.start}</button>
        </div>
      </form>
    </Modal>
  )
}
