// The Lift Apps lineup: one source for the site build, intro pages and every app's top bar.
// Order follows the delivery cycle: why → what → when → how big → meet → learn.
// status: live (stable) | beta (usable, still changing) | soon (intro page only)
// href: where "Open" goes. Apps hosted here live at /<key>/app/; RetroLift runs on fun-retro.com.

export const STAGES = [
  { id: "strategy", en: "Why", zh: "为什么做" },
  { id: "discover", en: "What", zh: "做什么" },
  { id: "plan", en: "When", zh: "什么时候做" },
  { id: "estimate", en: "How big", zh: "有多大" },
  { id: "collab", en: "Work together", zh: "一起协作" },
  { id: "team", en: "How the team is", zh: "团队状态" },
  { id: "learn", en: "What we learned", zh: "学到什么" },
];

export const APPS = [
  {
    key: "goal", word: "Goal", stage: "strategy", status: "beta", href: "/goal/app/",
    en: { label: "OKRs", line: "Set company, department, team and personal OKRs, and see how they line up.",
      feats: ["Four clear levels: company, department, team and personal", "Alignment tree from each key result up to the company goal", "Weekly check-ins with progress and confidence", "Quarter review and scoring"] },
    zh: { label: "OKR 目标", line: "制定公司、部门、团队和个人四级 OKR，一眼看清彼此如何对齐。",
      feats: ["公司、部门、团队、个人四级，界线清晰", "从每个关键结果一路对齐到公司目标的对齐树", "每周跟进进度和信心", "季度复盘与评分"] },
  },
  {
    key: "discovery", word: "Discovery", stage: "discover", status: "beta", href: "/discovery/app/",
    en: { label: "Product discovery", line: "Capture ideas, score them and decide what to build next.",
      feats: ["One place for ideas from customers and the team", "Impact, effort and confidence scoring", "List, board, matrix and timeline views", "Insights linked to each idea"] },
    zh: { label: "产品探索", line: "收集想法、打分排序，决定下一步做什么。",
      feats: ["集中收集客户和团队的想法", "影响、投入、信心打分", "列表、看板、矩阵、时间线四种视图", "每个想法都能挂上用户洞察"] },
  },
  {
    key: "plan", word: "Plan", stage: "plan", status: "beta", href: "/plan/app/",
    en: { label: "Roadmap planner", line: "The simplest roadmap: drag work onto a timeline and share it.",
      feats: ["Lanes for teams or themes, bars for initiatives", "Drag to move, stretch to resize", "Now / next / later view for stakeholders", "Share a read-only link"] },
    zh: { label: "路线图规划", line: "最简单的路线图：把工作拖到时间线上，然后分享出去。",
      feats: ["按团队或主题分泳道，用条块表示事项", "拖动改时间，拉伸改长度", "给干系人看「现在 / 下一步 / 以后」", "分享只读链接"] },
  },
  {
    key: "estimate", word: "Estimate", stage: "estimate", status: "beta", href: "/estimate/app/",
    en: { label: "Estimation", line: "Planning poker, t-shirt sizing and confidence votes in one place.",
      feats: ["Planning poker with a simultaneous reveal", "T-shirt sizing for a whole backlog", "Fist-of-five confidence vote", "Join from a link or QR code, no sign-up"] },
    zh: { label: "估算", line: "计划扑克、T 恤尺码和信心投票，集中在一处。",
      feats: ["计划扑克，同时亮牌", "整个需求池的 T 恤尺码估算", "举手五指信心投票", "点链接或扫码加入，无需注册"] },
  },
  {
    key: "meeting", word: "Meeting", stage: "collab", status: "beta", href: "/meeting/app/",
    en: { label: "Better meetings", line: "Lean Coffee, icebreakers, workshop agendas and a meeting cost clock.",
      feats: ["Lean Coffee: propose, vote, time-box", "Icebreaker questions to warm up the room", "Workshop agenda with a run-mode timer", "Live meeting cost clock"] },
    zh: { label: "会议", line: "精益咖啡、破冰、工作坊议程和会议成本计时器。",
      feats: ["精益咖啡：提议、投票、限时讨论", "破冰问题，让现场热起来", "工作坊议程加计时运行模式", "实时会议成本计时"] },
  },
  {
    key: "vote", word: "Vote", stage: "collab", status: "beta", href: "/vote/app/",
    en: { label: "Live polls & Q&A", line: "Interactive presentations: your audience joins with a code and results update live.",
      feats: ["Multiple choice, word cloud, scales, ranking and more", "Audience Q&A with upvotes", "Timed quizzes with a leaderboard", "Join on any phone with a code or QR"] },
    zh: { label: "现场互动", line: "互动演示：观众输入代码加入，结果实时更新。",
      feats: ["单选、词云、量表、排序等多种题型", "观众问答，可点赞排序", "限时竞答和排行榜", "任何手机输入代码或扫码即可加入"] },
  },
  {
    key: "sketch", word: "Sketch", stage: "collab", status: "beta", href: "/sketch/app/",
    en: { label: "Whiteboard", line: "A hand-drawn whiteboard for diagrams and workshops.",
      feats: ["Hand-drawn shapes, arrows and text", "Infinite canvas with zoom and pan", "Export to PNG or SVG", "Works offline in your browser"] },
    zh: { label: "白板", line: "手绘风白板，画图、开工作坊都顺手。",
      feats: ["手绘风形状、箭头和文字", "无限画布，自由缩放平移", "导出 PNG 或 SVG", "在浏览器里离线也能用"] },
  },
  {
    key: "pulse", word: "Pulse", stage: "team", status: "beta", href: "/pulse/app/",
    en: { label: "Team health", line: "Run a team health check and see how the team is really doing.",
      feats: ["Health check across the areas that matter", "Everyone votes anonymously from their phone", "Results at a glance, discussion prompts per area", "Repeat each sprint or quarter to see the trend"] },
    zh: { label: "团队健康", line: "做一次团队健康检查，看清团队的真实状态。",
      feats: ["覆盖关键维度的健康检查", "每个人用手机匿名投票", "结果一目了然，每个维度附讨论问题", "每个迭代或季度重复一次，看到趋势"] },
  },
  {
    key: "retro", word: "Retro", stage: "learn", status: "live", href: "https://fun-retro.com",
    en: { label: "Retrospectives", line: "Themed retro boards with voting, action items and kudos.",
      feats: ["Dozens of themed retro templates", "Anonymous cards, dot voting and grouping", "Action items that carry over", "Kudos boards for celebrations"] },
    zh: { label: "复盘", line: "主题复盘看板，带投票、行动项和致谢墙。",
      feats: ["几十种主题复盘模板", "匿名卡片、点投票和归类", "行动项可以延续到下次", "庆祝用的致谢墙"] },
  },
];

export const appByKey = Object.fromEntries(APPS.map((a) => [a.key, a]));
