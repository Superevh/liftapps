// Intro-page content for apps that are not live yet: tagline, three features and related apps.
const DETAILS = {
  standup: {
    tag: ["Standups without the meeting.", "不开会的站会。"],
    feats: [
      ["Answer in a minute", "Each person answers yesterday, today and blockers on their own time.", "一分钟填完", "每个人在自己方便的时候填写昨天、今天和阻碍。"],
      ["Only blockers get shouted", "AI reads every update and posts just the blockers, with who could help.", "只推送阻碍", "AI 读完所有更新，只把阻碍和能帮忙的人推送出来。"],
      ["Lives in your chat", "Runs inside Slack or Teams, so nobody needs another tab.", "就在聊天工具里", "在 Slack 或 Teams 里运行，不用再多开一个标签页。"],
    ], rel: ["retro", "board", "pulse"],
  },
  vote: {
    tag: ["Live polls and Q&A your audience actually joins.", "观众真的愿意参与的实时投票和问答。"],
    feats: [
      ["Join with a code", "People join from their phone with a short code. No app, no sign-up.", "输入代码就加入", "观众用手机输入短代码即可加入，不用装应用、不用注册。"],
      ["Results move live", "Word clouds, multiple choice, scales and ranking update as votes arrive.", "结果实时变化", "词云、单选、量表和排序随投票实时更新。"],
      ["Questions, sorted", "AI groups similar questions so you answer the theme, not twenty duplicates.", "提问自动归类", "AI 把相似的问题归在一起，你回答主题，而不是二十个重复问题。"],
    ], rel: ["quiz", "agenda", "retro"],
  },
  quiz: {
    tag: ["Quick quizzes that wake the room up.", "让全场瞬间醒过来的快问快答。"],
    feats: [
      ["Timed rounds", "Questions on a countdown with points for speed and accuracy.", "限时作答", "每题倒计时，答得又快又准得分更高。"],
      ["Live leaderboard", "Show the top players between questions to keep energy high.", "实时排行榜", "每题之间展示排名，保持现场气氛。"],
      ["AI writes the questions", "Paste your training notes and get a first draft of the quiz.", "AI 出题", "贴上培训资料，自动生成第一版题目。"],
    ], rel: ["vote", "agenda", "kudo"],
  },
  sketch: {
    tag: ["A whiteboard that feels like paper.", "像纸一样顺手的白板。"],
    feats: [
      ["Hand-drawn feel", "Sketchy shapes and arrows that keep ideas loose and friendly.", "手绘质感", "手绘风格的形状和箭头，让想法保持轻松。"],
      ["Agile templates", "Start from a retro, story map, impact map or team canvas.", "敏捷模板", "从复盘、故事地图、影响地图或团队画布开始。"],
      ["Draw together", "Everyone draws on the same canvas in real time.", "一起画", "所有人实时在同一张画布上协作。"],
    ], rel: ["story", "retro", "team"],
  },
  agenda: {
    tag: ["Plan the workshop. Then run it on time.", "排好工作坊，再准时跑完。"],
    feats: [
      ["Block-by-block agenda", "Lay out each activity with its goal, time and materials.", "按环节排议程", "为每个环节写清目标、时长和所需材料。"],
      ["Run mode with timers", "A facilitator view that counts down each block and shows what is next.", "计时运行模式", "引导者视图逐个环节倒计时，并提示下一步。"],
      ["AI drafts the plan", "Describe your goal and group size; get an agenda with the right Lift app per block.", "AI 起草议程", "说明目标和人数，自动生成议程，并为每个环节配上合适的 Lift 应用。"],
    ], rel: ["vote", "sketch", "retro"],
  },
  board: {
    tag: ["A calm kanban board for everyday work.", "一个安静好用的日常看板。"],
    feats: [
      ["Lists and cards", "Drag cards across lists, add labels, checklists and due dates.", "列表与卡片", "在列表之间拖动卡片，加标签、清单和截止日期。"],
      ["Retro actions land here", "Action items from RetroLift arrive as cards automatically.", "复盘行动项直接进来", "RetroLift 的行动项自动变成看板卡片。"],
      ["WIP limits", "Set limits per column and see where work is piling up.", "在制品限制", "为每一列设上限，一眼看出哪里在堆积。"],
    ], rel: ["sprint", "retro", "flow"],
  },
  sprint: {
    tag: ["Sprints and issues, kept simple.", "简单好用的迭代与任务管理。"],
    feats: [
      ["Backlog to board", "Groom the backlog, plan the sprint and track it on a sprint board.", "从需求池到看板", "整理需求池、规划迭代，在迭代看板上跟踪。"],
      ["Estimates built in", "Pull PointLift estimates straight into each story.", "内置估点", "直接把 PointLift 的估点结果带进每个故事。"],
      ["Made for small teams", "The essentials without a week of configuration.", "为小团队设计", "保留必要功能，不用花一周去配置。"],
    ], rel: ["board", "point", "story"],
  },
  road: {
    tag: ["From scattered ideas to a roadmap people can read.", "从零散想法到人人看得懂的路线图。"],
    feats: [
      ["Capture every idea", "Collect ideas from customers, sales and the team in one place.", "收集所有想法", "把客户、销售和团队的想法集中在一处。"],
      ["Score and compare", "Rate impact, effort and confidence, then rank what matters.", "打分比较", "评估影响、投入和信心，排出优先级。"],
      ["Share a clear roadmap", "Now, next, later views for stakeholders, without exposing the mess.", "分享清晰路线图", "给干系人看「现在、下一步、以后」，不暴露内部细节。"],
    ], rel: ["story", "goal", "sprint"],
  },
  story: {
    tag: ["See the whole journey, then slice the release.", "先看清完整旅程，再切分发布。"],
    feats: [
      ["Map the journey", "Lay out user activities left to right and stories underneath.", "铺开用户旅程", "从左到右排列用户活动，下面挂具体故事。"],
      ["Slice releases", "Drag a line to define the MVP and each release after it.", "切分发布", "拖一条线就能定出 MVP 和之后的每个版本。"],
      ["AI first draft", "Upload a requirements doc and get a starting map to edit.", "AI 生成初稿", "上传需求文档，得到一份可以直接修改的初版地图。"],
    ], rel: ["sprint", "road", "sketch"],
  },
  plan: {
    tag: ["Big-room planning without the string and sticky tape.", "不用毛线和胶带的大型联合规划。"],
    feats: [
      ["Program board", "Teams, iterations and features on one board.", "项目群看板", "团队、迭代和特性放在同一块看板上。"],
      ["Dependency lines", "Draw dependencies between teams and spot risky chains early.", "依赖连线", "画出团队之间的依赖，提前发现高风险链条。"],
      ["Objectives and confidence", "Capture team objectives and run a confidence vote at the end.", "目标与信心投票", "记录团队目标，最后做一次信心投票。"],
    ], rel: ["story", "sprint", "goal"],
  },
  goal: {
    tag: ["OKRs that stay alive after the kickoff.", "开完会也不会被遗忘的 OKR。"],
    feats: [
      ["Objectives and key results", "Set goals at team or company level and link them together.", "目标与关键结果", "在团队或公司层面设定目标，并互相关联。"],
      ["Light check-ins", "A weekly one-minute update keeps progress honest.", "轻量跟进", "每周一分钟更新，进度一目了然。"],
      ["Sharper key results", "AI rewrites vague key results into measurable ones.", "更清晰的 KR", "AI 把模糊的关键结果改写成可衡量的。"],
    ], rel: ["road", "plan", "pulse"],
  },
  flow: {
    tag: ["Answer \"when will it be done?\" with data.", "用数据回答「什么时候能做完」。"],
    feats: [
      ["Start from a CSV", "Export from any tracker and drop the file in. No integration needed.", "从 CSV 开始", "从任何工具导出文件拖进来即可，不需要集成。"],
      ["Flow metrics", "Cycle time, throughput, WIP and ageing work in clear charts.", "流动度量", "周期时间、吞吐量、在制品和老化任务一目了然。"],
      ["Forecasts explained", "Monte Carlo forecasts with a plain-language note on what would move the date.", "预测有解释", "蒙特卡洛预测，并用一句话说明什么会影响交付日期。"],
    ], rel: ["board", "sprint", "ship"],
  },
  ship: {
    tag: ["Tell people what shipped, without writing it twice.", "告诉大家上线了什么，不用写两遍。"],
    feats: [
      ["Notes from pull requests", "AI drafts release notes from merged pull requests.", "从 PR 生成", "AI 根据合并的 PR 起草发布说明。"],
      ["Two audiences", "A customer-friendly version and a detailed team version from the same source.", "两种读者", "同一份来源，生成面向客户和面向团队两个版本。"],
      ["Public changelog", "A hosted changelog page you can link from your product.", "公开更新日志", "托管的更新日志页面，可以从产品里直接链接。"],
    ], rel: ["flow", "status", "sprint"],
  },
  status: {
    tag: ["A status page your customers can trust.", "客户信得过的状态页。"],
    feats: [
      ["Live component status", "Show each part of your service as operational, degraded or down.", "实时组件状态", "逐个显示服务组件正常、降级还是中断。"],
      ["Incident updates", "Post updates as you work and notify subscribers.", "事故通报", "处理过程中发布更新，并通知订阅者。"],
      ["Uptime history", "Ninety days of history that speaks for itself.", "可用性历史", "九十天历史记录，让数据说话。"],
    ], rel: ["incident", "ship", "flow"],
  },
  incident: {
    tag: ["Blameless incident reviews that lead to change.", "带来改变的无责事故复盘。"],
    feats: [
      ["Timeline first", "Rebuild what happened minute by minute with the whole team.", "时间线优先", "和团队一起按分钟还原发生了什么。"],
      ["Blameless prompts", "Guided questions focus on systems and decisions, not people.", "无责引导", "引导问题聚焦系统和决策，而不是追究个人。"],
      ["Actions that stick", "Follow-up actions go straight to BoardLift so they get done.", "行动项落地", "后续行动直接进入 BoardLift，确保完成。"],
    ], rel: ["retro", "status", "board"],
  },
  team: {
    tag: ["How your team works, written down together.", "把团队的协作方式一起写下来。"],
    feats: [
      ["Team canvas", "Purpose, values, roles and goals on one shared page.", "团队画布", "目的、价值观、角色和目标放在同一页。"],
      ["Working agreements", "Agree how you meet, decide and communicate, and revisit it often.", "工作约定", "约定怎么开会、决策和沟通，并定期回顾。"],
      ["Skills and motivators", "A skills matrix and motivator cards help you grow and staff the team.", "技能与动机", "技能矩阵和动机卡帮助团队成长和分工。"],
    ], rel: ["pulse", "retro", "note"],
  },
  note: {
    tag: ["Team knowledge that links to the work.", "与工作相连的团队知识库。"],
    feats: [
      ["Linked notes", "Write in Markdown and link pages with double brackets.", "双向链接笔记", "用 Markdown 写作，用双括号互相链接。"],
      ["Connected to Lift", "Reference retros, boards and goals from any note.", "与 Lift 互通", "在任何笔记里引用复盘、看板和目标。"],
      ["Find it fast", "Search across every page your team has written.", "快速查找", "在团队写过的所有页面里搜索。"],
    ], rel: ["team", "sketch", "goal"],
  },
};
