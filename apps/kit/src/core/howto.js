// "How to use" text for the older tools. Newer tools keep theirs in their own T dict.

export const HOWTO = {
  poker: {
    en: {
      steps: [
        ['Create a room', 'Name it, pick a deck and a card theme. No sign-up needed.'],
        ['Invite the team', 'Share the link or the QR code. People can join as voters or just watch.'],
        ['Add stories', 'Paste one story per line, or skip this and run quick rounds.'],
        ['Vote in secret', 'Everyone picks a card. Nobody sees the others until the cards are revealed.'],
        ['Reveal and agree', 'Talk about the highest and lowest votes, vote again if needed, then save the estimate and move on.'],
      ],
      tips: [
        'A big spread is useful: it usually means people imagine different work. Ask both ends to explain.',
        'Turn on auto-reveal in the room settings so cards flip as soon as everyone has voted.',
        'Use the timer to keep discussions short, and Export CSV to copy the estimates into your tracker.',
      ],
    },
    zh: {
      steps: [
        ['创建房间', '起个名字，选一套牌和牌面主题，无需注册。'],
        ['邀请团队', '分享链接或二维码，成员可以参与投票，也可以只旁观。'],
        ['添加故事', '每行粘贴一个故事；也可以不加，直接快速投一轮。'],
        ['私下投票', '每人选一张牌，翻牌前谁也看不到别人的选择。'],
        ['翻牌并达成一致', '先听最高和最低票的理由，必要时重投，然后保存估算进入下一个。'],
      ],
      tips: [
        '分歧大是好事：通常说明大家对工作的理解不同，请两端的人各自解释。',
        '在房间设置里打开“自动翻牌”，所有人投完就会立刻翻开。',
        '用计时器控制讨论时长，用“导出 CSV”把估算结果搬到你的工具里。',
      ],
    },
  },
  health: {
    en: {
      steps: [
        ['Create a check', 'Give it a name and team, then pick a question set or write your own.'],
        ['Share the link', 'Everyone votes anonymously: green, amber or red for each area, plus a trend and an optional note.'],
        ['Reveal together', 'When enough people have voted, the facilitator reveals the results for everyone.'],
        ['Talk about the weak spots', 'Sort worst first, focus one area at a time and add action items.'],
        ['Repeat regularly', 'Run the same set every month or quarter to see changes and the team heatmap.'],
      ],
      tips: [
        'Wait for at least three votes before revealing, so nobody can be singled out.',
        'Pick one or two areas to improve, not all of them. “Copy the weak spots” gives you a ready list for your next retrospective.',
        'Use the same team name each time so checks line up in the trends.',
      ],
    },
    zh: {
      steps: [
        ['创建检查', '填写名称和团队，选择一套问题或自定义问题。'],
        ['分享链接', '每人匿名为每个方面投绿、黄或红，再选趋势，可以附一句备注。'],
        ['一起揭晓', '投票人数够了，主持人一键为所有人揭晓结果。'],
        ['聚焦薄弱项', '按“最差优先”排序，一次讨论一个方面并记录行动项。'],
        ['定期重复', '每月或每季度用同一套问题再测，查看变化和团队热力图。'],
      ],
      tips: [
        '至少等三个人投完再揭晓，避免能对号入座。',
        '只挑一两个方面改进，不要全部铺开。“复制薄弱项”能直接生成下一次复盘的话题清单。',
        '每次使用同一个团队名，趋势才能连起来。',
      ],
    },
  },
  leancoffee: {
    en: {
      steps: [
        ['Collect', 'Create a session, share the link, and everyone adds topics they want to talk about.'],
        ['Vote', 'Spend your dots on the topics you care about most. You can stack several on one.'],
        ['Discuss', 'The top topic moves to Discussing and a shared timer starts.'],
        ['Decide', 'When time is up, everyone votes: keep going for a few more minutes, or move on.'],
        ['Wrap up', 'Capture notes and actions as you go, then copy or download the summary.'],
      ],
      tips: [
        'Keep topics short, like a headline. The person who wrote it gets a minute to explain it first.',
        'Five to seven minutes per topic works well. Short timeboxes keep the energy up.',
        'Turn a note into an action item and give it an owner before moving on.',
      ],
    },
    zh: {
      steps: [
        ['收集', '创建会话并分享链接，每人写下想聊的话题。'],
        ['投票', '把圆点投给最关心的话题，可以在一个话题上叠加多票。'],
        ['讨论', '票数最高的话题进入“讨论中”，共享计时器开始倒计时。'],
        ['决定', '时间到了大家投票：再聊几分钟，还是换下一个。'],
        ['收尾', '随时记录笔记和行动项，最后复制或下载总结。'],
      ],
      tips: [
        '话题写得像标题一样简短，由提出者先用一分钟说明。',
        '每个话题 5–7 分钟效果最好，短时盒能保持节奏。',
        '离开话题前，把笔记转成行动项并指定负责人。',
      ],
    },
  },
  icebreakers: {
    en: {
      steps: [
        ['Draw a question', 'Pick categories and draw a card. Use present mode to show it full screen.'],
        ['Or open a live room', 'Share the link: everyone answers on their phone and you reveal the answers together.'],
        ['Shuffle the speakers', 'Paste names to get a random order with a per-person timer.'],
        ['Play bingo', 'Start a bingo game in the room, or print cards for a meeting in person.'],
      ],
      tips: [
        'Keep it to a minute or two, and let people pass.',
        'Retro check-ins (weather, one word, energy 1–5) are a quick way to read the room before a retrospective.',
        'Drawn questions don’t repeat on this device until you reset.',
      ],
    },
    zh: {
      steps: [
        ['抽一个问题', '选好类别抽一张卡，可以用全屏演示模式展示。'],
        ['或开一个实时房间', '分享链接，大家用手机作答，一起揭晓答案。'],
        ['打乱发言顺序', '粘贴名单，随机排序并为每人计时。'],
        ['玩宾果', '在房间里开一局宾果，线下会议可以打印卡片。'],
      ],
      tips: [
        '控制在一两分钟内，允许有人跳过。',
        '复盘签到题（天气、一个词、精力 1–5）能在复盘前快速了解大家状态。',
        '在这台设备上抽过的问题不会重复，除非你重置。',
      ],
    },
  },
}
