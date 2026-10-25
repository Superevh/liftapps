// The workshop template library: categories, the original starters, and the sets in a.js, b.js, c.js.
// A template is { id, cat, en: [name, summary], zh: [name, summary], blocks: [[minutes, enTitle, enNotes, zhTitle, zhNotes], …] }.
import A from './a.js'
import B from './b.js'
import C from './c.js'

export const CATEGORIES = [
  { id: 'scrum', en: 'Scrum events', zh: 'Scrum 事件' },
  { id: 'kickoff', en: 'Kickoff & chartering', zh: '启动与团队章程' },
  { id: 'discovery', en: 'Discovery & product', zh: '探索与产品' },
  { id: 'planning', en: 'Planning', zh: '规划' },
  { id: 'people', en: 'Team health & people', zh: '团队健康与人' },
  { id: 'decide', en: 'Problem solving & decisions', zh: '解决问题与决策' },
  { id: 'retro', en: 'Retrospective formats', zh: '复盘形式' },
  { id: 'learning', en: 'Learning & community', zh: '学习与社区' },
]

// The first starters, kept under their original ids.
const ORIGINAL = [
  {
    id: 'planning', cat: 'scrum',
    en: ['Sprint planning', 'Goal, capacity, select, plan, confidence'], zh: ['迭代计划会', '目标、容量、选择、拆解、信心'],
    blocks: [
      [10, 'Sprint goal', 'Draft one sentence the team can rally behind.', '迭代目标', '起草一句全队都认同的话。'],
      [5, 'Capacity check', 'Holidays, support duty, carry-over.', '容量确认', '休假、值班、上个迭代遗留。'],
      [20, 'Select the work', 'Pull items that serve the goal, estimate if needed.', '选择工作', '挑选服务于目标的条目，必要时估算。'],
      [15, 'Plan the first days', 'Break down what starts first.', '规划前几天', '把先开始的工作拆细。'],
      [5, 'Confidence vote', 'Fist of five on the plan.', '信心投票', '对计划做举手五指投票。'],
      [5, 'Wrap up', '', '收尾', ''],
    ],
  },
  {
    id: 'retro', cat: 'scrum',
    en: ['Sprint retrospective', 'Check-in, gather, insights, actions, close'], zh: ['迭代复盘会', '签到、收集、洞察、行动、收尾'],
    blocks: [
      [5, 'Check-in', 'One word: how are you arriving today?', '签到', '用一个词说说今天的状态。'],
      [5, 'Set the stage', 'Goal of this retro and the working agreement.', '开场', '说明本次复盘的目标和约定。'],
      [15, 'Gather data', 'What happened this sprint? Silent writing, then cluster.', '收集信息', '这个迭代发生了什么？先各自安静书写，再归类。'],
      [15, 'Generate insights', 'Pick the top themes and ask why.', '产生洞察', '选出最重要的主题，追问原因。'],
      [15, 'Decide what to do', 'One or two actions, each with an owner.', '决定行动', '定一到两个行动项，每项都有负责人。'],
      [5, 'Close', 'Quick feedback on the session.', '收尾', '对这次会议做个快速反馈。'],
    ],
  },
  {
    id: 'kickoff', cat: 'kickoff',
    en: ['Project kickoff', 'Why, scope, risks, ways of working'], zh: ['项目启动会', '目标、范围、风险、协作方式'],
    blocks: [
      [10, 'Welcome and introductions', 'Names, roles, one thing you hope for.', '欢迎与介绍', '名字、角色，以及你最期待的一件事。'],
      [15, 'Why this project', 'The problem, who it helps, how we will know it worked.', '为什么做这个项目', '要解决的问题、帮助谁、怎样算成功。'],
      [20, 'Scope: in and out', 'List what is in, what is out, and what is unsure.', '范围：做与不做', '列出要做的、不做的、还不确定的。'],
      [10, 'Break', '', '休息', ''],
      [15, 'Risks and assumptions', 'Write them down, vote on the scariest three.', '风险与假设', '写下来，投票选出最担心的三个。'],
      [15, 'Ways of working', 'Rituals, tools, decisions, who to ask.', '协作方式', '例会、工具、决策方式、找谁。'],
      [5, 'Next steps', 'Owners and dates.', '下一步', '负责人和时间。'],
    ],
  },
]

const ORDER = CATEGORIES.map(c => c.id)
export const TEMPLATES = [...ORIGINAL, ...A, ...B, ...C]
  .map((tpl, i) => ({ ...tpl, minutes: tpl.blocks.reduce((n, b) => n + b[0], 0), i }))
  .sort((x, y) => ORDER.indexOf(x.cat) - ORDER.indexOf(y.cat) || x.i - y.i)

export const BLANK = { id: 'blank', cat: null, en: ['Blank agenda', 'Start from an empty list'], zh: ['空白议程', '从空列表开始'], blocks: [], minutes: 0 }

export const templateById = id => (id === 'blank' ? BLANK : TEMPLATES.find(x => x.id === id))

export function templateBlocks(id, lang) {
  const tpl = templateById(id)
  if (!tpl) return []
  return tpl.blocks.map(([minutes, enT, enN, zhT, zhN]) => (lang === 'zh' ? { title: zhT, minutes, notes: zhN } : { title: enT, minutes, notes: enN }))
}

// Free-text search over names, summaries and block titles in both languages.
export function searchTemplates(query, cat) {
  const q = query.trim().toLowerCase()
  return TEMPLATES.filter(x => (!cat || x.cat === cat) && (!q || [x.en[0], x.en[1], x.zh[0], x.zh[1], ...x.blocks.flatMap(b => [b[1], b[3]])].some(s => s.toLowerCase().includes(q))))
}
