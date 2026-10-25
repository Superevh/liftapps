// MeetingLift agenda templates, set A: scrum events, team kickoff, and classic retrospectives (EN + zh-CN).
export default [
  {
    id: 'daily', cat: 'scrum',
    en: ['Daily scrum', 'A 15-minute check on progress toward the sprint goal, walking the board right to left.'],
    zh: ['每日站会', '15 分钟对齐迭代目标进展，从右往左过看板。'],
    blocks: [
      [1, 'Restate the sprint goal', 'Goal: anchor everyone on the outcome. Tip: read the sprint goal aloud and name how many days remain, so updates are about the goal, not personal activity.', '重申迭代目标', '目标：让大家围绕成果对齐。技巧：大声读出迭代目标并说明剩余天数，让发言聚焦目标而不是个人忙了什么。'],
      [9, 'Walk the board right to left', 'Goal: finish what is closest to done first. Tip: start at the rightmost column and ask “what moves this item forward today?” Pair up or swarm on stalled items.', '从右往左过看板', '目标：优先推动最接近完成的事项。技巧：从最右列开始，问“今天怎样让它往前走一步？”，对卡住的事项现场结对或集中攻关。'],
      [2, 'Spot risks to the goal', 'Goal: surface anything threatening the sprint goal. Tip: ask for a quick thumbs up, sideways or down on goal confidence and note any thumbs down.', '识别目标风险', '目标：暴露威胁迭代目标的因素。技巧：让大家用拇指向上、平、向下表示对达成目标的信心，向下的当场记下原因。'],
      [3, 'Fill the parking lot', 'Goal: keep the standup short while not losing blockers. Tip: write each blocker or deep topic on a card with an owner and a time to meet, then release everyone else.', '登记待跟进事项', '目标：站会不拖沓，也不漏掉阻碍。技巧：每个阻碍或深入话题写一张卡，指定负责人和碰头时间，其他人即可离场。']
    ],
  },
  {
    id: 'review', cat: 'scrum',
    en: ['Sprint review', 'A working session with stakeholders on the increment and what to build next.'],
    zh: ['迭代评审会', '与干系人一起检视增量、讨论下一步的工作会。'],
    blocks: [
      [5, 'Product goal and sprint recap', 'Goal: give context before showing anything. Tip: in two minutes cover the product goal, the sprint goal and whether it was met; say plainly what was not finished.', '产品目标与迭代回顾', '目标：先交代背景再演示。技巧：用两分钟讲清产品目标、迭代目标及是否达成，未完成的内容也要坦率说明。'],
      [15, 'Demo of done work', 'Goal: inspect real, working software against the definition of done. Tip: let stakeholders drive or click through it themselves rather than watching slides.', '已完成成果演示', '目标：对照完成定义检视真实可用的成果。技巧：尽量让干系人亲自操作，而不是看 PPT。'],
      [15, 'Collect feedback', 'Goal: capture reactions while they are fresh. Tip: use two columns, “keep / change”, on sticky notes; the scribe records every comment, then cluster and discuss the top few.', '收集反馈', '目标：趁热记录各方反应。技巧：用“保留 / 修改”两列便签，记录员逐条记下，再归类并讨论最重要的几条。'],
      [10, 'Market, budget and timeline', 'Goal: check whether the plan still fits reality. Tip: ask the product owner and sponsors one question each: what changed outside, and what does that do to our forecast?', '市场、预算与时间线', '目标：确认计划是否仍贴合现实。技巧：让产品负责人和出资方各回答一个问题：外部有什么变化，对预测有何影响。'],
      [12, 'Adapt the backlog', 'Goal: turn feedback into ordered backlog changes. Tip: add, remove and reorder items live on screen; ask the room to confirm the top five before moving on.', '调整待办列表', '目标：把反馈转化为排序后的待办列表变化。技巧：在屏幕上现场新增、删除、调序，进入下一步前请大家确认前五项。'],
      [3, 'Agree next steps', 'Goal: leave with clear follow-ups. Tip: restate decisions, owners and the date of the next review; invite one-word feedback on the session itself.', '确认后续行动', '目标：带着明确的跟进离场。技巧：复述决定、负责人和下次评审日期，并请每人用一个词评价这次会议。']
    ],
  },
  {
    id: 'refinement', cat: 'scrum',
    en: ['Backlog refinement', 'Clarify, split and roughly size upcoming items so planning goes smoothly.'],
    zh: ['待办列表梳理', '澄清、拆分并粗估即将开发的条目，让迭代计划更顺畅。'],
    blocks: [
      [5, 'Frame and pick items', 'Goal: agree which items matter most for the next one or two sprints. Tip: pre-select five to eight top items and timebox each to about ten minutes.', '开场并选定条目', '目标：确定接下来一两个迭代最重要的条目。技巧：提前选好 5 至 8 个靠前的条目，每个限时约 10 分钟。'],
      [15, 'Clarify the why and the what', 'Goal: shared understanding of value and scope. Tip: the product owner states the user need, then the team asks questions; capture open questions on a visible list instead of debating.', '澄清价值与范围', '目标：对价值和范围形成共识。技巧：产品负责人先讲用户需求，团队提问；未决问题记在可见的清单上，不要当场争论。'],
      [15, 'Split large items', 'Goal: get items small enough to finish in a sprint. Tip: split by user outcome or workflow step, not by technical layer; ask “what is the thinnest slice that still delivers value?”', '拆分大条目', '目标：让条目小到能在一个迭代内完成。技巧：按用户成果或流程步骤拆分，不要按技术层拆；问“能交付价值的最薄切片是什么？”'],
      [10, 'Write acceptance criteria', 'Goal: make “done” testable. Tip: write two to four examples in the form “given, when, then” and ask a tester or skeptic to find a gap.', '编写验收标准', '目标：让“完成”可以被验证。技巧：用“假如、当、那么”写 2 至 4 个例子，请测试同学或持怀疑态度的人找漏洞。'],
      [10, 'Rough sizing', 'Goal: a quick relative estimate, not a commitment. Tip: use planning cards revealed together; discuss only when the highest and lowest differ widely. Anything too big goes back to splitting.', '粗略估算', '目标：快速得到相对估算，而不是承诺。技巧：用估算牌同时亮牌，只在最高与最低差距大时讨论；过大的条目回去再拆。'],
      [5, 'Check readiness', 'Goal: decide which items are ready enough. Tip: treat “ready” as a guide, not a gate; mark each item ready, needs info or needs split, with an owner for open questions.', '确认就绪程度', '目标：判断哪些条目已足够清晰。技巧：把“就绪”当作参考而非门槛；每项标为已就绪、待补信息或待拆分，并为未决问题指定负责人。']
    ],
  },
  {
    id: 'chartering', cat: 'kickoff',
    en: ['Team launch / chartering', 'A half-day session to build a shared team charter.'],
    zh: ['团队启动 / 团队章程共创', '用半天时间共创团队章程，统一方向。'],
    blocks: [
      [20, 'Purpose: why we exist', 'Goal: a shared reason for the team. Tip: each person writes why this team matters to customers; share in pairs, then merge into one sentence everyone can say aloud.', '目的：我们为何存在', '目标：形成团队共同的存在理由。技巧：每人写下团队对客户的意义，两人分享后合并成一句大家都能说出口的话。'],
      [25, 'Mission and values', 'Goal: define what we do and how we behave. Tip: ask “what does this value look like on a hard day?” and keep only values with observable behaviors; limit to four or five.', '使命与价值观', '目标：明确做什么、如何做事。技巧：问“在艰难的日子里这条价值观是什么样？”，只保留有可观察行为的，控制在四五条。'],
      [25, 'Skills inventory', 'Goal: see what the team can do and where the gaps are. Tip: build a grid of people against skills, rating each from “can learn” to “can teach”; look for single points of failure.', '技能盘点', '目标：看清团队能力与缺口。技巧：画“人员 × 技能”矩阵，从“想学”到“能教”打分，找出只有一个人会的单点风险。'],
      [15, 'Break', 'Goal: rest and reset. Tip: ask people to step away from screens; use the time to cluster sticky notes on the wall.', '休息', '目标：休息并重新聚焦。技巧：请大家离开屏幕；利用这段时间整理墙上的便签。'],
      [25, 'Stakeholders map', 'Goal: know who needs what from us. Tip: place stakeholders on a grid of influence and interest, then write one expectation and one communication habit for each key group.', '干系人地图', '目标：弄清谁对我们有什么期待。技巧：按影响力与关注度把干系人放到矩阵上，为每个关键群体写下一条期待和一种沟通方式。'],
      [25, 'Boundaries and constraints', 'Goal: clarify authority, budget and limits. Tip: use three lists: we decide, we consult, we escalate; check each with the sponsor if present.', '边界与约束', '目标：厘清决策权、预算和限制。技巧：列三栏：我们自己决定、需要征求意见、需要上报；如发起人在场，当场确认。'],
      [30, 'Success measures', 'Goal: agree how we will know we are succeeding. Tip: pick three to five measures mixing outcomes and team health, each with a current value, a target and a review date.', '成功衡量', '目标：约定如何判断团队成功。技巧：选 3 至 5 个兼顾成果与团队健康的指标，写明现状值、目标值和回顾日期。'],
      [15, 'Commit and close', 'Goal: leave with a shared charter and next steps. Tip: read the charter aloud, do a fist of five on commitment, and assign who publishes it where the team sees it daily.', '承诺与收尾', '目标：带着共同章程和后续行动离开。技巧：朗读章程，用五指法表决承诺度，并指定谁把它放到团队每天能看到的地方。']
    ],
  },
  {
    id: 'agreements', cat: 'kickoff',
    en: ['Working agreements', 'Co-create a short set of team agreements and make them visible.'],
    zh: ['团队工作协议', '共创一套简短的团队协议并张贴可见。'],
    blocks: [
      [5, 'Why agreements', 'Goal: explain what agreements are for. Tip: share one example of a past misunderstanding and set the rule that agreements describe behavior, not values.', '为什么需要协议', '目标：说明协议的用途。技巧：举一个过去误会的例子，并强调协议描述的是具体行为，而不是空泛的价值观。'],
      [10, 'Generate silently', 'Goal: collect ideas from everyone. Tip: prompt with topics such as meetings, communication, decisions, conflict and focus time; each person writes one idea per note for 5 to 7 minutes.', '静默发散', '目标：收集每个人的想法。技巧：用会议、沟通、决策、冲突、专注时间等主题提示，每人 5 至 7 分钟，每张便签写一条。'],
      [10, 'Cluster and clarify', 'Goal: merge duplicates and make wording concrete. Tip: rewrite vague notes like “be respectful” as an observable behavior such as “no side conversations during demos”.', '归类与澄清', '目标：合并重复项并让措辞具体。技巧：把“要尊重他人”之类的模糊表述改成可观察的行为，例如“演示时不私下聊天”。'],
      [15, 'Agree by fist of five', 'Goal: only keep what everyone can live with. Tip: vote each candidate with fingers; anyone showing 0 to 2 explains their concern and the group edits until all show 3 or more.', '五指法达成一致', '目标：只保留所有人都能接受的条目。技巧：逐条用手指投票，出 0 至 2 的人说明顾虑，大家修改直到全员 3 以上。'],
      [10, 'Make them visible', 'Goal: agreements that live in daily work. Tip: limit to five to seven; post them on the team board and the chat channel, and agree what to do when someone slips.', '张贴可见', '目标：让协议融入日常工作。技巧：控制在 5 至 7 条，贴在团队看板和群里，并约定有人违反时怎么办。'],
      [10, 'Review cadence', 'Goal: keep agreements alive. Tip: schedule a check at each retrospective, ask “which agreement helped, which did we ignore?”, and give every new member a walkthrough.', '回顾机制', '目标：让协议持续有效。技巧：安排在每次复盘时检查，问“哪条有帮助、哪条被忽略了？”，新成员加入时逐条讲解。']
    ],
  },
  {
    id: 'roles', cat: 'kickoff',
    en: ['Roles & responsibilities', 'Map who does, decides and supports each activity, then resolve gaps and overlaps.'],
    zh: ['角色与职责', '梳理每项活动由谁负责、谁决策、谁支持，并消除空白与重叠。'],
    blocks: [
      [5, 'Frame the exercise', 'Goal: focus on work, not job titles. Tip: explain that we map activities to people, and that overlap and gaps are expected findings, not blame.', '说明练习目的', '目标：关注工作本身而非头衔。技巧：说明我们是把活动对应到人，出现重叠和空白是正常发现，不是追责。'],
      [15, 'List team activities', 'Goal: a complete list of recurring work. Tip: brainstorm verbs on notes, such as “prioritize backlog”, “review code”, “talk to customers”, “release”; aim for 20 to 30.', '列出团队活动', '目标：列全经常发生的工作。技巧：用动词写便签，如“排优先级”“代码评审”“访谈客户”“发布”，争取 20 至 30 条。'],
      [20, 'Map roles to activities', 'Goal: show who is responsible, accountable, consulted or informed. Tip: build a matrix with activities as rows and people as columns; each person marks their own cells first.', '把角色对应到活动', '目标：标明谁负责、谁拍板、谁被咨询、谁知情。技巧：用活动为行、人员为列的矩阵，先由每个人标注自己的格子。'],
      [15, 'Find gaps and overlaps', 'Goal: spot rows with nobody or with several owners. Tip: highlight rows with no accountable person or two; rank the five most painful ones by dot vote.', '发现空白与重叠', '目标：找出无人负责或多人重复的行。技巧：标出没有拍板人或有两个拍板人的行，用圆点投票选出最痛的五个。'],
      [15, 'Resolve and agree', 'Goal: one accountable person for each key activity. Tip: discuss pairs of people at the top rows in turn and confirm each outcome with a fist of five.', '解决并达成一致', '目标：每项关键活动明确一位拍板人。技巧：按排名逐个讨论相关人员，每个结论用五指法确认。'],
      [5, 'Publish and review', 'Goal: make the result usable. Tip: save the matrix where the team works and set a date, such as in four to six weeks, to revisit it.', '发布与复查', '目标：让成果可用。技巧：把矩阵存放在团队日常工作的地方，并约定四到六周后复查。']
    ],
  },
  {
    id: 'ssc', cat: 'retro',
    en: ['Start / stop / continue', 'A simple retrospective sorting ideas into start, stop and continue.'],
    zh: ['开始 / 停止 / 继续', '用三列简单直接地复盘：开始做、停止做、继续做。'],
    blocks: [
      [5, 'Set the stage', 'Goal: create a safe space and focus. Tip: restate the retro rules, then check in with a one-word weather report for the sprint.', '营造氛围', '目标：建立安全感并聚焦。技巧：重申复盘规则，再让每人用一个“天气词”形容这个迭代。'],
      [10, 'Gather data', 'Goal: collect observations quietly. Tip: each person writes notes silently under Start, Stop and Continue for 7 minutes, one idea per note, and adds them to the board.', '收集数据', '目标：安静地收集观察。技巧：每人静默 7 分钟，在“开始、停止、继续”下各写便签，每条一个想法，贴到看板上。'],
      [10, 'Group and vote', 'Goal: find what matters most. Tip: cluster similar notes, name each cluster, then give each person three dots to vote.', '归类并投票', '目标：找出最重要的主题。技巧：把相似便签归组并命名，每人用三个圆点投票。'],
      [15, 'Generate insights and decide', 'Goal: choose one to three experiments. Tip: for the top clusters ask “what is the smallest change we can try next sprint?”; write each action with an owner and a date.', '洞察与决策', '目标：选定一到三个改进实验。技巧：对得票最高的主题问“下个迭代最小可尝试的改变是什么？”，每个行动写明负责人和日期。'],
      [5, 'Close', 'Goal: end on a clear note. Tip: read back the actions, thank the team and ask for a quick rating from one to five on how useful the retro was.', '收尾', '目标：清晰地结束。技巧：复述行动项，感谢大家，并请大家用 1 到 5 分评价这次复盘的价值。']
    ],
  },
  {
    id: '4ls', cat: 'retro',
    en: ['4Ls: liked, learned, lacked, longed for', 'Reflect on what worked, what we learned and what was missing.'],
    zh: ['4L 复盘：喜欢、学到、缺少、渴望', '回顾做得好的、学到的、缺失的和期待的。'],
    blocks: [
      [5, 'Set the stage', 'Goal: relax the room and set focus. Tip: ask each person to name one moment from the period that they would replay; keep it short.', '营造氛围', '目标：放松气氛并聚焦。技巧：请每人说一个想“重播”的时刻，保持简短。'],
      [15, 'Gather data on four columns', 'Goal: capture rich input. Tip: four columns: Liked, Learned, Lacked, Longed for. Silent writing for 8 minutes, then each person reads their notes aloud as they post them.', '四栏收集数据', '目标：获取丰富的输入。技巧：四栏：喜欢、学到、缺少、渴望。静默书写 8 分钟，再边贴边读出自己的便签。'],
      [10, 'Cluster themes', 'Goal: see patterns. Tip: group notes across columns when they relate, such as a lacked item that matches a longed-for item, and name each theme.', '归纳主题', '目标：看见规律。技巧：把相关便签跨栏归组，例如“缺少”与“渴望”中相呼应的条目，并给每组命名。'],
      [10, 'Dig into the top themes', 'Goal: understand causes before fixes. Tip: vote with three dots, then ask “why?” up to three times on the top two themes; note facts, not blame.', '深入分析重点主题', '目标：先找原因再想办法。技巧：每人三点投票，对前两个主题连续追问最多三次“为什么”，记录事实而非指责。'],
      [15, 'Decide on actions', 'Goal: turn insight into commitments. Tip: brainstorm for 5 minutes, pick one to three actions, and make each specific with an owner, a due date and how we will know it worked.', '确定行动', '目标：把洞察变为承诺。技巧：先发散 5 分钟，再选一到三项行动，写清负责人、截止日期和如何判断见效。'],
      [5, 'Close', 'Goal: appreciate and finish. Tip: do a round of one-line appreciations to a teammate, then confirm where the actions will be tracked.', '收尾', '目标：致谢并结束。技巧：每人对一位同事说一句感谢，再确认行动项记录在哪里跟踪。']
    ],
  },
  {
    id: 'sailboat', cat: 'retro',
    en: ['Sailboat', 'Use a sailing metaphor: wind, anchors, rocks and the island we are heading for.'],
    zh: ['帆船复盘', '借用帆船比喻：风、锚、礁石与目的地岛屿。'],
    blocks: [
      [5, 'Set the stage', 'Goal: introduce the metaphor and align on the goal. Tip: draw a boat, wind, anchor, rocks and island; name the island as our sprint or project goal.', '营造氛围', '目标：介绍比喻并对齐目标。技巧：画出船、风、锚、礁石和岛，并把“岛”定为迭代或项目目标。'],
      [15, 'Gather data on the picture', 'Goal: surface helps and hindrances. Tip: wind = what pushes us forward, anchors = what slows us, rocks = risks ahead, island = our ideal state. Write silently for 8 minutes, then post.', '在图上收集数据', '目标：找出助力与阻力。技巧：风是推动前进的，锚是拖慢我们的，礁石是前方风险，岛是理想状态。静默写 8 分钟后张贴。'],
      [10, 'Cluster and discuss', 'Goal: build a shared view. Tip: read the notes in groups; ask people to add context, not defend. Move notes between areas if the group sees them differently.', '归类与讨论', '目标：形成共同认识。技巧：按区域读便签，请大家补充背景而不是辩解；若看法不同，可将便签挪到别的区域。'],
      [10, 'Vote on what to tackle', 'Goal: choose the biggest anchors and rocks. Tip: give each person three dots; vote on anchors to remove and rocks to avoid, and rank the winners.', '投票选择重点', '目标：选出最大的锚和礁石。技巧：每人三个圆点，为想移除的锚和想避开的礁石投票，并给得票项排序。'],
      [15, 'Plan actions', 'Goal: remove anchors and steer around rocks. Tip: for each top item write an action, an owner and a date; also pick one “wind” to amplify.', '制定行动', '目标：去掉锚、避开礁石。技巧：对每个重点项写出行动、负责人和日期；再选一个要放大的“风”。'],
      [5, 'Close', 'Goal: end with energy. Tip: ask each person to finish the sentence “the island feels closer when...” and thank the team.', '收尾', '目标：带着干劲结束。技巧：请每人完成这句话：“当……时，岛离我们更近了”，并感谢大家。']
    ],
  },
  {
    id: 'msg', cat: 'retro',
    en: ['Mad / sad / glad', 'Explore the emotions behind the work to find what really matters.'],
    zh: ['气 / 难过 / 开心', '通过情绪找出团队真正在意的事。'],
    blocks: [
      [5, 'Set the stage', 'Goal: make emotions safe to share. Tip: restate confidentiality and that feelings are data, not complaints; set a rule for focusing on situations, not people.', '营造氛围', '目标：让大家敢于表达情绪。技巧：重申保密原则，强调感受是数据而不是抱怨，并约定谈事不谈人。'],
      [10, 'Gather feelings', 'Goal: collect emotional moments. Tip: three columns: Mad, Sad, Glad. Everyone writes silently for 7 minutes, one event per note, and posts anonymously if the team prefers.', '收集感受', '目标：收集情绪时刻。技巧：三栏：气、难过、开心。每人静默写 7 分钟，每张一件事；团队愿意的话可匿名张贴。'],
      [10, 'Cluster and name themes', 'Goal: find patterns in the feelings. Tip: group similar notes and name each group by the underlying need, such as clarity, recognition or focus.', '归类并命名主题', '目标：从感受中找出规律。技巧：把相似便签归组，并按背后的需求命名，如清晰度、认可、专注。'],
      [15, 'Understand and decide', 'Goal: turn the strongest themes into actions. Tip: vote with three dots, discuss the top two or three, and ask “what would turn this mad or sad into glad?” Record owners and dates.', '理解并决策', '目标：把最强烈的主题变为行动。技巧：三点投票，讨论前两三项，问“怎样才能把气和难过变成开心？”并记录负责人与日期。'],
      [5, 'Close', 'Goal: leave on a positive note. Tip: read out the glad items together, confirm the actions and end with a round of one-word closing feelings.', '收尾', '目标：积极地收场。技巧：一起读一遍“开心”栏，确认行动项，再让每人用一个词说出此刻的感受。']
    ],
  },
  {
    id: 'timeline', cat: 'retro',
    en: ['Timeline retro', 'Build a shared timeline of the sprint or project, trace the energy and learn from patterns.'],
    zh: ['时间线复盘', '共同梳理迭代或项目的时间线，追踪团队情绪，从规律中学习。'],
    blocks: [
      [5, 'Set the stage', 'Goal: set focus and the period covered. Tip: show a long horizontal line with dates; ask for a one-word check-in on how the period felt overall.', '营造氛围', '目标：明确聚焦的时间范围。技巧：展示一条带日期的横向长线，并让大家用一个词说出整体感受。'],
      [15, 'Build the timeline', 'Goal: recall key events together. Tip: each person writes events (releases, changes, incidents, wins) and posts them on the date; use colors for different types and invite people to fill gaps.', '构建时间线', '目标：共同回忆关键事件。技巧：每人写下发布、变更、事故、成果等事件，贴到对应日期；用不同颜色区分类型，鼓励补漏。'],
      [15, 'Draw the energy line', 'Goal: see how the team felt. Tip: each person marks their own high and low points with a dot or colored line under the timeline, then share a few in a round.', '绘制情绪曲线', '目标：看见团队情绪起伏。技巧：每人在时间线下方用圆点或彩线标出自己的高点和低点，再轮流分享几处。'],
      [10, 'Spot patterns', 'Goal: move from stories to insights. Tip: walk the timeline in silence for 3 minutes, then ask “what repeats, what surprises, what caused the dips?” and note answers.', '发现规律', '目标：从故事走向洞察。技巧：先静默浏览时间线 3 分钟，再问“什么在重复、什么出乎意料、低谷由什么引起？”并记录答案。'],
      [15, 'Choose what to change', 'Goal: select a few causes to act on. Tip: dot vote on the insights, then discuss the top two root causes and avoid solutions until the cause is clear.', '选择要改变的点', '目标：挑出少数值得处理的原因。技巧：对洞察圆点投票，再讨论前两个根因，原因没弄清前先不谈方案。'],
      [10, 'Define actions', 'Goal: leave with committed experiments. Tip: write one to three SMART actions with an owner, due date and a check at the next retro; add them to the backlog.', '制定行动', '目标：带着承诺的改进实验离开。技巧：写一到三条具体可衡量的行动，指定负责人、截止日期并在下次复盘检查，同时加入待办列表。'],
      [5, 'Close', 'Goal: finish and appreciate. Tip: ask each person for one thing they appreciated in the period and check how useful the retro was on a one-to-five scale.', '收尾', '目标：致谢并结束。技巧：请每人说出这段时间里一件感激的事，并用 1 到 5 分评价复盘的价值。']
    ],
  },
]
