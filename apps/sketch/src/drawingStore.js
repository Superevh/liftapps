// SketchLift's product layer on top of shared/cloud: one cloud document per drawing ({ elements, bg, name }),
// plus what stays in this browser: a cache of each drawing with its own zoom/scroll (so drawings open
// instantly and offline), a thumbnail and "last edited" time for the drawings list.
import { backend, workspacesOf, createWorkspace } from '../../../shared/cloud/cloud.mjs'
import { apply } from '../../../shared/cloud/patch.mjs'
import { exportCanvas } from './render.js'
import { uid, isLinear, commonBounds } from './scene.js'

export const APP = 'sketch'
export const PREFIX = 'sk'
export const LEGACY_KEY = 'sketchlift-v1' // the single local scene from before cloud saving (kept as a backup)
export const MIGRATED_KEY = 'sketchlift-migrated'
// Same keys useCloudSync uses for "the drawing this browser had open" and the switcher list.
export const CURRENT_KEY = `lift-cloud-${APP}`
const LIST_KEY = `lift-cloud-${APP}-list`
const cacheKey = id => `sketchlift-d-${id}`
const metaKey = id => `sketchlift-t-${id}`
const KEEP_CACHES = 12

const get = key => { try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v) } catch { return null } }
const set = (key, value) => { try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true } catch { return false } }

export const blankDrawing = bg => ({ elements: [], bg, name: '' })

// ---------- per-browser cache of each drawing ----------
export const readCache = id => (id ? get(cacheKey(id)) : null)
export function writeCache(id, json) {
  if (set(cacheKey(id), json)) return
  // Storage is full: drop caches of drawings not opened recently, then try once more.
  pruneCaches(id, 3)
  set(cacheKey(id), json)
}
export function pruneCaches(keepId, keep = KEEP_CACHES) {
  const recent = new Set(workspacesOf(APP).slice(0, keep).map(w => w.id))
  recent.add(keepId)
  try {
    for (const key of Object.keys(localStorage)) {
      const m = /^sketchlift-[dt]-(.+)$/.exec(key)
      if (!m || recent.has(m[1])) continue
      // Thumbnails are small: keep them for everything still in the list.
      if (key.startsWith('sketchlift-t-') && workspacesOf(APP).some(w => w.id === m[1])) continue
      localStorage.removeItem(key)
    }
  } catch { /* storage blocked */ }
}
export function readLegacy() {
  const data = get(LEGACY_KEY)
  return data && Array.isArray(data.elements) ? data : null
}

// ---------- drawings list (per browser) ----------
export const metaOf = id => get(metaKey(id)) ?? {}
export const saveMeta = (id, meta) => set(metaKey(id), { ...metaOf(id), ...meta })
export function forgetMeta(id) {
  try { localStorage.removeItem(metaKey(id)); localStorage.removeItem(cacheKey(id)) } catch { /* storage blocked */ }
}
// Updates a drawing's name in the switcher list without changing its order.
export function renameInList(id, name) {
  const list = workspacesOf(APP)
  set(LIST_KEY, list.map(w => (w.id === id ? { ...w, name } : w)))
}

// A small JPEG of the drawing for its card in the list (~8 KB).
export function makeThumb(elements, bg) {
  const W = 288, H = 180
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  if (elements.length) {
    try {
      const b = commonBounds(elements)
      const scale = Math.min(W / (b.x2 - b.x1 + 48), H / (b.y2 - b.y1 + 48), 1.5)
      const img = exportCanvas(elements, null, scale)
      ctx.drawImage(img, (W - img.width) / 2, (H - img.height) / 2)
    } catch { /* odd scene: keep the blank card */ }
  }
  return c.toDataURL('image/jpeg', 0.72)
}

// ---------- other drawings in the cloud ----------
// Reads a drawing's current content: snapshot + the log after it + anything this browser hasn't sent yet.
export async function loadDrawing(id) {
  const [r] = await backend.getBoards([id])
  if (!r) throw new Error('missing')
  const fold = (data, a) => (a.type === 'PATCH' ? apply(data, a.ops) : a.type === 'REPLACE' ? a.data : data)
  let data = [...r.events].sort((a, b) => a.seq - b.seq).reduce((d, e) => fold(d, e.action), r.snapshot.data)
  const sent = new Set(r.events.map(e => e.action?.nonce))
  for (const a of get(`lift-cloud-q-${id}`) ?? []) if (!sent.has(a.nonce)) data = fold(data, a)
  return data
}

export async function renameDrawing(id, name) {
  await backend.append(id, { type: 'PATCH', ops: [['s', ['name'], name]], nonce: uid() + uid(), at: Date.now() })
  renameInList(id, name)
}

export async function duplicateDrawing(data, name) {
  const copy = { elements: data.elements ?? [], bg: data.bg, name }
  const id = await createWorkspace(APP, PREFIX, copy, name)
  return id
}

// ---------- keeping elements small enough to sync ----------
const r2 = n => (typeof n === 'number' ? Math.round(n * 100) / 100 : n)
// Coordinates to 0.01 px: invisible, and keeps long strokes well under the 64 KB-per-change limit.
export const tidy = el => ({ ...el, x: r2(el.x), y: r2(el.y), w: r2(el.w), h: r2(el.h), ...(el.points ? { points: el.points.map(([x, y]) => [r2(x), r2(y)]) } : null) })

const SPLIT_AT = 40000 // bytes of JSON per element
// A very long freehand stroke becomes a few consecutive strokes that join seamlessly, so each one syncs.
export function fitForSync(el) {
  if (!isLinear(el) || el.points.length < 3) return [el]
  const size = JSON.stringify(el).length
  if (size <= SPLIT_AT) return [el]
  const per = Math.max(2, Math.floor(el.points.length * SPLIT_AT / size))
  if (el.type !== 'freedraw') {
    // Lines and arrows keep one shape: thin out the points instead.
    const step = Math.ceil(el.points.length / per)
    const pts = el.points.filter((_, i) => i % step === 0)
    pts.push(el.points[el.points.length - 1])
    return [{ ...el, points: pts }]
  }
  const parts = []
  for (let i = 0; i < el.points.length - 1; i += per - 1) {
    parts.push({ ...el, id: parts.length ? uid() : el.id, points: el.points.slice(i, i + per) })
  }
  return parts
}

// Imported files may repeat ids or lack them; ids must be unique for edits to merge.
export function uniqueIds(elements) {
  const seen = new Set()
  return elements.map(e => {
    const id = (typeof e.id === 'string' && e.id && !seen.has(e.id)) ? e.id : uid()
    seen.add(id)
    return id === e.id ? e : { ...e, id }
  })
}
