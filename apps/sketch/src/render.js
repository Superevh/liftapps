import { mulberry32, bounds, commonBounds, isLinear, isContainer, FONT, LINE_HEIGHT } from './scene.js'

export const SELECTION_COLOR = '#8C613A'
export const HANDLE_SIZE = 8

// Max jitter (in px) for a segment of a given length at a given roughness.
const jitterFor = (len, roughness) => roughness === 0 ? 0 : Math.min(len * 0.06, 1.5 + roughness * 1.6) * roughness

function roughSegment(ctx, rng, x1, y1, x2, y2, roughness, pass) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const j = jitterFor(len, roughness)
  const r = () => (rng() - 0.5) * 2 * j
  // Slight bow in the middle of the line, like a hand-drawn stroke.
  const bow = (rng() - 0.5) * j * (pass ? 1.2 : 0.8)
  const nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : 0
  const mx = (x1 + x2) / 2 + nx * bow, my = (y1 + y2) / 2 + ny * bow
  ctx.moveTo(x1 + r(), y1 + r())
  ctx.quadraticCurveTo(mx + r() * 0.5, my + r() * 0.5, x2 + r(), y2 + r())
}

function strokePasses(roughness) { return roughness === 0 ? 1 : 2 }

function catmullRom(ctx, pts, closed) {
  if (pts.length < 2) return
  const n = pts.length
  const get = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]
  ctx.moveTo(pts[0][0], pts[0][1])
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2)
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    )
  }
}

// Outline points for shapes drawn as curves (ellipses and rounded corners).
function outlinePoints(el) {
  const { x1, y1, x2, y2 } = bounds(el)
  const w = x2 - x1, h = y2 - y1
  if (el.type === 'ellipse') {
    const cx = x1 + w / 2, cy = y1 + h / 2
    const n = Math.max(12, Math.round((w + h) / 18))
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2] })
  }
  if (el.type === 'rectangle') {
    const r = Math.min(w, h) * 0.25, k = r * 0.3
    return [[x1 + r, y1], [x2 - r, y1], [x2 - k, y1 + k], [x2, y1 + r], [x2, y2 - r], [x2 - k, y2 - k], [x2 - r, y2], [x1 + r, y2], [x1 + k, y2 - k], [x1, y2 - r], [x1, y1 + r], [x1 + k, y1 + k]]
  }
  // Rounded diamond
  const cx = x1 + w / 2, cy = y1 + h / 2, t = 0.12
  const P = [[cx, y1], [x2, cy], [cx, y2], [x1, cy]]
  const out = []
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4]
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [b[0] - (b[0] - a[0]) * t, b[1] - (b[1] - a[1]) * t])
  }
  return out
}

// Clean path used for clipping fills.
function shapePath(ctx, el) {
  const { x1, y1, x2, y2 } = bounds(el)
  ctx.beginPath()
  if (el.type === 'rectangle') {
    if (el.roundness === 'round') ctx.roundRect(x1, y1, x2 - x1, y2 - y1, Math.min(x2 - x1, y2 - y1) * 0.25)
    else ctx.rect(x1, y1, x2 - x1, y2 - y1)
  } else if (el.type === 'ellipse') {
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2, (y2 - y1) / 2, 0, 0, Math.PI * 2)
  } else if (el.type === 'diamond') {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
    ctx.moveTo(cx, y1); ctx.lineTo(x2, cy); ctx.lineTo(cx, y2); ctx.lineTo(x1, cy); ctx.closePath()
  }
}

function drawFill(ctx, el, rng) {
  if (el.backgroundColor === 'transparent') return
  ctx.save()
  shapePath(ctx, el)
  if (el.fillStyle === 'solid') {
    ctx.fillStyle = el.backgroundColor
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.clip()
  const { x1, y1, x2, y2 } = bounds(el)
  const gap = Math.max(6, el.strokeWidth * 4 + 4)
  ctx.strokeStyle = el.backgroundColor
  ctx.lineWidth = Math.max(1, el.strokeWidth / 2)
  ctx.setLineDash([])
  const angles = el.fillStyle === 'cross-hatch' ? [-Math.PI / 4.4, Math.PI / 4.4] : [-Math.PI / 4.4]
  const diag = Math.hypot(x2 - x1, y2 - y1)
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a)
    ctx.beginPath()
    for (let o = -diag / 2; o <= diag / 2; o += gap) {
      const px = cx - dy * o, py = cy + dx * o
      roughSegment(ctx, rng, px - dx * diag, py - dy * diag, px + dx * diag, py + dy * diag, Math.min(1, el.roughness), 0)
    }
    ctx.stroke()
  }
  ctx.restore()
}

function applyStrokeStyle(ctx, el) {
  ctx.strokeStyle = el.strokeColor
  ctx.lineWidth = el.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const w = el.strokeWidth
  ctx.setLineDash(el.strokeStyle === 'dashed' ? [8 + w * 2, 6 + w * 2] : el.strokeStyle === 'dotted' ? [1, 4 + w * 2] : [])
}

function drawPolygonEdges(ctx, el, rng, pts) {
  for (let p = 0; p < strokePasses(el.roughness); p++) {
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      roughSegment(ctx, rng, a[0], a[1], b[0], b[1], el.roughness, p)
    }
    ctx.stroke()
  }
}

function drawCurve(ctx, el, rng, pts, closed) {
  const { x1, y1, x2, y2 } = bounds(el)
  const j = jitterFor(Math.min(x2 - x1, y2 - y1) || 40, el.roughness) * 0.8
  for (let p = 0; p < strokePasses(el.roughness); p++) {
    const jittered = pts.map(([x, y]) => [x + (rng() - 0.5) * 2 * j, y + (rng() - 0.5) * 2 * j])
    ctx.beginPath()
    catmullRom(ctx, jittered, closed)
    ctx.stroke()
  }
}

function drawArrowhead(ctx, el, rng, pts) {
  if (pts.length < 2) return
  const [tx, ty] = pts[pts.length - 1]
  let i = pts.length - 2
  while (i > 0 && Math.hypot(tx - pts[i][0], ty - pts[i][1]) < 1) i--
  const [fx, fy] = pts[i]
  const len = Math.hypot(tx - fx, ty - fy)
  if (len < 1) return
  const size = Math.min(30, Math.max(10, len * 0.3)) + el.strokeWidth * 2
  const a = Math.atan2(ty - fy, tx - fx)
  ctx.setLineDash([])
  for (const s of [-1, 1]) {
    const ha = a + Math.PI - s * Math.PI / 7
    ctx.beginPath()
    roughSegment(ctx, rng, tx, ty, tx + Math.cos(ha) * size, ty + Math.sin(ha) * size, Math.min(1, el.roughness), 0)
    ctx.stroke()
  }
}

function drawText(ctx, text, fontSize, color, cx, top, align) {
  ctx.fillStyle = color
  ctx.font = `${fontSize}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  text.split('\n').forEach((line, i) => ctx.fillText(line, cx, top + i * fontSize * LINE_HEIGHT + fontSize * 0.1))
}

export function drawElement(ctx, el, { skipText } = {}) {
  const rng = mulberry32(el.seed)
  ctx.save()
  ctx.globalAlpha = el.opacity / 100
  if (el.type === 'text') {
    if (!skipText) drawText(ctx, el.text, el.fontSize, el.strokeColor, el.x, el.y, 'left')
    ctx.restore()
    return
  }
  if (el.type === 'freedraw') {
    const pts = el.points.map(([x, y]) => [el.x + x, el.y + y])
    ctx.strokeStyle = el.strokeColor
    ctx.lineWidth = el.strokeWidth * 1.4
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1])
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
    ctx.stroke()
    ctx.restore()
    return
  }
  if (isLinear(el)) {
    const pts = el.points.map(([x, y]) => [el.x + x, el.y + y])
    applyStrokeStyle(ctx, el)
    if (pts.length > 2 && el.roundness === 'round') drawCurve(ctx, el, rng, pts, false)
    else {
      for (let p = 0; p < strokePasses(el.roughness); p++) {
        ctx.beginPath()
        for (let i = 1; i < pts.length; i++) roughSegment(ctx, rng, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], el.roughness, p)
        ctx.stroke()
      }
    }
    if (el.type === 'arrow') drawArrowhead(ctx, el, rng, pts)
    ctx.restore()
    return
  }
  drawFill(ctx, el, rng)
  applyStrokeStyle(ctx, el)
  const { x1, y1, x2, y2 } = bounds(el)
  if (el.type === 'ellipse' || el.roundness === 'round') drawCurve(ctx, el, rng, outlinePoints(el), true)
  else if (el.type === 'rectangle') drawPolygonEdges(ctx, el, rng, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
  else drawPolygonEdges(ctx, el, rng, [[(x1 + x2) / 2, y1], [x2, (y1 + y2) / 2], [(x1 + x2) / 2, y2], [x1, (y1 + y2) / 2]])
  if (isContainer(el) && el.label && !skipText) {
    const lines = el.label.split('\n').length
    const fs = el.fontSize ?? 20
    drawText(ctx, el.label, fs, el.strokeColor, (x1 + x2) / 2, (y1 + y2) / 2 - (lines * fs * LINE_HEIGHT) / 2, 'center')
  }
  ctx.restore()
}

export function handleRects(b, zoom) {
  const s = HANDLE_SIZE / zoom, pad = 6 / zoom
  const x1 = b.x1 - pad, y1 = b.y1 - pad, x2 = b.x2 + pad, y2 = b.y2 + pad
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const pos = { nw: [x1, y1], n: [mx, y1], ne: [x2, y1], e: [x2, my], se: [x2, y2], s: [mx, y2], sw: [x1, y2], w: [x1, my] }
  return Object.entries(pos).map(([k, [x, y]]) => ({ k, x: x - s / 2, y: y - s / 2, s }))
}

export function renderScene(ctx, { elements, width, height, zoom, scrollX, scrollY, bg, selectedIds, marquee, editingId, erasing, dpr }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * zoom * scrollX, dpr * zoom * scrollY)
  const vx1 = -scrollX, vy1 = -scrollY, vx2 = vx1 + width / zoom, vy2 = vy1 + height / zoom
  for (const el of elements) {
    const b = bounds(el)
    if (b.x2 < vx1 - 50 || b.x1 > vx2 + 50 || b.y2 < vy1 - 50 || b.y1 > vy2 + 50) continue
    ctx.save()
    if (erasing?.has(el.id)) ctx.globalAlpha = 0.25
    drawElement(ctx, el, { skipText: el.id === editingId })
    ctx.restore()
  }
  const selected = elements.filter(e => selectedIds.has(e.id))
  if (selected.length) {
    ctx.save()
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 1 / zoom
    const pad = 6 / zoom
    if (selected.length > 1) {
      ctx.setLineDash([4 / zoom, 4 / zoom])
      for (const el of selected) { const b = bounds(el); ctx.strokeRect(b.x1 - pad / 2, b.y1 - pad / 2, b.x2 - b.x1 + pad, b.y2 - b.y1 + pad) }
    }
    const cb = commonBounds(selected)
    ctx.setLineDash(selected.length > 1 ? [6 / zoom, 3 / zoom] : [])
    ctx.strokeRect(cb.x1 - pad, cb.y1 - pad, cb.x2 - cb.x1 + pad * 2, cb.y2 - cb.y1 + pad * 2)
    ctx.setLineDash([])
    ctx.fillStyle = '#FFFCF7'
    for (const h of handleRects(cb, zoom)) {
      ctx.beginPath(); ctx.roundRect(h.x, h.y, h.s, h.s, 2 / zoom); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }
  if (marquee) {
    ctx.save()
    ctx.fillStyle = 'rgba(204,160,106,0.12)'
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 1 / zoom
    const x = Math.min(marquee.x1, marquee.x2), y = Math.min(marquee.y1, marquee.y2)
    ctx.fillRect(x, y, Math.abs(marquee.x2 - marquee.x1), Math.abs(marquee.y2 - marquee.y1))
    ctx.strokeRect(x, y, Math.abs(marquee.x2 - marquee.x1), Math.abs(marquee.y2 - marquee.y1))
    ctx.restore()
  }
}

// Render the given elements to a standalone PNG canvas.
export function exportCanvas(elements, bg, scale = 2, padding = 24) {
  const b = commonBounds(elements)
  const w = b.x2 - b.x1 + padding * 2, h = b.y2 - b.y1 + padding * 2
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale)
  const ctx = c.getContext('2d')
  ctx.scale(scale, scale)
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h) }
  ctx.translate(padding - b.x1, padding - b.y1)
  for (const el of elements) drawElement(ctx, el)
  return c
}

// ---------- SVG export ----------
// A tiny recorder that implements the subset of the 2D canvas API drawElement uses and writes SVG,
// so exported SVGs keep exactly the same hand-drawn strokes as the canvas.
const n = v => Math.round(v * 100) / 100
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

class SvgContext {
  constructor() {
    this.out = []; this.defs = []; this.stack = []; this.d = ''; this.clips = 0
    this.st = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', dash: [], font: '16px sans-serif', textAlign: 'left', textBaseline: 'alphabetic', clip: null }
  }
  save() { this.stack.push({ ...this.st }) }
  restore() { if (this.stack.length) this.st = this.stack.pop() }
  setLineDash(d) { this.st.dash = d }
  beginPath() { this.d = '' }
  moveTo(x, y) { this.d += `M${n(x)} ${n(y)}` }
  lineTo(x, y) { this.d += `L${n(x)} ${n(y)}` }
  quadraticCurveTo(a, b, x, y) { this.d += `Q${n(a)} ${n(b)} ${n(x)} ${n(y)}` }
  bezierCurveTo(a, b, c, d, x, y) { this.d += `C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(x)} ${n(y)}` }
  closePath() { this.d += 'Z' }
  rect(x, y, w, h) { this.d += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z` }
  roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    this.d += `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`
  }
  ellipse(cx, cy, rx, ry) { this.d += `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z` }
  common() {
    const s = this.st
    return (s.globalAlpha < 1 ? ` opacity="${n(s.globalAlpha)}"` : '') + (s.clip ? ` clip-path="url(#${s.clip})"` : '')
  }
  stroke() {
    if (!this.d) return
    const s = this.st
    this.out.push(`<path d="${this.d}" fill="none" stroke="${esc(s.strokeStyle)}" stroke-width="${n(s.lineWidth)}" stroke-linecap="${s.lineCap}" stroke-linejoin="${s.lineJoin}"${s.dash.length ? ` stroke-dasharray="${s.dash.map(n).join(' ')}"` : ''}${this.common()}/>`)
  }
  fill() { if (this.d) this.out.push(`<path d="${this.d}" fill="${esc(this.st.fillStyle)}"${this.common()}/>`) }
  clip() { const id = `c${++this.clips}`; this.defs.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`); this.st.clip = id }
  fillText(text, x, y) {
    const s = this.st
    const m = /^(\d+(?:\.\d+)?)px (.*)$/.exec(s.font) || [null, 16, 'sans-serif']
    const anchor = s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : 'start'
    this.out.push(`<text x="${n(x)}" y="${n(y)}" font-size="${m[1]}" font-family="${esc(m[2])}" fill="${esc(s.fillStyle)}" text-anchor="${anchor}" dominant-baseline="text-before-edge" xml:space="preserve"${this.common()}>${esc(text)}</text>`)
  }
}
for (const k of ['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'font', 'textAlign', 'textBaseline']) {
  Object.defineProperty(SvgContext.prototype, k, { get() { return this.st[k] }, set(v) { this.st[k] = v } })
}

export function exportSvg(elements, bg, padding = 24) {
  const b = commonBounds(elements)
  const w = n(b.x2 - b.x1 + padding * 2), h = n(b.y2 - b.y1 + padding * 2)
  const ctx = new SvgContext()
  for (const el of elements) drawElement(ctx, el)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '') +
    (bg ? `<rect width="100%" height="100%" fill="${esc(bg)}"/>` : '') +
    `<g transform="translate(${n(padding - b.x1)} ${n(padding - b.y1)})">${ctx.out.join('')}</g></svg>`
}
