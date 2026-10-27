import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import {
  createElement, bounds, commonBounds, normalize, hitTest, measureText, scaleElement, demoScene, uid, newSeed,
  isLinear, isContainer, STROKE_COLORS, BG_COLORS, CANVAS_BGS, DEFAULT_STYLE, DEFAULT_BG, FONT_SIZES, FONT, LINE_HEIGHT,
} from './scene.js'
import { renderScene, handleRects, exportCanvas, exportSvg } from './render.js'
import Icon, { Glyph } from './icons.jsx'
import { useLang, tFor, getLang, MOD, CLOUD_WORDS } from './i18n.js'
import { backend, useCloudSync, createWorkspace, openWorkspace, forgetWorkspace } from '../../../shared/cloud/cloud.mjs'
import { diff, apply } from '../../../shared/cloud/patch.mjs'
import { CloudMenu } from '../../../shared/cloud/CloudMenu.jsx'
import {
  APP, PREFIX, LEGACY_KEY, MIGRATED_KEY, CURRENT_KEY, readCache, writeCache, pruneCaches, readLegacy, saveMeta, metaOf, forgetMeta, makeThumb,
  blankDrawing, tidy, fitForSync, uniqueIds,
} from './drawingStore.js'
import { DrawingsPanel, DrawingGate } from './Drawings.jsx'

const TOOLS = [
  { id: 'hand', key: 'H' },
  { id: 'selection', key: '1', alt: 'V' },
  { id: 'rectangle', key: '2', alt: 'R' },
  { id: 'diamond', key: '3', alt: 'D' },
  { id: 'ellipse', key: '4', alt: 'O' },
  { id: 'arrow', key: '5', alt: 'A' },
  { id: 'line', key: '6', alt: 'L' },
  { id: 'freedraw', key: '7', alt: 'P' },
  { id: 'text', key: '8', alt: 'T' },
  { id: 'eraser', key: '0', alt: 'E' },
]
const KEY_TO_TOOL = { h: 'hand', v: 'selection', 1: 'selection', r: 'rectangle', 2: 'rectangle', d: 'diamond', 3: 'diamond', o: 'ellipse', 4: 'ellipse', a: 'arrow', 5: 'arrow', l: 'line', 6: 'line', p: 'freedraw', 7: 'freedraw', t: 'text', 8: 'text', e: 'eraser', 0: 'eraser' }
const DRAW_TOOLS = ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text']
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
const BAR_H = 52
// Keeps one text within a single synced change (the cloud takes ≤ 64 KB per change, CJK is 3 bytes a character).
const MAX_TEXT = 15000

// What to show first. Without a backend: the one local scene, as before. With one: the drawing in the
// ?w= link (or the one this browser had open), from this browser's copy of it when there is one.
//   ready     false while a drawing this browser has never seen loads (the canvas waits for it)
//   uploading true on the first cloud visit: useCloudSync uploads the scene on screen as the first drawing
//   migrate   the pre-cloud local scene, when it still needs its own cloud copy (arrived by someone's link)
function loadInitial() {
  const base = { elements: [], bg: DEFAULT_BG, name: '', zoom: 1, scrollX: 0, scrollY: 0, ready: true }
  const demo = location.hash === '#demo' ? { elements: demoScene(tFor(getLang()).sample) } : null
  const legacy = readLegacy()
  if (!backend) return { ...base, ...(demo ?? legacy) }
  const fromUrl = new URLSearchParams(location.search).get('w')
  let stored = null
  try { stored = JSON.parse(localStorage.getItem(CURRENT_KEY)) } catch { /* blocked storage */ }
  // A drawing this browser has a copy of opens straight from it (instantly, and offline too).
  if (fromUrl && fromUrl !== stored && readCache(fromUrl)) {
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(fromUrl)) } catch { /* blocked storage */ }
    stored = fromUrl
  }
  const id = fromUrl || stored
  if (!id) {
    // useCloudSync uploads what's on screen until it succeeds, so the old scene is migrated by that.
    try { if (legacy) localStorage.setItem(MIGRATED_KEY, 'first') } catch { /* blocked storage */ }
    return { ...base, ...(demo ?? legacy), uploading: true }
  }
  let migrate = null
  try { if (legacy?.elements.length && !localStorage.getItem(MIGRATED_KEY)) migrate = legacy } catch { /* blocked storage */ }
  return { ...base, ...readCache(id), ready: id === stored, migrate }
}
const stamp = () => new Date().toISOString().slice(0, 10)

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function App() {
  const [lang, t] = useLang()
  const init = useRef(null)
  if (!init.current) init.current = loadInitial()
  const S = useRef({
    elements: uniqueIds(Array.isArray(init.current.elements) ? init.current.elements : []), selectedIds: new Set(), tool: 'selection', locked: false,
    zoom: init.current.zoom, scrollX: init.current.scrollX, scrollY: init.current.scrollY,
    bg: init.current.bg || DEFAULT_BG, name: init.current.name || '', editedAt: null, style: { ...DEFAULT_STYLE },
    past: [], future: [], editing: null, marquee: null, erasing: null, interaction: null,
    spaceDown: false, clipboard: null, pointer: { x: 0, y: 0 },
  }).current
  const [, force] = useReducer(x => x + 1, 0)
  if (import.meta.env.DEV) Object.assign(window, { __sketch: S, __sketchBackend: backend })
  const canvasRef = useRef(null)
  const appRef = useRef(null)
  const fileRef = useRef(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: Math.max(200, window.innerHeight - BAR_H) })
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [cursor, setCursor] = useState('default')
  const [loaded, setLoaded] = useState(init.current.ready)
  const [tooBig, setTooBig] = useState(false)

  // ---------- cloud ----------
  // The synced part of the drawing: elements, canvas colour and name (zoom, scroll, selection and tool stay
  // in this browser). During a gesture it keeps the pre-gesture version, so a stroke or drag is sent once,
  // when it's finished, and a remote update can't pull the shape out from under the pointer.
  const sharedRef = useRef(null)
  if (!sharedRef.current) sharedRef.current = { elements: S.elements, bg: S.bg, name: S.name }
  {
    const c = sharedRef.current
    if (!S.interaction && (c.elements !== S.elements || c.bg !== S.bg || c.name !== S.name)) {
      sharedRef.current = { elements: S.elements, bg: S.bg, name: S.name }
      S.editedAt = Date.now()
    }
  }
  // Someone else's changes (merged by useCloudSync under our unsent ones).
  const fromCloud = useCallback(next => {
    const prev = sharedRef.current
    if (!Array.isArray(next.elements)) next = { ...next, elements: [] }
    // Edits made here that useCloudSync hasn't been handed yet (a gesture in progress) are replayed on top.
    const mine = diff(prev.elements, S.elements)
    const theirs = diff(prev.elements, next.elements)
    if (theirs.length) {
      // Undo/redo revert only this person's edits: other people's changes are folded into the history,
      // so undo never brings back a shape someone else deleted or removes one they added.
      S.past = S.past.map(p => apply(p, theirs))
      S.future = S.future.map(p => apply(p, theirs))
      S.editedAt = Date.now()
    }
    S.elements = mine.length ? apply(next.elements, mine) : next.elements
    if (S.bg === prev.bg) S.bg = next.bg || DEFAULT_BG
    if (S.name === prev.name) S.name = next.name ?? ''
    sharedRef.current = next
    const ids = new Set(S.elements.map(e => e.id))
    S.selectedIds = new Set([...S.selectedIds].filter(id => ids.has(id)))
    if (S.editing && !ids.has(S.editing.id)) S.editing = null
    force()
  }, [S])
  const sync = useCloudSync({ app: APP, prefix: PREFIX, state: sharedRef.current, setState: fromCloud, hasLocalData: false, nameOf: d => d.name ?? '' })
  const cloud = sync.mode === 'cloud'
  const blocked = !loaded || sync.status === 'missing'

  // A drawing this browser hasn't seen opens once its cloud copy is here.
  useEffect(() => {
    if (loaded || (sync.status !== 'synced' && sync.status !== 'saving')) return
    setLoaded(true)
    if (S.elements.length) zoomToFit(S.elements, 1)
  }, [sync.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arrived by someone's link with a pre-cloud local scene: it becomes a drawing of its own (never lost).
  useEffect(() => {
    const legacy = init.current.migrate
    if (!legacy) return
    const data = { elements: uniqueIds(legacy.elements), bg: legacy.bg || DEFAULT_BG, name: '' }
    createWorkspace(APP, PREFIX, data, '').then(id => {
      try { localStorage.setItem(MIGRATED_KEY, id) } catch { /* blocked storage */ }
      writeCache(id, JSON.stringify({ ...legacy, ...data }))
      saveMeta(id, { edited: Date.now(), thumb: makeThumb(data.elements, data.bg) })
    }, () => { /* offline or too large: it stays in this browser and is tried again next time */ })
  }, [])

  useEffect(() => { if (sync.id) pruneCaches(sync.id) }, [sync.id])
  // A dead link doesn't belong in the drawings list.
  useEffect(() => { if (sync.status === 'missing') { forgetWorkspace(APP, sync.id); if (!loaded) forgetMeta(sync.id) } }, [sync.status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = cloud && S.name ? `${S.name} · SketchLift` : 'SketchLift · Lift Apps' })

  const newDrawing = async () => {
    const blank = blankDrawing(DEFAULT_BG)
    const id = await createWorkspace(APP, PREFIX, blank, '')
    writeCache(id, JSON.stringify({ ...blank, zoom: 1, scrollX: 0, scrollY: 0 }))
    saveMeta(id, { edited: Date.now() })
    openWorkspace(id)
  }
  const failed = () => setDialog({ type: 'error', message: t.createFail })
  const saveAsNew = () => {
    const data = { elements: S.elements, bg: S.bg, name: S.name }
    createWorkspace(APP, PREFIX, data, S.name).then(id => {
      writeCache(id, JSON.stringify({ ...data, zoom: S.zoom, scrollX: S.scrollX, scrollY: S.scrollY }))
      saveMeta(id, { edited: Date.now(), thumb: makeThumb(S.elements, S.bg) })
      openWorkspace(id)
    }, failed)
  }
  const openDrawings = () => {
    setMenuOpen(false)
    setDialog({ type: 'drawings', thumb: loaded && sync.id ? makeThumb(S.elements, S.bg) : metaOf(sync.id).thumb })
  }

  // ---------- scene helpers ----------
  const snapshot = () => { S.past.push(S.elements); if (S.past.length > 100) S.past.shift(); S.future = [] }
  const setElements = els => { S.elements = els }
  const selected = () => S.elements.filter(e => S.selectedIds.has(e.id))
  const toWorld = (cx, cy) => ({ x: cx / S.zoom - S.scrollX, y: cy / S.zoom - S.scrollY })
  // Pointer position relative to the canvas (the family bar sits above it).
  const local = e => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const worldOf = e => { const p = local(e); return toWorld(p.x, p.y) }
  const select = ids => { S.selectedIds = new Set(ids) }

  const undo = () => { if (!S.past.length) return; S.future.push(S.elements); S.elements = S.past.pop(); pruneSelection(); force() }
  const redo = () => { if (!S.future.length) return; S.past.push(S.elements); S.elements = S.future.pop(); pruneSelection(); force() }
  const pruneSelection = () => { const ids = new Set(S.elements.map(e => e.id)); select([...S.selectedIds].filter(id => ids.has(id))) }

  const setTool = tool => {
    S.tool = tool
    if (tool !== 'selection' && tool !== 'hand') select([])
    finishEditing()
    force()
  }

  const zoomTo = (z, cx = size.w / 2, cy = size.h / 2) => {
    const nz = Math.min(30, Math.max(0.1, z))
    const w = toWorld(cx, cy)
    S.scrollX = cx / nz - w.x; S.scrollY = cy / nz - w.y; S.zoom = nz
    force()
  }
  const zoomToFit = (els = S.elements, max = 2) => {
    const b = commonBounds(els)
    if (!b) return
    const z = Math.min(max, Math.max(0.1, Math.min((size.w - 160) / (b.x2 - b.x1 || 1), (size.h - 200) / (b.y2 - b.y1 || 1))))
    S.zoom = z
    S.scrollX = size.w / 2 / z - (b.x1 + b.x2) / 2
    S.scrollY = size.h / 2 / z - (b.y1 + b.y2) / 2
    force()
  }

  const deleteSelected = () => {
    if (!S.selectedIds.size) return
    snapshot()
    setElements(S.elements.filter(e => !S.selectedIds.has(e.id)))
    select([]); force()
  }
  const cloneEls = (els, dx, dy) => els.map(e => ({ ...e, id: uid(), seed: newSeed(), x: e.x + dx, y: e.y + dy, points: e.points?.map(p => [...p]) }))
  const duplicate = () => {
    const sel = selected()
    if (!sel.length) return
    snapshot()
    const copies = cloneEls(sel, 10, 10)
    setElements([...S.elements, ...copies]); select(copies.map(c => c.id)); force()
  }
  const copy = () => { const sel = selected(); if (sel.length) S.clipboard = JSON.parse(JSON.stringify(sel)) }
  const paste = () => {
    if (!S.clipboard?.length) return
    snapshot()
    const b = commonBounds(S.clipboard)
    const p = S.pointer
    const copies = cloneEls(S.clipboard, p.x - (b.x1 + b.x2) / 2, p.y - (b.y1 + b.y2) / 2)
    setElements([...S.elements, ...copies]); select(copies.map(c => c.id)); force()
  }
  const reorder = dir => {
    const sel = S.selectedIds
    if (!sel.size) return
    snapshot()
    let els = [...S.elements]
    if (dir === 'front') els = [...els.filter(e => !sel.has(e.id)), ...els.filter(e => sel.has(e.id))]
    else if (dir === 'back') els = [...els.filter(e => sel.has(e.id)), ...els.filter(e => !sel.has(e.id))]
    else if (dir === 'forward') { for (let i = els.length - 2; i >= 0; i--) if (sel.has(els[i].id) && !sel.has(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]] }
    else { for (let i = 1; i < els.length; i++) if (sel.has(els[i].id) && !sel.has(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]] }
    setElements(els); force()
  }
  const setProp = (key, value) => {
    S.style[key] = value
    if (S.selectedIds.size) {
      snapshot()
      setElements(S.elements.map(e => {
        if (!S.selectedIds.has(e.id)) return e
        const next = { ...e, [key]: value }
        if (key === 'fontSize' && e.type === 'text') Object.assign(next, measureText(e.text, value))
        return next
      }))
    }
    force()
  }

  // ---------- text editing ----------
  // New text elements already have a snapshot taken before they were added.
  const startEditing = (id, field, isNew = false) => {
    if (!isNew) snapshot()
    S.editing = { id, field, isNew }
    select([id])
    force()
  }
  const finishEditing = () => {
    const ed = S.editing
    if (!ed) return
    S.editing = null
    const el = S.elements.find(e => e.id === ed.id)
    const emptyText = el && ed.field === 'text' && !el.text.trim()
    if (emptyText) { setElements(S.elements.filter(e => e.id !== ed.id)); select([]) }
    // Drop the history entry when nothing actually changed.
    if ((ed.isNew && emptyText) || (!ed.isNew && S.past.length && S.past[S.past.length - 1] === S.elements)) S.past.pop()
    if (!S.locked && S.tool === 'text') S.tool = 'selection'
    force()
  }
  const updateEditingText = value => {
    const ed = S.editing
    setElements(S.elements.map(e => {
      if (e.id !== ed.id) return e
      if (ed.field === 'label') return { ...e, label: value }
      return { ...e, text: value, ...measureText(value, e.fontSize) }
    }))
    force()
  }

  // ---------- pointer ----------
  const topHit = (x, y) => {
    const tol = 8 / S.zoom
    for (let i = S.elements.length - 1; i >= 0; i--) if (hitTest(S.elements[i], x, y, tol)) return S.elements[i]
    return null
  }
  const handleAt = (x, y) => {
    const sel = selected()
    if (!sel.length || S.tool !== 'selection') return null
    const cb = commonBounds(sel)
    const pad = 4 / S.zoom
    return handleRects(cb, S.zoom).find(h => x >= h.x - pad && x <= h.x + h.s + pad && y >= h.y - pad && y <= h.y + h.s + pad)?.k ?? null
  }

  const onPointerDown = e => {
    if (S.editing) { finishEditing(); if (S.tool === 'text') return }
    setMenuOpen(false)
    // Keep focus where it is: the browser's default mousedown focus change would blur a text editor opened by this press.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const w = worldOf(e)
    if (e.button === 1 || S.tool === 'hand' || S.spaceDown) {
      S.interaction = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: S.scrollX, oy: S.scrollY }
      setCursor('grabbing')
      return
    }
    if (S.tool === 'selection') {
      const handle = handleAt(w.x, w.y)
      if (handle) {
        snapshot()
        const sel = selected()
        S.interaction = { type: 'resize', handle, from: commonBounds(sel), origs: sel.map(el => ({ ...el })), start: w }
        return
      }
      const hit = topHit(w.x, w.y)
      if (hit) {
        if (e.shiftKey) {
          const ids = new Set(S.selectedIds)
          if (ids.has(hit.id)) { ids.delete(hit.id); S.selectedIds = ids; force(); return }
          ids.add(hit.id); S.selectedIds = ids
        } else if (!S.selectedIds.has(hit.id)) select([hit.id])
        S.interaction = { type: 'move', start: w, origs: selected().map(el => ({ ...el })), moved: false, dup: e.altKey }
      } else {
        if (!e.shiftKey) select([])
        S.interaction = { type: 'marquee', base: e.shiftKey ? new Set(S.selectedIds) : new Set() }
        S.marquee = { x1: w.x, y1: w.y, x2: w.x, y2: w.y }
      }
      force()
      return
    }
    if (S.tool === 'eraser') {
      S.erasing = new Set()
      const hit = topHit(w.x, w.y)
      if (hit) S.erasing.add(hit.id)
      S.interaction = { type: 'erase' }
      force()
      return
    }
    if (S.tool === 'text') {
      const hit = topHit(w.x, w.y)
      if (hit && (hit.type === 'text' || isContainer(hit))) { startEditing(hit.id, hit.type === 'text' ? 'text' : 'label'); return }
      snapshot()
      const el = { ...createElement('text', w.x, w.y - S.style.fontSize * 0.6, S.style), ...measureText('', S.style.fontSize) }
      setElements([...S.elements, el])
      startEditing(el.id, 'text', true)
      return
    }
    snapshot()
    const el = createElement(S.tool, w.x, w.y, S.style)
    setElements([...S.elements, el])
    S.interaction = { type: 'create', id: el.id, start: w }
    force()
  }

  const onPointerMove = e => {
    const w = worldOf(e)
    S.pointer = w
    const it = S.interaction
    if (!it) {
      if (S.tool === 'hand' || S.spaceDown) setCursor('grab')
      else if (S.tool === 'selection') {
        const h = handleAt(w.x, w.y)
        setCursor(h ? CURSORS[h] : topHit(w.x, w.y) ? 'move' : 'default')
      } else if (S.tool === 'eraser') setCursor('cell')
      else if (S.tool === 'text') setCursor('text')
      else setCursor('crosshair')
      return
    }
    if (it.type === 'pan') {
      S.scrollX = it.ox + (e.clientX - it.sx) / S.zoom
      S.scrollY = it.oy + (e.clientY - it.sy) / S.zoom
    } else if (it.type === 'move') {
      const dx = w.x - it.start.x, dy = w.y - it.start.y
      if (!it.moved && Math.hypot(dx, dy) * S.zoom < 2) return
      if (!it.moved) {
        snapshot()
        it.moved = true
        // Alt-drag leaves a copy behind.
        if (it.dup) setElements([...S.elements, ...it.origs.map(o => ({ ...o, id: uid(), seed: newSeed() }))])
      }
      const map = new Map(it.origs.map(o => [o.id, o]))
      setElements(S.elements.map(el => map.has(el.id) ? { ...el, x: map.get(el.id).x + dx, y: map.get(el.id).y + dy } : el))
    } else if (it.type === 'resize') {
      const f = it.from
      const dx = w.x - it.start.x, dy = w.y - it.start.y
      const to = { ...f }
      if (it.handle.includes('w')) to.x1 = f.x1 + dx
      if (it.handle.includes('e')) to.x2 = f.x2 + dx
      if (it.handle.includes('n')) to.y1 = f.y1 + dy
      if (it.handle.includes('s')) to.y2 = f.y2 + dy
      if (e.shiftKey && it.handle.length === 2) {
        const ratio = (f.x2 - f.x1) / ((f.y2 - f.y1) || 1)
        const nw = to.x2 - to.x1, nh = to.y2 - to.y1
        if (Math.abs(nw / ratio) > Math.abs(nh)) { const h2 = nw / ratio; if (it.handle.includes('n')) to.y1 = to.y2 - h2; else to.y2 = to.y1 + h2 }
        else { const w2 = nh * ratio; if (it.handle.includes('w')) to.x1 = to.x2 - w2; else to.x2 = to.x1 + w2 }
      }
      const map = new Map(it.origs.map(o => [o.id, scaleElement(o, f, to)]))
      setElements(S.elements.map(el => map.get(el.id) ?? el))
    } else if (it.type === 'marquee') {
      S.marquee = { ...S.marquee, x2: w.x, y2: w.y }
      const m = { x1: Math.min(S.marquee.x1, w.x), y1: Math.min(S.marquee.y1, w.y), x2: Math.max(S.marquee.x1, w.x), y2: Math.max(S.marquee.y1, w.y) }
      const inside = S.elements.filter(el => { const b = bounds(el); return b.x1 >= m.x1 && b.x2 <= m.x2 && b.y1 >= m.y1 && b.y2 <= m.y2 }).map(el => el.id)
      select([...it.base, ...inside])
    } else if (it.type === 'erase') {
      const hit = topHit(w.x, w.y)
      if (hit) S.erasing.add(hit.id)
    } else if (it.type === 'create') {
      const el = S.elements.find(x => x.id === it.id)
      if (!el) { S.interaction = null; return force() }
      let dx = w.x - it.start.x, dy = w.y - it.start.y
      let next
      if (el.type === 'freedraw') {
        // Points closer than a screen pixel add nothing visible, only size.
        const last = el.points[el.points.length - 1]
        if (Math.hypot(w.x - el.x - last[0], w.y - el.y - last[1]) * S.zoom < 1) return
        next = { ...el, points: [...el.points, [w.x - el.x, w.y - el.y]] }
      }
      else if (isLinear(el)) {
        if (e.shiftKey) {
          const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12), len = Math.hypot(dx, dy)
          dx = Math.cos(a) * len; dy = Math.sin(a) * len
        }
        next = { ...el, points: [[0, 0], [dx, dy]] }
      } else {
        if (e.shiftKey) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * s; dy = Math.sign(dy || 1) * s }
        next = { ...el, w: dx, h: dy }
      }
      setElements(S.elements.map(x => x.id === it.id ? next : x))
    }
    force()
  }

  const onPointerUp = () => {
    const it = S.interaction
    S.interaction = null
    if (!it) return
    if (it.type === 'pan') setCursor(S.tool === 'hand' || S.spaceDown ? 'grab' : 'default')
    else if (it.type === 'marquee') S.marquee = null
    else if (it.type === 'resize') setElements(S.elements.map(el => S.selectedIds.has(el.id) ? tidy(normalize(el)) : el))
    else if (it.type === 'move' && it.moved) setElements(S.elements.map(el => S.selectedIds.has(el.id) ? tidy(el) : el))
    else if (it.type === 'erase') {
      if (S.erasing.size) { snapshot(); setElements(S.elements.filter(el => !S.erasing.has(el.id))) }
      S.erasing = null
    } else if (it.type === 'create' && S.elements.some(x => x.id === it.id)) {
      const el = tidy(normalize(S.elements.find(x => x.id === it.id)))
      const b = bounds(el)
      const tiny = el.type === 'freedraw' ? false : (b.x2 - b.x1) < 3 && (b.y2 - b.y1) < 3
      if (tiny) { setElements(S.elements.filter(x => x.id !== it.id)); S.past.pop() }
      else {
        // A very long stroke is split so each piece fits in one synced change.
        const parts = fitForSync(el)
        setElements(S.elements.flatMap(x => x.id === it.id ? parts : x))
        if (el.type !== 'freedraw') select([el.id])
        if (!S.locked && el.type !== 'freedraw') S.tool = 'selection'
      }
    }
    force()
  }

  const onDoubleClick = e => {
    if (S.tool !== 'selection' && S.tool !== 'text') return
    const w = worldOf(e)
    const hit = topHit(w.x, w.y)
    if (hit?.type === 'text') return startEditing(hit.id, 'text')
    if (hit && isContainer(hit)) return startEditing(hit.id, 'label')
    if (hit) return
    snapshot()
    const el = { ...createElement('text', w.x, w.y - S.style.fontSize * 0.6, S.style), ...measureText('', S.style.fontSize) }
    setElements([...S.elements, el])
    startEditing(el.id, 'text', true)
  }

  const onWheel = e => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) { const p = local(e); zoomTo(S.zoom * Math.exp(-e.deltaY * 0.01), p.x, p.y) }
    else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
      S.scrollX -= dx / S.zoom; S.scrollY -= dy / S.zoom
      force()
    }
  }

  // ---------- files ----------
  const saveFile = () => {
    const data = { type: 'sketchlift', version: 1, source: 'https://liftapps.com.au/sketch/', elements: S.elements, appState: { viewBackgroundColor: S.bg } }
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `sketch-${stamp()}.json`)
  }
  const openFile = async file => {
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.elements)) throw new Error('No elements')
      snapshot()
      setElements(uniqueIds(data.elements.filter(e => !e.isDeleted).map(e => ({
        ...DEFAULT_STYLE, ...e, w: e.w ?? e.width ?? 0, h: e.h ?? e.height ?? 0, seed: e.seed ?? newSeed(),
        roundness: typeof e.roundness === 'string' ? e.roundness : e.roundness ? 'round' : 'sharp',
        label: e.label ?? '', text: e.text ?? '', fontSize: e.fontSize ?? 20,
      }))).map(tidy).flatMap(fitForSync))
      if (data.appState?.viewBackgroundColor) S.bg = data.appState.viewBackgroundColor
      select([])
      zoomToFit()
    } catch (err) {
      setDialog({ type: 'error', message: t.openFail + err.message })
    }
  }
  const resetCanvas = () => { snapshot(); setElements([]); select([]); setMenuOpen(false); force() }

  // ---------- keyboard ----------
  useEffect(() => {
    const down = e => {
      if (blocked) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (e.key === ' ' && !S.spaceDown) { S.spaceDown = true; setCursor('grab'); e.preventDefault(); return }
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo() }
      if (mod && k === 'y') { e.preventDefault(); return redo() }
      if (mod && k === 'd') { e.preventDefault(); return duplicate() }
      if (mod && k === 'c') return copy()
      if (mod && k === 'x') { copy(); return deleteSelected() }
      if (mod && k === 'v') return paste()
      if (mod && k === 'a') { e.preventDefault(); select(S.elements.map(el => el.id)); S.tool = 'selection'; return force() }
      if (mod && k === 's') { e.preventDefault(); return saveFile() }
      if (mod && k === 'o') { e.preventDefault(); return fileRef.current?.click() }
      if (mod && e.shiftKey && k === 'e') { e.preventDefault(); return setDialog({ type: 'export' }) }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); return zoomTo(S.zoom * 1.1) }
      if (mod && e.key === '-') { e.preventDefault(); return zoomTo(S.zoom / 1.1) }
      if (mod && e.key === '0') { e.preventDefault(); return zoomTo(1) }
      if (mod && e.code === 'BracketRight') { e.preventDefault(); return reorder(e.altKey ? 'front' : 'forward') }
      if (mod && e.code === 'BracketLeft') { e.preventDefault(); return reorder(e.altKey ? 'back' : 'backward') }
      if (e.shiftKey && e.code === 'Digit1') return zoomToFit()
      if (e.shiftKey && e.code === 'Digit2') return zoomToFit(selected().length ? selected() : S.elements)
      if (e.key === '?') return setDialog({ type: 'help' })
      if (e.key === 'Escape') { setDialog(null); setMenuOpen(false); select([]); if (!S.locked) S.tool = 'selection'; return force() }
      if (e.key === 'Delete' || e.key === 'Backspace') return deleteSelected()
      if (e.key === 'Enter') {
        const sel = selected()
        if (sel.length === 1 && (sel[0].type === 'text' || isContainer(sel[0]))) { e.preventDefault(); return startEditing(sel[0].id, sel[0].type === 'text' ? 'text' : 'label') }
      }
      if (e.key.startsWith('Arrow') && S.selectedIds.size) {
        e.preventDefault()
        const step = e.shiftKey ? 5 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        snapshot()
        setElements(S.elements.map(el => S.selectedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el))
        return force()
      }
      if (mod || e.altKey) return
      if (k === 'q') { S.locked = !S.locked; return force() }
      if (KEY_TO_TOOL[k] && !e.shiftKey) setTool(KEY_TO_TOOL[k])
    }
    const up = e => { if (e.key === ' ') { S.spaceDown = false; setCursor('default') } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })
  useEffect(() => {
    const el = appRef.current
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel listener so ctrl+wheel can be prevented from zooming the page.
  useEffect(() => {
    const c = canvasRef.current
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  })

  // ---------- render + persist ----------
  // Redraw only when something drawn changed (sync status updates and cursor changes re-render the UI too).
  const drawn = useRef(null)
  useLayoutEffect(() => {
    const c = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const key = [S.elements, size.w, size.h, S.zoom, S.scrollX, S.scrollY, S.bg, S.editing ? null : S.selectedIds, S.marquee, S.editing?.id, S.erasing, S.erasing?.size, dpr]
    if (drawn.current && key.every((v, i) => v === drawn.current[i])) return
    drawn.current = key
    if (c.width !== size.w * dpr || c.height !== size.h * dpr) { c.width = size.w * dpr; c.height = size.h * dpr }
    renderScene(c.getContext('2d'), {
      elements: S.elements, width: size.w, height: size.h, zoom: S.zoom, scrollX: S.scrollX, scrollY: S.scrollY,
      bg: S.bg, selectedIds: S.editing ? new Set() : S.selectedIds, marquee: S.marquee, editingId: S.editing?.id, erasing: S.erasing, dpr,
    })
  })
  // This browser's copy: the drawing with its own zoom/scroll (cloud), or the single local scene (no cloud,
  // or the first visit while that scene is being uploaded).
  const persisted = useRef(null)
  const persist = useRef(null)
  persist.current = () => {
    if (!loaded || S.interaction) return
    const v = [S.elements, S.bg, S.name, S.zoom, S.scrollX, S.scrollY, sync.id]
    if (persisted.current && v.every((x, i) => x === persisted.current[i])) return
    persisted.current = v
    const json = JSON.stringify({ elements: S.elements, bg: S.bg, name: S.name, zoom: S.zoom, scrollX: S.scrollX, scrollY: S.scrollY })
    if (sync.id) writeCache(sync.id, json)
    else try { localStorage.setItem(LEGACY_KEY, json) } catch { /* storage full or blocked */ }
    const big = cloud && json.length > 850000
    if (big !== tooBig) setTooBig(big)
  }
  useEffect(() => {
    const t = setTimeout(() => persist.current(), 300)
    return () => clearTimeout(t)
  })
  // Thumbnail and "last edited" for the drawings list.
  const thumbFor = useRef(null)
  thumbFor.current = () => {
    if (!sync.id || !loaded) return
    const edited = S.editedAt ?? metaOf(sync.id).edited ?? Date.now()
    saveMeta(sync.id, { thumb: makeThumb(S.elements, S.bg), edited })
  }
  useEffect(() => {
    const t = setTimeout(() => thumbFor.current(), 1500)
    return () => clearTimeout(t)
  }, [sharedRef.current, sync.id, loaded]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const out = () => { persist.current(); thumbFor.current() }
    window.addEventListener('pagehide', out)
    return () => window.removeEventListener('pagehide', out)
  }, [])

  // ---------- derived UI state ----------
  const sel = selected()
  const showProps = (sel.length > 0 || DRAW_TOOLS.includes(S.tool)) && !S.editing
  const first = sel[0]
  const val = key => first?.[key] ?? S.style[key]
  const types = new Set(sel.length ? sel.map(e => e.type) : [S.tool])
  const hasBg = sel.length ? sel.some(e => isContainer(e)) : ['rectangle', 'diamond', 'ellipse'].includes(S.tool)
  const hasStrokeOpts = sel.length ? sel.some(e => e.type !== 'text') : S.tool !== 'text'
  const hasText = types.has('text') || (sel.some(e => isContainer(e) && e.label))
  const hasEdges = [...types].some(t => ['rectangle', 'diamond', 'line', 'arrow'].includes(t))
  const editingEl = S.editing && S.elements.find(e => e.id === S.editing.id)
  const empty = S.elements.length === 0

  return (
    <div ref={appRef} className="app" style={{ '--canvas-bg': S.bg }}>
      <canvas ref={canvasRef} className="scene" style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}
        onContextMenu={e => e.preventDefault()} aria-label={t.canvas} />

      {editingEl && <TextEditor el={editingEl} field={S.editing.field} S={S} onChange={updateEditingText} onDone={finishEditing} />}

      {/* top-left menu */}
      <div className="island top-left">
        <button className={`ui-btn ${menuOpen ? 'on' : ''}`} aria-label={t.menu} title={t.menu} aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><Icon name="menu" /></button>
        {cloud && (
          <button className="title-btn" aria-label={`${S.name || t.untitled} — ${t.drawingsBtn}`} title={t.drawingsBtn} onClick={openDrawings}>
            <Icon name="drawings" size={16} /><span>{S.name || t.untitled}</span><Icon name="chevron" size={14} />
          </button>
        )}
        {menuOpen && (
          <div className="menu" role="menu">
            {cloud && <>
              <MenuItem icon="drawings" label={t.drawings} onClick={openDrawings} />
              <MenuItem icon="plus" label={t.newDrawing} onClick={() => { setMenuOpen(false); newDrawing().catch(failed) }} />
              <hr />
            </>}
            <MenuItem icon="open" label={t.open} kbd={`${MOD}+O`} onClick={() => { setMenuOpen(false); fileRef.current?.click() }} />
            <MenuItem icon="save" label={t.save} kbd={`${MOD}+S`} onClick={() => { setMenuOpen(false); saveFile() }} />
            <MenuItem icon="image" label={t.exportImg} kbd={`${MOD}+Shift+E`} onClick={() => { setMenuOpen(false); setDialog({ type: 'export' }) }} />
            <MenuItem icon="help" label={t.help} kbd="?" onClick={() => { setMenuOpen(false); setDialog({ type: 'help' }) }} />
            <MenuItem icon="trash" label={t.reset} onClick={() => { setMenuOpen(false); setDialog({ type: 'reset' }) }} />
            <hr />
            <div className="menu-label">{t.canvasBg}</div>
            <div className="swatches">
              {CANVAS_BGS.map(c => <button key={c} className={`swatch ${S.bg === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} title={c} onClick={() => { S.bg = c; force() }} />)}
              <label className="swatch current" style={{ background: S.bg }} title={t.customColor}>
                <input type="color" aria-label={t.customColor} value={S.bg} onChange={e => { S.bg = e.target.value; force() }} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="island toolbar" role="toolbar" aria-label={t.gTools}>
        <button className={`tool ${S.locked ? 'on' : ''}`} aria-label={t.keepTool} title={`${t.keepTool} — Q`} aria-pressed={S.locked}
          onClick={() => { S.locked = !S.locked; force() }}><Icon name={S.locked ? 'lock' : 'unlock'} /></button>
        <span className="tool-sep" />
        {TOOLS.map(tool => (
          <button key={tool.id} className={`tool ${S.tool === tool.id ? 'on' : ''}`} aria-label={t.tools[tool.id]} aria-pressed={S.tool === tool.id}
            title={`${t.tools[tool.id]} — ${tool.alt ? `${tool.alt} ${t.or} ` : ''}${tool.key}`} onClick={() => setTool(tool.id)}>
            <Icon name={tool.id} />
            <span className="tool-key">{tool.key === 'H' ? '' : tool.key}</span>
          </button>
        ))}
      </div>

      {/* properties panel */}
      {showProps && (
        <div className={`island props ${sel.length ? '' : 'tool-only'}`} role="region" aria-label={t.props}>
          {hasStrokeOpts || hasText ? (
            <Section title={t.stroke}>
              <ColorRow colors={STROKE_COLORS} value={val('strokeColor')} onPick={c => setProp('strokeColor', c)} label={t.stroke} custom={t.customColor} />
            </Section>
          ) : null}
          {hasBg && (
            <Section title={t.background}>
              <ColorRow colors={BG_COLORS} value={val('backgroundColor')} onPick={c => setProp('backgroundColor', c)} label={t.background} custom={t.customColor} />
            </Section>
          )}
          {hasBg && val('backgroundColor') !== 'transparent' && (
            <Section title={t.fill}>
              <Radio value={val('fillStyle')} onPick={v => setProp('fillStyle', v)} options={[['hachure', t.hachure], ['cross-hatch', t.cross], ['solid', t.solid]].map(([v, l]) => ({ v, l, g: <Glyph kind="fill" value={v} /> }))} />
            </Section>
          )}
          {hasStrokeOpts && (
            <>
              <Section title={t.strokeWidth}>
                <Radio value={val('strokeWidth')} onPick={v => setProp('strokeWidth', v)} options={[[1, t.thin], [2, t.bold], [4, t.xbold]].map(([v, l]) => ({ v, l, g: <Glyph kind="width" value={v} /> }))} />
              </Section>
              <Section title={t.strokeStyle}>
                <Radio value={val('strokeStyle')} onPick={v => setProp('strokeStyle', v)} options={[['solid', t.solid], ['dashed', t.dashed], ['dotted', t.dotted]].map(([v, l]) => ({ v, l, g: <Glyph kind="style" value={v} /> }))} />
              </Section>
              <Section title={t.sloppiness}>
                <Radio value={val('roughness')} onPick={v => setProp('roughness', v)} options={[[0, t.neat], [1, t.sketchy], [2, t.loose]].map(([v, l]) => ({ v, l, g: <Glyph kind="rough" value={v} /> }))} />
              </Section>
            </>
          )}
          {hasEdges && (
            <Section title={t.edges}>
              <Radio value={val('roundness')} onPick={v => setProp('roundness', v)} options={[['sharp', t.sharp], ['round', t.round]].map(([v, l]) => ({ v, l, g: <Glyph kind="edges" value={v} /> }))} />
            </Section>
          )}
          {(hasText || S.tool === 'text') && (
            <Section title={t.fontSize}>
              <Radio value={val('fontSize')} onPick={v => setProp('fontSize', v)} options={Object.entries(FONT_SIZES).map(([l, v]) => ({ v, l: t.fs[l], g: <b className="fs">{l}</b> }))} />
            </Section>
          )}
          <Section title={t.opacity}>
            <input type="range" min="0" max="100" step="10" value={val('opacity')} aria-label={t.opacity}
              onChange={e => setProp('opacity', +e.target.value)} className="opacity" />
            <div className="range-labels"><span>0</span><span>{val('opacity')}</span><span>100</span></div>
          </Section>
          {sel.length > 0 && (
            <>
              <Section title={t.layers}>
                <div className="btn-row">
                  <button className="prop-btn" title={`${t.toBack} — ${MOD}+Alt+[`} aria-label={t.toBack} onClick={() => reorder('back')}><Icon name="back" size={16} /></button>
                  <button className="prop-btn" title={`${t.backward} — ${MOD}+[`} aria-label={t.backward} onClick={() => reorder('backward')}><Icon name="backward" size={16} /></button>
                  <button className="prop-btn" title={`${t.forward} — ${MOD}+]`} aria-label={t.forward} onClick={() => reorder('forward')}><Icon name="forward" size={16} /></button>
                  <button className="prop-btn" title={`${t.toFront} — ${MOD}+Alt+]`} aria-label={t.toFront} onClick={() => reorder('front')}><Icon name="front" size={16} /></button>
                </div>
              </Section>
              <Section title={t.actions}>
                <div className="btn-row">
                  <button className="prop-btn" title={`${t.duplicate} — ${MOD}+D`} aria-label={t.duplicate} onClick={duplicate}><Icon name="duplicate" size={16} /></button>
                  <button className="prop-btn" title={`${t.del} — Delete`} aria-label={t.del} onClick={deleteSelected}><Icon name="trash" size={16} /></button>
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* welcome screen */}
      {empty && S.tool === 'selection' && !S.editing && !blocked && (
        <div className="welcome">
          <div className="hint hint-menu"><svg width="40" height="50" viewBox="0 0 40 50"><path d="M30 46C10 42 6 24 10 6M4 14l6-9 6 8" /></svg><span>{t.hintMenu}</span></div>
          <div className="hint hint-tools"><span>{t.hintTools}</span><svg width="50" height="60" viewBox="0 0 50 60"><path d="M6 54c26 2 38-18 34-48M32 14l8-9 6 10" /></svg></div>
          <div className="hint hint-help"><span>{t.hintHelp}</span><svg width="44" height="50" viewBox="0 0 44 50"><path d="M4 8c22-6 34 10 30 36M27 37l7 8 6-9" /></svg></div>
          <div className="welcome-center">
            <div className="welcome-logo">Sketch<i>Lift</i></div>
            <p className="welcome-line">{t.welcomeLine}</p>
            <p className="welcome-note">{cloud ? t.welcomeCloud : t.welcomeNote}</p>
            <div className="welcome-items">
              <button onClick={() => fileRef.current?.click()}><Icon name="open" size={16} /> {t.open} <kbd>{MOD}+O</kbd></button>
              <button onClick={() => setDialog({ type: 'help' })}><Icon name="help" size={16} /> {t.help} <kbd>?</kbd></button>
              <button onClick={() => { snapshot(); S.elements = demoScene(t.sample); force() }}><Icon name="image" size={16} /> {t.loadSample}</button>
            </div>
          </div>
        </div>
      )}

      {/* bottom-left: zoom + undo */}
      <div className="bottom-left" role="region" aria-label={t.canvasActions}>
        <div className="island group">
          <button className="ui-btn" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoomTo(S.zoom / 1.1)}><Icon name="minus" /></button>
          <button className="ui-btn zoom-val" aria-label={t.resetZoom} title={t.resetZoom} onClick={() => zoomTo(1)}>{Math.round(S.zoom * 100)}%</button>
          <button className="ui-btn" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoomTo(S.zoom * 1.1)}><Icon name="plus" /></button>
        </div>
        <div className="island group">
          <button className="ui-btn" aria-label={t.undo} title={`${t.undo} — ${MOD}+Z`} disabled={!S.past.length} onClick={undo}><Icon name="undo" /></button>
          <button className="ui-btn" aria-label={t.redo} title={`${t.redo} — ${MOD}+Shift+Z`} disabled={!S.future.length} onClick={redo}><Icon name="redo" /></button>
        </div>
      </div>
      <button className="island ui-btn help-btn" aria-label={t.help} title={t.help} onClick={() => setDialog({ type: 'help' })}><Icon name="help" /></button>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = '' }} />

      <div className="top-right">
        <CloudMenu sync={sync} app={APP} lang={lang} words={CLOUD_WORDS} onNew={cloud ? () => newDrawing().catch(failed) : null} />
      </div>
      {cloud && (tooBig || sync.error === 'too large') && <div className="island size-warn" role="status">{t.tooBig}</div>}
      {blocked && <DrawingGate t={t} status={sync.status} onDrawings={openDrawings} onSaveAsNew={loaded && S.elements.length ? saveAsNew : null} onNew={() => newDrawing().catch(failed)} />}

      {dialog?.type === 'drawings' && (
        <DrawingsPanel t={t} lang={lang} currentId={sync.id} currentName={S.name} currentThumb={dialog.thumb}
          currentData={() => ({ elements: S.elements, bg: S.bg })} onRenameCurrent={name => { S.name = name; force() }}
          onNew={newDrawing} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'help' && <HelpDialog t={t} onClose={() => setDialog(null)} />}
      {dialog?.type === 'export' && <ExportDialog t={t} all={S.elements} selection={sel} bg={S.bg} onClose={() => setDialog(null)} />}
      {dialog?.type === 'reset' && (
        <Modal t={t} title={t.resetTitle} onClose={() => setDialog(null)} small>
          <p>{t.resetBody}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDialog(null)}>{t.cancel}</button>
            <button className="btn danger" onClick={() => { resetCanvas(); setDialog(null) }}>{t.confirm}</button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'error' && <Modal t={t} title={t.error} small onClose={() => setDialog(null)}><p>{dialog.message}</p></Modal>}
    </div>
  )
}

function TextEditor({ el, field, S, onChange, onDone }) {
  const ref = useRef(null)
  useEffect(() => { const t = ref.current; t.focus(); t.setSelectionRange(t.value.length, t.value.length) }, [])
  const z = S.zoom
  const value = field === 'label' ? el.label : el.text
  const fs = (el.fontSize ?? 20) * z
  let style
  if (field === 'label') {
    const b = bounds(el)
    const lines = Math.max(1, value.split('\n').length)
    const h = lines * fs * LINE_HEIGHT
    const w = Math.max(40, (b.x2 - b.x1 - 20) * z)
    style = { left: ((b.x1 + b.x2) / 2 + S.scrollX) * z - w / 2, top: ((b.y1 + b.y2) / 2 + S.scrollY) * z - h / 2, width: w, height: h, textAlign: 'center' }
  } else {
    style = { left: (el.x + S.scrollX) * z, top: (el.y + S.scrollY) * z + fs * 0.1, width: Math.max(el.w * z, 20) + fs, height: Math.max(el.h * z, fs * LINE_HEIGHT), textAlign: 'left' }
  }
  return (
    <textarea ref={ref} className="text-editor" value={value} spellCheck={false} maxLength={MAX_TEXT}
      style={{ ...style, fontSize: fs, lineHeight: LINE_HEIGHT, fontFamily: FONT, color: el.strokeColor, opacity: el.opacity / 100 }}
      onChange={e => onChange(e.target.value)} onBlur={onDone}
      onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); e.currentTarget.blur() } e.stopPropagation() }} />
  )
}

function MenuItem({ icon, label, kbd, onClick }) {
  return <button className="menu-item" role="menuitem" onClick={onClick}><Icon name={icon} size={16} /><span>{label}</span>{kbd && <kbd>{kbd}</kbd>}</button>
}

function Section({ title, children }) {
  return <fieldset className="section"><legend>{title}</legend>{children}</fieldset>
}

function ColorRow({ colors, value, onPick, label, custom }) {
  return (
    <div className="swatches">
      {colors.map(c => (
        <button key={c} className={`swatch ${value === c ? 'on' : ''} ${c === 'transparent' ? 'transparent' : ''}`} style={{ background: c === 'transparent' ? undefined : c }}
          aria-label={c} title={c} onClick={() => onPick(c)} />
      ))}
      <span className="swatch-sep" />
      <label className={`swatch current ${value === 'transparent' ? 'transparent' : ''}`} style={{ background: value === 'transparent' ? undefined : value }} title={custom}>
        <input type="color" aria-label={label} value={value === 'transparent' ? '#ffffff' : value} onChange={e => onPick(e.target.value)} />
      </label>
    </div>
  )
}

function Radio({ options, value, onPick }) {
  return (
    <div className="btn-row" role="radiogroup">
      {options.map(o => (
        <button key={String(o.v)} role="radio" aria-checked={value === o.v} aria-label={o.l} title={o.l}
          className={`prop-btn ${value === o.v ? 'on' : ''}`} onClick={() => onPick(o.v)}>{o.g}</button>
      ))}
    </div>
  )
}

function Modal({ t, title, children, onClose, small }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${small ? 'small' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="ui-btn" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  )
}

function shortcuts(t) {
  const T = t.tools, s = t.sc, o = t.or
  return {
    [t.gTools]: [[T.hand, 'H'], [T.selection, `V ${o} 1`], [T.rectangle, `R ${o} 2`], [T.diamond, `D ${o} 3`], [T.ellipse, `O ${o} 4`], [T.arrow, `A ${o} 5`], [T.line, `L ${o} 6`], [T.freedraw, `P ${o} 7`], [T.text, `T ${o} 8`], [T.eraser, `E ${o} 0`], [s.keep, 'Q']],
    [t.gView]: [[s.zin, `${MOD} +`], [s.zout, `${MOD} -`], [s.zreset, `${MOD} 0`], [s.fit, 'Shift 1'], [s.fitSel, 'Shift 2'], [s.pan, s.spaceDrag], [s.wheelZoom, `${MOD} Wheel`]],
    [t.gEditor]: [[s.del, 'Delete'], [s.cut, `${MOD} X`], [s.copy, `${MOD} C`], [s.paste, `${MOD} V`], [s.all, `${MOD} A`], [s.add, s.shiftClick], [s.dup, `${MOD} D`], [s.dragDup, s.altDrag], [s.edit, s.enter], [s.undo, `${MOD} Z`], [s.redo, `${MOD} Shift Z`], [s.fwd, `${MOD} ] / [`], [s.front, `${MOD} Alt ] / [`], [s.nudge, s.arrows], [s.constrain, s.shiftDrag], [s.save, `${MOD} S`], [s.open, `${MOD} O`], [s.exp, `${MOD} Shift E`]],
  }
}

function HelpDialog({ t, onClose }) {
  const words = new Set([t.or, '/'])
  return (
    <Modal t={t} title={t.help} onClose={onClose}>
      <h3 className="help-h">{t.shortcuts}</h3>
      <div className="help-cols">
        {Object.entries(shortcuts(t)).map(([group, rows]) => (
          <section key={group}>
            <h4>{group}</h4>
            <div className="shortcut-box">
              {rows.map(([label, keys]) => (
                <div key={label} className="shortcut"><span>{label}</span><span className="keys">{keys.split(' ').map((k, i) => words.has(k) ? <em key={i}>{k}</em> : <kbd key={i}>{k}</kbd>)}</span></div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}

function ExportDialog({ t, all, selection, bg, onClose }) {
  const [withBg, setWithBg] = useState(true)
  const [onlySel, setOnlySel] = useState(selection.length > 0)
  const [scale, setScale] = useState(2)
  const previewRef = useRef(null)
  const elements = onlySel && selection.length ? selection : all
  useEffect(() => {
    const box = previewRef.current
    box.innerHTML = ''
    if (!elements.length) return
    const c = exportCanvas(elements, withBg ? bg : null, scale)
    c.className = 'export-preview-canvas'
    box.appendChild(c)
  })
  const name = `sketch-${new Date().toISOString().slice(0, 10)}`
  return (
    <Modal t={t} title={t.exportTitle} onClose={onClose}>
      <div className="export">
        <div className={`export-preview ${withBg ? '' : 'checker'}`} ref={previewRef}>{!elements.length && <span className="muted">{t.nothing}</span>}</div>
        <div className="export-opts">
          <label className="check"><input type="checkbox" checked={withBg} onChange={e => setWithBg(e.target.checked)} /> {t.withBg}</label>
          {selection.length > 0 && <label className="check"><input type="checkbox" checked={onlySel} onChange={e => setOnlySel(e.target.checked)} /> {t.onlySel}</label>}
          <div className="menu-label">{t.scale}</div>
          <div className="seg">{[1, 2, 3].map(s => <button key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>{s}×</button>)}</div>
          <div className="export-btns">
            <button className="btn primary" disabled={!elements.length} onClick={() => exportCanvas(elements, withBg ? bg : null, scale).toBlob(b => b && download(b, `${name}.png`))}><Icon name="save" size={16} /> PNG</button>
            <button className="btn" disabled={!elements.length} onClick={() => download(new Blob([exportSvg(elements, withBg ? bg : null)], { type: 'image/svg+xml' }), `${name}.svg`)}><Icon name="save" size={16} /> SVG</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
