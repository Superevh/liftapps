import { today, addMonths, addDays, parts, ymd, isDate } from './dates.js'

export const PALETTE = [
  { id: 'gold', hex: '#CCA06A' }, { id: 'sand', hex: '#DBBE94' }, { id: 'bronze', hex: '#8C613A' }, { id: 'sage', hex: '#A9C8AE' },
  { id: 'forest', hex: '#3E6E57' }, { id: 'terracotta', hex: '#E2A27F' }, { id: 'walnut', hex: '#6A472D' },
]
export const DARK = new Set(['#8C613A', '#3E6E57', '#6A472D'])
export const STATUSES = ['idea', 'planned', 'progress', 'done']
const KEY = 'planlift-v1'
export const uid = () => Math.random().toString(36).slice(2, 10)

// ---------- seed ----------
const SEED = {
  en: {
    name: 'Sample product roadmap',
    lanes: ['Product experience', 'Platform', 'Growth', 'Operations'],
    items: [
      [0, 'Onboarding refresh', -3, 2, 'done', 'Shorter sign-up, clearer first steps.'],
      [0, 'Mobile app beta', -1, 3, 'progress', 'Invite-only beta with 200 users.'],
      [0, 'Offline mode', 2, 2, 'planned'],
      [0, 'Personal dashboards', 5, 3, 'idea'],
      [1, 'Public API v2', -2, 3, 'progress'],
      [1, 'Faster search', 1, 3, 'planned'],
      [1, 'Data export', 4, 2, 'idea'],
      [2, 'Referral programme', 0, 2, 'progress'],
      [2, 'Pricing page test', 2, 1, 'planned', 'Two variants, four weeks.'],
      [2, 'Partner integrations', 3, 3, 'idea'],
      [3, 'Support inbox triage', -3, 1, 'done'],
      [3, 'Status page', 1, 1, 'planned'],
      [3, 'Security review', 3, 2, 'planned'],
    ],
  },
  zh: {
    name: '示例产品路线图',
    lanes: ['产品体验', '平台', '增长', '运营'],
    items: [
      [0, '新手引导改版', -3, 2, 'done', '注册更短，第一步更清楚。'],
      [0, '移动端内测', -1, 3, 'progress', '邀请 200 位用户参与内测。'],
      [0, '离线模式', 2, 2, 'planned'],
      [0, '个人仪表盘', 5, 3, 'idea'],
      [1, '开放 API v2', -2, 3, 'progress'],
      [1, '搜索提速', 1, 3, 'planned'],
      [1, '数据导出', 4, 2, 'idea'],
      [2, '推荐有礼计划', 0, 2, 'progress'],
      [2, '定价页实验', 2, 1, 'planned', '两个版本，测四周。'],
      [2, '合作伙伴集成', 3, 3, 'idea'],
      [3, '客服工单分流', -3, 1, 'done'],
      [3, '状态页', 1, 1, 'planned'],
      [3, '安全评审', 3, 2, 'planned'],
    ],
  },
}

export function sampleRoadmap(lang) {
  const s = SEED[lang] || SEED.en
  const { y, m } = parts(today())
  const first = ymd(y, m, 1)
  const colors = ['#CCA06A', '#3E6E57', '#E2A27F', '#A9C8AE']
  const lanes = s.lanes.map((name, i) => ({ id: uid(), name, color: colors[i] }))
  const items = s.items.map(([lane, title, off, len, status, note]) => {
    const start = addMonths(first, off)
    return { id: uid(), laneId: lanes[lane].id, title, start, end: addDays(addMonths(start, len), -1), status, note: note || '', link: '' }
  })
  return { id: uid(), name: s.name, lanes, items, updated: Date.now() }
}

export function blankRoadmap(name, laneName) {
  return { id: uid(), name, lanes: [{ id: uid(), name: laneName, color: PALETTE[0].hex }], items: [], updated: Date.now() }
}

// ---------- persistence ----------
export function load(lang) {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw)
      const roadmaps = (data.roadmaps || []).map(clean).filter(Boolean)
      if (roadmaps.length) return { roadmaps, currentId: roadmaps.some(r => r.id === data.currentId) ? data.currentId : roadmaps[0].id }
    }
  } catch { /* corrupted or blocked storage */ }
  const r = sampleRoadmap(lang)
  return { roadmaps: [r], currentId: r.id }
}
export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true } catch { return false }
}

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max)
// Validate anything that comes from storage, a file or a link.
export function clean(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.lanes)) return null
  const hexes = new Set(PALETTE.map(p => p.hex))
  const lanes = r.lanes.slice(0, 50).map(l => ({ id: str(l.id, 40) || uid(), name: str(l.name, 80), color: hexes.has(l.color) ? l.color : PALETTE[0].hex }))
  if (!lanes.length) lanes.push({ id: uid(), name: 'Lane', color: PALETTE[0].hex })
  const ids = new Set(lanes.map(l => l.id))
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 2000).filter(i => i && isDate(i.start) && isDate(i.end)).map(i => {
    const start = i.start <= i.end ? i.start : i.end, end = i.start <= i.end ? i.end : i.start
    return {
      id: str(i.id, 40) || uid(), laneId: ids.has(i.laneId) ? i.laneId : lanes[0].id, title: str(i.title, 200), start, end,
      status: STATUSES.includes(i.status) ? i.status : 'planned', note: str(i.note, 4000), link: safeLink(str(i.link, 1000)),
      ...(Number.isInteger(i.order) && i.order >= 0 && i.order < 100000 ? { order: i.order } : {}),
    }
  })
  return { id: str(r.id, 40) || uid(), name: str(r.name, 120) || 'Roadmap', lanes, items, updated: Number(r.updated) || Date.now() }
}
export function safeLink(v) {
  const s = v.trim()
  if (!s) return ''
  try { const u = new URL(/^[a-z]+:/i.test(s) ? s : `https://${s}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '' } catch { return '' }
}

// ---------- share links ----------
// The roadmap travels in the URL hash (never sent to a server): compact JSON → deflate-raw → base64url.
const b64url = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const unb64url = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out }
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())

export async function encodeShare(r) {
  const laneIdx = new Map(r.lanes.map((l, i) => [l.id, i]))
  const compact = {
    v: 1, n: r.name, l: r.lanes.map(l => [l.name, PALETTE.findIndex(p => p.hex === l.color)]),
    i: r.items.map(i => [laneIdx.get(i.laneId) ?? 0, i.title, i.start, i.end, STATUSES.indexOf(i.status), i.note || '', i.link || '', ...(Number.isInteger(i.order) ? [i.order] : [])]),
  }
  return b64url(await pipe(new TextEncoder().encode(JSON.stringify(compact)), new CompressionStream('deflate-raw')))
}
export async function decodeShare(str) {
  const c = JSON.parse(new TextDecoder().decode(await pipe(unb64url(str), new DecompressionStream('deflate-raw'))))
  if (c.v !== 1) throw new Error('version')
  const lanes = c.l.map(([name, ci]) => ({ id: uid(), name, color: (PALETTE[ci] || PALETTE[0]).hex }))
  const items = c.i.map(([li, title, start, end, si, note, link, order]) => ({ id: uid(), laneId: lanes[li]?.id, title, start, end, status: STATUSES[si] || 'planned', note, link, order }))
  return clean({ id: 'shared', name: c.n, lanes, items })
}
export const SHARE_PREFIX = '#view='
