import { lazy } from 'react'
import { boot } from './core/boot.jsx'

// EstimateLift (估算): planning poker, t-shirt sizing and confidence votes. Each tool loads on demand.
const pick = (load, name) => lazy(() => load().then(m => ({ default: m[name] })))
const poker = () => import('./poker/Poker.jsx')
const sizing = () => import('./sizing/Sizing.jsx')
const confidence = () => import('./confidence/Confidence.jsx')

boot({
  key: 'estimate',
  name: 'EstimateLift',
  en: {
    title: 'Estimate together, calmly',
    lead: 'Planning poker, t-shirt sizing and confidence votes for agile teams. Everyone joins from a link or QR code, no sign-up.',
    how: 'start a session, share the link, everyone votes in private on their own device, then reveal together and talk about the differences.',
  },
  zh: {
    title: '一起估算，从容不迫',
    lead: '为敏捷团队准备的计划扑克、T 恤尺码估算和信心投票。点链接或扫码即可加入，无需注册。',
    how: '发起一个会话并分享链接，每个人在自己的设备上私下投票，然后一起揭晓，围绕差异展开讨论。',
  },
  tools: [
    { view: 'poker', icon: 'cards', kind: 'poker-rooms', live: true, Home: pick(poker, 'PokerHome'), Room: pick(poker, 'PokerRoom'),
      en: ['Planning poker', 'Estimate stories with a simultaneous reveal, so nobody anchors the room.'],
      zh: ['计划扑克', '同时亮牌估算故事点，避免被第一个开口的人带偏。'] },
    { view: 'sizing', icon: 'grid', kind: 'sizing', live: true, Home: pick(sizing, 'SizingHome'), Room: pick(sizing, 'SizingBoard'),
      en: ['T-shirt sizing', 'Sort a whole backlog into sizes quickly, then talk only about the disputed items.'],
      zh: ['T 恤尺码估算', '快速把整个需求池分到不同尺码，只讨论有分歧的条目。'] },
    { view: 'confidence', icon: 'thumb', kind: 'confidence', live: true, Home: pick(confidence, 'ConfidenceHome'), Room: pick(confidence, 'ConfidenceVote'),
      en: ['Confidence vote', 'Fist of five on a plan or a sprint goal: anonymous, instant, with a clear verdict.'],
      zh: ['信心投票', '对计划或迭代目标做举手五指投票：匿名、即时、结论清楚。'] },
  ],
})
