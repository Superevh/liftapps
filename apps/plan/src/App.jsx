import { useEffect, useRef, useState } from 'react'
import { useLang, getLang } from './i18n.js'
import { load, save, clean, sampleRoadmap, blankRoadmap, uid, encodeShare, decodeShare, SHARE_PREFIX, PALETTE } from './store.js'
import { addMonths, addDays, today, parts } from './dates.js'
import Timeline from './Timeline.jsx'
import Board, { bucket, movePatch } from './Board.jsx'
import Panel from './Panel.jsx'
import Icon from './icons.jsx'

const ZOOMS = [56, 72, 92, 120, 160, 220]
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const setPref = (k, v) => { try { localStorage.setItem(k, v) } catch { /* blocked */ } }
const isShareHash = () => location.hash.startsWith(SHARE_PREFIX)

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const slug = s => (s || 'roadmap').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'roadmap'

export default function App() {
  const [lang, t] = useLang()
  const [store, setStore] = useState(() => load(getLang()))
  // shared: null (own roadmaps) | { loading } | { roadmap } | { error }
  const [shared, setShared] = useState(() => (isShareHash() ? { loading: true } : null))
  const [view, setViewState] = useState(() => (pref('planlift-view', 'timeline') === 'board' ? 'board' : 'timeline'))
  const [selId, setSelId] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [menu, setMenu] = useState(null)
  const [width, setWidth] = useState(window.innerWidth)
  const [zoom, setZoom] = useState(() => (window.innerWidth < 640 ? 1 : 2))
  const [showDone, setShowDone] = useState(false)
  const [todayToken, setTodayToken] = useState(0)
  const [toast, setToast] = useState(null)
  const fileRef = useRef(null)
  const warned = useRef(false)

  const readOnly = !!shared
  const current = store.roadmaps.find(r => r.id === store.currentId) || store.roadmaps[0]
  const rm = readOnly ? shared.roadmap : current
  const sel = rm?.items.find(i => i.id === selId)
  const narrow = width < 640
  const setView = v => { setViewState(v); setPref('planlift-view', v) }
  const flash = msg => { setToast(msg); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(null), 2600) }

  // ---------- share links in the hash ----------
  useEffect(() => {
    const check = async () => {
      if (!isShareHash()) { setShared(null); return }
      setSelId(null)
      try { setShared({ roadmap: await decodeShare(location.hash.slice(SHARE_PREFIX.length)) }) } catch { setShared({ error: true }) }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  useEffect(() => { setTodayToken(x => x + 1) }, [rm?.id, view])

  // ---------- autosave ----------
  useEffect(() => {
    const h = setTimeout(() => { if (!save(store) && !warned.current) { warned.current = true; flash(t.storageFull) } }, 250)
    return () => clearTimeout(h)
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = () => setWidth(window.innerWidth)
    const k = e => {
      if (e.key !== 'Escape') return
      if (dialog) setDialog(null)
      else if (menu) setMenu(null)
      else setSelId(null)
    }
    window.addEventListener('resize', r)
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('resize', r); window.removeEventListener('keydown', k) }
  }, [dialog, menu])
  useEffect(() => {
    if (!menu) return
    const close = e => { if (!e.target.closest('.menu, .menu-btn')) setMenu(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])
  useEffect(() => { document.title = rm ? `${rm.name} · PlanLift · Lift Apps` : 'PlanLift · Lift Apps' }, [rm?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- edits ----------
  const updateRm = fn => setStore(s => ({ ...s, roadmaps: s.roadmaps.map(r => (r.id === s.currentId ? { ...fn(r), updated: Date.now() } : r)) }))
  const updateItem = (id, patch) => updateRm(r => ({ ...r, items: r.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }))
  const addItem = (laneId, start) => {
    const it = { id: uid(), laneId, title: '', start, end: addDays(addMonths(start, 1), -1), status: 'planned', note: '', link: '' }
    updateRm(r => ({ ...r, items: [...r.items, it] }))
    setSelId(it.id)
  }
  // Dropped on the Now / Next / Later board: apply the column's date/status rule and persist the column order.
  const moveItem = (id, col, orderedIds) => {
    const it = rm.items.find(i => i.id === id)
    if (!it || readOnly) return
    const now = today()
    const from = bucket(it, now, addMonths(now, 3))
    const patch = from === col ? {} : movePatch(it, col, now)
    const ord = new Map(orderedIds.map((x, i) => [x, i]))
    updateRm(r => ({ ...r, items: r.items.map(i => {
      let n = i.id === id ? { ...i, ...patch } : i
      if (ord.has(i.id) && n.order !== ord.get(i.id)) n = { ...n, order: ord.get(i.id) }
      return n
    }) }))
    if (from === col) return
    const label = { now: t.now, next: t.next, later: t.later, done: t.doneCol }[col]
    const bits = []
    if (patch.start) { const { y, m, d } = parts(patch.start); bits.push(t.startSet(t.dayMonth(y, m, d, y !== parts(now).y))) }
    if (patch.status) bits.push(t.statusSet(t.st[patch.status]))
    flash([t.movedTo(label), ...bits].join(' · '))
  }
  const deleteItem = id => {
    const it = rm.items.find(i => i.id === id)
    if (it?.title && !window.confirm(t.confirmDeleteItem(it.title))) return
    updateRm(r => ({ ...r, items: r.items.filter(i => i.id !== id) }))
    setSelId(null)
  }
  const laneOps = {
    add: () => updateRm(r => ({ ...r, lanes: [...r.lanes, { id: uid(), name: t.newLane, color: PALETTE[r.lanes.length % PALETTE.length].hex }] })),
    rename: (id, name) => updateRm(r => ({ ...r, lanes: r.lanes.map(l => (l.id === id ? { ...l, name } : l)) })),
    colour: (id, color) => updateRm(r => ({ ...r, lanes: r.lanes.map(l => (l.id === id ? { ...l, color } : l)) })),
    move: (id, dir) => updateRm(r => {
      const lanes = [...r.lanes], i = lanes.findIndex(l => l.id === id), j = i + dir
      if (i < 0 || j < 0 || j >= lanes.length) return r
      ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
      return { ...r, lanes }
    }),
    remove: id => {
      const lane = rm.lanes.find(l => l.id === id), n = rm.items.filter(i => i.laneId === id).length
      if (rm.lanes.length < 2 || !window.confirm(t.confirmDeleteLane(lane.name || t.lane, n))) return
      updateRm(r => ({ ...r, lanes: r.lanes.filter(l => l.id !== id), items: r.items.filter(i => i.laneId !== id) }))
      if (sel?.laneId === id) setSelId(null)
    },
  }

  // ---------- roadmaps ----------
  const addRoadmap = r => { setStore(s => ({ roadmaps: [...s.roadmaps, r], currentId: r.id })); setSelId(null); setMenu(null) }
  const switchTo = id => { setStore(s => ({ ...s, currentId: id })); setSelId(null) }
  const removeRoadmap = () => {
    setMenu(null)
    if (!window.confirm(t.confirmDeleteRoadmap(current.name))) return
    setStore(s => {
      const rest = s.roadmaps.filter(r => r.id !== s.currentId)
      const list = rest.length ? rest : [blankRoadmap(t.untitled, t.newLane)]
      return { roadmaps: list, currentId: list[0].id }
    })
    setSelId(null)
  }
  const exportJson = () => {
    setMenu(null)
    const data = { type: 'planlift', version: 1, source: 'https://liftapps.com.au/plan/', roadmap: rm }
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slug(rm.name)}.planlift.json`)
  }
  const importJson = async file => {
    try {
      const data = JSON.parse(await file.text())
      const r = clean(data.roadmap || (Array.isArray(data.roadmaps) ? data.roadmaps[0] : data))
      if (!r) throw new Error('bad')
      addRoadmap({ ...r, id: uid(), updated: Date.now() })
    } catch { flash(t.importFail) }
  }
  const share = async () => {
    setMenu(null)
    const code = await encodeShare(rm)
    setDialog({ type: 'share', url: `${location.origin}${location.pathname}${SHARE_PREFIX}${code}`, copied: false })
  }
  const leaveShared = keep => {
    if (keep && shared?.roadmap) {
      const r = { ...shared.roadmap, id: uid(), updated: Date.now() }
      setStore(s => ({ roadmaps: [...s.roadmaps, r], currentId: r.id }))
      flash(t.savedCopy)
    }
    history.replaceState(null, '', location.pathname + location.search)
    setShared(null)
    setSelId(null)
  }

  const monthW = ZOOMS[zoom]
  const laneW = narrow ? 118 : 196

  return (
    <div className={`app ${readOnly ? 'read-only' : ''} ${sel ? 'has-panel' : ''}`}>
      {readOnly && (
        <div className="ro-banner" role="status">
          <span className="ro-tag"><Icon name="eye" size={15} /> {t.readOnly}</span>
          <span className="ro-text">{shared.error ? t.badLink : t.readOnlyBody}</span>
          <span className="grow" />
          {shared.roadmap && <button className="btn small primary" onClick={() => leaveShared(true)}>{t.saveCopy}</button>}
          <button className="btn small" onClick={() => leaveShared(false)}>{t.exitView}</button>
        </div>
      )}

      {rm && (
        <header className="toolbar">
          <div className="tb-left">
            {readOnly ? <h1 className="rm-title">{rm.name}</h1> : (
              <>
                <div className="rm-switch">
                  <button className="menu-btn rm-btn" aria-haspopup="true" aria-expanded={menu === 'roadmaps'} aria-label={t.roadmaps} title={t.roadmaps} onClick={() => setMenu(menu === 'roadmaps' ? null : 'roadmaps')}>
                    <Icon name="map" size={17} /><Icon name="chevron" size={14} />
                  </button>
                  {menu === 'roadmaps' && (
                    <div className="menu" role="menu">
                      <div className="menu-label">{t.roadmaps}</div>
                      {store.roadmaps.map(r => (
                        <button key={r.id} role="menuitemradio" aria-checked={r.id === current.id} className={`menu-item ${r.id === current.id ? 'on' : ''}`} onClick={() => { switchTo(r.id); setMenu(null) }}>
                          <span className="mi-check">{r.id === current.id && <Icon name="check" size={14} />}</span><span className="mi-label">{r.name || t.untitled}</span>
                        </button>
                      ))}
                      <hr />
                      <button role="menuitem" className="menu-item" onClick={() => addRoadmap(blankRoadmap(t.untitled, t.newLane))}><Icon name="plus" size={15} /><span className="mi-label">{t.newRoadmap}</span></button>
                      <button role="menuitem" className="menu-item" onClick={() => addRoadmap({ ...structuredClone(current), id: uid(), name: t.copyOf(current.name) })}><Icon name="copy" size={15} /><span className="mi-label">{t.duplicate}</span></button>
                      <button role="menuitem" className="menu-item" onClick={() => addRoadmap(sampleRoadmap(lang))}><Icon name="timeline" size={15} /><span className="mi-label">{t.sample}</span></button>
                      <button role="menuitem" className="menu-item danger" onClick={removeRoadmap}><Icon name="trash" size={15} /><span className="mi-label">{t.deleteRoadmap}</span></button>
                    </div>
                  )}
                </div>
                <input className="rm-name" value={current.name} aria-label={t.roadmapName} placeholder={t.untitled}
                  onChange={e => updateRm(r => ({ ...r, name: e.target.value }))} onBlur={e => { if (!e.target.value.trim()) updateRm(r => ({ ...r, name: t.untitled })) }} />
              </>
            )}
          </div>

          <div className="seg views" role="tablist" aria-label={t.views}>
            <button role="tab" aria-selected={view === 'timeline'} className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}><Icon name="timeline" size={16} /><span>{t.timeline}</span></button>
            <button role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><Icon name="columns" size={16} /><span>{t.nnl}</span></button>
          </div>

          <div className="tb-right">
            {view === 'timeline' ? (
              <>
                <button className="btn small ghost" onClick={() => setTodayToken(x => x + 1)} title={t.todayBtn}><Icon name="today" size={15} /><span className="hide-narrow">{t.todayBtn}</span></button>
                <div className="seg zoom">
                  <button aria-label={t.zoomOut} title={t.zoomOut} disabled={zoom === 0} onClick={() => setZoom(z => z - 1)}><Icon name="minus" size={15} /></button>
                  <button aria-label={t.zoomIn} title={t.zoomIn} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(z => z + 1)}><Icon name="plus" size={15} /></button>
                </div>
              </>
            ) : (
              <label className="check"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> {t.showDone}</label>
            )}
            {!readOnly && <button className="btn small primary" onClick={share}><Icon name="share" size={15} /><span className="hide-narrow">{t.share}</span></button>}
            <div className="more">
              <button className="menu-btn icon-btn" aria-label={t.more} title={t.more} aria-haspopup="true" aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')}><Icon name="more" size={20} sw={3} /></button>
              {menu === 'more' && (
                <div className="menu right" role="menu">
                  <button role="menuitem" className="menu-item" onClick={exportJson}><Icon name="download" size={15} /><span className="mi-label">{t.exportJson}</span></button>
                  {!readOnly && <button role="menuitem" className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click() }}><Icon name="upload" size={15} /><span className="mi-label">{t.importJson}</span></button>}
                  <button role="menuitem" className="menu-item" onClick={() => { setMenu(null); setSelId(null); setTimeout(() => window.print(), 50) }}><Icon name="print" size={15} /><span className="mi-label">{t.print}</span></button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="main">
        {rm && view === 'timeline' && (
          <Timeline rm={rm} t={t} readOnly={readOnly} monthW={monthW} laneW={laneW} selId={selId} todayToken={todayToken}
            onSelect={setSelId} onAdd={addItem} onUpdateItem={updateItem} lanes={laneOps} />
        )}
        {rm && view === 'board' && <Board rm={rm} t={t} showDone={showDone} selId={selId} readOnly={readOnly} onSelect={setSelId} onMove={moveItem} />}
        {sel && <Panel key={sel.id} item={sel} rm={rm} t={t} readOnly={readOnly} onChange={p => updateItem(sel.id, p)} onDelete={() => deleteItem(sel.id)} onClose={() => setSelId(null)} />}
      </main>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />

      {dialog?.type === 'share' && (
        <div className="backdrop" onMouseDown={e => e.target === e.currentTarget && setDialog(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-h">
            <div className="dialog-head"><h2 id="share-h">{t.shareTitle}</h2><button className="icon-btn" aria-label={t.close} title={t.close} onClick={() => setDialog(null)}><Icon name="close" /></button></div>
            <p>{t.shareBody}</p>
            <input className="share-url" readOnly value={dialog.url} onFocus={e => e.target.select()} aria-label={t.shareTitle} />
            <p className="muted small">{t.longLink(dialog.url.length)}</p>
            <div className="dialog-actions">
              <a className="btn" href={dialog.url} target="_blank" rel="noopener">{t.openLink}</a>
              <button className="btn primary" onClick={async () => {
                try { await navigator.clipboard.writeText(dialog.url) } catch { document.querySelector('.share-url')?.select(); document.execCommand?.('copy') }
                setDialog(d => ({ ...d, copied: true }))
              }}><Icon name={dialog.copied ? 'check' : 'copy'} size={15} /> {dialog.copied ? t.copied : t.copy}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
