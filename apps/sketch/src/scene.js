export const uid = () => Math.random().toString(36).slice(2, 10)
export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// Small deterministic PRNG so each element's sketchy jitter is stable across redraws.
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Lift warm palette: ink, walnut, bronze, forest, terracotta for strokes; soft fills for backgrounds.
export const STROKE_COLORS = ['#2B1E14', '#6A472D', '#8C613A', '#3E6E57', '#C9774F']
export const BG_COLORS = ['transparent', '#DBBE94', '#A9C8AE', '#E2A27F', '#CCA06A']
export const CANVAS_BGS = ['#FFFCF7', '#FBF8F2', '#F6F0E5', '#F1F4EE', '#FAF1EA']
export const DEFAULT_BG = '#FFFCF7'
export const FONT_SIZES = { S: 16, M: 20, L: 28, XL: 36 }
export const FONT = '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive'
export const LINE_HEIGHT = 1.25

export const DEFAULT_STYLE = {
  strokeColor: '#2B1E14',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  roundness: 'round',
  opacity: 100,
  fontSize: 20,
}

export const isLinear = el => el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw'
export const isContainer = el => el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse'

export function createElement(type, x, y, style) {
  const base = {
    id: uid(), type, x, y, w: 0, h: 0, seed: newSeed(), angle: 0,
    strokeColor: style.strokeColor, backgroundColor: style.backgroundColor, fillStyle: style.fillStyle,
    strokeWidth: style.strokeWidth, strokeStyle: style.strokeStyle, roughness: style.roughness,
    roundness: style.roundness, opacity: style.opacity,
  }
  if (isLinear({ type })) return { ...base, points: [[0, 0]] }
  if (type === 'text') return { ...base, text: '', fontSize: style.fontSize }
  return { ...base, label: '' }
}

// Axis-aligned world bounds.
export function bounds(el) {
  if (isLinear(el)) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (const [px, py] of el.points) {
      x1 = Math.min(x1, el.x + px); y1 = Math.min(y1, el.y + py)
      x2 = Math.max(x2, el.x + px); y2 = Math.max(y2, el.y + py)
    }
    return { x1, y1, x2, y2 }
  }
  return { x1: Math.min(el.x, el.x + el.w), y1: Math.min(el.y, el.y + el.h), x2: Math.max(el.x, el.x + el.w), y2: Math.max(el.y, el.y + el.h) }
}

export function commonBounds(els) {
  if (!els.length) return null
  const b = els.map(bounds)
  return { x1: Math.min(...b.map(v => v.x1)), y1: Math.min(...b.map(v => v.y1)), x2: Math.max(...b.map(v => v.x2)), y2: Math.max(...b.map(v => v.y2)) }
}

// Make width/height positive after drawing in any direction.
export function normalize(el) {
  if (isLinear(el) || (el.w >= 0 && el.h >= 0)) return el
  return { ...el, x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// Hit test: filled shapes hit anywhere inside, hollow ones only near the outline.
export function hitTest(el, x, y, tol) {
  const b = bounds(el)
  if (x < b.x1 - tol || x > b.x2 + tol || y < b.y1 - tol || y > b.y2 + tol) return false
  const filled = el.backgroundColor !== 'transparent' || (isContainer(el) && el.label)
  if (el.type === 'text') return true
  if (isLinear(el)) {
    const pts = el.points.map(([px, py]) => [el.x + px, el.y + py])
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) < tol
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) < tol + el.strokeWidth) return true
    }
    return false
  }
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2
  const hw = (b.x2 - b.x1) / 2 || 1, hh = (b.y2 - b.y1) / 2 || 1
  if (el.type === 'rectangle') {
    const inside = x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2
    if (filled && inside) return true
    const nearX = Math.abs(x - b.x1) < tol || Math.abs(x - b.x2) < tol
    const nearY = Math.abs(y - b.y1) < tol || Math.abs(y - b.y2) < tol
    return (nearX && y >= b.y1 - tol && y <= b.y2 + tol) || (nearY && x >= b.x1 - tol && x <= b.x2 + tol)
  }
  if (el.type === 'ellipse') {
    const d = Math.hypot((x - cx) / hw, (y - cy) / hh)
    return filled ? d <= 1 + tol / Math.min(hw, hh) : Math.abs(d - 1) * Math.min(hw, hh) < tol
  }
  if (el.type === 'diamond') {
    const d = Math.abs(x - cx) / hw + Math.abs(y - cy) / hh
    return filled ? d <= 1 + tol / Math.min(hw, hh) : Math.abs(d - 1) * Math.min(hw, hh) < tol
  }
  return false
}

export function measureText(text, fontSize) {
  const c = measureText.ctx ?? (measureText.ctx = document.createElement('canvas').getContext('2d'))
  c.font = `${fontSize}px ${FONT}`
  const lines = text.split('\n')
  const w = Math.max(...lines.map(l => c.measureText(l || ' ').width))
  return { w: Math.ceil(w), h: Math.ceil(lines.length * fontSize * LINE_HEIGHT) }
}

// Scale an element from an original box to a new box (used by resize handles).
export function scaleElement(orig, from, to) {
  const sx = (to.x2 - to.x1) / ((from.x2 - from.x1) || 1)
  const sy = (to.y2 - to.y1) / ((from.y2 - from.y1) || 1)
  const mx = v => to.x1 + (v - from.x1) * sx
  const my = v => to.y1 + (v - from.y1) * sy
  if (isLinear(orig)) {
    const nx = mx(orig.x), ny = my(orig.y)
    return { ...orig, x: nx, y: ny, points: orig.points.map(([px, py]) => [mx(orig.x + px) - nx, my(orig.y + py) - ny]) }
  }
  const x1 = mx(orig.x), y1 = my(orig.y), x2 = mx(orig.x + orig.w), y2 = my(orig.y + orig.h)
  const out = { ...orig, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  if (orig.type === 'text') {
    const f = Math.max(6, Math.round(orig.fontSize * Math.abs(sy)))
    const m = measureText(orig.text, f)
    return { ...out, fontSize: f, w: m.w, h: m.h }
  }
  return out
}

export function demoScene(t) {
  const s = { ...DEFAULT_STYLE }
  const el = (type, x, y, w, h, extra = {}) => ({ ...createElement(type, x, y, s), w, h, ...extra })
  const tx = (x, y, text, fontSize = 20, extra = {}) => { const m = measureText(text, fontSize); return { ...createElement('text', x, y, s), text, fontSize, w: m.w, h: m.h, ...extra } }
  // Offset keeps the scene clear of the style panel.
  const DX = 240, DY = 60
  return [
    tx(120, 60, t.title, 36),
    el('rectangle', 120, 140, 200, 110, { backgroundColor: '#DBBE94', fillStyle: 'hachure', label: t.idea }),
    el('diamond', 420, 130, 180, 130, { backgroundColor: '#CCA06A', fillStyle: 'cross-hatch', label: t.decide }),
    el('ellipse', 700, 145, 190, 100, { backgroundColor: '#A9C8AE', fillStyle: 'solid', label: t.ship }),
    { ...createElement('arrow', 325, 195, s), points: [[0, 0], [90, 0]] },
    { ...createElement('arrow', 605, 195, s), points: [[0, 0], [90, 0]], strokeColor: '#3E6E57' },
    el('rectangle', 120, 320, 200, 100, { strokeStyle: 'dashed', roundness: 'sharp', strokeColor: '#8C613A', label: t.draft }),
    el('rectangle', 380, 320, 200, 100, { roughness: 0, strokeWidth: 4, strokeColor: '#3E6E57', label: t.neat }),
    el('ellipse', 640, 320, 120, 100, { roughness: 2, strokeStyle: 'dotted', strokeColor: '#C9774F' }),
    { ...createElement('line', 820, 330, s), points: [[0, 0], [60, 40], [20, 90], [90, 80]] },
    { ...createElement('freedraw', 140, 480, s), points: Array.from({ length: 60 }, (_, i) => [i * 6, Math.sin(i / 5) * 18]), strokeColor: '#C9774F' },
    tx(560, 470, t.note, 20, { strokeColor: '#6A472D' }),
  ].map(e => ({ ...e, x: e.x + DX, y: e.y + DY }))
}
