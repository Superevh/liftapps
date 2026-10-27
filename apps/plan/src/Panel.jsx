import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { STATUSES, HORIZONS, PRIORITIES, SIZES, safeLink, uid, colorVar } from './store.js'
import { depInfo, ownersOf, tagsOf } from './logic.js'
import { longDate, when } from './format.js'
import { addDays, addMonths, today } from './dates.js'
import { ChangeRow } from './Changes.jsx'
import { initials } from './logic.js'
import Icon from './icons.jsx'

function usePanelFocus(ref, onClose) {
  // Focus moves into the panel when it opens and goes back where it was when it closes.
  useEffect(() => {
    const back = document.activeElement
    return () => { if (back && document.contains(back) && typeof back.focus === 'function') back.focus({ preventScroll: true }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = e => { if (e.key === 'Escape' && ref.current?.contains(document.activeElement)) { e.stopPropagation(); onClose() } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true) }, [onClose, ref])
}

export default function Panel({ item, rm, log = [], t, meId, me, readOnly = false, onChange, onDelete, onDuplicate, onAddDep, onRemoveDep, onSelect, onClose, onComment, onDeleteComment, onName }) {
  const ref = useRef(null)
  const titleRef = useRef(null)
  const [tag, setTag] = useState('')
  const [link, setLink] = useState('')
  usePanelFocus(ref, onClose)
  // The title box grows with the title.
  useLayoutEffect(() => { const el = titleRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` } }, [item.title])
  useEffect(() => { if (readOnly) ref.current?.querySelector('.icon-btn')?.focus({ preventScroll: true }); else if (!item.title) titleRef.current?.focus(); else ref.current?.focus({ preventScroll: true }) }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const lane = rm.lanes.find(l => l.id === item.laneId)
  const info = useMemo(() => depInfo(rm), [rm])
  const waits = info.waitsOn.get(item.id) || [], blocks = info.blocks.get(item.id) || []
  const owners = ownersOf(rm), allTags = tagsOf(rm)
  const history = log.filter(e => e.item === item.id).slice(-6).reverse()
  const ws = { roadmaps: [rm] }

  const depWarn = waits.filter(w => w.bad)
  const warnings = depWarn.length > 0 && (
    <div className="panel-warn" role="note"><Icon name="warn" size={15} sw={2.2} /><div>{depWarn.map(w => <p key={w.dep.id}>{t.depConflict(w.item.title || t.untitledItem, longDate(t, w.item.end))}</p>)}</div></div>
  )

  if (readOnly) {
    return (
      <aside className="panel" aria-label={t.item} ref={ref}>
        <div className="panel-head"><span className="panel-lane" style={{ '--c': colorVar(lane?.color) }}><i />{lane?.name}</span>
          <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button></div>
        <h2 className="panel-title">{item.title || t.untitledItem}</h2>
        {warnings}
        <dl className="panel-dl">
          <dt>{t.status}</dt><dd><span className={`chip st-${item.status}`}>{t.st[item.status]}</span>{item.progress > 0 && item.status !== 'done' && <span className="muted"> {item.progress}%</span>}</dd>
          <dt>{t.schedule}</dt><dd>{item.start ? `${longDate(t, item.start)} – ${longDate(t, item.end)}` : t.hz[item.horizon]}</dd>
          {item.owner && <><dt>{t.owner}</dt><dd>{item.owner}</dd></>}
          {item.priority && <><dt>{t.priority}</dt><dd>{t.pr[item.priority]}</dd></>}
          {item.size && <><dt>{t.size}</dt><dd>{item.size}</dd></>}
          {item.tags.length > 0 && <><dt>{t.themes}</dt><dd className="tags">{item.tags.map(x => <span key={x} className="tag">{x}</span>)}</dd></>}
          {waits.length > 0 && <><dt>{t.dependsOn}</dt><dd>{waits.map(w => <div key={w.dep.id}>{w.item.title || t.untitledItem}</div>)}</dd></>}
          {blocks.length > 0 && <><dt>{t.blocks}</dt><dd>{blocks.map(w => <div key={w.dep.id}>{w.item.title || t.untitledItem}</div>)}</dd></>}
          {item.desc && <><dt>{t.description}</dt><dd className="note">{item.desc}</dd></>}
          {item.links.length > 0 && <><dt>{t.links}</dt><dd>{item.links.map(l => <div key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label || l.url.replace(/^https?:\/\//, '')}</a></div>)}</dd></>}
        </dl>
        {item.comments?.length > 0 && <div className="field"><span>{t.comments}</span><Comments item={item} t={t} meId={meId} /></div>}
      </aside>
    )
  }

  const setStart = v => { if (!v) return; onChange(v > item.end ? { start: v, end: v } : { start: v }) }
  const setEnd = v => { if (!v) return; onChange(v < item.start ? { start: v, end: v } : { end: v }) }
  const schedule = on => {
    if (on) {
      const start = item.horizon === 'later' ? addMonths(today(), 4).slice(0, 8) + '01' : item.horizon === 'next' ? addMonths(today(), 1).slice(0, 8) + '01' : today()
      onChange({ start, end: addDays(addMonths(start, 1), -1), horizon: '' })
    } else onChange({ start: '', end: '', horizon: item.start && item.start <= today() ? 'now' : 'next' })
  }
  const addTag = v => { const x = v.trim().slice(0, 40); if (x && !item.tags.includes(x)) onChange({ tags: [...item.tags, x] }); setTag('') }
  const addLink = () => { const url = safeLink(link); if (url) onChange({ links: [...item.links, { id: uid(), url, label: '' }] }); setLink('') }
  const candidates = rm.items.filter(i => i.id !== item.id && !waits.some(w => w.item.id === i.id))

  return (
    <aside className="panel" aria-label={t.item} ref={ref} tabIndex={-1}>
      <div className="panel-head">
        <span className="panel-lane" style={{ '--c': colorVar(lane?.color) }}><i />{lane?.name || t.item}</span>
        <span className="grow" />
        <button className="icon-btn" aria-label={t.duplicate} title={`${t.duplicate} (D)`} onClick={onDuplicate}><Icon name="copy" size={16} /></button>
        <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button>
      </div>
      <textarea ref={titleRef} className="panel-title-input" rows={1} value={item.title} placeholder={t.newItem} aria-label={t.title}
        onChange={e => onChange({ title: e.target.value.replace(/\n/g, ' ') })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
      {warnings}

      <div className="field"><span>{t.status}</span>
        <div className="status-seg" role="radiogroup" aria-label={t.status}>
          {STATUSES.map(s => <button key={s} role="radio" aria-checked={item.status === s} className={`st-${s} ${item.status === s ? 'on' : ''}`} onClick={() => onChange({ status: s })}><i aria-hidden="true" />{t.st[s]}</button>)}
        </div>
      </div>

      <div className="field-row">
        <label className="field"><span>{t.lane}</span>
          <select value={item.laneId} onChange={e => onChange({ laneId: e.target.value })}>{rm.lanes.map(l => <option key={l.id} value={l.id}>{l.name || '—'}</option>)}</select></label>
        <label className="field"><span>{t.owner}</span>
          <input value={item.owner} list="pl-panel-owners" placeholder={t.ownerPh} onChange={e => onChange({ owner: e.target.value.slice(0, 60) })} />
          <datalist id="pl-panel-owners">{owners.map(o => <option key={o} value={o} />)}</datalist></label>
      </div>

      <div className="field"><span>{t.schedule}</span>
        <div className="seg small-seg" role="radiogroup" aria-label={t.schedule}>
          <button role="radio" aria-checked={!!item.start} className={item.start ? 'on' : ''} onClick={() => !item.start && schedule(true)}>{t.onTimeline}</button>
          <button role="radio" aria-checked={!item.start} className={!item.start ? 'on' : ''} onClick={() => item.start && schedule(false)}>{t.noDates}</button>
        </div>
      </div>
      {item.start ? (
        <div className="field-row">
          <label className="field"><span>{t.start}</span><input type="date" value={item.start} onChange={e => setStart(e.target.value)} /></label>
          <label className="field"><span>{t.end}</span><input type="date" value={item.end} onChange={e => setEnd(e.target.value)} /></label>
        </div>
      ) : (
        <div className="field"><span>{t.horizon}</span>
          <div className="seg small-seg" role="radiogroup" aria-label={t.horizon}>
            {HORIZONS.map(h => <button key={h} role="radio" aria-checked={item.horizon === h} className={item.horizon === h ? 'on' : ''} onClick={() => onChange({ horizon: h })}>{t.hz[h]}</button>)}
          </div>
        </div>
      )}

      <label className="field"><span>{t.progress} · {item.progress}%</span>
        <input type="range" min="0" max="100" step="5" value={item.progress} onChange={e => onChange({ progress: +e.target.value })} aria-valuetext={`${item.progress}%`} /></label>

      <div className="field-row">
        <label className="field"><span>{t.priority}</span>
          <select value={item.priority} onChange={e => onChange({ priority: e.target.value })}><option value="">{t.none}</option>{PRIORITIES.map(p => <option key={p} value={p}>{t.pr[p]}</option>)}</select></label>
        <label className="field"><span>{t.size}</span>
          <select value={item.size} onChange={e => onChange({ size: e.target.value })}><option value="">{t.none}</option>{SIZES.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      </div>

      <div className="field"><span>{t.themes}</span>
        <div className="tag-box">
          {item.tags.map(x => <span key={x} className="tag">{x}<button aria-label={t.removeTheme(x)} title={t.removeTheme(x)} onClick={() => onChange({ tags: item.tags.filter(y => y !== x) })}>×</button></span>)}
          <input value={tag} list="pl-panel-tags" placeholder={item.tags.length ? '' : t.addTheme} aria-label={t.addTheme} onChange={e => setTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tag) } else if (e.key === 'Backspace' && !tag && item.tags.length) onChange({ tags: item.tags.slice(0, -1) }) }} onBlur={() => tag && addTag(tag)} />
          <datalist id="pl-panel-tags">{allTags.filter(x => !item.tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
        </div>
      </div>

      <label className="field"><span>{t.description}</span>
        <textarea rows={3} value={item.desc} placeholder={t.descPh} onChange={e => onChange({ desc: e.target.value.slice(0, 4000) })} /></label>

      <div className="field"><span>{t.dependsOn}</span>
        {waits.map(w => (
          <div key={w.dep.id} className={`dep-row ${w.bad ? 'bad' : ''}`}>
            <Icon name={w.bad ? 'warn' : 'dep'} size={14} />
            <button className="link-btn" onClick={() => onSelect({ kind: 'item', id: w.item.id })}>{w.item.title || t.untitledItem}</button>
            <small>{when(t, w.item)}</small>
            <button className="x-btn" aria-label={t.removeDep} title={t.removeDep} onClick={() => onRemoveDep(w.dep.id)}>×</button>
          </div>
        ))}
        {candidates.length > 0 && <DepPicker rm={rm} candidates={candidates} t={t} onPick={id => onAddDep(id, item.id)} />}
        {blocks.length > 0 && <p className="blocks"><b>{t.blocks}:</b> {blocks.map((w, k) => <span key={w.dep.id}>{k ? ', ' : ''}<button className="link-btn" onClick={() => onSelect({ kind: 'item', id: w.item.id })}>{w.item.title || t.untitledItem}</button></span>)}</p>}
      </div>

      <div className="field"><span>{t.links}</span>
        {item.links.map(l => (
          <div key={l.id} className="link-item">
            <Icon name="link" size={14} />
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label || l.url.replace(/^https?:\/\//, '')}</a>
            <button className="x-btn" aria-label={t.removeLink} title={t.removeLink} onClick={() => onChange({ links: item.links.filter(x => x.id !== l.id) })}>×</button>
          </div>
        ))}
        <input value={link} placeholder={t.addLink} inputMode="url" aria-label={t.addLink} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} onBlur={() => link && addLink()} />
      </div>

      <div className="field"><span>{t.comments}</span>
        <Comments item={item} t={t} meId={meId} me={me} onComment={onComment} onDelete={onDeleteComment} onName={onName} />
      </div>

      {history.length > 0 && (
        <div className="field"><span>{t.history}</span>
          <ul className="mini-log">{history.map(e => <ChangeRow key={e.id} e={e} t={t} ws={ws} meId={meId} />)}</ul>
        </div>
      )}

      <div className="panel-foot">
        <button className="text-btn danger" onClick={onDelete}><Icon name="trash" size={15} /> {t.deleteItem}</button>
      </div>
    </aside>
  )
}

export function MilestonePanel({ ms, rm, t, readOnly = false, onChange, onDelete, onClose }) {
  const ref = useRef(null)
  usePanelFocus(ref, onClose)
  useEffect(() => { if (!readOnly && !ms.title) ref.current?.querySelector('input')?.focus(); else ref.current?.focus({ preventScroll: true }) }, [ms.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const lane = rm.lanes.find(l => l.id === ms.laneId)
  if (readOnly) {
    return (
      <aside className="panel" aria-label={t.milestone} ref={ref}>
        <div className="panel-head"><span className="panel-kicker"><Icon name="diamond" size={13} /> {ms.kind === 'release' ? t.release : t.milestone}</span>
          <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button></div>
        <h2 className="panel-title">{ms.title || t.untitledMilestone}</h2>
        <dl className="panel-dl"><dt>{t.date}</dt><dd>{longDate(t, ms.date)}</dd>{lane && <><dt>{t.lane}</dt><dd>{lane.name}</dd></>}{ms.note && <><dt>{t.note}</dt><dd className="note">{ms.note}</dd></>}</dl>
      </aside>
    )
  }
  return (
    <aside className="panel" aria-label={t.milestone} ref={ref} tabIndex={-1}>
      <div className="panel-head">
        <span className="panel-kicker"><Icon name="diamond" size={13} /> {t.milestone}</span>
        <button className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button>
      </div>
      <label className="field"><span>{t.title}</span>
        <input className="strong" value={ms.title} placeholder={t.newMilestone} onChange={e => onChange({ title: e.target.value.slice(0, 160) })} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
      <div className="field"><span>{t.kind}</span>
        <div className="seg small-seg" role="radiogroup" aria-label={t.kind}>
          {['milestone', 'release'].map(k => <button key={k} role="radio" aria-checked={ms.kind === k} className={ms.kind === k ? 'on' : ''} onClick={() => onChange({ kind: k })}>{k === 'release' ? t.release : t.milestone}</button>)}
        </div>
      </div>
      <div className="field-row">
        <label className="field"><span>{t.date}</span><input type="date" value={ms.date} onChange={e => e.target.value && onChange({ date: e.target.value })} /></label>
        <label className="field"><span>{t.lane}</span>
          <select value={ms.laneId} onChange={e => onChange({ laneId: e.target.value })}><option value="">{t.allLanes}</option>{rm.lanes.map(l => <option key={l.id} value={l.id}>{l.name || '—'}</option>)}</select></label>
      </div>
      <label className="field"><span>{t.note}</span><textarea rows={3} value={ms.note} onChange={e => onChange({ note: e.target.value.slice(0, 2000) })} /></label>
      <div className="panel-foot"><button className="text-btn danger" onClick={onDelete}><Icon name="trash" size={15} /> {t.deleteMilestone}</button></div>
    </aside>
  )
}

// Searchable picker for "waits on": type to filter, grouped by lane, arrow keys + Enter.
function DepPicker({ rm, candidates, t, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)
  const ql = q.trim().toLowerCase()
  const groups = rm.lanes.map(l => ({ lane: l, list: candidates.filter(i => i.laneId === l.id && (!ql || (i.title || '').toLowerCase().includes(ql))) })).filter(g => g.list.length)
  const flat = groups.flatMap(g => g.list)
  useEffect(() => { setHi(0) }, [q])
  useEffect(() => {
    if (!open) return
    const away = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const pick = it => { onPick(it.id); setQ(''); setOpen(false) }
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(flat.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && flat[hi]) pick(flat[hi]) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }
  let k = -1
  return (
    <div className="dep-pick" ref={boxRef}>
      <input value={q} placeholder={t.addDep} aria-label={t.addDep} role="combobox" aria-expanded={open} aria-controls="pl-dep-list" aria-autocomplete="list"
        aria-activedescendant={open && flat[hi] ? `pl-dep-${flat[hi].id}` : undefined}
        onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true) }} onKeyDown={key} />
      {open && (
        <ul className="dep-list" id="pl-dep-list" role="listbox" aria-label={t.addDep}>
          {!flat.length && <li className="none">{t.noPickMatch}</li>}
          {groups.map(g => [
            <li key={'g' + g.lane.id} className="grp" role="presentation">{g.lane.name || '—'}</li>,
            ...g.list.map(it => { k += 1; const on = k === hi; return (
              <li key={it.id} id={`pl-dep-${it.id}`} role="option" aria-selected={on} className={`opt ${on ? 'on' : ''}`} onPointerDown={e => { e.preventDefault(); pick(it) }}>
                <span className={`chip-dot st-${it.status}`} aria-hidden="true" />{it.title || t.untitledItem}<small>{when(t, it)}</small>
              </li>
            ) }),
          ])}
        </ul>
      )}
    </div>
  )
}

// Discussion on an item: synced with the workspace, each comment with author and time.
function Comments({ item, t, meId, me, onComment, onDelete, onName }) {
  const [text, setText] = useState('')
  const list = item.comments || []
  const post = () => { if (text.trim()) { onComment(text); setText('') } }
  return (
    <div className="comments">
      {list.length > 0 && (
        <ul className="cmt-list">
          {list.map(c => (
            <li key={c.id} className="cmt">
              <span className="avatar sm" aria-hidden="true">{c.wid === meId ? <Icon name="user" size={11} /> : initials(c.who || '?')}</span>
              <div className="cmt-body">
                <div className="cmt-meta"><b>{c.wid === meId ? me || t.youLabel : c.who || t.someone}</b><time dateTime={new Date(c.at).toISOString()} title={new Date(c.at).toLocaleString()}>{t.ago(Date.now() - c.at)}</time>
                  {onDelete && c.wid === meId && <button className="x-btn" aria-label={t.deleteComment} title={t.deleteComment} onClick={() => onDelete(c.id)}>×</button>}</div>
                <p>{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {onComment && <>
        <textarea rows={2} value={text} placeholder={t.commentPh} aria-label={t.comments} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post() } }} />
        <div className="cmt-actions">
          {me ? <span className="muted small">{t.commentAs(me)}</span> : <button className="link-btn small" onClick={onName}>{t.commentNoName}</button>}
          <button className="btn small" disabled={!text.trim()} onClick={post}>{t.postComment}</button>
        </div>
      </>}
    </div>
  )
}
