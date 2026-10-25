// Team health check: a JSON document folded from an ordered log of actions (see live.js).
// Votes are keyed by a random per-browser ballot id, never by the person's id, so the shared
// document does not say who voted what.

export const LIGHTS = ['g', 'a', 'r']
export const TRENDS = ['up', 'flat', 'down']

// Our own wording for widely used health areas. Each area has a "healthy" and an "unhealthy" picture.
const SETS = {
  squad: [
    ['🚀', 'Shipping', 'Getting work into users’ hands is simple, safe and mostly automated.', 'Releasing is slow, risky or full of manual steps.'],
    ['🧭', 'Purpose', 'We know why we exist and we’re excited about where we’re heading.', 'We’re not sure what we’re for or why it matters.'],
    ['💎', 'Value', 'What we build makes a real difference for customers and the business.', 'We often build things nobody seems to need.'],
    ['⚡', 'Pace', 'Work flows. We finish things quickly with few waits or interruptions.', 'We are stuck or blocked a lot; things drag on.'],
    ['🧹', 'Code health', 'Our codebase is clean, tested and pleasant to change.', 'Technical debt slows us down and makes changes scary.'],
    ['🛠️', 'Way of working', 'Our process fits us and we keep improving it.', 'Our process gets in the way or nobody owns it.'],
    ['🎉', 'Fun', 'We enjoy working together and the energy is good.', 'It feels like a grind; morale is low.'],
    ['🌱', 'Learning', 'We learn new things all the time and have room to grow.', 'We never have time to learn anything.'],
    ['🤝', 'Support', 'Help is easy to get when we ask for it.', 'We often get stuck because nobody helps.'],
    ['🎮', 'Ownership', 'We decide what to build and how to build it.', 'We just follow orders; decisions are made elsewhere.'],
  ],
  team: [
    ['👑', 'Clear ownership', 'Someone clearly owns priorities and is available to the team.', 'Priorities shift and nobody owns the decisions.'],
    ['⚖️', 'Balanced team', 'We have the skills and capacity we need, and roles are clear.', 'Gaps in skills or people keep slowing us down.'],
    ['🗺️', 'Shared understanding', 'We agree on what we are doing and why.', 'People have different pictures of the goal.'],
    ['📏', 'Success measures', 'We know how we’ll measure success and we check it.', 'We don’t know whether what we did worked.'],
    ['🧩', 'Managed dependencies', 'We know who we depend on and work well with them.', 'Other teams block us and surprise us.'],
    ['⚡', 'Speed and focus', 'We move fast on a few things at a time.', 'Too much work in progress; little gets done.'],
    ['🔁', 'Continuous improvement', 'We regularly reflect and act on what we learn.', 'Retros produce actions nobody follows up.'],
    ['💬', 'Open communication', 'It’s safe to speak up, disagree and admit mistakes.', 'People hold back or conflicts stay hidden.'],
  ],
  remote: [
    ['📞', 'Staying connected', 'We feel like one team even when apart.', 'I feel isolated from my teammates.'],
    ['🕒', 'Meetings', 'Our meetings are few, focused and useful.', 'Too many meetings, too little value.'],
    ['📝', 'Async work', 'Decisions and context are written down and easy to find.', 'Important things live in people’s heads or lost chats.'],
    ['⏱️', 'Focus time', 'I get long stretches to do deep work.', 'Constant pings break my concentration.'],
    ['🏡', 'Balance', 'My workload and hours are sustainable.', 'I’m often overloaded or always online.'],
    ['🙌', 'Recognition', 'Good work gets noticed and appreciated.', 'Effort goes unseen.'],
  ],
  pulse: [
    ['😊', 'Mood', 'I’m happy with how things are going.', 'I’m frustrated or worried.'],
    ['🎯', 'Clarity', 'I know what to work on next and why.', 'I’m unsure what matters most.'],
    ['⚡', 'Momentum', 'We’re making good progress.', 'We feel stuck.'],
    ['🤝', 'Collaboration', 'We work well together.', 'We’re working in silos.'],
    ['🔋', 'Energy', 'I have energy for the coming weeks.', 'I’m running on empty.'],
  ],
}

const ZH = {
  squad: [
    ['交付发布', '把工作交到用户手里简单、安全，而且大部分是自动化的。', '发布慢、风险高、手工步骤多。'],
    ['使命', '我们清楚团队为什么存在，也对方向充满期待。', '不清楚我们的目标是什么、为什么重要。'],
    ['价值', '我们做的东西真正帮到了客户和业务。', '经常做出没人需要的东西。'],
    ['速度', '工作顺畅流动，很少等待或被打断。', '经常卡住或被阻塞，事情拖很久。'],
    ['代码健康', '代码整洁、有测试，改起来很舒服。', '技术债拖慢速度，改动让人提心吊胆。'],
    ['工作方式', '流程适合我们，并且在持续改进。', '流程碍事，或者没人负责改进。'],
    ['乐趣', '一起工作很开心，氛围很好。', '像在苦熬，士气低落。'],
    ['学习', '一直在学新东西，有成长空间。', '根本没时间学习。'],
    ['支持', '需要帮助时很容易得到。', '常常卡住却没人帮忙。'],
    ['自主', '我们自己决定做什么、怎么做。', '只是照指令办事，决定在别处做出。'],
  ],
  team: [
    ['明确负责人', '有人明确负责优先级，并且能随时和团队沟通。', '优先级常变，没人对决定负责。'],
    ['团队均衡', '我们拥有需要的技能和人手，角色清楚。', '技能或人手的缺口一直拖慢我们。'],
    ['共同理解', '大家对要做什么、为什么做看法一致。', '每个人对目标的理解都不一样。'],
    ['成功标准', '知道如何衡量成功，并且会去检查。', '不知道做的事情有没有效果。'],
    ['依赖管理', '清楚依赖谁，并且合作顺畅。', '其他团队经常阻塞或给我们“惊喜”。'],
    ['速度与专注', '同时只做少量事情，推进很快。', '在制品太多，完成得很少。'],
    ['持续改进', '定期反思并根据所学采取行动。', '复盘的行动项没人跟进。'],
    ['开放沟通', '可以放心发言、提出异议、承认错误。', '大家有所保留，冲突被掩盖。'],
  ],
  remote: [
    ['保持连接', '即使分散各地，也像一个团队。', '我感觉和队友脱节了。'],
    ['会议', '会议少而精，很有用。', '会太多，价值太少。'],
    ['异步协作', '决定和背景都有文字记录，容易找到。', '重要信息只在某人脑子里或淹没在聊天里。'],
    ['专注时间', '有大段时间做深度工作。', '不断的消息打断我的专注。'],
    ['工作平衡', '工作量和工作时长可持续。', '经常超负荷或一直在线。'],
    ['认可', '好的工作会被看到和感谢。', '付出没人看见。'],
  ],
  pulse: [
    ['心情', '我对现状感到满意。', '我感到沮丧或担心。'],
    ['清晰度', '我知道接下来做什么、为什么。', '我不确定什么最重要。'],
    ['进展', '我们进展顺利。', '我们感觉卡住了。'],
    ['协作', '我们合作得很好。', '大家各自为战。'],
    ['精力', '我对接下来几周充满精力。', '我已经筋疲力尽。'],
  ],
}

export const TEMPLATES = {
  squad: { en: ['Squad health check', 'Ten areas of a healthy product team. The classic.'], zh: ['小队健康检查', '健康产品团队的十个方面，经典之选。'] },
  team: { en: ['Team foundations', 'Eight foundations of a well-set-up team.'], zh: ['团队基础', '一个运作良好的团队的八个基础。'] },
  remote: { en: ['Remote team check', 'How well is working apart working?'], zh: ['远程团队检查', '分布式协作运作得怎么样？'] },
  pulse: { en: ['Quick pulse', 'Five questions, two minutes.'], zh: ['快速脉搏', '五个问题，两分钟。'] },
}

export function templateQuestions(id, lang) {
  return SETS[id].map(([emoji, title, good, bad], i) => {
    const zh = ZH[id][i]
    return lang === 'zh' ? { id: `${id}${i}`, emoji, title: zh[0], good: zh[1], bad: zh[2] } : { id: `${id}${i}`, emoji, title, good, bad }
  })
}

export function newCheck({ id, name, team, templateId, questions, owner, at }) {
  return {
    kind: 'health', id, name, team, templateId, createdAt: at, ownerId: owner.id,
    questions, phase: 'vote', focusId: null,
    settings: { trends: true, comments: true },
    people: { [owner.id]: { ...owner, joinedAt: at } },
    ballots: {}, actions: [],
  }
}

export function reduce(c, a) {
  if (!c) return c
  switch (a.type) {
    case 'JOIN': return { ...c, people: { ...c.people, [a.person.id]: { ...c.people[a.person.id], ...a.person, joinedAt: c.people[a.person.id]?.joinedAt ?? a.at } } }
    // One answer per area and ballot: { light, trend, note }. A null field clears it.
    case 'ANSWER': {
      if (c.phase !== 'vote' || !c.questions.some(q => q.id === a.qid)) return c
      const ballot = c.ballots[a.ballot] ?? {}
      const answer = { ...ballot[a.qid], ...a.patch }
      if (answer.note) answer.note = String(answer.note).slice(0, 500)
      return { ...c, ballots: { ...c.ballots, [a.ballot]: { ...ballot, [a.qid]: answer } } }
    }
    case 'PHASE': return { ...c, phase: a.phase, focusId: a.phase === 'discuss' ? c.focusId : null }
    case 'FOCUS': return { ...c, focusId: a.qid }
    case 'RENAME': return { ...c, name: a.name.slice(0, 80) }
    case 'SETTINGS': return { ...c, settings: { ...c.settings, ...a.patch } }
    case 'ADD_ACTION': return { ...c, actions: [...c.actions, { id: `${a.nonce}0`, text: a.text.slice(0, 300), qid: a.qid ?? null, done: false, at: a.at }] }
    case 'UPDATE_ACTION': return { ...c, actions: c.actions.map(x => x.id === a.actionId ? { ...x, ...a.patch } : x) }
    case 'DELETE_ACTION': return { ...c, actions: c.actions.filter(x => x.id !== a.actionId) }
    case 'SET_QUESTIONS': return c.phase === 'vote' && !Object.keys(c.ballots).length ? { ...c, questions: a.questions } : c
    default: return c
  }
}

// Per-area tallies. Score is 0–100: green counts 1, amber ½, red 0.
export function summarize(check) {
  const ballots = Object.values(check.ballots)
  return check.questions.map(q => {
    const answers = ballots.map(b => b[q.id]).filter(Boolean)
    const lights = { g: 0, a: 0, r: 0 }
    const trends = { up: 0, flat: 0, down: 0 }
    const notes = []
    for (const x of answers) {
      if (x.light) lights[x.light] += 1
      if (x.trend) trends[x.trend] += 1
      if (x.note) notes.push(x.note)
    }
    const n = lights.g + lights.a + lights.r
    const score = n ? Math.round(((lights.g + lights.a / 2) / n) * 100) : null
    const mood = n ? (score >= 67 ? 'g' : score >= 40 ? 'a' : 'r') : null
    const tn = trends.up + trends.flat + trends.down
    const trend = tn ? (trends.up > trends.down ? 'up' : trends.down > trends.up ? 'down' : 'flat') : null
    return { q, n, lights, trends, trend, score, mood, notes }
  })
}

export const ballotCount = check => Object.values(check.ballots).filter(b => Object.values(b).some(x => x.light)).length

export function overall(rows) {
  const scored = rows.filter(r => r.score != null)
  return scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null
}

export function checkCsv(check) {
  const q = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  const rows = summarize(check)
  return ['area,green,amber,red,score,trend_up,trend_flat,trend_down,comments',
    ...rows.map(r => [r.q.title, r.lights.g, r.lights.a, r.lights.r, r.score ?? '', r.trends.up, r.trends.flat, r.trends.down, r.notes.join(' | ')].map(x => q(String(x))).join(','))].join('\n')
}
