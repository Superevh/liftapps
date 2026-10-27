// PlanLift data model.
//
// A workspace (one cloud document, shared by link) holds several roadmaps and a change log:
//   { v: 2, name, roadmaps: [Roadmap], log: [Change] }
//   Roadmap   { id, name, desc, template, lanes: [Lane], items: [Item], milestones: [Milestone], deps: [Dep], created, updated }
//   Lane      { id, name, color }
//   Item      { id, laneId, title, desc, start, end, horizon, status, owner, progress, tags, size, priority, links: [{ id, url, label }], order? }
//             start/end are "YYYY-MM-DD" (inclusive) or both "" for an unscheduled item that only has a horizon.
//   Milestone { id, title, date, kind: 'milestone' | 'release', laneId, note }
//   Dep       { id, from, to }   `to` can't start until `from` is finished
//   Change    { id, at, wid, who, rm, item, title, kind, from, to }
// Everything people add concurrently is an object with a unique id, so the cloud patches merge by id.
// Per-browser things (current roadmap, view, zoom, filters, your name) live in localStorage, never in the workspace.
import { today, addMonths, addDays, parts, ymd, isDate, toDay } from './dates.js'

// Lane colours are stored as hex (compatible with v1 data and share links) and drawn with the theme tokens.
export const PALETTE = [
  { id: 'gold', hex: '#CCA06A', v: '--lift-gold' }, { id: 'sand', hex: '#DBBE94', v: '--lift-sand' },
  { id: 'bronze', hex: '#8C613A', v: '--lift-gold-ink' }, { id: 'sage', hex: '#A9C8AE', v: '--lift-sage' },
  { id: 'forest', hex: '#3E6E57', v: '--lift-forest' }, { id: 'terracotta', hex: '#E2A27F', v: '--lift-terracotta' },
  { id: 'walnut', hex: '#6A472D', v: '--lift-walnut' },
]
const HEXES = new Set(PALETTE.map(p => p.hex))
export const DARK = new Set(['#8C613A', '#3E6E57', '#6A472D'])
export const colorVar = hex => `var(${(PALETTE.find(p => p.hex === hex) || PALETTE[0]).v})`
export const onColorVar = hex => (DARK.has(hex) ? 'var(--lift-card)' : 'var(--lift-ink)')

export const STATUSES = ['idea', 'planned', 'progress', 'risk', 'done']
export const HORIZONS = ['now', 'next', 'later']
export const PRIORITIES = ['high', 'medium', 'low']
export const SIZES = ['XS', 'S', 'M', 'L', 'XL']
export const KEY_V1 = 'planlift-v1'
export const KEY = 'planlift-v2'
export const LOG_MAX = 400

export const uid = () => Math.random().toString(36).slice(2, 10)

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max)
const num = (v, lo, hi, d) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, Math.round(+v))) : d)
export function safeLink(v) {
  const s = (v || '').trim()
  if (!s) return ''
  try { const u = new URL(/^[a-z]+:/i.test(s) ? s : `https://${s}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '' } catch { return '' }
}

// ---------- validation (anything from storage, a file or a link) ----------
export function cleanItem(i, laneIds, fallbackLane) {
  if (!i || typeof i !== 'object') return null
  let start = isDate(i.start) ? i.start : '', end = isDate(i.end) ? i.end : ''
  if (start && !end) end = start
  if (end && !start) start = end
  if (start > end) [start, end] = [end, start]
  const horizon = HORIZONS.includes(i.horizon) ? i.horizon : start ? '' : 'later'
  const links = Array.isArray(i.links) ? i.links.slice(0, 20).map(l => ({ id: str(l?.id, 40) || uid(), url: safeLink(str(l?.url, 1000)), label: str(l?.label, 120) })).filter(l => l.url) : []
  if (!links.length && typeof i.link === 'string' && safeLink(i.link)) links.push({ id: uid(), url: safeLink(i.link), label: '' })
  const out = {
    id: str(i.id, 40) || uid(), laneId: laneIds.has(i.laneId) ? i.laneId : fallbackLane, title: str(i.title, 200),
    desc: str(i.desc ?? i.note, 4000), start, end, horizon,
    status: STATUSES.includes(i.status) ? i.status : 'planned', owner: str(i.owner, 60), progress: num(i.progress, 0, 100, i.status === 'done' ? 100 : 0),
    tags: Array.isArray(i.tags) ? [...new Set(i.tags.map(x => str(x, 40).trim()).filter(Boolean))].slice(0, 12) : [],
    size: SIZES.includes(i.size) ? i.size : '', priority: PRIORITIES.includes(i.priority) ? i.priority : '', links,
    comments: Array.isArray(i.comments) ? i.comments.slice(-200).filter(c => c && typeof c.text === 'string' && c.text.trim()).map(c => ({ id: str(c.id, 40) || uid(), at: Number(c.at) || Date.now(), wid: str(c.wid, 40), who: str(c.who, 60), text: str(c.text, 2000) })) : [],
  }
  if (Number.isInteger(i.order) && i.order >= 0 && i.order < 100000) out.order = i.order
  return out
}

export function cleanRoadmap(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.lanes)) return null
  const lanes = r.lanes.slice(0, 60).map(l => ({ id: str(l?.id, 40) || uid(), name: str(l?.name, 80), color: HEXES.has(l?.color) ? l.color : PALETTE[0].hex }))
  if (!lanes.length) lanes.push({ id: uid(), name: 'Lane', color: PALETTE[3].hex })
  const laneIds = new Set(lanes.map(l => l.id))
  const seen = new Set()
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 3000).map(i => cleanItem(i, laneIds, lanes[0].id)).filter(i => i && !seen.has(i.id) && seen.add(i.id))
  const milestones = (Array.isArray(r.milestones) ? r.milestones : []).slice(0, 300).filter(m => m && isDate(m.date)).map(m => ({
    id: str(m.id, 40) || uid(), title: str(m.title, 160), date: m.date, kind: m.kind === 'release' ? 'release' : 'milestone',
    laneId: laneIds.has(m.laneId) ? m.laneId : '', note: str(m.note, 2000),
  }))
  const pairs = new Set()
  const deps = (Array.isArray(r.deps) ? r.deps : []).slice(0, 3000).filter(d => d && seen.has(d.from) && seen.has(d.to) && d.from !== d.to && !pairs.has(d.from + '>' + d.to) && pairs.add(d.from + '>' + d.to))
    .map(d => ({ id: str(d.id, 40) || uid(), from: d.from, to: d.to }))
  return {
    id: str(r.id, 40) || uid(), name: str(r.name, 120) || 'Roadmap', desc: str(r.desc, 600), template: str(r.template, 20),
    lanes, items, milestones, deps, created: Number(r.created) || Number(r.updated) || Date.now(), updated: Number(r.updated) || Date.now(),
  }
}

export function cleanWs(w) {
  if (!w || typeof w !== 'object' || !Array.isArray(w.roadmaps)) return null
  const ids = new Set()
  const roadmaps = w.roadmaps.slice(0, 100).map(cleanRoadmap).filter(r => r && !ids.has(r.id) && ids.add(r.id))
  const log = (Array.isArray(w.log) ? w.log : []).filter(e => e && typeof e.id === 'string' && Number.isFinite(e.at)).slice(-LOG_MAX)
  return { v: 2, name: str(w.name, 120), roadmaps, log, ...(w.example === true ? { example: true } : {}), ...(w.example === true && (w.pristine === 'en' || w.pristine === 'zh') ? { pristine: w.pristine } : {}), ...(w.publish && typeof w.publish === 'object' ? { publish: { id: str(w.publish.id, 60), on: !!w.publish.on } } : {}) }
}

// Lenient repair for documents that arrive from the cloud: only fills in what's missing, never drops
// anything another (perhaps newer) client wrote, and keeps unchanged objects as they are.
export function normalizeWs(w) {
  if (!w || typeof w !== 'object') return { v: 2, name: '', roadmaps: [], log: [] }
  let out = w
  const fix = (k, v) => { if (out === w) out = { ...w }; out[k] = v }
  if (!Array.isArray(w.roadmaps)) fix('roadmaps', [])
  if (!Array.isArray(w.log)) fix('log', [])
  if (typeof w.name !== 'string') fix('name', '')
  const rms = out.roadmaps.filter(r => r && typeof r === 'object').map(r => {
    let o = r
    const f = (k, v) => { if (o === r) o = { ...r }; o[k] = v }
    for (const k of ['lanes', 'items', 'milestones', 'deps']) if (!Array.isArray(r[k])) f(k, [])
    if (o.items.some(i => !Array.isArray(i?.tags) || !Array.isArray(i?.links))) f('items', o.items.filter(Boolean).map(i => (Array.isArray(i.tags) && Array.isArray(i.links) ? i : { ...i, tags: Array.isArray(i.tags) ? i.tags : [], links: Array.isArray(i.links) ? i.links : [] })))
    return o
  })
  if (rms.some((r, i) => r !== out.roadmaps[i]) || rms.length !== out.roadmaps.length) fix('roadmaps', rms)
  return out
}

// ---------- persistence ----------
// Returns { ws, uiRm, fromV1, hasLocal }. v1 data (one list of roadmaps) is migrated, and its key is left in place.
export function load(lang) {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const ws = cleanWs(JSON.parse(raw)); if (ws) return { ws, hasLocal: true } }
  } catch { /* corrupted or blocked storage */ }
  try {
    const raw = localStorage.getItem(KEY_V1)
    if (raw) {
      const data = JSON.parse(raw)
      const roadmaps = (data.roadmaps || []).map(cleanRoadmap).filter(Boolean)
      if (roadmaps.length) {
        const name = lang === 'zh' ? '我的路线图' : 'My roadmaps'
        return { ws: { v: 2, name, roadmaps, log: [] }, hasLocal: true, fromV1: true, uiRm: data.currentId }
      }
    }
  } catch { /* ignore */ }
  return { ws: sampleWorkspace(lang), hasLocal: false }
}
export function save(ws) {
  try { localStorage.setItem(KEY, JSON.stringify(ws)); return true } catch { return false }
}

// ---------- templates & the example workspace ----------
const M = (first, off, day = 1) => { const { y, m } = parts(addMonths(first, off)); return ymd(y, m, day) }
// Fractional lengths (0.5, 1.5) end two weeks into the last month instead of a whole month later.
const span = (first, off, len, startDay = 1) => {
  const start = M(first, off, startDay)
  return [start, len % 1 ? addDays(addMonths(start, Math.floor(len)), 13) : addDays(addMonths(start, len), -1)]
}

function build({ name, desc, template, lanes, items = [], milestones = [], deps = [] }, first) {
  const L = lanes.map(([n, c]) => ({ id: uid(), name: n, color: PALETTE.find(p => p.id === c).hex }))
  const I = items.map(x => {
    const [lane, title, off, len, status, owner = '', progress = 0, tags = [], size = '', priority = '', desc = '', horizon = ''] = x
    const [start, end] = off === null ? ['', ''] : span(first, Math.floor(off), len, off % 1 ? 15 : 1)
    return { id: uid(), laneId: L[lane].id, title, desc, start, end, horizon: start ? '' : horizon || 'later', status, owner, progress, tags, size, priority, links: [], comments: [] }
  })
  const MS = milestones.map(([title, off, day, kind, lane = -1]) => ({ id: uid(), title, date: M(first, off, day), kind, laneId: lane >= 0 ? L[lane].id : '', note: '' }))
  const D = deps.map(([a, b]) => ({ id: uid(), from: I[a].id, to: I[b].id }))
  const now = Date.now()
  return { roadmap: { id: uid(), name, desc, template, lanes: L, items: I, milestones: MS, deps: D, created: now, updated: now }, items: I }
}

const quarterFirst = (d = today()) => { const { y, m } = parts(d); return ymd(y, Math.floor((m - 1) / 3) * 3 + 1, 1) }
const monthFirst = (d = today()) => { const { y, m } = parts(d); return ymd(y, m, 1) }

const TPL = {
  en: {
    product: {
      name: 'Product roadmap', desc: 'What we’re building over the next three quarters, by area.',
      lanes: [['Customer experience', 'sage'], ['Mobile', 'sand'], ['Platform', 'bronze'], ['Growth', 'terracotta']],
      items: [
        [0, 'Onboarding refresh', -3, 2, 'done', 'Maya', 100, ['Activation'], 'M', 'high', 'Shorter sign-up and a clearer first week.'],
        [0, 'Self-serve billing', -1, 3, 'progress', 'Leo', 45, ['Revenue'], 'L', 'high', 'Upgrade, downgrade and invoices without talking to sales.'],
        [0, 'Accessibility fixes', 1, 2, 'planned', 'Maya', 0, ['Quality'], 'S', 'medium'],
        [0, 'Personal dashboards', 4, 3, 'idea', '', 0, ['Engagement'], 'L', 'low'],
        [1, 'Mobile app beta', -2, 4, 'risk', 'Priya', 60, ['Engagement'], 'L', 'high', 'Invite-only beta with 200 customers. Push notifications are slipping.'],
        [1, 'Mobile app launch', 1, 2, 'planned', 'Priya', 0, ['Engagement'], 'M', 'high'],
        [1, 'Offline mode', 4, 2, 'idea', '', 0, ['Engagement'], 'M', 'low'],
        [2, 'Public API v2', -2, 3, 'progress', 'Sam', 70, ['Ecosystem'], 'L', 'high'],
        [2, 'Faster search', 1, 2, 'planned', 'Sam', 0, ['Quality'], 'M', 'medium'],
        [2, 'SSO and SCIM', 2, 3, 'planned', 'Ana', 0, ['Enterprise'], 'L', 'high', 'Asked for by 6 of our 10 largest prospects.'],
        [3, 'Referral programme', 0, 2, 'progress', 'Leo', 30, ['Acquisition'], 'M', 'medium'],
        [3, 'Pricing page test', 1.5, 1, 'planned', 'Leo', 0, ['Revenue'], 'S', 'low', 'Two variants, four weeks.'],
        [3, 'Partner integrations', 3, 3, 'planned', 'Ana', 0, ['Ecosystem'], 'L', 'medium'],
        [0, 'AI summaries', null, 0, 'idea', '', 0, ['Engagement'], '', '', 'Summarise long threads for busy admins.', 'later'],
        [2, 'Team workspaces', null, 0, 'idea', 'Sam', 0, ['Enterprise'], 'L', 'medium', '', 'next'],
      ],
      milestones: [['Mobile launch', 3, 1, 'release', 1], ['Quarterly business review', 2, 10, 'milestone'], ['Enterprise release', 5, 1, 'release']],
      deps: [[4, 5], [7, 12], [7, 8]],
    },
    okr: {
      name: 'Quarterly plan', desc: 'This quarter’s objectives and the initiatives that move them.',
      lanes: [['Objective 1 · Grow active teams', 'sage'], ['Objective 2 · Effortless onboarding', 'sand'], ['Objective 3 · Rock-solid reliability', 'forest']],
      items: [
        [0, 'Team invites from the app', 0, 1, 'progress', 'Leo', 50, ['KR 1.1'], 'M', 'high'],
        [0, 'Weekly digest email', 1, 1, 'planned', 'Maya', 0, ['KR 1.2'], 'S', 'medium'],
        [1, 'Guided setup checklist', 0, 2, 'progress', 'Maya', 35, ['KR 2.1'], 'M', 'high'],
        [1, 'Sample data on sign-up', 1.5, 1, 'planned', 'Priya', 0, ['KR 2.2'], 'S', 'medium'],
        [2, 'Error budget alerts', 0, 1, 'done', 'Sam', 100, ['KR 3.1'], 'S', 'high'],
        [2, 'Database failover drill', 1, 1, 'planned', 'Sam', 0, ['KR 3.2'], 'M', 'high'],
      ],
      milestones: [['Mid-quarter check-in', 1, 15, 'milestone'], ['Quarter review', 2, 25, 'milestone']],
      deps: [[4, 5]],
    },
    release: {
      name: 'Release plan', desc: 'Everything that has to land for the next release.',
      lanes: [['Design', 'sand'], ['Build', 'bronze'], ['Quality', 'sage'], ['Launch', 'terracotta']],
      items: [
        [0, 'Final designs', 0, 1, 'progress', '', 60, [], 'M', 'high'],
        [1, 'Core features', 1, 1, 'planned', '', 0, [], 'L', 'high'],
        [2, 'Regression testing', 2, 0.5, 'planned', '', 0, [], 'M', 'high'],
        [3, 'Release notes and help', 2, 0.5, 'planned', '', 0, [], 'S', 'medium'],
      ],
      milestones: [['Code freeze', 2, 1, 'milestone'], ['Release', 2, 20, 'release']],
      deps: [[0, 1], [1, 2]],
    },
    pi: {
      name: 'Quarter planning across teams', desc: 'Features per team for the planning interval, with cross-team dependencies.',
      lanes: [['Team Atlas', 'sage'], ['Team Beacon', 'sand'], ['Team Comet', 'terracotta'], ['Shared services', 'bronze']],
      items: [
        [3, 'New event pipeline', 0, 1, 'planned', '', 0, ['Feature'], 'L', 'high'],
        [0, 'Usage reports', 1, 1, 'planned', '', 0, ['Feature'], 'M', 'high'],
        [1, 'Notification centre', 0.5, 1, 'planned', '', 0, ['Feature'], 'M', 'medium'],
        [2, 'Audit log', 1.5, 1, 'planned', '', 0, ['Feature'], 'M', 'medium'],
        [0, 'Tech debt and fixes', 2, 1, 'planned', '', 0, ['Enabler'], 'S', 'low'],
      ],
      milestones: [['Planning day', 0, 3, 'milestone'], ['Interval demo', 2, 24, 'release']],
      deps: [[0, 1], [0, 3]],
    },
    blank: { name: 'New roadmap', desc: '', lanes: [['Product', 'sage'], ['Design', 'sand'], ['Engineering', 'terracotta']] },
  },
  zh: {
    product: {
      name: '产品路线图', desc: '未来三个季度按领域要做的事。',
      lanes: [['客户体验', 'sage'], ['移动端', 'sand'], ['平台', 'bronze'], ['增长', 'terracotta']],
      items: [
        [0, '新手引导改版', -3, 2, 'done', '王敏', 100, ['激活'], 'M', 'high', '注册更短，第一周更清楚。'],
        [0, '自助账单', -1, 3, 'progress', '李乐', 45, ['收入'], 'L', 'high', '升级、降级、发票都不用找销售。'],
        [0, '无障碍修复', 1, 2, 'planned', '王敏', 0, ['质量'], 'S', 'medium'],
        [0, '个人仪表盘', 4, 3, 'idea', '', 0, ['活跃'], 'L', 'low'],
        [1, '移动端内测', -2, 4, 'risk', '陈佳', 60, ['活跃'], 'L', 'high', '邀请 200 位客户内测。推送通知进度落后。'],
        [1, '移动端正式发布', 1, 2, 'planned', '陈佳', 0, ['活跃'], 'M', 'high'],
        [1, '离线模式', 4, 2, 'idea', '', 0, ['活跃'], 'M', 'low'],
        [2, '开放 API v2', -2, 3, 'progress', '张森', 70, ['生态'], 'L', 'high'],
        [2, '搜索提速', 1, 2, 'planned', '张森', 0, ['质量'], 'M', 'medium'],
        [2, 'SSO 与 SCIM', 2, 3, 'planned', '赵安', 0, ['企业'], 'L', 'high', '10 个最大潜在客户里有 6 个提过。'],
        [3, '推荐有礼', 0, 2, 'progress', '李乐', 30, ['获客'], 'M', 'medium'],
        [3, '定价页实验', 1.5, 1, 'planned', '李乐', 0, ['收入'], 'S', 'low', '两个版本，测四周。'],
        [3, '合作伙伴集成', 3, 3, 'planned', '赵安', 0, ['生态'], 'L', 'medium'],
        [0, 'AI 摘要', null, 0, 'idea', '', 0, ['活跃'], '', '', '帮忙碌的管理员总结长讨论。', 'later'],
        [2, '团队空间', null, 0, 'idea', '张森', 0, ['企业'], 'L', 'medium', '', 'next'],
      ],
      milestones: [['移动端发布', 3, 1, 'release', 1], ['季度业务回顾', 2, 10, 'milestone'], ['企业版发布', 5, 1, 'release']],
      deps: [[4, 5], [7, 12], [7, 8]],
    },
    okr: {
      name: '季度计划', desc: '本季度的目标，以及推动目标的关键举措。',
      lanes: [['目标 1 · 活跃团队增长', 'sage'], ['目标 2 · 轻松上手', 'sand'], ['目标 3 · 稳定可靠', 'forest']],
      items: [
        [0, '应用内邀请队友', 0, 1, 'progress', '李乐', 50, ['KR 1.1'], 'M', 'high'],
        [0, '每周摘要邮件', 1, 1, 'planned', '王敏', 0, ['KR 1.2'], 'S', 'medium'],
        [1, '引导式设置清单', 0, 2, 'progress', '王敏', 35, ['KR 2.1'], 'M', 'high'],
        [1, '注册即带示例数据', 1.5, 1, 'planned', '陈佳', 0, ['KR 2.2'], 'S', 'medium'],
        [2, '错误预算告警', 0, 1, 'done', '张森', 100, ['KR 3.1'], 'S', 'high'],
        [2, '数据库故障切换演练', 1, 1, 'planned', '张森', 0, ['KR 3.2'], 'M', 'high'],
      ],
      milestones: [['季中检查', 1, 15, 'milestone'], ['季度复盘', 2, 25, 'milestone']],
      deps: [[4, 5]],
    },
    release: {
      name: '发布计划', desc: '下一个版本发布前必须完成的事。',
      lanes: [['设计', 'sand'], ['开发', 'bronze'], ['质量', 'sage'], ['上线', 'terracotta']],
      items: [
        [0, '最终设计稿', 0, 1, 'progress', '', 60, [], 'M', 'high'],
        [1, '核心功能', 1, 1, 'planned', '', 0, [], 'L', 'high'],
        [2, '回归测试', 2, 0.5, 'planned', '', 0, [], 'M', 'high'],
        [3, '发布说明与帮助文档', 2, 0.5, 'planned', '', 0, [], 'S', 'medium'],
      ],
      milestones: [['代码冻结', 2, 1, 'milestone'], ['正式发布', 2, 20, 'release']],
      deps: [[0, 1], [1, 2]],
    },
    pi: {
      name: '跨团队季度规划', desc: '规划周期内各团队的特性，以及跨团队依赖。',
      lanes: [['Atlas 团队', 'sage'], ['Beacon 团队', 'sand'], ['Comet 团队', 'terracotta'], ['共享服务', 'bronze']],
      items: [
        [3, '新事件管道', 0, 1, 'planned', '', 0, ['特性'], 'L', 'high'],
        [0, '用量报表', 1, 1, 'planned', '', 0, ['特性'], 'M', 'high'],
        [1, '通知中心', 0.5, 1, 'planned', '', 0, ['特性'], 'M', 'medium'],
        [2, '审计日志', 1.5, 1, 'planned', '', 0, ['特性'], 'M', 'medium'],
        [0, '技术债与修复', 2, 1, 'planned', '', 0, ['使能'], 'S', 'low'],
      ],
      milestones: [['规划日', 0, 3, 'milestone'], ['周期演示', 2, 24, 'release']],
      deps: [[0, 1], [0, 3]],
    },
    blank: { name: '新路线图', desc: '', lanes: [['产品', 'sage'], ['设计', 'sand'], ['研发', 'terracotta']] },
  },
}
export const TEMPLATE_IDS = ['product', 'okr', 'release', 'pi', 'blank']

export function fromTemplate(id, lang, withExamples = true) {
  const t = (TPL[lang] || TPL.en)[id] || (TPL[lang] || TPL.en).blank
  const first = id === 'product' ? monthFirst() : quarterFirst()
  const shape = withExamples ? t : { ...t, items: [], milestones: [], deps: [] }
  return build({ ...shape, template: id }, first).roadmap
}

export function sampleWorkspace(lang) {
  const zh = lang === 'zh'
  const product = fromTemplate('product', lang)
  const okr = fromTemplate('okr', lang)
  const day = 86400000, now = Date.now()
  const it = n => product.items.find(i => i.title === n)
  const P = zh
    ? { beta: '移动端内测', on: '新手引导改版', price: '定价页实验', sso: 'SSO 与 SCIM', priya: '陈佳', maya: '王敏', leo: '李乐', ana: '赵安' }
    : { beta: 'Mobile app beta', on: 'Onboarding refresh', price: 'Pricing page test', sso: 'SSO and SCIM', priya: 'Priya', maya: 'Maya', leo: 'Leo', ana: 'Ana' }
  const beta = it(P.beta), on = it(P.on), price = it(P.price), sso = it(P.sso)
  const log = [
    { at: now - 12 * day, who: P.maya, item: on, kind: 'status', from: 'progress', to: 'done' },
    { at: now - 6 * day, who: P.leo, item: price, kind: 'add', from: '', to: '' },
    { at: now - 4 * day, who: P.ana, item: sso, kind: 'dates', from: [addMonths(sso.start, -1), addMonths(sso.end, -1)], to: [sso.start, sso.end] },
    { at: now - 2 * day, who: P.priya, item: beta, kind: 'dates', from: [beta.start, addMonths(beta.end, -1)], to: [beta.start, beta.end] },
    { at: now - 2 * day + 60000, who: P.priya, item: beta, kind: 'status', from: 'progress', to: 'risk' },
  ].map(e => ({ id: uid(), at: e.at, wid: 'example', who: e.who, rm: product.id, item: e.item.id, title: e.item.title, kind: e.kind, from: e.from, to: e.to }))
  // `pristine` (until the first edit) lets the example follow a language switch.
  return { v: 2, name: zh ? '示例工作区' : 'Example workspace', roadmaps: [product, okr], log, example: true, pristine: lang === 'zh' ? 'zh' : 'en' }
}

// ---------- read-only snapshot links (#view=…) ----------
// The roadmap travels in the URL hash (never sent to a server): compact JSON → deflate-raw → base64url.
const b64url = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const unb64url = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out }
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())

export async function encodeShare(r) {
  const { id, created, ...rest } = r
  const compact = { v: 2, r: { ...rest, items: r.items.map(({ order, ...i }) => i) } }
  return b64url(await pipe(new TextEncoder().encode(JSON.stringify(compact)), new CompressionStream('deflate-raw')))
}
export async function decodeShare(code) {
  const c = JSON.parse(new TextDecoder().decode(await pipe(unb64url(code), new DecompressionStream('deflate-raw'))))
  if (c.v === 2) return cleanRoadmap({ ...c.r, id: 'shared' })
  if (c.v !== 1) throw new Error('version')
  // v1 links from the first PlanLift.
  const lanes = c.l.map(([name, ci]) => ({ id: uid(), name, color: (PALETTE[ci] || PALETTE[0]).hex }))
  const v1 = ['idea', 'planned', 'progress', 'done']
  const items = c.i.map(([li, title, start, end, si, note, link, order]) => ({ id: uid(), laneId: lanes[li]?.id, title, start, end, status: v1[si] || 'planned', note, link, order }))
  return cleanRoadmap({ id: 'shared', name: c.n, lanes, items })
}
export const SHARE_PREFIX = '#view='

export const duration = it => (it.start ? toDay(it.end) - toDay(it.start) : 0)
