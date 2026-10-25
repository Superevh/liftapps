import { createContext, useContext, useEffect, useReducer } from 'react'
import { parse, evaluate } from './formula.js'
import { currentLang } from './lang.js'

const STORAGE_KEY = 'discoverylift-v1'
export const SCHEMA = 2

export const uid = () => Math.random().toString(36).slice(2, 10)

// Warm option palette (no blues, purples, neon or saturated reds).
export const COLORS = {
  stone: { bg: '#EEE7DB', fg: '#6A5A4A' },
  sand: { bg: '#F2E4CD', fg: '#7A5A32' },
  gold: { bg: '#F4E3C3', fg: '#8C613A' },
  bronze: { bg: '#EAD6BF', fg: '#6A472D' },
  sage: { bg: '#DFECE1', fg: '#3E6E57' },
  forest: { bg: '#CFE1D6', fg: '#2F5A45' },
  terracotta: { bg: '#F7DFCF', fg: '#94532F' },
  walnut: { bg: '#E4D5C6', fg: '#4A3220' },
  clay: { bg: '#F1DCD2', fg: '#86493A' },
}
export const COLOR_KEYS = Object.keys(COLORS)
export const USER_COLORS = ['#6A472D', '#3E6E57', '#8C613A', '#B5714C', '#7A6A4F', '#4F6B5C']

// Types people can create. System types (insights, insightImpact, comments, delivery) come with every project.
export const FIELD_TYPES = ['select', 'multiselect', 'rating', 'number', 'slider', 'text', 'link', 'checkbox', 'date', 'user', 'interval', 'votes', 'formula']
export const SYSTEM_TYPES = ['insights', 'insightImpact', 'comments', 'delivery']
export const NUMERIC_TYPES = ['rating', 'number', 'slider', 'formula', 'insights', 'insightImpact', 'votes', 'comments', 'checkbox', 'delivery']

const opt = (label, color, weight) => ({ id: uid(), label, color, ...(weight != null ? { weight } : {}) })

const DAY = 86400000

// The example project. Content is written in the interface language at the moment it is created.
export function seedProject(lang = currentLang()) {
  const L = (en, zh) => (lang === 'zh' ? zh : en)
  const users = [
    { id: 'u1', name: L('Avery Lin', '林悦'), color: USER_COLORS[0] },
    { id: 'u2', name: L('Jordan Reyes', '周航'), color: USER_COLORS[1] },
    { id: 'u3', name: L('Sam Okafor', '陈思'), color: USER_COLORS[2] },
    { id: 'u4', name: L('Priya Nair', '王可'), color: USER_COLORS[3] },
  ]
  const status = [opt(L('Parking lot', '待定'), 'stone'), opt(L('Discovery', '探索中'), 'gold'), opt(L('Ready to build', '待开发'), 'sand'), opt(L('Building', '开发中'), 'bronze'), opt(L('Shipped', '已上线'), 'forest'), opt(L('Not doing', '不做'), 'clay')]
  const roadmap = [opt(L('Now', '现在'), 'forest'), opt(L('Next', '下一步'), 'gold'), opt(L('Later', '以后'), 'stone')]
  const area = [opt(L('Editor', '编辑器'), 'sand'), opt(L('Collaboration', '协作'), 'sage'), opt(L('Mobile', '移动端'), 'terracotta'), opt(L('Admin', '管理后台'), 'walnut')]
  const goals = [opt(L('Retention', '留存'), 'sage', 3), opt(L('New users', '拉新'), 'terracotta', 2), opt(L('Revenue', '收入'), 'gold', 3), opt(L('Reliability', '稳定性'), 'stone', 1)]

  const N = {
    reach: L('Reach', '覆盖人数'), impact: L('Impact', '影响'), confidence: L('Confidence', '信心'), effort: L('Effort', '工作量'),
  }
  const fields = [
    { id: 'status', name: L('Status', '状态'), type: 'select', options: status, system: true },
    { id: 'roadmap', name: L('Roadmap', '路线图'), type: 'select', options: roadmap },
    { id: 'area', name: L('Product area', '产品模块'), type: 'select', options: area },
    { id: 'goals', name: L('Goals', '目标'), type: 'multiselect', options: goals, description: L('Each goal carries a weight used by the Priority score.', '每个目标都有权重，用于计算优先级得分。') },
    { id: 'reach', name: N.reach, type: 'number', description: L('People affected per quarter.', '每季度受影响的用户数。') },
    { id: 'impact', name: N.impact, type: 'rating', max: 5 },
    { id: 'confidence', name: N.confidence, type: 'rating', max: 5 },
    { id: 'effort', name: N.effort, type: 'rating', max: 5 },
    { id: 'rice', name: L('RICE score', 'RICE 得分'), type: 'formula', formula: { kind: 'expr', expr: `{${N.reach}} * {${N.impact}} * {${N.confidence}} / {${N.effort}} / 100` } },
    { id: 'priority', name: L('Priority', '优先级'), type: 'formula', formula: { kind: 'weighted', inputs: [{ field: 'impact', weight: 2 }, { field: 'goals', weight: 1 }, { field: 'insightImpact', weight: 2 }, { field: 'votes', weight: 1 }, { field: 'effort', weight: -1 }] } },
    { id: 'evidence', name: L('Evidence', '证据数'), type: 'formula', formula: { kind: 'rollup', inputs: ['insights', 'votes'] } },
    { id: 'insights', name: L('Insights', '洞察'), type: 'insights', system: true },
    { id: 'insightImpact', name: L('Insight impact', '洞察影响力'), type: 'insightImpact', system: true },
    { id: 'votes', name: L('Votes', '投票'), type: 'votes', maxPerUser: 3 },
    { id: 'comments', name: L('Comments', '评论'), type: 'comments', system: true },
    { id: 'delivery', name: L('Delivery progress', '交付进度'), type: 'delivery', system: true },
    { id: 'owner', name: L('Owner', '负责人'), type: 'user' },
    { id: 'dates', name: L('Planned dates', '计划时间'), type: 'interval' },
    { id: 'spec', name: L('Spec link', '需求文档'), type: 'link' },
    { id: 'designReady', name: L('Design ready', '设计就绪'), type: 'checkbox' },
    { id: 'risk', name: L('Risk', '风险'), type: 'slider' },
  ]

  const now = new Date()
  const month = off => { const d = new Date(now.getFullYear(), now.getMonth() + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  // [summary, description, status, roadmap, area, goals, reach, impact, effort, confidence, owner, dates, votes]
  const rows = [
    [L('Offline mode on mobile', '移动端离线模式'), L('Keep editing notes with no signal and sync when back online.', '没有网络时也能继续编辑笔记，恢复联网后自动同步。'), 3, 0, 2, [0], 4200, 5, 4, 4, 'u3', [-1, 1], { u1: 1, u2: 1, u4: 3 }],
    [L('Live co-editing', '多人实时协同编辑'), L('Several people edit one note at once and see each other’s cursors.', '多人同时编辑同一篇笔记，并能看到彼此的光标。'), 2, 0, 1, [0, 1], 3000, 5, 5, 3, 'u2', [0, 2], { u1: 1, u3: 2 }],
    [L('Note templates', '笔记模板'), L('Start a note from a small library of ready-made layouts.', '从一组现成的版式中快速新建笔记。'), 4, 0, 0, [1], 2500, 3, 2, 4, 'u1', [-2, 0], { u2: 1 }],
    [L('Summary of long notes', '长笔记自动摘要'), L('Show a short summary at the top of long notes.', '在长笔记顶部显示一段简短摘要。'), 1, 1, 0, [1, 2], 1800, 4, 3, 2, 'u1', [1, 3], { u4: 2 }],
    [L('Single sign-on for admins', '管理员单点登录'), L('Workspace admins can require sign-in through their identity provider.', '工作区管理员可以要求成员通过企业身份提供方登录。'), 2, 1, 3, [2], 600, 4, 3, 5, 'u4', [1, 2], {}],
    [L('Comments on a paragraph', '段落评论'), L('Discuss one paragraph without leaving the note.', '无需离开笔记，就能针对某一段进行讨论。'), 1, 1, 1, [0], 2200, 3, 2, 3, 'u2', [2, 3], { u3: 1 }],
    [L('Audit log export', '审计日志导出'), L('Export workspace events as CSV for compliance reviews.', '将工作区事件导出为 CSV，便于合规审查。'), 1, 1, 3, [3, 2], 300, 2, 2, 4, 'u4', [2, 3], {}],
    [L('Home screen widget', '桌面小组件'), L('Quick capture widget for phone home screens.', '手机桌面上的快速记录小组件。'), 0, 2, 2, [1], 1500, 2, 2, 2, null, [3, 4], { u2: 1 }],
    [L('View-only sharing', '只读分享'), L('Share a note as view-only, comment-only or editable.', '可将笔记分享为只读、仅评论或可编辑。'), 1, 2, 1, [0, 3], 2600, 4, 4, 3, 'u2', [4, 6], { u2: 2, u4: 1 }],
    [L('Night theme', '夜间主题'), L('A darker theme that follows the device setting.', '跟随系统设置的深色主题。'), 0, 2, 0, [0], 3500, 2, 1, 5, null, [4, 5], { u3: 3 }],
    [L('Usage-based pricing', '按用量计费'), L('Charge teams by active editors instead of seats.', '按活跃编辑人数而不是席位向团队收费。'), 0, 2, 3, [2], 800, 3, 5, 1, 'u4', [5, 7], {}],
    [L('Import from other note apps', '从其他笔记应用导入'), L('Bring notebooks, tags and attachments over in one go.', '一次性导入笔记本、标签和附件。'), 5, null, 0, [1], 1200, 3, 4, 2, null, null, {}],
  ]
  const ideas = {}
  const order = []
  rows.forEach(([summary, desc, st, rm, ar, gl, reach, imp, eff, conf, owner, dates, votes], i) => {
    const key = `NA-${i + 1}`
    ideas[key] = {
      key, summary, desc, archived: false,
      created: Date.now() - (40 - i) * DAY, updated: Date.now() - (12 - i) * 6 * 3600000,
      values: {
        status: status[st].id, roadmap: rm == null ? null : roadmap[rm].id, area: area[ar].id, goals: gl.map(g => goals[g].id),
        reach, impact: imp, effort: eff, confidence: conf, owner, votes,
        dates: dates ? { start: month(dates[0]), end: month(dates[1]) } : null,
        designReady: i % 3 === 0, risk: [30, 55, 10, 45, 20, 25, 15, 35, 40, 10, 70, 50][i],
      },
      insights: [], comments: [], delivery: [],
    }
    order.push(key)
  })
  const ins = (text, source, customer, impact, labels, ago, link = '') => ({ id: uid(), text, source, customer, impact, labels, link, at: Date.now() - ago * DAY })
  ideas['NA-1'].insights = [
    ins(L('Our field crews lose work every time they go underground. It is the main reason we are looking at other tools.', '我们的外勤人员一进地下就丢内容，这是我们在考虑换工具的主要原因。'), L('Sales call', '销售通话'), L('Regional utility company', '某区域公用事业公司'), 5, [L('Large account', '大客户')], 6),
    ins(L('The app spins forever on the train.', '在地铁上应用一直在转圈。'), L('App store review', '应用商店评论'), '', 3, [], 3),
    ins(L('38% of mobile sessions start on a weak connection.', '38% 的移动端会话开始时网络信号较弱。'), L('Product analytics', '产品数据分析'), '', 4, [L('Data', '数据')], 1),
  ]
  ideas['NA-2'].insights = [
    ins(L('We keep overwriting each other in meeting notes.', '我们在会议纪要里经常互相覆盖内容。'), L('Support ticket', '客服工单'), L('Design agency', '某设计工作室'), 4, [], 4),
    ins(L('Seeing cursors would make workshops much easier.', '能看到彼此光标的话，工作坊会顺畅很多。'), L('User interview', '用户访谈'), L('Training provider', '某培训机构'), 3, [L('Interview', '访谈')], 2),
  ]
  ideas['NA-5'].insights = [ins(L('Single sign-on is a must-have from our security team.', '单点登录是我们安全团队的硬性要求。'), L('Tender requirements', '招标需求'), L('Hospital network', '某医疗集团'), 5, [L('Large account', '大客户'), L('Blocker', '阻碍成交')], 9)]
  ideas['NA-9'].insights = [ins(L('I need to show notes to clients without letting them edit.', '我需要给客户看笔记，但不想让他们修改。'), L('Community forum', '社区论坛'), '', 2, [], 5)]
  ideas['NA-1'].delivery = [
    { id: uid(), key: 'MOB-112', summary: L('Local storage layer', '本地存储层'), status: 'done' },
    { id: uid(), key: 'MOB-113', summary: L('Sync conflict handling', '同步冲突处理'), status: 'inprogress' },
    { id: uid(), key: 'MOB-114', summary: L('Offline indicator', '离线状态提示'), status: 'todo' },
  ]
  ideas['NA-3'].delivery = [{ id: uid(), key: 'WEB-88', summary: L('Template picker', '模板选择器'), status: 'done' }, { id: uid(), key: 'WEB-89', summary: L('Template content', '模板内容'), status: 'done' }]
  ideas['NA-1'].comments = [{ id: uid(), author: 'u2', text: L('Sync conflicts are the hard part. Let’s timebox a spike first.', '同步冲突是难点，先做一个限时技术验证吧。'), at: Date.now() - 2 * DAY }]
  ideas['NA-1'].values.spec = 'https://example.com/specs/offline'

  const views = [
    { id: 'v-list', section: 'prioritize', type: 'list', name: L('All ideas', '全部想法'), about: L('Every idea with the fields we use to prioritise. Sorted by the Priority score.', '所有想法及用于排序的字段，按优先级得分排序。'),
      fields: ['status', 'impact', 'effort', 'confidence', 'reach', 'rice', 'priority', 'insights', 'votes', 'owner'], groupBy: null, sort: { field: 'priority', dir: 'desc' }, filters: [] },
    { id: 'v-matrix', section: 'prioritize', type: 'matrix', name: L('Impact vs effort', '影响 vs 工作量'), about: L('Quick wins sit top-left: high impact, low effort.', '左上角是速赢项：影响大、工作量小。'),
      fields: ['status', 'impact', 'effort'], x: 'effort', y: 'impact', size: 'insights', colorBy: 'status', sort: null, filters: [] },
    { id: 'v-vote', section: 'prioritize', type: 'list', name: L('Team vote', '团队投票'), about: L('Everyone has 3 votes. Spend them on the ideas you believe in most.', '每人 3 票，投给你最看好的想法。'),
      fields: ['votes', 'insights', 'area', 'status'], groupBy: null, sort: { field: 'votes', dir: 'desc' }, filters: [] },
    { id: 'v-board', section: 'roadmap', type: 'board', name: L('Now / Next / Later', '现在 / 下一步 / 以后'), about: L('Our roadmap for the wider team. It changes as we learn.', '面向全员的路线图，会随着我们的了解而调整。'),
      fields: ['goals', 'delivery'], groupBy: 'roadmap', swimlanes: null, sort: null, filters: [], published: true, hideEmpty: true },
    { id: 'v-timeline', section: 'roadmap', type: 'timeline', name: L('Timeline', '时间线'), about: L('When we expect to work on each idea.', '每个想法预计的开展时间。'),
      fields: ['status'], dateField: 'dates', groupBy: 'area', sort: null, filters: [] },
    { id: 'v-pipeline', section: 'discover', type: 'board', name: L('Discovery pipeline', '探索流程'), about: L('Ideas moving from parking lot to shipped.', '想法从待定到上线的流转。'),
      fields: ['impact', 'insights', 'owner'], groupBy: 'status', swimlanes: null, sort: null, filters: [] },
  ]

  return {
    schema: SCHEMA, id: uid(), example: true,
    space: { key: 'NA', name: L('Field notes app', '外勤笔记应用') },
    me: 'u1', users, fields, ideas, order, views, nextNum: rows.length + 1,
    sections: ['prioritize', 'roadmap', 'discover'],
    templates: defaultTemplates(lang),
  }
}

export function defaultTemplates(lang = currentLang()) {
  const L = (en, zh) => (lang === 'zh' ? zh : en)
  return [
    { id: uid(), name: L('Problem brief', '问题简报'), body: L('Problem\n- Who has this problem?\n- What happens today?\n\nWhy it matters\n- \n\nWhat we would measure\n- ', '问题\n- 谁遇到了这个问题？\n- 现在是怎么处理的？\n\n为什么重要\n- \n\n衡量指标\n- ') },
    { id: uid(), name: L('Feature request', '功能需求'), body: L('Request\n- \n\nWho asked\n- \n\nWorkaround today\n- \n\nOpen questions\n- ', '需求\n- \n\n提出者\n- \n\n当前的替代做法\n- \n\n待确认的问题\n- ') },
    { id: uid(), name: L('Experiment', '实验'), body: L('We believe that\n- \n\nWill result in\n- \n\nWe will know we are right when\n- ', '我们相信\n- \n\n会带来\n- \n\n当看到以下结果时说明我们是对的\n- ') },
  ]
}

export function blankProject(name, lang = currentLang()) {
  const L = (en, zh) => (lang === 'zh' ? zh : en)
  const key = (name.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'ID').toUpperCase()
  const status = [opt(L('New', '新建'), 'stone'), opt(L('Discovery', '探索中'), 'gold'), opt(L('Ready to build', '待开发'), 'sand'), opt(L('Shipped', '已上线'), 'forest'), opt(L('Not doing', '不做'), 'clay')]
  const imp = L('Impact', '影响'), eff = L('Effort', '工作量')
  return {
    schema: SCHEMA, id: uid(), space: { key, name }, me: 'u1',
    users: [{ id: 'u1', name: L('You', '我'), color: USER_COLORS[0] }],
    fields: [
      { id: 'status', name: L('Status', '状态'), type: 'select', options: status, system: true },
      { id: 'roadmap', name: L('Roadmap', '路线图'), type: 'select', options: [opt(L('Now', '现在'), 'forest'), opt(L('Next', '下一步'), 'gold'), opt(L('Later', '以后'), 'stone')] },
      { id: 'impact', name: imp, type: 'rating', max: 5 },
      { id: 'effort', name: eff, type: 'rating', max: 5 },
      { id: 'value', name: L('Value', '价值'), type: 'formula', formula: { kind: 'expr', expr: `({${imp}} * 2 + {${L('Insight impact', '洞察影响力')}}) / {${eff}}` } },
      { id: 'insights', name: L('Insights', '洞察'), type: 'insights', system: true },
      { id: 'insightImpact', name: L('Insight impact', '洞察影响力'), type: 'insightImpact', system: true },
      { id: 'votes', name: L('Votes', '投票'), type: 'votes', maxPerUser: 3 },
      { id: 'comments', name: L('Comments', '评论'), type: 'comments', system: true },
      { id: 'delivery', name: L('Delivery progress', '交付进度'), type: 'delivery', system: true },
      { id: 'owner', name: L('Owner', '负责人'), type: 'user' },
      { id: 'dates', name: L('Planned dates', '计划时间'), type: 'interval' },
    ],
    ideas: {}, order: [], nextNum: 1, sections: ['prioritize', 'roadmap', 'discover'],
    views: [
      { id: uid(), section: 'prioritize', type: 'list', name: L('All ideas', '全部想法'), about: '', fields: ['status', 'impact', 'effort', 'value', 'insights', 'votes', 'owner'], groupBy: null, sort: { field: 'value', dir: 'desc' }, filters: [] },
      { id: uid(), section: 'roadmap', type: 'board', name: L('Roadmap', '路线图'), about: '', fields: ['impact', 'delivery'], groupBy: 'roadmap', swimlanes: null, sort: null, filters: [] },
    ],
    templates: defaultTemplates(lang),
  }
}

// ---------- workspace (many projects) ----------

function emptyWorkspace() {
  const p = seedProject()
  return { current: p.id, projects: { [p.id]: p } }
}

export function validProject(p) {
  return p && typeof p === 'object' && p.space && Array.isArray(p.fields) && p.ideas && typeof p.ideas === 'object' && Array.isArray(p.views) && Array.isArray(p.order)
}

// Fill anything an older or hand-edited file may be missing.
export function normalizeProject(p) {
  const out = { ...p }
  out.id = out.id || uid()
  out.users = Array.isArray(out.users) && out.users.length ? out.users : [{ id: 'u1', name: 'You', color: USER_COLORS[0] }]
  out.me = out.users.some(u => u.id === out.me) ? out.me : out.users[0].id
  out.sections = Array.isArray(out.sections) && out.sections.length ? out.sections : ['prioritize', 'roadmap', 'discover']
  out.templates = Array.isArray(out.templates) ? out.templates : []
  out.nextNum = out.nextNum || out.order.length + 1
  if (!out.fields.some(f => f.id === 'status')) out.fields = [{ id: 'status', name: 'Status', type: 'select', options: [opt('New', 'stone')], system: true }, ...out.fields]
  for (const t of SYSTEM_TYPES) if (!out.fields.some(f => f.type === t)) out.fields = [...out.fields, { id: t, name: t[0].toUpperCase() + t.slice(1), type: t, system: true }]
  const ideas = {}
  for (const [k, i] of Object.entries(out.ideas)) {
    ideas[k] = { archived: false, desc: '', values: {}, insights: [], comments: [], delivery: [], created: Date.now(), updated: Date.now(), ...i, key: k }
    ideas[k].insights = ideas[k].insights.map(x => ({ labels: [], impact: null, link: '', ...x }))
  }
  out.ideas = ideas
  out.order = out.order.filter(k => ideas[k])
  for (const k of Object.keys(ideas)) if (!out.order.includes(k)) out.order.push(k)
  out.views = out.views.map(v => ({ fields: [], filters: [], sort: null, about: '', ...v, section: out.sections.includes(v.section) ? v.section : out.sections[0] }))
  out.schema = SCHEMA
  return out
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const ws = JSON.parse(raw)
      if (ws && ws.projects && Object.keys(ws.projects).length) {
        const projects = {}
        for (const [id, p] of Object.entries(ws.projects)) if (validProject(p)) projects[id] = normalizeProject({ ...p, id })
        const ids = Object.keys(projects)
        if (ids.length) return { current: projects[ws.current] ? ws.current : ids[0], projects }
      }
    }
  } catch { /* fall through to seed */ }
  return emptyWorkspace()
}

const touch = idea => ({ ...idea, updated: Date.now() })

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function projectReducer(s, a) {
  const setIdea = (key, fn) => (s.ideas[key] ? { ...s, ideas: { ...s.ideas, [key]: touch(fn(s.ideas[key])) } } : s)
  const setField = (id, fn) => ({ ...s, fields: s.fields.map(f => (f.id === id ? fn(f) : f)) })
  switch (a.type) {
    case 'CREATE_IDEA': {
      const key = `${s.space.key}-${s.nextNum}`
      const status = s.fields.find(f => f.id === 'status')?.options[0]?.id ?? null
      const idea = { key, summary: a.summary, desc: a.desc ?? '', archived: false, created: Date.now(), updated: Date.now(),
        values: { status, ...a.values }, insights: [], comments: [], delivery: [] }
      return { ...s, nextNum: s.nextNum + 1, ideas: { ...s.ideas, [key]: idea }, order: [...s.order, key], lastCreated: key }
    }
    case 'UPDATE_IDEA':
      return setIdea(a.key, i => ({ ...i, ...a.patch }))
    case 'SET_VALUE':
      return setIdea(a.key, i => ({ ...i, values: { ...i.values, [a.field]: a.value } }))
    case 'ARCHIVE_IDEA':
      return setIdea(a.key, i => ({ ...i, archived: a.archived }))
    case 'DELETE_IDEA': {
      const ideas = { ...s.ideas }
      delete ideas[a.key]
      return { ...s, ideas, order: s.order.filter(k => k !== a.key) }
    }
    case 'RANK_IDEA': {
      const order = s.order.filter(k => k !== a.key)
      const at = a.beforeKey ? order.indexOf(a.beforeKey) : -1
      order.splice(at === -1 ? order.length : at, 0, a.key)
      return { ...s, order }
    }
    case 'VOTE': {
      const f = s.fields.find(x => x.id === a.field)
      if (!f) return s
      return setIdea(a.key, i => {
        const votes = { ...(i.values[a.field] ?? {}) }
        const usedElsewhere = Object.values(s.ideas).filter(x => x.key !== a.key && !x.archived).reduce((n, x) => n + (x.values[a.field]?.[s.me] ?? 0), 0)
        const mine = votes[s.me] ?? 0
        const next = Math.max(0, mine + a.delta)
        if (a.delta > 0 && usedElsewhere + next > (f.maxPerUser ?? 3)) return i
        if (next) votes[s.me] = next; else delete votes[s.me]
        return { ...i, values: { ...i.values, [a.field]: votes } }
      })
    }
    case 'ADD_INSIGHT':
      return setIdea(a.key, i => ({ ...i, insights: [{ id: uid(), at: Date.now(), labels: [], impact: null, link: '', ...a.insight }, ...i.insights] }))
    case 'UPDATE_INSIGHT':
      return setIdea(a.key, i => ({ ...i, insights: i.insights.map(x => (x.id === a.id ? { ...x, ...a.patch } : x)) }))
    case 'DELETE_INSIGHT':
      return setIdea(a.key, i => ({ ...i, insights: i.insights.filter(x => x.id !== a.id) }))
    case 'ADD_COMMENT':
      return setIdea(a.key, i => ({ ...i, comments: [...i.comments, { id: uid(), author: s.me, text: a.text, at: Date.now() }] }))
    case 'DELETE_COMMENT':
      return setIdea(a.key, i => ({ ...i, comments: i.comments.filter(c => c.id !== a.id) }))
    case 'ADD_DELIVERY':
      return setIdea(a.key, i => ({ ...i, delivery: [...i.delivery, { id: uid(), status: 'todo', ...a.item }] }))
    case 'UPDATE_DELIVERY':
      return setIdea(a.key, i => ({ ...i, delivery: i.delivery.map(d => (d.id === a.id ? { ...d, ...a.patch } : d)) }))
    case 'DELETE_DELIVERY':
      return setIdea(a.key, i => ({ ...i, delivery: i.delivery.filter(d => d.id !== a.id) }))
    case 'CREATE_VIEW': {
      const id = uid()
      const base = { id, section: a.section, type: a.viewType, name: a.name, about: '', fields: ['status'], sort: null, filters: [] }
      const numeric = s.fields.filter(f => ['rating', 'number', 'slider'].includes(f.type)).map(f => f.id)
      const sel = s.fields.find(f => f.type === 'select')?.id ?? 'status'
      const extra = {
        list: { fields: ['status', ...numeric.slice(0, 3), 'insights'], groupBy: null },
        board: { groupBy: sel, swimlanes: null, fields: [...numeric.slice(0, 1), 'insights'] },
        matrix: { x: numeric[1] ?? numeric[0] ?? 'insights', y: numeric[0] ?? 'insights', size: 'insights', colorBy: 'status' },
        timeline: { dateField: s.fields.find(f => f.type === 'interval')?.id ?? null, groupBy: null },
      }[a.viewType]
      return { ...s, views: [...s.views, { ...base, ...extra }], lastView: id }
    }
    case 'DUPLICATE_VIEW': {
      const v = s.views.find(x => x.id === a.id)
      if (!v) return s
      const id = uid()
      return { ...s, views: [...s.views, { ...structuredClone(v), id, name: a.name, published: false }], lastView: id }
    }
    case 'UPDATE_VIEW':
      return { ...s, views: s.views.map(v => (v.id === a.id ? { ...v, ...a.patch } : v)) }
    case 'DELETE_VIEW':
      return { ...s, views: s.views.filter(v => v.id !== a.id) }
    case 'CREATE_FIELD': {
      const id = uid()
      const t = a.field?.type ?? a.fieldType
      const field = a.field ? { ...a.field, id } : { id, name: a.name, type: t,
        ...(t === 'rating' ? { max: 5 } : {}),
        ...(t === 'votes' ? { maxPerUser: a.maxPerUser ?? 3 } : {}),
        ...(t === 'formula' ? { formula: a.formula ?? { kind: 'rollup', inputs: [] } } : {}),
        ...(t === 'select' || t === 'multiselect' ? { options: (a.options ?? []).map((l, i) => opt(l, COLOR_KEYS[(i + 1) % COLOR_KEYS.length], 1)) } : {}) }
      return {
        ...s,
        fields: [...s.fields, field],
        views: a.viewId ? s.views.map(v => (v.id === a.viewId ? { ...v, fields: [...v.fields, id] } : v)) : s.views,
        lastField: id,
      }
    }
    case 'UPDATE_FIELD': {
      const old = s.fields.find(f => f.id === a.id)
      if (!old) return s
      let fields = s.fields.map(f => (f.id === a.id ? { ...f, ...a.patch } : f))
      // Keep custom formulas working when a field they reference is renamed.
      if (a.patch.name && a.patch.name !== old.name) {
        const re = new RegExp(`\\{\\s*${escapeRe(old.name)}\\s*\\}`, 'gi')
        fields = fields.map(f => (f.type === 'formula' && f.formula?.kind === 'expr' ? { ...f, formula: { ...f.formula, expr: f.formula.expr.replace(re, `{${a.patch.name}}`) } } : f))
      }
      return { ...s, fields }
    }
    case 'DELETE_FIELD': {
      const f = s.fields.find(x => x.id === a.id)
      if (!f || f.system) return s
      const ideas = {}
      for (const [k, i] of Object.entries(s.ideas)) { const values = { ...i.values }; delete values[a.id]; ideas[k] = { ...i, values } }
      return {
        ...s, ideas,
        fields: s.fields.filter(x => x.id !== a.id).map(x => (x.type === 'formula' && x.formula?.inputs
          ? { ...x, formula: { ...x.formula, inputs: x.formula.inputs.filter(inp => (inp.field ?? inp) !== a.id) } } : x)),
        views: s.views.map(v => ({
          ...v, fields: v.fields.filter(id => id !== a.id), filters: (v.filters ?? []).filter(x => x.field !== a.id),
          sort: v.sort?.field === a.id ? null : v.sort, groupBy: v.groupBy === a.id ? null : v.groupBy, swimlanes: v.swimlanes === a.id ? null : v.swimlanes,
          size: v.size === a.id ? null : v.size,
        })),
      }
    }
    case 'ADD_OPTION':
      return setField(a.field, f => ({ ...f, options: [...f.options, opt(a.label, COLOR_KEYS[(f.options.length + 1) % COLOR_KEYS.length], 1)] }))
    case 'UPDATE_OPTION':
      return setField(a.field, f => ({ ...f, options: f.options.map(o => (o.id === a.id ? { ...o, ...a.patch } : o)) }))
    case 'MOVE_OPTION':
      return setField(a.field, f => {
        const options = [...f.options]
        const i = options.findIndex(o => o.id === a.id)
        const j = i + a.dir
        if (i < 0 || j < 0 || j >= options.length) return f
        ;[options[i], options[j]] = [options[j], options[i]]
        return { ...f, options }
      })
    case 'DELETE_OPTION': {
      const next = setField(a.field, f => ({ ...f, options: f.options.filter(o => o.id !== a.id) }))
      const ideas = {}
      for (const [k, i] of Object.entries(next.ideas)) {
        const v = i.values[a.field]
        ideas[k] = Array.isArray(v) ? { ...i, values: { ...i.values, [a.field]: v.filter(x => x !== a.id) } }
          : v === a.id ? { ...i, values: { ...i.values, [a.field]: null } } : i
      }
      return { ...next, ideas }
    }
    case 'SET_ME':
      return { ...s, me: a.id }
    case 'ADD_USER':
      return { ...s, users: [...s.users, { id: uid(), name: a.name, color: USER_COLORS[s.users.length % USER_COLORS.length] }] }
    case 'UPDATE_SPACE':
      return { ...s, space: { ...s.space, ...a.patch } }
    case 'ADD_TEMPLATE':
      return { ...s, templates: [...s.templates, { id: uid(), name: a.name, body: a.body ?? '' }] }
    case 'UPDATE_TEMPLATE':
      return { ...s, templates: s.templates.map(t => (t.id === a.id ? { ...t, ...a.patch } : t)) }
    case 'DELETE_TEMPLATE':
      return { ...s, templates: s.templates.filter(t => t.id !== a.id) }
    default:
      return s
  }
}

function reducer(ws, a) {
  switch (a.type) {
    case 'SWITCH_PROJECT':
      return ws.projects[a.id] ? { ...ws, current: a.id } : ws
    case 'NEW_PROJECT': {
      const p = a.example ? seedProject() : blankProject(a.name)
      return { current: p.id, projects: { ...ws.projects, [p.id]: p } }
    }
    case 'IMPORT_PROJECT': {
      const p = normalizeProject({ ...a.project, id: uid() })
      const names = Object.values(ws.projects).map(x => x.space.name)
      for (let n = 2; names.includes(p.space.name); n++) p.space = { ...p.space, name: `${a.project.space.name} (${n})` }
      return { current: p.id, projects: { ...ws.projects, [p.id]: p } }
    }
    case 'DELETE_PROJECT': {
      const projects = { ...ws.projects }
      delete projects[a.id]
      if (!Object.keys(projects).length) return emptyWorkspace()
      return { current: projects[ws.current] ? ws.current : Object.keys(projects)[0], projects }
    }
    case 'RESET_EXAMPLE': {
      const p = { ...seedProject(), id: ws.current }
      return { ...ws, projects: { ...ws.projects, [ws.current]: p } }
    }
    default: {
      const cur = ws.projects[ws.current]
      const next = projectReducer(cur, a)
      return next === cur ? ws : { ...ws, projects: { ...ws.projects, [ws.current]: next } }
    }
  }
}

const Ctx = createContext(null)

const strip = p => { const { lastView, lastField, lastCreated, ...rest } = p; return rest }

export function StoreProvider({ children }) {
  const [ws, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      const projects = {}
      for (const [id, p] of Object.entries(ws.projects)) projects[id] = strip(p)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: ws.current, projects }))
    } catch { /* storage full or blocked */ }
  }, [ws])
  return <Ctx.Provider value={{ state: ws.projects[ws.current], ws, dispatch }}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
export const exportable = p => ({ app: 'discoverylift', ...strip(p) })

export const fieldById = (state, id) => state.fields.find(f => f.id === id)
export const userById = (state, id) => state.users.find(u => u.id === id)
export const optionById = (field, id) => field?.options?.find(o => o.id === id)
export const fieldByName = (state, name) => state.fields.find(f => f.name.trim().toLowerCase() === name.trim().toLowerCase())

// ---------- computed values ----------

const astCache = new Map()
function ast(expr) {
  if (!astCache.has(expr)) { try { astCache.set(expr, parse(expr)) } catch { astCache.set(expr, null) } }
  return astCache.get(expr)
}

const rangeCache = new WeakMap()
function rangeOf(state, fieldId, depth) {
  let m = rangeCache.get(state)
  if (!m) { m = new Map(); rangeCache.set(state, m) }
  if (!m.has(fieldId)) {
    const vals = Object.values(state.ideas).filter(i => !i.archived).map(i => numeric(state, i, fieldId, depth + 1)).filter(v => v != null)
    const max = vals.length ? Math.max(...vals) : 0
    const min = vals.length ? Math.min(0, ...vals) : 0
    m.set(fieldId, { min, max })
  }
  return m.get(fieldId)
}

const round = v => (v == null ? null : Math.round(v * 10) / 10)

function formulaValue(state, idea, f, depth) {
  if (depth > 6) return null // guards against formulas that reference each other
  const fm = f.formula ?? {}
  if (fm.kind === 'expr') {
    const tree = ast(fm.expr ?? '')
    if (!tree) return null
    return round(evaluate(tree, name => { const ref = fieldByName(state, name); return ref && ref.id !== f.id ? numeric(state, idea, ref.id, depth + 1) : null }))
  }
  if (fm.kind === 'rollup') {
    const inputs = (fm.inputs ?? []).filter(id => id !== f.id)
    if (!inputs.length) return null
    return round(inputs.reduce((sum, id) => sum + (numeric(state, idea, id, depth + 1) ?? 0), 0))
  }
  if (fm.kind === 'weighted') {
    // Each input is scaled 0-100 against every active idea in the project, then weighted.
    // Negative weights pull the score down. The result stays within 0-100.
    const inputs = (fm.inputs ?? []).filter(x => x.field !== f.id && x.weight)
    const pos = inputs.filter(x => x.weight > 0).reduce((n, x) => n + x.weight, 0)
    if (!pos) return null
    let score = 0
    for (const x of inputs) {
      const { min, max } = rangeOf(state, x.field, depth)
      const v = numeric(state, idea, x.field, depth + 1) ?? min
      const norm = max > min ? ((v - min) / (max - min)) * 100 : v > 0 ? 100 : 0
      score += x.weight * norm
    }
    return Math.round(Math.min(100, Math.max(0, score / pos)))
  }
  return null
}

// Number used by formulas, matrix axes and number filters.
export function numeric(state, idea, fieldId, depth = 0) {
  const f = fieldById(state, fieldId)
  if (!f) return null
  const v = idea.values[fieldId]
  switch (f.type) {
    case 'rating': case 'number': case 'slider': return v ?? null
    case 'checkbox': return v ? 1 : 0
    case 'select': { const o = optionById(f, v); return o ? (o.weight ?? f.options.indexOf(o) + 1) : null }
    case 'multiselect': return (v ?? []).reduce((n, id) => n + (optionById(f, id)?.weight ?? 1), 0)
    case 'insights': return idea.insights.length
    case 'insightImpact': return idea.insights.reduce((n, x) => n + (x.impact ?? 1), 0)
    case 'comments': return idea.comments.length
    case 'votes': return Object.values(v ?? {}).reduce((n, x) => n + x, 0)
    case 'delivery': return idea.delivery.length ? Math.round((idea.delivery.filter(d => d.status === 'done').length / idea.delivery.length) * 100) : null
    case 'formula': return formulaValue(state, idea, f, depth)
    default: return null
  }
}

// Display/stored value for a field on an idea.
export function getValue(state, idea, fieldId) {
  const f = fieldById(state, fieldId)
  if (!f) return null
  switch (f.type) {
    case 'insights': case 'insightImpact': case 'comments': case 'formula': case 'votes': return numeric(state, idea, fieldId)
    case 'delivery': {
      const n = idea.delivery.length
      return n ? { done: idea.delivery.filter(d => d.status === 'done').length, inprogress: idea.delivery.filter(d => d.status === 'inprogress').length, total: n } : null
    }
    default: return idea.values[fieldId] ?? null
  }
}

export function sortValue(state, idea, fieldId) {
  const f = fieldById(state, fieldId)
  if (!f) return null
  const v = getValue(state, idea, fieldId)
  if (v == null) return null
  if (f.type === 'select') return f.options.findIndex(o => o.id === v)
  if (f.type === 'multiselect') return numeric(state, idea, fieldId)
  if (f.type === 'user') return userById(state, v)?.name ?? ''
  if (f.type === 'interval') return v.start
  if (f.type === 'delivery') return v.done / v.total
  if (f.type === 'text' || f.type === 'link') return String(v).toLowerCase()
  if (f.type === 'checkbox') return v ? 1 : 0
  return v
}

// Buckets an idea can fall into for grouping (list groups, board columns/swimlanes, timeline groups).
export const groupable = f => ['select', 'user', 'checkbox'].includes(f.type)
export function bucketsFor(state, field) {
  if (field.type === 'select') return [...field.options.map(o => ({ id: o.id, option: o })), { id: null }]
  if (field.type === 'user') return [...state.users.map(u => ({ id: u.id, user: u })), { id: null }]
  if (field.type === 'checkbox') return [{ id: true, check: true }, { id: false, check: false }]
  return [{ id: null }]
}
export const bucketOf = (state, idea, field) => (field.type === 'checkbox' ? !!idea.values[field.id] : getValue(state, idea, field.id) ?? null)

export function applyFiltersAndSort(state, view, ideas) {
  let out = ideas.filter(i => (view.archive ? i.archived : !i.archived))
  for (const flt of view.filters ?? []) {
    if (flt.field === '__text') {
      const q = flt.values?.[0]?.toLowerCase() ?? ''
      if (q) out = out.filter(i => `${i.key} ${i.summary} ${i.desc}`.toLowerCase().includes(q))
      continue
    }
    const f = fieldById(state, flt.field)
    if (!f) continue
    if (flt.min != null || flt.max != null) {
      out = out.filter(i => {
        const v = numeric(state, i, flt.field)
        if (v == null) return false
        return (flt.min == null || v >= flt.min) && (flt.max == null || v <= flt.max)
      })
      continue
    }
    if (!flt.values?.length) continue
    out = out.filter(i => {
      if (f.type === 'checkbox') return flt.values.includes(i.values[f.id] ? 'yes' : 'no')
      const v = getValue(state, i, flt.field)
      if (Array.isArray(v)) return flt.values.some(x => v.includes(x)) || (!v.length && flt.values.includes('__none'))
      return flt.values.includes(v ?? '__none')
    })
  }
  if (view.sort?.field) {
    const dir = view.sort.dir === 'desc' ? -1 : 1
    out = [...out].sort((a, b) => {
      const va = sortValue(state, a, view.sort.field)
      const vb = sortValue(state, b, view.sort.field)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
  }
  return out
}

export const orderedIdeas = state => state.order.map(k => state.ideas[k]).filter(Boolean)
