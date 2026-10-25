import { lazy } from 'react'
import { boot } from './core/boot.jsx'

// MeetingLift (会议): Lean Coffee, icebreakers, workshop agendas and the meeting cost clock.
const pick = (load, name) => lazy(() => load().then(m => ({ default: m[name] })))
const lean = () => import('./leancoffee/LeanCoffee.jsx')
const ice = () => import('./icebreakers/Icebreakers.jsx')
const agenda = () => import('./agenda/Agenda.jsx')
const cost = () => import('./meetingcost/MeetingCost.jsx')

boot({
  key: 'meeting',
  name: 'MeetingLift',
  en: {
    title: 'Meetings that earn their time',
    lead: 'Lean Coffee, icebreakers, a workshop agenda with a run-mode timer, and a meeting cost clock. Light tools for facilitators.',
    how: 'pick a tool, start a session and share the link or QR code. People join from any device, no sign-up.',
  },
  zh: {
    title: '让每场会议都值得',
    lead: '精益咖啡、破冰问题、带计时运行模式的工作坊议程，以及会议成本计时器。给引导者的轻量工具。',
    how: '选一个工具，发起会话并分享链接或二维码。大家用任何设备加入，无需注册。',
  },
  tools: [
    { view: 'leancoffee', icon: 'comment', kind: 'leancoffee', live: true, Home: pick(lean, 'LeanCoffeeHome'), Room: pick(lean, 'LeanCoffeeRoom'),
      en: ['Lean Coffee', 'No fixed agenda: propose topics, dot-vote, then talk in short time-boxes.'],
      zh: ['精益咖啡', '没有预设议程：提出话题、点投票，再分段限时讨论。'] },
    { view: 'icebreakers', icon: 'balloon', kind: 'icebreakers', live: true, Home: pick(ice, 'IcebreakersHome'), Room: pick(ice, 'IcebreakerRoom'),
      en: ['Icebreakers', 'Check-in questions and meeting bingo to warm up the room.'],
      zh: ['破冰', '签到问题和会议宾果，让现场热起来。'] },
    { view: 'agenda', icon: 'agenda', kind: 'agendas', live: true, noName: true, Home: pick(agenda, 'AgendaHome'), Room: pick(agenda, 'AgendaRoom'),
      en: ['Workshop agenda', 'Plan time-boxed blocks, then run them full-screen with a countdown and a gentle chime.'],
      zh: ['工作坊议程', '规划限时议程块，再全屏运行：倒计时、提示下一项、温和提示音。'] },
    { view: 'meetingcost', icon: 'timer', live: false, Home: pick(cost, 'default'),
      en: ['Meeting cost clock', 'A live ticker of what this meeting costs, to keep it short and useful.'],
      zh: ['会议成本计时', '实时显示这场会议的花费，让会议短而有用。'] },
  ],
})
