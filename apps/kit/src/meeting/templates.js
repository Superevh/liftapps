// Meeting templates: the everyday team meetings first, then the 37-template workshop library
// from the agenda tool, mapped onto typed agenda items.
// A meeting template item is [minutes, type, activity, enTitle, enNotes, zhTitle, zhNotes].
import { TEMPLATES as WORKSHOPS, CATEGORIES as WORKSHOP_CATS } from '../agenda/templates/index.js'

export const MEETING_TEMPLATES = [
  {
    id: 'weekly', cadence: 'weekly',
    en: ['Weekly team sync', 'Check in, close last week’s actions, agree this week’s priorities and take the team’s topics.'],
    zh: ['每周团队例会', '签到、关闭上周行动项、对齐本周重点，再讨论团队提出的话题。'],
    goal: ['Leave aligned on this week’s priorities, with every open question owned.', '对本周重点达成一致，每个悬而未决的问题都有负责人。'],
    items: [
      [5, 'activity', 'checkin', 'Check-in', 'One answer each, keep it short.', '签到', '每人一句，简短即可。', 'checkin:0'],
      [5, 'activity', 'actions', 'Last week’s action items', 'Close what is done; re-plan what is stuck.', '上周行动项', '关闭已完成的，卡住的重新安排。'],
      [5, 'update', null, 'Wins and numbers', 'Headline metrics and one win worth sharing.', '成果与数据', '关键指标，加一个值得分享的成果。'],
      [10, 'discussion', null, 'Priorities this week', 'What matters most, and what we will not do.', '本周重点', '最重要的是什么，什么这周不做。'],
      [15, 'activity', 'leancoffee', 'Team topics', 'Topics people added before the meeting, most votes first.', '团队话题', '会前大家提出的话题，按票数先后讨论。'],
      [5, 'decision', null, 'Decisions and next steps', 'Read back decisions and action items with owners.', '决定与下一步', '复述决定和行动项，确认负责人。'],
    ],
  },
  {
    id: 'oneonone', cadence: 'biweekly',
    en: ['1:1', 'A recurring one-on-one: their topics first, then progress, growth and feedback.'],
    zh: ['一对一沟通', '定期一对一：先聊对方的话题，再谈进展、成长和反馈。'],
    goal: ['Help them get unblocked and grow; agree any follow-ups.', '帮对方扫清障碍、获得成长，确认后续跟进。'],
    items: [
      [5, 'discussion', null, 'How are you, really?', 'Energy, workload, anything outside work worth knowing.', '最近怎么样？', '精力、工作量，以及工作之外值得了解的事。'],
      [10, 'activity', 'leancoffee', 'Your topics', 'Their list first. Add topics any time before the meeting.', '你的话题', '先聊对方的话题，会前随时可以添加。'],
      [5, 'update', null, 'Progress and blockers', 'What moved, what is stuck, what help is needed.', '进展与障碍', '推进了什么、卡在哪里、需要什么帮助。'],
      [7, 'discussion', null, 'Growth and feedback', 'One piece of feedback each way; one growth goal.', '成长与反馈', '双向各给一条反馈，聊一个成长目标。'],
      [3, 'decision', null, 'Follow-ups', 'Who does what before next time.', '后续跟进', '下次见面前，谁做什么。'],
    ],
  },
  {
    id: 'sprintplanning', cadence: 'biweekly',
    en: ['Sprint planning', 'Sprint goal, capacity, select and plan the work, then a confidence vote.'],
    zh: ['迭代计划会', '迭代目标、容量、选择和拆解工作，最后做信心投票。'],
    goal: ['A sprint goal and a plan the whole team is confident in.', '一个全队都有信心的迭代目标和计划。'],
    items: [
      [10, 'decision', null, 'Sprint goal', 'Draft one sentence the team can rally behind.', '迭代目标', '起草一句全队都认同的话。'],
      [5, 'update', null, 'Capacity', 'Leave, support duty, carry-over work.', '容量', '休假、值班、上个迭代遗留的工作。'],
      [20, 'discussion', null, 'Select the work', 'Pull items that serve the goal; size them if needed.', '选择工作', '挑选服务于目标的条目，必要时估算。'],
      [15, 'discussion', null, 'Plan the first days', 'Break down what starts first and who picks it up.', '规划前几天', '把先开始的工作拆细，确认谁来认领。'],
      [5, 'activity', 'poll', 'Confidence vote', 'Fist of five on the plan. Talk about any score under 3.', '信心投票', '对计划举手五指投票，低于 3 分的要聊一聊。'],
      [5, 'decision', null, 'Wrap up', 'Read back the goal and the commitments.', '收尾', '复述目标和承诺。'],
    ],
  },
  {
    id: 'retrolite', cadence: 'biweekly',
    en: ['Retro-lite', 'A 30-minute retrospective: check in, vote on what to talk about, commit to one change.'],
    zh: ['轻量复盘', '30 分钟复盘：签到、投票选话题、承诺一项改进。'],
    goal: ['One improvement the team commits to, with an owner.', '全队承诺一项改进，并有负责人。'],
    items: [
      [4, 'activity', 'checkin', 'Check-in', 'Describe the last sprint as a weather forecast.', '签到', '用一种天气形容上个迭代。', 'checkin:7'],
      [3, 'activity', 'actions', 'Last retro’s actions', 'Did we do what we said?', '上次复盘的行动项', '说到做到了吗？'],
      [15, 'activity', 'leancoffee', 'What went well, what didn’t', 'Everyone adds topics, dot-vote, talk about the top ones.', '做得好的、不好的', '每人添加话题，点投票，讨论票数最高的。'],
      [6, 'decision', null, 'Pick one change', 'One experiment for next sprint, with an owner.', '选定一项改进', '下个迭代做一个实验，指定负责人。'],
      [2, 'activity', 'poll', 'Was this retro useful?', 'Fist of five, then close.', '这次复盘有用吗？', '举手五指投票，然后结束。'],
    ],
  },
  {
    id: 'decision', cadence: 'none',
    en: ['Decision meeting', 'Frame the decision, weigh the options, gauge support, decide and assign owners.'],
    zh: ['决策会', '界定问题、权衡选项、了解支持度、做出决定并指定负责人。'],
    goal: ['A clear decision, who made it, and who carries it out.', '一个清晰的决定：谁决定的，谁去执行。'],
    items: [
      [5, 'update', null, 'Frame the decision', 'What exactly are we deciding, by when, and who decides?', '界定决策', '到底要决定什么、何时决定、由谁拍板？'],
      [10, 'discussion', null, 'Options on the table', 'Each option with its strongest case.', '可选方案', '每个方案都讲清它最有力的理由。'],
      [5, 'discussion', null, 'Risks and concerns', 'What could go wrong? What would change our mind?', '风险与顾虑', '可能出什么问题？什么会让我们改变主意？'],
      [3, 'activity', 'poll', 'Gauge support', 'Fist of five on the leading option.', '了解支持度', '对领先的方案举手五指投票。'],
      [5, 'decision', null, 'Decide and record', 'State the decision in one sentence and record it.', '做出并记录决定', '用一句话说清决定并记录下来。'],
      [2, 'decision', null, 'Owners and communication', 'Who acts, and who needs to hear about it.', '负责人与沟通', '谁来执行，需要告知哪些人。'],
    ],
  },
  {
    id: 'kickoffmeeting', cadence: 'none',
    en: ['Project kickoff', 'Introductions, why, scope, risks and ways of working.'],
    zh: ['项目启动会', '介绍、目标、范围、风险和协作方式。'],
    goal: ['Shared understanding of why, what and how, and the first owners.', '对为什么、做什么、怎么做形成共识，并确定首批负责人。'],
    items: [
      [10, 'activity', 'checkin', 'Welcome and introductions', 'Name, role, and what you want to get out of this.', '欢迎与介绍', '名字、角色，以及你希望从中得到什么。', 'checkin:6'],
      [10, 'update', null, 'Why this project', 'The problem, who it helps, how we will know it worked.', '为什么做这个项目', '要解决的问题、帮助谁、怎样算成功。'],
      [15, 'discussion', null, 'Scope: in and out', 'List what is in, what is out, and what is unsure.', '范围：做与不做', '列出要做的、不做的、还不确定的。'],
      [10, 'discussion', null, 'Risks and assumptions', 'Write them down, then vote on the scariest three.', '风险与假设', '写下来，投票选出最担心的三个。'],
      [10, 'decision', null, 'Ways of working', 'Rituals, tools, how we decide, who to ask.', '协作方式', '例会、工具、决策方式、找谁。'],
      [5, 'decision', null, 'Next steps', 'Owners and dates.', '下一步', '负责人和时间。'],
    ],
  },
  {
    id: 'brainstorm', cadence: 'none',
    en: ['Brainstorm', 'Warm up, frame the challenge, add ideas, vote, and pick what to try.'],
    zh: ['头脑风暴', '热身、界定挑战、提出想法、投票，选出要尝试的方向。'],
    goal: ['Two or three ideas worth trying, each with an owner.', '两三个值得尝试的想法，每个都有负责人。'],
    items: [
      [5, 'activity', 'checkin', 'Warm-up', 'A quick, playful question to loosen up.', '热身', '一个轻松有趣的问题，让大家放松。', 'quick:5'],
      [5, 'update', null, 'Frame the challenge', 'Write it as “How might we…?” and agree the constraints.', '界定挑战', '写成“我们可以如何……？”并确认限制条件。'],
      [15, 'activity', 'leancoffee', 'Ideas and dot-voting', 'Add ideas silently first, then vote and talk about the top ones.', '想法与点投票', '先各自安静写想法，再投票讨论票数最高的。'],
      [10, 'discussion', null, 'Build on the best', 'Combine and sharpen the top ideas.', '深化最佳想法', '组合并打磨票数最高的想法。'],
      [5, 'decision', null, 'Pick what to try', 'Choose two or three, each with an owner and a first step.', '选定要尝试的', '选两三个，每个都有负责人和第一步。'],
      [5, 'activity', 'parking', 'Parking lot', 'Decide what happens to everything we parked.', '停车场', '决定之前暂放的话题怎么处理。'],
    ],
  },
  {
    id: 'standup', cadence: 'daily',
    en: ['Daily stand-up', '15 minutes: progress toward the goal, blockers, and a parking lot for the rest.'],
    zh: ['每日站会', '15 分钟：目标进展、障碍，其余话题放进停车场。'],
    goal: ['Everyone knows what moves the goal today and what is blocked.', '每个人都知道今天怎样推进目标、哪里受阻。'],
    items: [
      [10, 'update', null, 'Progress and plans', 'Walk the board right to left: what moves the goal today?', '进展与计划', '从右往左过看板：今天怎样推进目标？'],
      [2, 'discussion', null, 'Blockers', 'Name them, give each an owner.', '障碍', '说出来，每个都指定负责人。'],
      [3, 'activity', 'parking', 'Parking lot', 'Who stays back for which topic.', '停车场', '哪些人留下来聊哪个话题。'],
    ],
  },
]

export const BLANK = { id: 'blank', cadence: 'none', en: ['Blank meeting', 'Start with an empty agenda'], zh: ['空白会议', '从空议程开始'], items: [] }

// Workshop blocks have no type: infer one from the title, so check-ins, votes and breaks get the right tools.
const RULES = [
  [/check-?in|warm-?up|icebreaker|签到|热身|破冰/i, 'activity', 'checkin'],
  [/parking lot|停车场|待跟进/i, 'activity', 'parking'],
  [/fist of five|confidence vote|信心投票|举手五指/i, 'activity', 'poll'],
  [/\bbreak\b|休息/i, 'break', null],
  [/decid|decision|commit|agree|pick|choose|select|vote|决定|决策|承诺|选定|投票/i, 'decision', null],
  [/recap|update|status|demo|report|context|frame|welcome|回顾|进展|演示|汇报|背景|开场|欢迎/i, 'update', null],
]
export function inferType(title) {
  for (const [re, type, activity] of RULES) if (re.test(title)) return { type, activity }
  return { type: 'discussion', activity: null }
}

export const LIBRARY = WORKSHOPS
export const LIBRARY_CATS = WORKSHOP_CATS

export function templateItems(tpl, lang) {
  if (!tpl) return []
  const zh = lang === 'zh'
  if (tpl.items) return tpl.items.map(([minutes, type, activity, enT, enN, zhT, zhN, qid]) => ({ minutes, type, activity, qid, title: zh ? zhT : enT, notes: zh ? zhN : enN }))
  return tpl.blocks.map(([minutes, enT, enN, zhT, zhN]) => ({ minutes, ...inferType(enT + ' ' + zhT), title: zh ? zhT : enT, notes: zh ? zhN : enN }))
}

export const templateMinutes = tpl => (tpl.items ? tpl.items.reduce((n, x) => n + x[0], 0) : tpl.minutes ?? 0)
export const templateById = id => (id === 'blank' ? BLANK : MEETING_TEMPLATES.find(x => x.id === id) ?? WORKSHOPS.find(x => x.id === id))

export function searchLibrary(query, cat) {
  const q = query.trim().toLowerCase()
  return WORKSHOPS.filter(x => (!cat || x.cat === cat) && (!q || [x.en[0], x.en[1], x.zh[0], x.zh[1], ...x.blocks.flatMap(b => [b[1], b[3]])].some(s => s.toLowerCase().includes(q))))
}
