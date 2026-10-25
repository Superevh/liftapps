import { newSlide, SERIES } from './slides.js'

// Starter presentations. Each template builds fresh slides (new ids) in the chosen language.
// { id, icon, color, title: {en, zh}, description: {en, zh}, slides(lang) }
const pick = (lang, en, zh) => (lang === 'zh' ? zh : en)

export const TEMPLATES = [
  {
    id: 'blank',
    icon: 'plus',
    color: SERIES[9],
    title: { en: 'Blank presentation', zh: '空白演示' },
    description: { en: 'Start from one multiple choice question and build your own.', zh: '从一道选择题开始，自由搭建。' },
    slides: lang => [newSlide('mc', lang)],
  },
  {
    id: 'icebreaker',
    icon: 'sparkle',
    color: SERIES[1],
    title: { en: 'Icebreaker', zh: '破冰暖场' },
    description: { en: 'Warm up the room in five minutes: a word cloud, a fun vote and a quick quiz.', zh: '五分钟让现场热起来：词云、趣味投票和一道小抢答。' },
    slides: lang => [
      newSlide('heading', lang, { question: pick(lang, 'Welcome! Grab your phone 📱', '欢迎！请拿出手机 📱'), subtitle: pick(lang, 'Join with the code at the top of the screen', '用屏幕上方的代码加入') }),
      newSlide('wordcloud', lang, { question: pick(lang, 'Describe your week in one word', '用一个词形容你这一周'), maxEntries: 1 }),
      newSlide('mc', lang, {
        question: pick(lang, 'Coffee or tea?', '咖啡还是茶？'),
        options: pick(lang, ['Coffee ☕', 'Tea 🍵', 'Both, obviously', 'Neither — water please'], ['咖啡 ☕', '茶 🍵', '当然都要', '都不要，白开水就好']),
        chart: 'donut',
      }),
      newSlide('quiz', lang, {
        question: pick(lang, 'Which animal sleeps standing up?', '哪种动物是站着睡觉的？'),
        options: pick(lang, ['Horse', 'Cat', 'Owl', 'Dolphin'], ['马', '猫', '猫头鹰', '海豚']),
        correct: 0,
        time: 20,
      }),
      newSlide('leaderboard', lang),
    ],
  },
  {
    id: 'team-pulse',
    icon: 'pulse',
    color: SERIES[2],
    title: { en: 'Team pulse check-in', zh: '团队状态签到' },
    description: { en: 'A retro-style check-in: how the team feels, what is working and what to change.', zh: '回顾式签到：团队状态如何、什么做得好、哪里要改进。' },
    slides: lang => [
      newSlide('mc', lang, {
        question: pick(lang, 'How are you arriving today?', '你今天的状态如何？'),
        options: pick(lang, ['Energised 🔋', 'Steady 🙂', 'A bit tired 😮‍💨', 'Running on empty 🪫'], ['精力充沛 🔋', '平稳 🙂', '有点累 😮‍💨', '快没电了 🪫']),
      }),
      newSlide('scales', lang, {
        question: pick(lang, 'How true are these for our team right now?', '这些描述现在多符合我们团队？'),
        statements: pick(lang,
          ['Our goals are clear', 'I can raise problems safely', 'Our workload is sustainable', 'We help each other'],
          ['我们的目标很清晰', '我可以放心地提出问题', '工作量是可持续的', '我们会互相帮忙']),
        min: 1, max: 5,
        lowLabel: pick(lang, 'Not at all', '完全不符合'), highLabel: pick(lang, 'Completely', '完全符合'),
      }),
      newSlide('open', lang, { question: pick(lang, 'What went well since our last check-in?', '上次签到以来，什么做得好？'), maxEntries: 3 }),
      newSlide('open', lang, { question: pick(lang, 'What should we change next?', '接下来我们应该改变什么？'), maxEntries: 3 }),
      newSlide('mc', lang, {
        question: pick(lang, 'Which one should we focus on first?', '我们先聚焦哪一项？'),
        options: pick(lang, ['Fewer meetings', 'Clearer priorities', 'Better handovers', 'More time for deep work'], ['减少会议', '更清晰的优先级', '更顺畅的交接', '更多专注时间']),
      }),
    ],
  },
  {
    id: 'workshop-feedback',
    icon: 'star',
    color: SERIES[3],
    title: { en: 'Workshop feedback', zh: '工作坊反馈' },
    description: { en: 'Close a session with ratings, open feedback and where to invest next time.', zh: '用评分、开放反馈和下次投入方向来收尾。' },
    slides: lang => [
      newSlide('scales', lang, {
        question: pick(lang, 'Rate today’s workshop', '为今天的工作坊打分'),
        statements: pick(lang, ['Content was relevant to my work', 'The pace was right', 'Activities were engaging', 'I know what to do next'],
          ['内容和我的工作相关', '节奏合适', '活动有参与感', '我知道下一步该做什么']),
        min: 1, max: 5,
        lowLabel: pick(lang, 'Strongly disagree', '非常不同意'), highLabel: pick(lang, 'Strongly agree', '非常同意'),
      }),
      newSlide('mc', lang, {
        question: pick(lang, 'Which part was most useful?', '哪个环节最有用？'),
        options: pick(lang, ['The opening framework', 'Group exercises', 'Case studies', 'Q&A'], ['开场框架', '小组练习', '案例分析', '问答环节']),
      }),
      newSlide('points', lang, {
        question: pick(lang, 'Where should the next workshop spend its time?', '下次工作坊的时间该花在哪里？'),
        items: pick(lang, ['Hands-on practice', 'Theory and models', 'Real examples', 'Peer discussion'], ['动手练习', '理论与模型', '真实案例', '同伴讨论']),
        total: 100,
      }),
      newSlide('open', lang, { question: pick(lang, 'One thing you will try tomorrow', '明天你会尝试的一件事'), maxEntries: 1 }),
      newSlide('open', lang, { question: pick(lang, 'Anything else we should know?', '还有什么想告诉我们的？'), maxEntries: 2, layout: 'list' }),
    ],
  },
  {
    id: 'town-hall',
    icon: 'users',
    color: SERIES[4],
    title: { en: 'Town hall', zh: '全员大会' },
    description: { en: 'Open Q&A with upvotes, plus quick polls to take the room’s temperature.', zh: '支持点赞的开放问答，加上快速投票了解大家想法。' },
    slides: lang => [
      newSlide('heading', lang, { question: pick(lang, 'Quarterly town hall', '季度全员大会'), subtitle: pick(lang, 'Ask anything — vote up the questions you want answered', '尽管提问，为你最想听到答案的问题点赞') }),
      newSlide('mc', lang, {
        question: pick(lang, 'How confident are you in our direction for next quarter?', '你对下季度的方向有多大信心？'),
        options: pick(lang, ['Very confident', 'Fairly confident', 'Unsure', 'Worried'], ['非常有信心', '比较有信心', '不确定', '有些担心']),
        chart: 'bars',
      }),
      newSlide('qa', lang, { question: pick(lang, 'What would you like to ask the leadership team?', '你想问管理层什么问题？') }),
      newSlide('wordcloud', lang, { question: pick(lang, 'One word for how you feel after today', '用一个词形容今天之后的感受'), maxEntries: 1 }),
    ],
  },
  {
    id: 'training-quiz',
    icon: 'trophy',
    color: SERIES[0],
    title: { en: 'Training quiz', zh: '培训知识抢答' },
    description: { en: 'Check understanding with timed questions, speed scoring and a leaderboard.', zh: '限时答题、速度计分和排行榜，检验学习效果。' },
    slides: lang => [
      newSlide('heading', lang, { question: pick(lang, 'Knowledge check', '知识小测验'), subtitle: pick(lang, 'Faster correct answers earn more points', '答对越快，得分越高') }),
      newSlide('quiz', lang, {
        question: pick(lang, 'What does a good meeting agenda always include?', '一份好的会议议程一定包含什么？'),
        options: pick(lang, ['A clear goal', 'At least ten topics', 'Lunch plans', 'The attendee list only'], ['明确的目标', '至少十个议题', '午餐安排', '只有参会名单']),
        correct: 0, time: 20,
      }),
      newSlide('quiz', lang, {
        question: pick(lang, 'Which feedback is the most actionable?', '哪种反馈最具可操作性？'),
        options: pick(lang, ['“Great job!”', '“Do better next time”', '“The intro ran 10 minutes over; try timing it”', '“I didn’t like it”'],
          ['“干得好！”', '“下次做好点”', '“开场超时 10 分钟，下次试着计时”', '“我不喜欢”']),
        correct: 2, time: 30,
      }),
      newSlide('quiz', lang, {
        question: pick(lang, 'A customer reports a bug. What do you do first?', '客户报告了一个缺陷，你首先做什么？'),
        options: pick(lang, ['Reproduce it', 'Close the ticket', 'Blame the release', 'Wait for more reports'], ['复现问题', '关闭工单', '归咎于发布', '等更多人反馈']),
        correct: 0, time: 20,
      }),
      newSlide('quiz', lang, {
        question: pick(lang, 'How long should a daily stand-up usually take?', '每日站会通常应该多长？'),
        options: pick(lang, ['About 15 minutes', 'One hour', 'As long as needed', 'Two minutes'], ['15 分钟左右', '一小时', '想多久就多久', '两分钟']),
        correct: 0, time: 15,
      }),
      newSlide('quiz', lang, {
        question: pick(lang, 'Which of these is a SMART goal?', '以下哪个是 SMART 目标？'),
        options: pick(lang, ['Be more productive', 'Ship onboarding v2 to 100% of users by 30 June', 'Improve things', 'Work harder this year'],
          ['提高效率', '6 月 30 日前把新版引导上线给全部用户', '把事情做得更好', '今年更努力']),
        correct: 1, time: 30,
      }),
      newSlide('leaderboard', lang),
    ],
  },
  {
    id: 'brainstorm',
    icon: 'cloud',
    color: SERIES[5],
    title: { en: 'Brainstorm', zh: '头脑风暴' },
    description: { en: 'Go wide with ideas, then narrow down by ranking and spending points.', zh: '先发散收集想法，再通过排序和分配分数收敛。' },
    slides: lang => [
      newSlide('wordcloud', lang, { question: pick(lang, 'What comes to mind when you think of our customers?', '想到我们的客户，你脑海里浮现什么？'), maxEntries: 3 }),
      newSlide('open', lang, { question: pick(lang, 'Share an idea that could delight them', '分享一个能让他们惊喜的点子'), maxEntries: 5 }),
      newSlide('ranking', lang, {
        question: pick(lang, 'Rank these themes by impact', '按影响力给这些方向排序'),
        items: pick(lang, ['Faster onboarding', 'Personal recommendations', 'Better mobile app', 'Community events'], ['更快上手', '个性化推荐', '更好的移动端', '社区活动']),
      }),
      newSlide('points', lang, {
        question: pick(lang, 'You have 100 points. Where would you invest?', '你有 100 分，会投到哪里？'),
        items: pick(lang, ['Faster onboarding', 'Personal recommendations', 'Better mobile app', 'Community events'], ['更快上手', '个性化推荐', '更好的移动端', '社区活动']),
        total: 100,
      }),
    ],
  },
  {
    id: 'decision',
    icon: 'target',
    color: SERIES[6],
    title: { en: 'Decision making', zh: '集体决策' },
    description: { en: 'Lay out the options, then rank, weigh and vote to reach a decision together.', zh: '摆出选项，再通过排序、加权和投票一起做决定。' },
    slides: lang => [
      newSlide('bullets', lang, {
        question: pick(lang, 'The options on the table', '目前的备选方案'),
        bullets: pick(lang, ['A: Build it ourselves', 'B: Buy an off-the-shelf tool', 'C: Partner with a vendor', 'D: Wait until next quarter'],
          ['A：自己开发', 'B：购买现成工具', 'C：与供应商合作', 'D：等到下个季度']),
      }),
      newSlide('ranking', lang, {
        question: pick(lang, 'Rank the options from best to worst', '从最好到最差给方案排序'),
        items: pick(lang, ['Build it ourselves', 'Buy a tool', 'Partner with a vendor', 'Wait'], ['自己开发', '购买工具', '与供应商合作', '暂缓']),
      }),
      newSlide('points', lang, {
        question: pick(lang, 'What matters most in this decision?', '这个决定中什么最重要？'),
        items: pick(lang, ['Cost', 'Speed', 'Quality', 'Risk'], ['成本', '速度', '质量', '风险']),
        total: 100,
      }),
      newSlide('mc', lang, {
        question: pick(lang, 'Final vote: which option do we go with?', '最终投票：选择哪个方案？'),
        options: pick(lang, ['A: Build', 'B: Buy', 'C: Partner', 'D: Wait'], ['A：自己开发', 'B：购买', 'C：合作', 'D：暂缓']),
        chart: 'pie',
      }),
    ],
  },
  {
    id: 'event-nps',
    icon: 'chart',
    color: SERIES[7],
    title: { en: 'Event feedback (NPS)', zh: '活动反馈（NPS）' },
    description: { en: 'Net Promoter-style rating from 0 to 10, plus what to keep and improve.', zh: '0–10 分的净推荐值评分，加上保留和改进建议。' },
    slides: lang => [
      newSlide('scales', lang, {
        question: pick(lang, 'How likely are you to recommend this event to a friend?', '你有多大可能向朋友推荐这次活动？'),
        statements: pick(lang, ['Recommend to a friend or colleague'], ['推荐给朋友或同事']),
        min: 0, max: 10,
        lowLabel: pick(lang, 'Not at all likely', '完全不可能'), highLabel: pick(lang, 'Extremely likely', '非常可能'),
      }),
      newSlide('mc', lang, {
        question: pick(lang, 'What was the highlight?', '最大的亮点是什么？'),
        options: pick(lang, ['Speakers', 'Networking', 'Venue & food', 'Workshops'], ['演讲嘉宾', '交流认识新朋友', '场地和餐饮', '工作坊']),
      }),
      newSlide('open', lang, { question: pick(lang, 'What should we keep doing?', '哪些应该继续保持？'), maxEntries: 2 }),
      newSlide('open', lang, { question: pick(lang, 'What should we improve next time?', '下次应该改进什么？'), maxEntries: 2 }),
    ],
  },
]

export const templateById = id => TEMPLATES.find(t => t.id === id)
