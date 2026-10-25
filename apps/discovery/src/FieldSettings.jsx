import { useMemo, useState } from 'react'
import { useStore, uid, COLORS, COLOR_KEYS, FIELD_TYPES, NUMERIC_TYPES, numeric, orderedIdeas } from './store.jsx'
import { check } from './formula.js'
import { Icon, Modal, Chip } from './ui.jsx'
import { TYPE_LABELS } from './fields.jsx'
import { useT } from './lang.js'

const scoreable = f => NUMERIC_TYPES.includes(f.type) || f.type === 'select' || f.type === 'multiselect'

function OptionsEditor({ options, setOptions, weighted }) {
  const t = useT()
  const [label, setLabel] = useState('')
  const up = (i, patch) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const move = (i, d) => { const a = [...options]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setOptions(a) }
  const add = () => { if (!label.trim()) return; setOptions([...options, { id: uid(), label: label.trim(), color: COLOR_KEYS[(options.length + 1) % COLOR_KEYS.length], weight: 1 }]); setLabel('') }
  return (
    <div className="options-editor">
      <div className="opt-head muted small"><span>{t('Options')}</span>{weighted && <span>{t('Weight')}</span>}</div>
      {options.map((o, i) => (
        <div key={o.id} className="opt-row">
          <div className="swatches" role="radiogroup" aria-label={t('Colour')}>
            {COLOR_KEYS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={o.color === c} aria-label={c} className={`swatch ${o.color === c ? 'on' : ''}`}
                style={{ background: COLORS[c].bg, borderColor: COLORS[c].fg }} onClick={() => up(i, { color: c })} />
            ))}
          </div>
          <input aria-label={t('Option name')} value={o.label} onChange={e => up(i, { label: e.target.value })} />
          {weighted && <input className="weight" type="number" aria-label={t('Weight')} value={o.weight ?? 1} onChange={e => up(i, { weight: e.target.value === '' ? 0 : +e.target.value })} />}
          <button type="button" className="icon-btn tiny" aria-label={t('Move up')} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
          <button type="button" className="icon-btn tiny" aria-label={t('Move down')} onClick={() => move(i, 1)}><Icon name="chevron" size={14} /></button>
          <button type="button" className="icon-btn tiny" aria-label={t('Delete option')} onClick={() => setOptions(options.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
        </div>
      ))}
      <div className="row">
        <input placeholder={t('New option')} value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn subtle" onClick={add} disabled={!label.trim()}><Icon name="plus" size={14} /> {t('Add')}</button>
      </div>
      {options.length > 0 && <div className="chips preview">{options.map(o => <Chip key={o.id} option={o} />)}</div>}
    </div>
  )
}

function FormulaEditor({ formula, setFormula, fields, selfId, selfName }) {
  const t = useT()
  const { state } = useStore()
  const inputs = fields.filter(f => f.id !== selfId && scoreable(f))
  const kind = formula.kind
  const setKind = k => setFormula(k === 'expr' ? { kind: k, expr: formula.expr ?? '' } : k === 'rollup' ? { kind: k, inputs: [] } : { kind: k, inputs: [] })
  const names = fields.filter(f => f.id !== selfId).map(f => f.name)
  const result = kind === 'expr' ? check(formula.expr ?? '', names) : { ok: true }
  // Live preview against the first few ideas, using a throwaway copy of the field.
  const preview = useMemo(() => {
    if (!result.ok) return []
    const tmp = { ...state, fields: [...state.fields.filter(f => f.id !== (selfId ?? '__new')), { id: selfId ?? '__new', name: selfName || '__new', type: 'formula', formula }] }
    return orderedIdeas(tmp).filter(i => !i.archived).slice(0, 3).map(i => ({ key: i.key, summary: i.summary, v: numeric(tmp, i, selfId ?? '__new') }))
  }, [state, formula, selfId, selfName, result.ok])

  return (
    <div className="formula-editor">
      <div className="seg-control" role="tablist">
        {[['expr', t('Write a formula')], ['weighted', t('Weighted score')], ['rollup', t('Sum of fields')]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {kind === 'expr' && (
        <>
          <p className="muted small">{t('Use numbers, + − × ÷ and brackets. Put field names in curly braces, e.g. {Impact} * {Confidence} / {Effort}.')}</p>
          <textarea rows={3} className="mono" aria-label={t('Formula')} value={formula.expr ?? ''} onChange={e => setFormula({ ...formula, expr: e.target.value })} />
          <div className="insert-fields">
            <span className="muted small">{t('Insert field')}:</span>
            {inputs.map(f => <button key={f.id} type="button" className="field-token" onClick={() => setFormula({ ...formula, expr: `${(formula.expr ?? '').trimEnd()} {${f.name}}`.trim() })}>{f.name}</button>)}
          </div>
          {!result.ok && (
            <p className="form-error" role="alert">
              {result.error.unknown ? t('Unknown field: {names}', { names: result.error.unknown.join(', ') }) : t('Check the formula: {msg}', { msg: result.error.syntax })}
            </p>
          )}
        </>
      )}
      {kind === 'weighted' && (
        <>
          <p className="muted small">{t('Each field is scaled from 0 to 100 against all active ideas, multiplied by its weight and averaged. Use a negative weight for things that should lower the score, like effort.')}</p>
          <div className="weights">
            {inputs.map(f => {
              const cur = formula.inputs.find(x => x.field === f.id)
              return (
                <label key={f.id} className="weight-row">
                  <span className="grow">{f.name} <span className="muted small">{t(TYPE_LABELS[f.type])}</span></span>
                  <input type="number" className="weight" aria-label={t('Weight for {name}', { name: f.name })} value={cur?.weight ?? 0}
                    onChange={e => {
                      const w = e.target.value === '' ? 0 : +e.target.value
                      const rest = formula.inputs.filter(x => x.field !== f.id)
                      setFormula({ ...formula, inputs: w ? [...rest, { field: f.id, weight: w }] : rest })
                    }} />
                </label>
              )
            })}
          </div>
        </>
      )}
      {kind === 'rollup' && (
        <>
          <p className="muted small">{t('Adds up the selected fields for each idea.')}</p>
          <div className="weights">
            {inputs.map(f => (
              <label key={f.id} className="check-row">
                <input type="checkbox" checked={formula.inputs.includes(f.id)}
                  onChange={e => setFormula({ ...formula, inputs: e.target.checked ? [...formula.inputs, f.id] : formula.inputs.filter(x => x !== f.id) })} />
                {f.name} <span className="muted small">{t(TYPE_LABELS[f.type])}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {preview.length > 0 && (
        <div className="formula-preview">
          <div className="muted small">{t('Preview')}</div>
          {preview.map(p => <div key={p.key} className="preview-row"><span className="grow ellipsis">{p.summary}</span><b>{p.v ?? '–'}</b></div>)}
        </div>
      )}
    </div>
  )
}

// Create (field == null) or edit a field's settings.
export default function FieldSettings({ field, viewId, onClose }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const creating = !field
  const [name, setName] = useState(field?.name ?? '')
  const [type, setType] = useState(field?.type ?? 'select')
  const [description, setDescription] = useState(field?.description ?? '')
  const [options, setOptions] = useState(field?.options ?? [])
  const [maxPerUser, setMax] = useState(field?.maxPerUser ?? 3)
  const [formula, setFormula] = useState(field?.formula ?? { kind: 'expr', expr: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const clash = state.fields.some(f => f.id !== field?.id && f.name.trim().toLowerCase() === name.trim().toLowerCase())
  const formulaOk = type !== 'formula' || formula.kind !== 'expr' || check(formula.expr ?? '', state.fields.filter(f => f.id !== field?.id).map(f => f.name)).ok
  const canSave = name.trim() && !clash && formulaOk

  const build = () => ({
    name: name.trim(), description: description.trim() || undefined,
    ...(type === 'select' || type === 'multiselect' ? { options } : {}),
    ...(type === 'votes' ? { maxPerUser: Math.max(1, maxPerUser) } : {}),
    ...(type === 'formula' ? { formula } : {}),
    ...(type === 'rating' ? { max: field?.max ?? 5 } : {}),
  })
  const save = e => {
    e.preventDefault()
    if (!canSave) return
    if (creating) dispatch({ type: 'CREATE_FIELD', field: { type, ...build() }, viewId })
    else dispatch({ type: 'UPDATE_FIELD', id: field.id, patch: build() })
    onClose()
  }

  return (
    <Modal title={creating ? t('Create field') : t('Edit field')} onClose={onClose} wide className="field-settings">
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field-label" htmlFor="fs-name">{t('Name')}</label>
          <div>
            <input id="fs-name" autoFocus value={name} onChange={e => setName(e.target.value)} />
            {clash && <p className="form-error">{t('Another field already has this name.')}</p>}
          </div>
          <label className="field-label" htmlFor="fs-type">{t('Type')}</label>
          {creating ? (
            <select id="fs-type" value={type} onChange={e => setType(e.target.value)}>
              {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{t(TYPE_LABELS[ft])}</option>)}
            </select>
          ) : <div className="muted">{t(TYPE_LABELS[type])}{field.system && ` · ${t('built in')}`}</div>}
          <label className="field-label" htmlFor="fs-desc">{t('Description')}</label>
          <input id="fs-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('Shown when people hover the field name')} />
        </div>
        {(type === 'select' || type === 'multiselect') && <OptionsEditor options={options} setOptions={setOptions} weighted />}
        {type === 'votes' && (
          <div className="form-grid">
            <label className="field-label" htmlFor="fs-max">{t('Votes per person')}</label>
            <input id="fs-max" type="number" min="1" max="50" value={maxPerUser} onChange={e => setMax(+e.target.value || 1)} />
          </div>
        )}
        {type === 'formula' && <FormulaEditor formula={formula} setFormula={setFormula} fields={state.fields} selfId={field?.id} selfName={name.trim()} />}
        <div className="row end modal-foot">
          {!creating && !field.system && (
            confirmDelete
              ? <><span className="danger small">{t('Delete this field and its values?')}</span><button type="button" className="btn danger-btn" onClick={() => { dispatch({ type: 'DELETE_FIELD', id: field.id }); onClose() }}>{t('Delete')}</button></>
              : <button type="button" className="btn subtle" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14} /> {t('Delete field')}</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn subtle" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!canSave}>{creating ? t('Create') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  )
}
