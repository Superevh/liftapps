import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang, getLang } from './i18n.js'
import { load, save, cleanRoadmap, cleanWs, normalizeWs, fromTemplate, uid, encodeShare, decodeShare, SHARE_PREFIX, PALETTE, sampleWorkspace } from './store.js'
import { addMonths, addDays, today, toDay } from './dates.js'
import { NO_FILTERS, applyFilters, filterCount, movePatch, bucket, addChange, wouldCycle, toCSV, toMarkdown, download, slug, copyText } from './logic.js'
import { dateRange, dayMonth, longDate } from './format.js'
import { useCloudSync, createWorkspace, openWorkspace, liftIdentity, workspaceUrl, forgetWorkspace } from '../../../shared/cloud/cloud.mjs'
import { CloudMenu } from '../../../shared/cloud/CloudMenu.jsx'
import { diff, apply } from '../../../shared/cloud/patch.mjs'
import Timeline from './Timeline.jsx'
import Board from './Board.jsx'
import ListView from './ListView.jsx'
import Changes from './Changes.jsx'
import Home from './Home.jsx'
import Present from './Present.jsx'
import Panel, { MilestonePanel } from './Panel.jsx'
import Sidebar from './Sidebar.jsx'
import FilterBar from './FilterBar.jsx'
import { ConfirmDialog, TemplateDialog, SnapshotDialog, ShortcutsDialog, NameDialog, DetailsDialog, ViewLinkDialog } from './Dialogs.jsx'
import Icon from './icons.jsx'
import { usePublisher, createMirror, pushMirror, viewUrl as mirrorUrl, OFF } from './publish.js'

export const ZOOMS = [30, 40, 56, 76, 100, 136, 190]
const UI_KEY = 'planlift-ui-v2'
const VIEWS = ['timeline', 'board', 'list', 'changes']
const readJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* blocked */ } }
const isTyping = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
// Fields with their own text undo; selects, date pickers, sliders and checkboxes use the app's undo.
const isTextEntry = el => el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|url|email|number|)$/.test(el.type)))

function initialUi(boot) {
  const narrow = window.innerWidth < 640
  const s = readJSON(UI_KEY, {})
  return {
    rmId: s.rmId || boot.uiRm || null, page: s.page === 'home' ? 'home' : 'roadmap',
    view: VIEWS.includes(s.view) ? s.view : narrow ? 'board' : 'timeline',
    zooms: s.zooms && typeof s.zooms === 'object' ? Object.fromEntries(Object.entries(s.zooms).filter(([, v]) => Number.isInteger(v) && v >= 0 && v < ZOOMS.length).slice(-50)) : {},
    groupBy: ['lane', 'status', 'owner', 'theme'].includes(s.groupBy) ? s.groupBy : 'lane',
    showDone: !!s.showDone, sidebar: s.sidebar !== false, welcomeOff: !!s.welcomeOff,
    period: ['7', '30', 'all'].includes(s.period) ? s.period : '30', scope: s.scope === 'all' ? 'all' : 'rm',
    filters: { ...NO_FILTERS, ...(s.filters || {}), q: '' },
    laneW: Number.isFinite(s.laneW) ? Math.max(140, Math.min(380, s.laneW)) : 200,
    collapsed: s.collapsed && typeof s.collapsed === 'object' ? s.collapsed : {},
  }
}

export default function App() {
  const [lang, t] = useLang()
  const [boot] = useState(() => {
    const q = new URLSearchParams(location.search)
    // ?w=<id>&view=1 — a live, view-only window onto a workspace (presentation links). Nothing here is saved
    // in this browser or added to its workspace list, and no editing UI is shown.
    if (q.get('w') && q.get('view') === '1') return { ws: { v: 2, name: '', roadmaps: [], log: [] }, hasLocal: false, url: q.get('w'), stored: null, viewOnly: true }
    const l = load(getLang())
    let stored = null
    try { stored = JSON.parse(localStorage.getItem('lift-cloud-plan')) } catch { /* none */ }
    return { ...l, url: new URLSearchParams(location.search).get('w'), stored }
  })
  const viewOnly = !!boot.viewOnly
  const [ws, rawSetWs] = useState(boot.ws)
  // Undo: every local edit records the workspace before and after. Undoing applies the inverse patch to the
  // *current* workspace, so it takes back only this person's change and keeps what teammates did meanwhile.
  // Edits with the same key within 1.5 s (typing a title, dragging a bar) fold into one step.
  const undoStack = useRef([]), redoStack = useRef([])
  const localEdit = useRef(false) // set by edits made here (not by remote copies): drives publishing
  const record = (before, after, key) => {
    redoStack.current = []
    const top = undoStack.current[undoStack.current.length - 1], now = Date.now()
    if (key && top && top.key === key && now - top.at < 1500) { top.after = after; top.at = now; return }
    undoStack.current = [...undoStack.current.slice(-59), { before, after, key, at: now }]
  }
  // Every edit made here also ends the example's "pristine" state (remote copies arrive through rawSetWs).
  const setWs = useCallback((fn, key) => rawSetWs(w => {
    let n = typeof fn === 'function' ? fn(w) : fn
    if (n === w) return w
    if (n.pristine) { const { pristine, ...rest } = n; n = rest }
    record(w, n, key)
    localEdit.current = true
    return n
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [ui, setUi] = useState(() => initialUi(boot))
  const [sel, setSel] = useState(null) // { kind: 'item' | 'ms', id }
  const [presenting, setPresenting] = useState(() => location.hash.startsWith('#present'))
  const [snap, setSnap] = useState(() => (location.hash.startsWith(SHARE_PREFIX) ? { loading: true } : null))
  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [drawer, setDrawer] = useState(false)
  const [width, setWidth] = useState(window.innerWidth)
  const [todayToken, setTodayToken] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [menu, setMenu] = useState(null)
  const ident = useMemo(() => liftIdentity(), [])
  const [me, setMeState] = useState(() => { try { return localStorage.getItem('planlift-me') || ident.name || '' } catch { return '' } })
  const meRef = useRef(me)
  meRef.current = me
  const searchRef = useRef(null)
  const pendingSearch = useRef(false)
  const fileRef = useRef(null)
  const warned = useRef(false)

  const narrow = width < 640
  const docked = width >= 1100
  const patchUi = useCallback(p => setUi(u => ({ ...u, ...(typeof p === 'function' ? p(u) : p) })), [])
  const setMe = v => { const n = v.trim().slice(0, 40); setMeState(n); try { localStorage.setItem('planlift-me', n) } catch { /* blocked */ } }

  // ---------- cloud ----------
  const fromCloud = useCallback(d => rawSetWs(normalizeWs(d)), [])
  // View-only visits keep their bookkeeping under a separate key so the workspace never joins "Your workspaces".
  const sync = useCloudSync({ app: viewOnly ? 'plan-view' : 'plan', prefix: 'pl', state: ws, setState: fromCloud, hasLocalData: boot.hasLocal, nameOf: d => d.name || '' })
  const opening = sync.mode === 'cloud' && sync.status === 'connecting' && (viewOnly || (boot.url && boot.url !== boot.stored))
  const newWorkspace = useCallback(() => {
    const fresh = { v: 2, name: t.untitledWs, roadmaps: [], log: [] }
    createWorkspace('plan', 'pl', fresh, fresh.name).then(openWorkspace, () => flash(t.couldNotCreate))
  }, [t]) // eslint-disable-line react-hooks/exhaustive-deps

  // The untouched example follows the language switch.
  // Only on an actual switch (not on load), so a shared example never flips language under a teammate.
  const langSeen = useRef(lang)
  useEffect(() => {
    if (langSeen.current === lang || viewOnly) return
    langSeen.current = lang
    if (ws.pristine && ws.pristine !== lang) rawSetWs(sampleWorkspace(lang))
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- persistence ----------
  useEffect(() => {
    // In cloud mode the workspace is safe on the server even if this browser can't keep a copy.
    if (viewOnly || ws.pub) return
    const h = setTimeout(() => { if (!save(ws) && !warned.current && sync.mode === 'local') { warned.current = true; flash(t.storageFull) } }, 250)
    return () => clearTimeout(h)
  }, [ws]) // eslint-disable-line react-hooks/exhaustive-deps
  // Don't lose the last quarter-second of edits when the tab closes or goes to the background.
  const wsRef = useRef(ws)
  wsRef.current = ws
  useEffect(() => {
    if (viewOnly) return
    const out = () => { if (!wsRef.current.pub) save(wsRef.current) }
    const vis = () => { if (document.visibilityState === 'hidden') out() }
    window.addEventListener('pagehide', out)
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('pagehide', out); document.removeEventListener('visibilitychange', vis) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (viewOnly) return; const { filters, ...rest } = ui; writeJSON(UI_KEY, { ...rest, filters: { ...filters, q: '' } }) }, [ui]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- current roadmap ----------
  const cur = ws.roadmaps.find(r => r.id === ui.rmId) || ws.roadmaps[0] || null
  const page = !cur ? 'home' : ui.page
  const items = useMemo(() => (cur ? applyFilters(cur.items, ui.filters) : []), [cur, ui.filters])
  const selItem = sel?.kind === 'item' ? cur?.items.find(i => i.id === sel.id) : null
  const selMs = sel?.kind === 'ms' ? cur?.milestones.find(m => m.id === sel.id) : null
  useEffect(() => { if (sel && !selItem && !selMs) setSel(null) }, [sel, selItem, selMs])
  useEffect(() => { document.title = cur && page === 'roadmap' ? `${cur.name} · PlanLift` : 'PlanLift · Lift Apps' }, [cur?.name, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- toasts & undo ----------
  // `undo` truthy: the toast offers Undo for the step that was just recorded.
  const flash = useCallback((msg, undo) => {
    setToast({ msg, undo: !!undo, key: Date.now() })
    clearTimeout(flash.t)
    flash.t = setTimeout(() => setToast(null), undo ? 6000 : 2800)
  }, [])
  // Undo / redo move steps between the stacks and apply their patch (or its inverse) to the current workspace.
  const step = (from, to, forward, emptyMsg, doneMsg) => {
    let ops = [], e
    while (!ops.length && from.current.length) { e = from.current.pop(); ops = forward ? diff(e.before, e.after) : diff(e.after, e.before) }
    if (!ops.length) { flash(emptyMsg); return }
    to.current = [...to.current.slice(-59), { ...e, key: null }]
    localEdit.current = true
    rawSetWs(w => apply(w, ops))
    setToast({ msg: doneMsg, key: Date.now() })
    clearTimeout(flash.t)
    flash.t = setTimeout(() => setToast(null), 2000)
  }
  const runUndo = useCallback(() => step(undoStack, redoStack, false, t.nothingToUndo, t.undone), [flash, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const runRedo = useCallback(() => step(redoStack, undoStack, true, t.nothingToRedo, t.redone), [flash, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- publishing the view-only mirror ----------
  const [editTick, setEditTick] = useState(0)
  useEffect(() => { if (localEdit.current) { localEdit.current = false; setEditTick(x => x + 1) } }, [ws])
  usePublisher(ws, editTick, !viewOnly && sync.mode === 'cloud' && !ws.pub)
  const published = !!(ws.publish?.on && ws.publish.id)
  const startSharing = async () => {
    try { const id = await createMirror(ws); setWs(w => ({ ...w, publish: { id, on: true } })); return id } catch { flash(t.couldNotCreate); return null }
  }
  const stopSharing = async () => {
    const id = ws.publish?.id
    setWs(w => ({ ...w, publish: { id: '', on: false } }))
    if (id) pushMirror(id, OFF).catch(() => {})
  }
  // A mirror opened without &view=1 (someone edited the link): leave it out of this browser's workspaces and show it view-only.
  useEffect(() => {
    if (viewOnly || !ws.pub || !sync.id) return
    forgetWorkspace('plan', sync.id)
    try { if (boot.stored) localStorage.setItem('lift-cloud-plan', JSON.stringify(boot.stored)); else localStorage.removeItem('lift-cloud-plan') } catch { /* blocked */ }
    location.replace(mirrorUrl(sync.id, ''))
  }, [ws.pub, sync.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- edits ----------
  const who = () => ({ at: Date.now(), wid: ident.id, who: meRef.current })
  const editRm = useCallback((rmId, fn, key) => setWs(w => ({ ...w, roadmaps: w.roadmaps.map(r => (r.id === rmId ? { ...fn(r), updated: Date.now() } : r)) }), key), [])

  // One item edit, with the change log for stakeholders (dates, status, lane).
  const editItem = useCallback((id, patch, rmId = cur?.id, key = `item:${id}:${Object.keys(patch).sort().join()}`) => setWs(w => {
    const r = w.roadmaps.find(x => x.id === rmId), it = r?.items.find(i => i.id === id)
    if (!it) return w
    const next = { ...it, ...patch }
    if (patch.status === 'done' && it.status !== 'done') next.progress = 100
    if (next.start && next.end < next.start) next.end = next.start
    let log = w.log
    const base = { ...who(), rm: rmId, item: id, title: next.title }
    if (next.status !== it.status) log = addChange(log, { ...base, kind: 'status', from: it.status, to: next.status })
    if (next.start !== it.start || next.end !== it.end) log = addChange(log, { ...base, kind: 'dates', from: [it.start, it.end], to: [next.start, next.end] })
    if (next.laneId !== it.laneId) log = addChange(log, { ...base, kind: 'lane', from: it.laneId, to: next.laneId })
    return { ...w, log, roadmaps: w.roadmaps.map(x => (x.id === rmId ? { ...x, updated: Date.now(), items: x.items.map(i => (i.id === id ? next : i)) } : x)) }
  }, key), [cur?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const insertItem = (it, rmId = cur.id, after = null) => {
    setWs(w => ({
      ...w, log: addChange(w.log, { ...who(), rm: rmId, item: it.id, title: it.title, kind: 'add', from: '', to: '' }),
      roadmaps: w.roadmaps.map(r => {
        if (r.id !== rmId) return r
        const list = [...r.items], k = after ? list.findIndex(i => i.id === after) : -1
        list.splice(k < 0 ? list.length : k + 1, 0, it)
        return { ...r, items: list, updated: Date.now() }
      }),
    }))
  }
  const blankItem = p => ({ id: uid(), laneId: cur.lanes[0]?.id, title: '', desc: '', start: '', end: '', horizon: '', status: 'planned', owner: '', progress: 0, tags: [], size: '', priority: '', links: [], comments: [], ...p })
  const addItem = (laneId, start, extra = {}) => {
    if (!cur) return
    const lane = laneId || (ui.filters.lane.length ? ui.filters.lane[0] : cur.lanes[0]?.id)
    const p = start ? { start, end: addDays(addMonths(start, 1), -1), horizon: '' } : { horizon: 'next' }
    const it = blankItem({ laneId: lane, ...p, ...extra })
    insertItem(it)
    setSel({ kind: 'item', id: it.id })
  }
  const addFromToolbar = () => {
    if (!cur) return
    const v = page !== 'roadmap' || ui.view === 'changes' ? 'timeline' : ui.view
    if (v !== ui.view || page !== 'roadmap') patchUi({ page: 'roadmap', view: v })
    addItem(null, v === 'timeline' ? today() : '')
  }
  const duplicateItem = id => {
    const it = cur.items.find(i => i.id === id)
    if (!it) return
    const copy = { ...structuredClone(it), id: uid(), links: it.links.map(l => ({ ...l, id: uid() })), comments: [] }
    delete copy.order
    insertItem(copy, cur.id, id)
    setSel({ kind: 'item', id: copy.id })
    flash(t.duplicated)
  }
  const deleteItem = id => {
    const rmId = cur.id, idx = cur.items.findIndex(i => i.id === id), it = cur.items[idx]
    if (!it) return
    const deps = cur.deps.filter(d => d.from === id || d.to === id)
    setWs(w => ({
      ...w, log: addChange(w.log, { ...who(), rm: rmId, item: id, title: it.title, kind: 'delete', from: '', to: '' }),
      roadmaps: w.roadmaps.map(r => (r.id === rmId ? { ...r, updated: Date.now(), items: r.items.filter(i => i.id !== id), deps: r.deps.filter(d => d.from !== id && d.to !== id) } : r)),
    }))
    setSel(null)
    flash(t.deletedItem(it.title || t.untitledItem), () => setWs(w => ({
      ...w, log: w.log.filter(e => !(e.item === id && e.kind === 'delete' && e.wid === ident.id)),
      roadmaps: w.roadmaps.map(r => {
        if (r.id !== rmId || r.items.some(i => i.id === id)) return r
        const list = [...r.items]
        list.splice(Math.min(idx, list.length), 0, it)
        const ids = new Set(list.map(i => i.id))
        return { ...r, items: list, deps: [...r.deps, ...deps.filter(d => ids.has(d.from) && ids.has(d.to) && !r.deps.some(x => x.id === d.id))] }
      }),
    })))
  }
  // Called by the timeline when a drag ends: one undo step back to where it was.
  const dragDone = () => { /* the drag's edits were recorded as one undo step (same key) */ }

  // Now / Next / Later board: apply the column rule and persist the column order.
  const moveItem = (id, col, orderedIds) => {
    const it = cur.items.find(i => i.id === id)
    if (!it) return
    const now = today()
    const from = bucket(it, now, addMonths(now, 3))
    const patch = from === col ? {} : movePatch(it, col, now)
    const ord = new Map(orderedIds.map((x, i) => [x, i]))
    const rmId = cur.id
    const key = `move:${id}:${Date.now()}`
    if (Object.keys(patch).length) editItem(id, patch, rmId, key)
    editRm(rmId, r => ({ ...r, items: r.items.map(i => (ord.has(i.id) && i.order !== ord.get(i.id) ? { ...i, order: ord.get(i.id) } : i)) }), key)
    if (from === col) return
    const back = Object.fromEntries(Object.keys(patch).map(k => [k, it[k]]))
    const label = { now: t.now, next: t.next, later: t.later, done: t.doneCol }[col]
    const bits = []
    if (patch.start) bits.push(t.startSet(dayMonth(t, patch.start)))
    if (patch.status) bits.push(t.statusSet(t.st[patch.status]))
    flash([t.movedTo(label), ...bits].join(' · '), true)
  }

  // ---------- comments ----------
  const addComment = (itemId, text) => {
    const body = text.trim().slice(0, 2000)
    if (!body || !cur) return
    const rmId = cur.id, c = { id: uid(), at: Date.now(), wid: ident.id, who: meRef.current, text: body }
    setWs(w => {
      const it = w.roadmaps.find(r => r.id === rmId)?.items.find(i => i.id === itemId)
      if (!it) return w
      return {
        ...w, log: addChange(w.log, { ...who(), rm: rmId, item: itemId, title: it.title, kind: 'comment', from: '', to: body.slice(0, 140) }),
        roadmaps: w.roadmaps.map(r => (r.id === rmId ? { ...r, updated: Date.now(), items: r.items.map(i => (i.id === itemId ? { ...i, comments: [...(i.comments || []), c] } : i)) } : r)),
      }
    })
  }
  const deleteComment = (itemId, cid) => editRm(cur.id, r => ({ ...r, items: r.items.map(i => (i.id === itemId ? { ...i, comments: (i.comments || []).filter(c => c.id !== cid) } : i)) }))

  // ---------- milestones ----------
  const addMilestone = (date = today(), laneId = '') => {
    if (!cur) return
    const m = { id: uid(), title: '', date, kind: 'milestone', laneId, note: '' }
    const rmId = cur.id
    setWs(w => ({ ...w, log: addChange(w.log, { ...who(), rm: rmId, item: m.id, title: '', kind: 'madd', from: '', to: '' }), roadmaps: w.roadmaps.map(r => (r.id === rmId ? { ...r, updated: Date.now(), milestones: [...r.milestones, m] } : r)) }))
    setSel({ kind: 'ms', id: m.id })
  }
  const editMs = useCallback((id, patch) => {
    const rmId = cur?.id
    setWs(w => {
      const r = w.roadmaps.find(x => x.id === rmId), m = r?.milestones.find(x => x.id === id)
      if (!m) return w
      const next = { ...m, ...patch }
      let log = w.log
      if (next.date !== m.date) log = addChange(log, { ...who(), rm: rmId, item: id, title: next.title, kind: 'mdate', from: m.date, to: next.date })
      // Keep the "added" entry's title current while it's being named.
      log = log.map(e => (e.item === id && e.title !== next.title ? { ...e, title: next.title } : e))
      return { ...w, log, roadmaps: w.roadmaps.map(x => (x.id === rmId ? { ...x, updated: Date.now(), milestones: x.milestones.map(y => (y.id === id ? next : y)) } : x)) }
    }, `ms:${id}`)
  }, [cur?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const deleteMs = id => {
    const rmId = cur.id, m = cur.milestones.find(x => x.id === id)
    if (!m) return
    setWs(w => ({ ...w, log: addChange(w.log, { ...who(), rm: rmId, item: id, title: m.title, kind: 'mdelete', from: '', to: '' }), roadmaps: w.roadmaps.map(r => (r.id === rmId ? { ...r, updated: Date.now(), milestones: r.milestones.filter(x => x.id !== id) } : r)) }))
    setSel(null)
    flash(t.deletedMs(m.title || t.untitledMilestone), () => setWs(w => ({
      ...w, log: w.log.filter(e => !(e.item === id && e.kind === 'mdelete')),
      roadmaps: w.roadmaps.map(r => (r.id === rmId && !r.milestones.some(x => x.id === id) ? { ...r, milestones: [...r.milestones, m] } : r)),
    })))
  }

  // ---------- dependencies ----------
  const addDep = (from, to) => {
    if (wouldCycle(cur.deps, from, to)) { flash(t.depLoop); return }
    if (cur.deps.some(d => d.from === from && d.to === to)) return
    editRm(cur.id, r => ({ ...r, deps: [...r.deps, { id: uid(), from, to }] }))
  }
  const removeDep = id => editRm(cur.id, r => ({ ...r, deps: r.deps.filter(d => d.id !== id) }))

  // ---------- lanes ----------
  const laneOps = {
    add: () => editRm(cur.id, r => ({ ...r, lanes: [...r.lanes, { id: uid(), name: t.newLane, color: PALETTE[(r.lanes.length + 3) % PALETTE.length].hex }] })),
    rename: (id, name) => editRm(cur.id, r => ({ ...r, lanes: r.lanes.map(l => (l.id === id ? { ...l, name } : l)) }), `lane:${id}`),
    colour: (id, color) => editRm(cur.id, r => ({ ...r, lanes: r.lanes.map(l => (l.id === id ? { ...l, color } : l)) })),
    move: (id, dir) => editRm(cur.id, r => {
      const lanes = [...r.lanes], i = lanes.findIndex(l => l.id === id), j = i + dir
      if (i < 0 || j < 0 || j >= lanes.length) return r
      ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
      return { ...r, lanes }
    }),
    remove: id => {
      const lane = cur.lanes.find(l => l.id === id), n = cur.items.filter(i => i.laneId === id).length
      if (!lane || cur.lanes.length < 2) return
      const go = () => {
        const rmId = cur.id, snapshot = structuredClone(cur)
        editRm(rmId, r => {
          const gone = new Set(r.items.filter(i => i.laneId === id).map(i => i.id))
          return { ...r, lanes: r.lanes.filter(l => l.id !== id), items: r.items.filter(i => !gone.has(i.id)), deps: r.deps.filter(d => !gone.has(d.from) && !gone.has(d.to)), milestones: r.milestones.map(m => (m.laneId === id ? { ...m, laneId: '' } : m)) }
        })
        flash(t.deletedLane(lane.name || t.lane), () => editRm(rmId, r => {
          const lanes = r.lanes.some(l => l.id === id) ? r.lanes : snapshot.lanes.filter(l => l.id === id || r.lanes.some(x => x.id === l.id)).map(l => r.lanes.find(x => x.id === l.id) || l)
          const have = new Set(r.items.map(i => i.id))
          const back = snapshot.items.filter(i => i.laneId === id && !have.has(i.id))
          const all = new Set([...have, ...back.map(i => i.id)])
          return { ...r, lanes, items: [...r.items, ...back], deps: [...r.deps, ...snapshot.deps.filter(d => all.has(d.from) && all.has(d.to) && !r.deps.some(x => x.id === d.id))] }
        }))
      }
      if (n) setDialog({ type: 'confirm', title: t.deleteLane, body: t.confirmDeleteLane(lane.name || t.lane, n), action: t.delete, onOk: go })
      else go()
    },
  }

  // ---------- roadmaps ----------
  const openRm = id => { patchUi({ rmId: id, page: 'roadmap' }); setSel(null); setDrawer(false) }
  const createRoadmap = (tplId, withExamples, replaceExample, name) => {
    const r = fromTemplate(tplId, lang, withExamples)
    if (name && name.trim()) r.name = name.trim().slice(0, 120)
    const sampleName = sampleWorkspace(lang).name
    setWs(w => {
      // Creating your own roadmap ends the example: either replace the example roadmaps or keep them alongside.
      const { example, ...rest } = w
      if (replaceExample && example) return { ...rest, name: !w.name || w.name === sampleName ? t.myWorkspace : w.name, roadmaps: [r], log: [] }
      return { ...rest, roadmaps: [...w.roadmaps, r] }
    })
    openRm(r.id)
    patchUi({ welcomeOff: true, filters: NO_FILTERS })
    if (r.items.some(i => i.start) || !withExamples) patchUi({ view: narrow ? 'board' : 'timeline' })
    setTodayToken(x => x + 1)
    flash(t.createdRm(r.name), true)
  }
  const duplicateRm = () => {
    setMenu(null)
    const copy = cleanRoadmap({ ...structuredClone(cur), id: uid(), name: `${cur.name} (${lang === 'zh' ? '副本' : 'copy'})`, created: Date.now() })
    // Keep item / lane ids unique across roadmaps by remapping them.
    const map = new Map()
    const nid = old => { if (!map.has(old)) map.set(old, uid()); return map.get(old) }
    copy.lanes = copy.lanes.map(l => ({ ...l, id: nid(l.id) }))
    copy.items = copy.items.map(i => ({ ...i, id: nid(i.id), laneId: nid(i.laneId), links: i.links.map(l => ({ ...l, id: uid() })) }))
    copy.milestones = copy.milestones.map(m => ({ ...m, id: uid(), laneId: m.laneId ? nid(m.laneId) : '' }))
    copy.deps = copy.deps.map(d => ({ id: uid(), from: nid(d.from), to: nid(d.to) }))
    setWs(w => { const k = w.roadmaps.findIndex(r => r.id === cur.id); const list = [...w.roadmaps]; list.splice(k + 1, 0, copy); return { ...w, roadmaps: list } })
    openRm(copy.id)
    flash(t.duplicated)
  }
  const deleteRm = (rm = cur) => {
    setMenu(null)
    setDialog({
      type: 'confirm', title: t.deleteRm, body: t.confirmDeleteRm(rm.name || t.untitled, rm.items.length), action: t.delete,
      onOk: () => {
        const idx = ws.roadmaps.findIndex(r => r.id === rm.id)
        setWs(w => ({ ...w, roadmaps: w.roadmaps.filter(r => r.id !== rm.id) }))
        const rest = ws.roadmaps.filter(r => r.id !== rm.id)
        patchUi({ rmId: rest[Math.max(0, idx - 1)]?.id || null, page: rest.length ? ui.page : 'home' })
        setSel(null)
        flash(t.deletedRm(rm.name || t.untitled), () => {
          setWs(w => { if (w.roadmaps.some(r => r.id === rm.id)) return w; const list = [...w.roadmaps]; list.splice(Math.min(idx, list.length), 0, rm); return { ...w, roadmaps: list } })
          patchUi({ rmId: rm.id, page: 'roadmap' })
        })
      },
    })
  }
  const moveRm = (id, dir) => setWs(w => {
    const list = [...w.roadmaps], i = list.findIndex(r => r.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return w
    ;[list[i], list[j]] = [list[j], list[i]]
    return { ...w, roadmaps: list }
  })

  // ---------- export ----------
  const fmtRange = (a, b) => dateRange(t, a, b)
  const fmtDate = d => longDate(t, d)
  const exportCsv = () => { setMenu(null); download(new Blob([toCSV(cur, items, t)], { type: 'text/csv;charset=utf-8' }), `${slug(cur.name)}.csv`); flash(t.csvDone) }
  const copyMd = async plain => { setMenu(null); await copyText(toMarkdown(cur, items, t, { plain, fmtRange, fmtDate })); flash(t.copiedMd) }
  const exportJson = () => {
    setMenu(null)
    download(new Blob([JSON.stringify({ type: 'planlift', version: 2, source: 'https://liftapps.com.au/plan/', roadmap: cur }, null, 2)], { type: 'application/json' }), `${slug(cur.name)}.planlift.json`)
  }
  const importJson = async file => {
    try {
      const data = JSON.parse(await file.text())
      const list = data.workspace ? cleanWs(data.workspace)?.roadmaps : [cleanRoadmap(data.roadmap || (Array.isArray(data.roadmaps) ? data.roadmaps[0] : data))]
      if (!list?.length || !list[0]) throw new Error('bad')
      const added = list.map(r => ({ ...r, id: uid(), updated: Date.now() }))
      setWs(w => ({ ...w, roadmaps: [...w.roadmaps, ...added] }))
      openRm(added[0].id)
      flash(t.importDone(added[0].name))
    } catch { flash(t.importFail) }
  }
  const snapshotLink = async () => {
    setMenu(null)
    const code = await encodeShare(cur)
    setDialog({ type: 'snapshot', url: `${location.origin}${location.pathname}${SHARE_PREFIX}${code}` })
  }
  const print = () => { setMenu(null); setSel(null); setTimeout(() => window.print(), 80) }

  // ---------- snapshot links (#view=) and present mode (#present) ----------
  useEffect(() => {
    const check = async () => {
      setPresenting(location.hash.startsWith('#present'))
      if (!location.hash.startsWith(SHARE_PREFIX)) { setSnap(null); return }
      try { setSnap({ roadmap: await decodeShare(location.hash.slice(SHARE_PREFIX.length)) }) } catch { setSnap({ error: true }) }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  const rmIds = ws.roadmaps.map(r => r.id).join()
  useEffect(() => {
    const m = location.hash.match(/^#present=(.+)$/)
    if (m && ws.roadmaps.some(r => r.id === m[1])) patchUi({ rmId: m[1], page: 'roadmap' })
  }, [presenting, rmIds]) // eslint-disable-line react-hooks/exhaustive-deps
  const startPresent = () => { setSel(null); setMenu(null); if (cur) history.replaceState(null, '', `${location.pathname}${location.search}#present=${cur.id}`); setPresenting(true) }
  const stopPresent = () => { history.replaceState(null, '', location.pathname + location.search); setPresenting(false); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  const leaveSnap = keep => {
    if (keep && snap?.roadmap) {
      const r = { ...snap.roadmap, id: uid(), updated: Date.now() }
      setWs(w => ({ ...w, roadmaps: [...w.roadmaps, r] }))
      openRm(r.id)
      flash(t.savedCopy)
    }
    history.replaceState(null, '', location.pathname + location.search)
    setSnap(null)
  }
  const presentLink = cur && published ? mirrorUrl(ws.publish.id, cur.id) : null
  const openViewLink = () => { setMenu(null); setDialog({ type: 'viewlink' }) }

  // ---------- window events & shortcuts ----------
  useEffect(() => {
    const r = () => setWidth(window.innerWidth)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])
  const keyRef = useRef(null)
  keyRef.current = e => {
    if (viewOnly) return
    if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.metaKey && e.key.toLowerCase() === 'y')) && !isTextEntry(e.target) && !dialog) { e.preventDefault(); runRedo(); return }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTextEntry(e.target) && !dialog) { e.preventDefault(); runUndo(); return }
    if (e.key === 'Escape') {
      if (dialog) return // the dialog handles it
      if (menu) setMenu(null)
      else if (filterOpen) setFilterOpen(false)
      else if (drawer) setDrawer(false)
      else if (sel) setSel(null)
      else if (presenting) stopPresent()
      return
    }
    // Keys typed right after "/" (before the search box exists) go into the search, not to shortcuts.
    if (pendingSearch.current && !isTyping(e.target) && e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); patchUi(u => ({ filters: { ...u.filters, q: u.filters.q + e.key } })); return }
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || dialog || snap) return
    if (presenting) return
    const k = e.key
    if (k === '?') { e.preventDefault(); setDialog({ type: 'keys' }); return }
    if (!cur) return
    if (k === 'n' || k === 'N') { e.preventDefault(); addFromToolbar() }
    else if (k === 'm' || k === 'M') { e.preventDefault(); patchUi({ page: 'roadmap', view: 'timeline' }); addMilestone() }
    else if (/^[1-4]$/.test(k)) patchUi({ page: 'roadmap', view: VIEWS[+k - 1] })
    else if (k === 'p' || k === 'P') startPresent()
    else if (k === '/') {
      e.preventDefault()
      if (searchRef.current) searchRef.current.focus()
      else { pendingSearch.current = true; patchUi(u => ({ page: 'roadmap', view: u.view === 'changes' ? 'timeline' : u.view })) }
    }
    else if (k === 'f' || k === 'F') { patchUi({ page: 'roadmap' }); setFilterOpen(o => !o) }
    else if (k === 't' || k === 'T') setTodayToken(x => x + 1)
    else if (k === '+' || k === '=') setZoom(zoom + 1)
    else if (k === '-' || k === '_') setZoom(zoom - 1)
    else if ((k === 'Delete' || k === 'Backspace') && selItem) { e.preventDefault(); deleteItem(selItem.id) }
    else if ((k === 'Delete' || k === 'Backspace') && selMs) { e.preventDefault(); deleteMs(selMs.id) }
    else if ((k === 'd' || k === 'D') && selItem) duplicateItem(selItem.id)
  }
  useEffect(() => {
    const h = e => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => {
    if (!menu) return
    const close = e => { if (!e.target.closest('.menu, .menu-btn')) setMenu(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])
  useEffect(() => { setTodayToken(x => x + 1) }, [cur?.id, ui.view, page])
  useEffect(() => { if (pendingSearch.current && searchRef.current) { pendingSearch.current = false; const el = searchRef.current; el.focus(); el.setSelectionRange(el.value.length, el.value.length) } })

  // Zoom is remembered per roadmap; until someone zooms, fit the roadmap's dated span to the screen.
  const laneW = narrow ? 112 : ui.laneW
  const fitZoom = rm => {
    const ds = [...rm.items.filter(i => i.start).flatMap(i => [i.start, i.end]), ...rm.milestones.map(m => m.date)].sort()
    if (!ds.length) return narrow ? 2 : 3
    const months = (toDay(ds[ds.length - 1]) - toDay(ds[0])) / 30.4 + 1.5
    const avail = width - (docked && ui.sidebar ? 248 : 0) - laneW - 40
    const target = avail / Math.max(months, narrow ? 3 : 4)
    let z = 0
    ZOOMS.forEach((v, k) => { if (v <= target) z = k })
    return narrow ? Math.max(2, z) : z
  }
  const zoom = cur ? ui.zooms[cur.id] ?? fitZoom(cur) : 3
  const setZoom = z => cur && patchUi(u => ({ zooms: { ...u.zooms, [cur.id]: Math.max(0, Math.min(ZOOMS.length - 1, z)) } }))
  // Once a roadmap has been shown at its fitted zoom, keep it: adding items must not re-zoom under the user.
  useEffect(() => { if (cur && page === 'roadmap' && ui.view === 'timeline' && ui.zooms[cur.id] === undefined) setZoom(zoom) }, [cur?.id, page, ui.view]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilters = f => patchUi(u => ({ filters: typeof f === 'function' ? f(u.filters) : f }))
  const fCount = filterCount(ui.filters)

  // ---------- render ----------
  if (snap) {
    return (
      <div className="app-shell">
        <div className="ro-banner" role="status">
          <span className="ro-tag"><Icon name="eye" size={15} /> {t.readOnly}</span>
          <span className="ro-text">{snap.error ? t.badLink : t.readOnlyBody}</span>
          <span className="grow" />
          {snap.roadmap && <button className="btn small primary" onClick={() => leaveSnap(true)}>{t.saveCopy}</button>}
          <button className="btn small" onClick={() => leaveSnap(false)}>{t.exitView}</button>
        </div>
        {snap.roadmap && <Present rm={snap.roadmap} items={snap.roadmap.items} t={t} lang={lang} embedded />}
        {toast && <Toast toast={toast} t={t} onUndo={runUndo} />}
      </div>
    )
  }

  if (sync.status === 'missing') {
    const others = sync.workspaces.filter(w => w.id !== sync.id)
    return (
      <div className="app-shell">
        <div className="state-page">
          <Icon name="map" size={34} />
          <h1>{t.missingTitle}</h1>
          <p>{t.missingBody}</p>
          {others.length > 0 && <div className="state-list"><h2>{t.openMine}</h2>{others.map(w => <button key={w.id} className="btn" onClick={() => openWorkspace(w.id)}>{w.name || t.untitledWs}</button>)}</div>}
          <button className="btn primary" onClick={() => createWorkspace('plan', 'pl', sampleWorkspace(lang), sampleWorkspace(lang).name).then(openWorkspace, () => flash(t.couldNotCreate))}>{t.startNew}</button>
        </div>
        {toast && <Toast toast={toast} t={t} onUndo={runUndo} />}
      </div>
    )
  }

  if (viewOnly) {
    const idx = cur ? ws.roadmaps.findIndex(r => r.id === cur.id) : 0
    return (
      <div className="app-shell">
        {cur && <Present rm={cur} items={cur.items} t={t} lang={lang} viewOnly ws={ws} meId={ident.id} count={ws.roadmaps.length} index={idx}
          onStep={d => { const r = ws.roadmaps[(idx + d + ws.roadmaps.length) % ws.roadmaps.length]; if (r) { patchUi({ rmId: r.id }); history.replaceState(null, '', `${location.pathname}${location.search}#present=${r.id}`) } }} />}
        {!cur && !opening && <div className="state-page"><Icon name="map" size={34} /><h1>{ws.off ? t.viewLinkOffTitle : t.viewEmpty}</h1>{ws.off && <p>{t.viewLinkOffBody}</p>}</div>}
        {opening && <div className="loading-veil top" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{t.opening}</div>}
      </div>
    )
  }

  if (presenting && cur) {
    const idx = ws.roadmaps.findIndex(r => r.id === cur.id)
    return (
      <div className="app-shell">
        <Present rm={cur} items={items} t={t} lang={lang} filtered={fCount > 0} onExit={stopPresent} link={presentLink} onShare={sync.mode === 'cloud' ? () => { stopPresent(); openViewLink() } : null} ws={ws} meId={ident.id}
          onFlash={flash} count={ws.roadmaps.length} index={idx}
          onStep={d => { const r = ws.roadmaps[(idx + d + ws.roadmaps.length) % ws.roadmaps.length]; if (r) { patchUi({ rmId: r.id }); history.replaceState(null, '', `${location.pathname}${location.search}#present=${r.id}`) } }} />
        {opening && <div className="loading-veil top" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{t.opening}</div>}
        {toast && <Toast toast={toast} t={t} onUndo={runUndo} />}
      </div>
    )
  }

  const sidebarOpen = docked ? ui.sidebar : drawer
  const viewTabs = [['timeline', 'timeline', t.timeline], ['board', 'columns', narrow ? t.boardShort : t.board], ['list', 'list', t.list], ['changes', 'history', t.changes]]
  const showWelcome = ws.example && !ui.welcomeOff && page === 'roadmap'

  return (
    <div className={`app ${sidebarOpen ? 'side-open' : ''} ${docked ? 'docked' : 'undocked'}`}>
      {sidebarOpen && (
        <Sidebar ws={ws} cur={cur} page={page} t={t} me={me} docked={docked}
          onWsName={name => setWs(w => ({ ...w, name }), 'wsname')} onOpen={openRm} onHome={() => { patchUi({ page: 'home' }); setSel(null); setDrawer(false) }}
          onNew={() => { setDrawer(false); setDialog({ type: 'template' }) }} onKeys={() => setDialog({ type: 'keys' })} onName={() => setDialog({ type: 'name' })}
          onMove={moveRm} onClose={() => (docked ? patchUi({ sidebar: false }) : setDrawer(false))} />
      )}
      {!docked && drawer && <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <div className="work">
        <header className="toolbar">
          {(!docked || !ui.sidebar) && (
            <button className="icon-btn" aria-label={docked ? t.showSidebar : t.menu} title={docked ? t.showSidebar : t.menu} onClick={() => (docked ? patchUi({ sidebar: true }) : setDrawer(true))}>
              <Icon name={docked ? 'sidebar' : 'menu'} />
            </button>
          )}
          {page === 'home' || !cur ? (
            <h1 className="rm-title">{t.overviewTitle}</h1>
          ) : (
            <input className="rm-name" value={cur.name} aria-label={t.roadmapName} placeholder={t.untitled}
              onChange={e => editRm(cur.id, r => ({ ...r, name: e.target.value }), `rmname:${cur.id}`)} onBlur={e => { if (!e.target.value.trim()) editRm(cur.id, r => ({ ...r, name: t.untitled })) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          )}
          {page === 'roadmap' && cur && (
            <nav className="seg views" aria-label={t.views}>
              {viewTabs.map(([v, icon, label]) => (
                <button key={v} aria-current={ui.view === v ? 'page' : undefined} className={ui.view === v ? 'on' : ''} title={label} onClick={() => { patchUi({ view: v }); setSel(null) }}>
                  <Icon name={icon} size={16} /><span>{label}</span>
                </button>
              ))}
            </nav>
          )}
          <span className="grow" />
          <CloudMenu sync={sync} app="plan" lang={lang} onNew={sync.mode === 'cloud' ? newWorkspace : null} compact={narrow} />
          {page === 'roadmap' && cur && <button className="btn small hide-narrow" onClick={startPresent} title={`${t.present} (P)`}><Icon name="present" size={15} /><span>{t.present}</span></button>}
          {page === 'roadmap' && cur
            ? <button className="btn small primary" onClick={addFromToolbar} title={`${t.addItem} (N)`} aria-label={t.addItem}><Icon name="plus" size={15} /><span className="hide-narrow">{t.addItem}</span></button>
            : <button className="btn small primary" onClick={() => setDialog({ type: 'template' })}><Icon name="plus" size={15} /><span className="hide-narrow">{t.newRoadmap}</span></button>}
          {page === 'roadmap' && cur && (
            <div className="more">
              <button className="menu-btn icon-btn" aria-label={t.more} title={t.more} aria-haspopup="true" aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')}><Icon name="more" size={20} sw={3} /></button>
              {menu === 'more' && (
                <div className="menu right" role="menu">
                  <button role="menuitem" className="menu-item show-narrow" onClick={startPresent}><Icon name="present" size={15} /><span className="mi-label">{t.present}</span></button>
                  <div className="menu-label">{t.exportGroup}</div>
                  <button role="menuitem" className="menu-item" onClick={() => copyMd(false)}><Icon name="copy" size={15} /><span className="mi-label">{t.copyMd}</span></button>
                  <button role="menuitem" className="menu-item" onClick={() => copyMd(true)}><Icon name="copy" size={15} /><span className="mi-label">{t.copyText}</span></button>
                  <button role="menuitem" className="menu-item" onClick={exportCsv}><Icon name="download" size={15} /><span className="mi-label">{t.exportCsv}</span></button>
                  <button role="menuitem" className="menu-item" onClick={print}><Icon name="print" size={15} /><span className="mi-label">{t.print}</span></button>
                  {sync.mode === 'cloud' && <button role="menuitem" className="menu-item" onClick={openViewLink}><Icon name="eye" size={15} /><span className="mi-label">{t.viewLink}</span></button>}
                  <button role="menuitem" className="menu-item" onClick={snapshotLink}><Icon name="link" size={15} /><span className="mi-label">{t.snapshotLink}</span></button>
                  <hr />
                  <div className="menu-label">{t.manageGroup}</div>
                  <button role="menuitem" className="menu-item" onClick={() => { setMenu(null); setDialog({ type: 'details' }) }}><Icon name="edit" size={15} /><span className="mi-label">{t.rmDetails}</span></button>
                  <button role="menuitem" className="menu-item" onClick={duplicateRm}><Icon name="copy" size={15} /><span className="mi-label">{t.duplicateRm}</span></button>
                  <button role="menuitem" className="menu-item" onClick={exportJson}><Icon name="download" size={15} /><span className="mi-label">{t.exportJson}</span></button>
                  <button role="menuitem" className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click() }}><Icon name="upload" size={15} /><span className="mi-label">{t.importJson}</span></button>
                  <button role="menuitem" className="menu-item danger" onClick={() => deleteRm()}><Icon name="trash" size={15} /><span className="mi-label">{t.deleteRm}</span></button>
                  <hr />
                  <button role="menuitem" className="menu-item" onClick={() => { setMenu(null); setDialog({ type: 'keys' }) }}><Icon name="keyboard" size={15} /><span className="mi-label">{t.shortcuts}</span><kbd>?</kbd></button>
                </div>
              )}
            </div>
          )}
        </header>

        {page === 'roadmap' && cur && ui.view !== 'changes' && (
          <FilterBar t={t} rm={cur} ui={ui} patchUi={patchUi} filters={ui.filters} setFilters={setFilters} open={filterOpen} setOpen={setFilterOpen}
            searchRef={searchRef} shown={items.length} total={cur.items.length} narrow={narrow} onToday={() => setTodayToken(x => x + 1)} zoom={zoom} setZoom={setZoom} maxZoom={ZOOMS.length - 1} />
        )}

        {showWelcome && (
          <div className="welcome" role="note">
            <div><b>{t.welcomeTitle}</b><span>{t.welcomeBody}</span></div>
            <div className="welcome-actions">
              <button className="btn small" onClick={() => setDialog({ type: 'template' })}>{t.welcomeCta}</button>
              <button className="btn small ghost" onClick={() => patchUi({ welcomeOff: true })}>{t.dismiss}</button>
            </div>
          </div>
        )}

        {page === 'roadmap' && cur && (
          <div className="print-head" aria-hidden="true">
            <h1>{cur.name}</h1>
            <p>{cur.desc ? `${cur.desc} · ` : ''}{t.printedOn(longDate(t, today()))} · {t.itemsCount(items.length)}{fCount > 0 ? ` · ${t.filteredNote}` : ''}</p>
          </div>
        )}
        <main className="main" id="main">
          {page === 'home' && (
            <Home ws={ws} t={t} lang={lang} onOpen={openRm} onTemplate={id => setDialog({ type: 'template', preset: id })} onDelete={deleteRm} meId={ident.id} />
          )}
          {page === 'roadmap' && cur && ui.view === 'timeline' && (
            <Timeline rm={cur} items={items} t={t} monthW={ZOOMS[zoom]} laneW={laneW} groupBy={ui.groupBy} sel={sel} todayToken={todayToken}
              filtered={fCount > 0} narrow={narrow} collapsed={ui.collapsed} onToggleRow={k => patchUi(u => ({ collapsed: { ...u.collapsed, [k]: !u.collapsed[k] || undefined } }))}
              onLaneW={w => patchUi({ laneW: w })} onAddDep={addDep}
              onSelect={setSel} onAdd={addItem} onAddMs={addMilestone} onUpdateItem={editItem} onUpdateMs={editMs} onDragDone={dragDone} lanes={laneOps} onClearFilters={() => setFilters(NO_FILTERS)} />
          )}
          {page === 'roadmap' && cur && ui.view === 'board' && (
            <Board rm={cur} items={items} t={t} showDone={ui.showDone} sel={sel} onSelect={setSel} onMove={moveItem} onAdd={col => addItem(null, '', { horizon: col === 'done' ? 'now' : col, status: col === 'now' ? 'progress' : col === 'done' ? 'done' : 'planned' })} />
          )}
          {page === 'roadmap' && cur && ui.view === 'list' && (
            <ListView rm={cur} items={items} t={t} sel={sel} narrow={narrow} compact={width - (sidebarOpen && docked ? 248 : 0) < 1320} onSelect={setSel} onUpdate={editItem} onAdd={() => addItem(null, '')} filtered={fCount > 0} onClearFilters={() => setFilters(NO_FILTERS)} />
          )}
          {page === 'roadmap' && cur && ui.view === 'changes' && (
            <Changes ws={ws} rm={cur} t={t} lang={lang} meId={ident.id} me={me} period={ui.period} scope={ui.scope} patchUi={patchUi}
              onName={() => setDialog({ type: 'name' })} onOpenItem={id => { patchUi({ view: 'timeline' }); setSel({ kind: 'item', id }) }} onFlash={flash} />
          )}
          {selItem && page === 'roadmap' && (
            <Panel key={selItem.id} item={selItem} rm={cur} log={ws.log} t={t} meId={ident.id}
              onChange={p => editItem(selItem.id, p)} onDelete={() => deleteItem(selItem.id)} onDuplicate={() => duplicateItem(selItem.id)}
              onAddDep={addDep} onRemoveDep={removeDep} onSelect={setSel} onClose={() => setSel(null)} me={me} onComment={text => addComment(selItem.id, text)} onDeleteComment={cid => deleteComment(selItem.id, cid)} onName={() => setDialog({ type: 'name' })} />
          )}
          {selMs && page === 'roadmap' && (
            <MilestonePanel key={selMs.id} ms={selMs} rm={cur} t={t} onChange={p => editMs(selMs.id, p)} onDelete={() => deleteMs(selMs.id)} onClose={() => setSel(null)} />
          )}
        </main>
      {page === 'roadmap' && cur && ui.view === 'timeline' && (
        <div className="print-only" aria-hidden="true">
          <Timeline rm={cur} items={items} t={t} printing monthW={ZOOMS[zoom]} laneW={laneW} groupBy={ui.groupBy} sel={null} todayToken={0} filtered={fCount > 0} onSelect={() => {}} />
        </div>
      )}
      </div>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />

      {opening && <div className="loading-veil" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{t.opening}</div>}
      {dialog?.type === 'confirm' && <ConfirmDialog t={t} {...dialog} onClose={() => setDialog(null)} />}
      {dialog?.type === 'template' && <TemplateDialog t={t} lang={lang} preset={dialog.preset} example={!!ws.example} onCreate={(id, ex, rep, name) => { setDialog(null); createRoadmap(id, ex, rep, name) }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'snapshot' && <SnapshotDialog t={t} url={dialog.url} onClose={() => setDialog(null)} />}
      {dialog?.type === 'viewlink' && <ViewLinkDialog t={t} url={published ? mirrorUrl(ws.publish.id, cur?.id) : null} onCreate={startSharing} onStop={stopSharing} onClose={() => setDialog(null)} />}
      {dialog?.type === 'keys' && <ShortcutsDialog t={t} onClose={() => setDialog(null)} />}
      {dialog?.type === 'name' && <NameDialog t={t} value={me} onSave={v => { setMe(v); setDialog(null) }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'details' && cur && <DetailsDialog t={t} rm={cur} onSave={p => { editRm(cur.id, r => ({ ...r, ...p })); setDialog(null) }} onClose={() => setDialog(null)} />}
      {toast && <Toast toast={toast} t={t} onUndo={runUndo} />}
    </div>
  )
}

function Toast({ toast, t, onUndo }) {
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.key}>
      <span>{toast.msg}</span>
      {toast.undo && <button className="toast-undo" onClick={onUndo}>{t.undo}</button>}
    </div>
  )
}
