// The Lift Apps catalogue. Edit this file to add an app or change its status.
// status: live (has a url, opens the app directly) | building | planned (both get an intro page at /<key>/)
const GROUPS = [
  { id: "ritual", name: "Team rituals", zh: "团队仪式", note: "The ceremonies every agile team runs", noteZh: "每个敏捷团队都会开的会", cat: "var(--c-ritual)" },
  { id: "facil", name: "Facilitation", zh: "引导与互动", note: "Workshops, meetings and live audiences", noteZh: "工作坊、会议和现场互动", cat: "var(--c-facil)" },
  { id: "plan", name: "Planning & tracking", zh: "规划与跟踪", note: "From idea to backlog to board", noteZh: "从想法到需求池再到看板", cat: "var(--c-plan)" },
  { id: "flow", name: "Flow & delivery", zh: "交付与度量", note: "Forecasts, releases and incidents", noteZh: "预测、发布和事故", cat: "var(--c-flow)" },
  { id: "team", name: "Team & knowledge", zh: "团队与知识", note: "How the team works and what it knows", noteZh: "团队怎么协作、知道些什么", cat: "var(--c-team)" },
];

const APPS = [
  { g: "ritual", key: "retro", word: "Retro", zh: "复盘", role: "Retrospectives", desc: "Themed retro boards with voting and action items. AI groups the cards and drafts the actions.", roleZh: "团队复盘", descZh: "主题复盘看板，带投票和行动项。AI 自动归类卡片、起草行动项。", status: "live", url: "https://fun-retro.com" },
  { g: "ritual", key: "point", word: "Point", zh: "估点", role: "Planning poker", desc: "Estimate stories together with cards and a simultaneous reveal.", roleZh: "计划扑克", descZh: "大家一起出牌估点、同时亮牌。", status: "live", url: "https://fun-retro.com/#/poker" },
  { g: "ritual", key: "standup", word: "Standup", zh: "站会", role: "Async standups", desc: "Yesterday, today and blockers without the meeting. Only the blockers get posted.", roleZh: "异步站会", descZh: "不开会也能收集昨天、今天和阻碍，只把阻碍推送出来。", status: "planned" },
  { g: "ritual", key: "pulse", word: "Pulse", zh: "健康度", role: "Team health checks", desc: "Run a team health check and see at a glance where the team stands.", roleZh: "团队健康度", descZh: "做一次团队健康检查，一眼看清团队现状。", status: "live", url: "https://fun-retro.com/#/health" },
  { g: "ritual", key: "topic", word: "Topic", zh: "精益咖啡", role: "Lean Coffee", desc: "Propose topics, dot-vote, and time-box the conversation.", roleZh: "精益咖啡", descZh: "提议话题、点投票、限时讨论。", status: "live", url: "https://fun-retro.com/#/leancoffee" },
  { g: "ritual", key: "kudo", word: "Kudo", zh: "致谢", role: "Kudos walls", desc: "Thank-you cards and celebration boards for farewells, launches and milestones.", roleZh: "致谢墙", descZh: "感谢卡和庆祝墙，适合欢送、上线和里程碑。", status: "live", url: "https://fun-retro.com/#/kudos" },
  { g: "facil", key: "vote", word: "Vote", zh: "投票", role: "Live polls & Q&A", desc: "Your audience joins with a code and results update live. AI clusters the questions.", roleZh: "实时投票与问答", descZh: "观众输入代码加入，结果实时更新，AI 自动归类提问。", status: "building" },
  { g: "facil", key: "quiz", word: "Quiz", zh: "竞答", role: "Live quizzes", desc: "Timed questions and a live leaderboard for icebreakers and training.", roleZh: "实时竞答", descZh: "限时答题加实时排行榜，适合破冰和培训。", status: "building" },
  { g: "facil", key: "sketch", word: "Sketch", zh: "白板", role: "Whiteboard", desc: "A hand-drawn canvas for diagrams and workshops, with ready-made agile templates.", roleZh: "在线白板", descZh: "手绘风画布，画图、开工作坊，内置敏捷模板。", status: "building" },
  { g: "facil", key: "agenda", word: "Agenda", zh: "工作坊", role: "Workshop agendas & timers", desc: "Plan a session block by block, then run it with timers. AI drafts the agenda from your goal.", roleZh: "工作坊议程与计时", descZh: "按环节排好议程再计时运行，AI 根据目标起草议程。", status: "planned" },
  { g: "plan", key: "board", word: "Board", zh: "看板", role: "Kanban boards", desc: "Lists, cards, labels and drag-and-drop, shared with the rest of the family.", roleZh: "看板", descZh: "列表、卡片、标签和拖拽，和系列里其他应用共享数据。", status: "building" },
  { g: "plan", key: "sprint", word: "Sprint", zh: "迭代", role: "Sprints & issues", desc: "Backlog, sprints and a sprint board, kept simple for small teams.", roleZh: "迭代与任务", descZh: "需求池、迭代和迭代看板，为小团队保持简单。", status: "building" },
  { g: "plan", key: "road", word: "Road", zh: "路线图", role: "Discovery & roadmaps", desc: "Capture ideas, score them and share a roadmap people can read.", roleZh: "产品探索与路线图", descZh: "收集想法、打分排序，分享一份大家看得懂的路线图。", status: "building" },
  { g: "plan", key: "story", word: "Story", zh: "故事地图", role: "User story mapping", desc: "Lay out the user journey and slice releases. AI drafts a first map from your requirements.", roleZh: "用户故事地图", descZh: "铺开用户旅程、切分发布版本，AI 根据需求文档起草第一版地图。", status: "planned" },
  { g: "plan", key: "plan", word: "Plan", zh: "联合规划", role: "PI planning", desc: "A program board for many teams, with objectives and dependency lines.", roleZh: "联合规划", descZh: "多团队的项目群看板，带目标和依赖连线。", status: "planned" },
  { g: "plan", key: "goal", word: "Goal", zh: "目标", role: "OKRs", desc: "Objectives, key results and check-ins. AI turns vague key results into measurable ones.", roleZh: "OKR", descZh: "目标、关键结果和定期跟进，AI 把模糊的 KR 改写成可衡量的。", status: "planned" },
  { g: "flow", key: "flow", word: "Flow", zh: "预测", role: "Flow metrics & forecasts", desc: "Cycle time, throughput and Monte Carlo forecasts from a simple CSV export.", roleZh: "流动度量与预测", descZh: "用一份 CSV 就能算周期时间、吞吐量和蒙特卡洛交付预测。", status: "building" },
  { g: "flow", key: "ship", word: "Ship", zh: "发布说明", role: "Release notes", desc: "Publish what shipped. AI writes the notes from merged pull requests.", roleZh: "发布说明", descZh: "发布上线内容，AI 根据合并的 PR 自动写发布说明。", status: "planned" },
  { g: "flow", key: "status", word: "Status", zh: "状态页", role: "Status pages", desc: "Public uptime and incident updates for your customers.", roleZh: "状态页", descZh: "面向客户的公开运行状态和事故通报。", status: "planned" },
  { g: "flow", key: "incident", word: "Incident", zh: "事故复盘", role: "Incident reviews", desc: "Blameless postmortems built around a clear timeline.", roleZh: "事故复盘", descZh: "以清晰时间线为核心的无责复盘。", status: "planned" },
  { g: "team", key: "team", word: "Team", zh: "团队画布", role: "Team canvas & agreements", desc: "Team charter, working agreements, skills matrix and motivators in one place.", roleZh: "团队画布与约定", descZh: "团队章程、工作约定、技能矩阵和动机卡集中在一处。", status: "building" },
  { g: "team", key: "note", word: "Note", zh: "知识库", role: "Team knowledge base", desc: "Linked notes and team docs that the other apps can point to.", roleZh: "团队知识库", descZh: "互相链接的笔记和团队文档，其他应用都能引用。", status: "building" },
];
