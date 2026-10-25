// Small celebratory effects in brand gold. Both respect prefers-reduced-motion.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const GOLDS = ['#CCA06A', '#DBBE94', '#E8CF9F', '#8C613A', '#F7F1E6']

// A short burst of sparks from an element (used when voting).
export function sparkle(el) {
  if (!el || reduced()) return
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('i')
    s.className = 'spark'
    const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4
    const dist = 18 + Math.random() * 16
    s.style.left = `${cx}px`
    s.style.top = `${cy}px`
    s.style.background = GOLDS[i % GOLDS.length]
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 650)
  }
}

// Full-screen gold confetti for a few seconds (used when a retro is finished).
export function confetti(duration = 3200) {
  if (reduced()) return
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio }
  resize()
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width, y: -Math.random() * canvas.height * 0.6,
    w: (6 + Math.random() * 6) * devicePixelRatio, h: (3 + Math.random() * 4) * devicePixelRatio,
    vy: (2 + Math.random() * 3) * devicePixelRatio, vx: (Math.random() - 0.5) * 2 * devicePixelRatio,
    rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2, color: GOLDS[Math.floor(Math.random() * GOLDS.length)],
  }))
  const start = performance.now()
  const frame = t => {
    const fade = Math.max(0, 1 - Math.max(0, t - start - duration + 800) / 800)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = fade
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
    }
    if (t - start < duration) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
