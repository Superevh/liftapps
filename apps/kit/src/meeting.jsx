import { lazy } from 'react'
import { boot } from './core/boot.jsx'

// MeetingLift (会议): plan, run and follow up on team meetings. A meeting is one shared live
// document with a time-boxed agenda, a facilitator-run timer, notes, decisions, action items and
// built-in activities. The original stand-alone tools stay reachable as the facilitation toolkit.
const pick = (load, name) => lazy(() => load().then(m => ({ default: m[name] })))
const home = () => import('./meeting/Home.jsx')
const room = () => import('./meeting/Meeting.jsx')
const newMeeting = () => import('./meeting/NewMeeting.jsx')
const actions = () => import('./meeting/ActionsPage.jsx')
const toolkit = () => import('./meeting/Toolkit.jsx')
const team = () => import('./meeting/TeamPage.jsx')
const lean = () => import('./leancoffee/LeanCoffee.jsx')
const ice = () => import('./icebreakers/Icebreakers.jsx')
const agenda = () => import('./agenda/Agenda.jsx')
const cost = () => import('./meetingcost/MeetingCost.jsx')

boot({
  key: 'meeting',
  name: 'MeetingLift',
  Home: pick(home, 'MeetingHome'),
  en: {
    title: 'Meetings that end with decisions and owners',
    lead: 'Plan a time-boxed agenda together, run it live with a shared timer, and follow up with minutes and action items that carry into the next meeting.',
    how: 'create a meeting from a template and share the link. Everyone joins from any device, no sign-up.',
  },
  zh: {
    title: '让每场会议都以决定和负责人收尾',
    lead: '一起规划限时议程，用共享计时器实时主持，会后自动生成纪要，行动项自动带到下一次会议。',
    how: '从模板创建会议并分享链接。大家用任何设备加入，无需注册。',
  },
  tools: [
    { view: 'm', icon: 'agenda', kind: 'meetings', live: true, noName: true, hidden: true, Home: pick(newMeeting, 'NewMeeting'), Room: pick(room, 'MeetingRoom'),
      en: ['Meeting', 'Plan, run and follow up on a meeting.'], zh: ['会议', '规划、主持并跟进一场会议。'] },
    { view: 'actions', icon: 'check', live: false, Home: pick(actions, 'ActionsPage'),
      en: ['Action items', 'Open action items across your meetings.'], zh: ['行动项', '所有会议中未完成的行动项。'] },
    { view: 'team', icon: 'users', kind: 'meetingteams', live: true, noName: true, Home: pick(team, 'TeamHome'), Room: pick(team, 'TeamRoom'),
      en: ['Teams', 'Team spaces: meetings and action items on any device.'], zh: ['团队', '团队空间：任何设备都能看会议和行动项。'] },
    { view: 'toolkit', icon: 'grid', live: false, Home: pick(toolkit, 'ToolkitPage'),
      en: ['Toolkit', 'Stand-alone facilitation tools.'], zh: ['工具箱', '独立的引导工具。'] },
    { view: 'leancoffee', icon: 'comment', kind: 'leancoffee', live: true, hidden: true, Home: pick(lean, 'LeanCoffeeHome'), Room: pick(lean, 'LeanCoffeeRoom'),
      en: ['Lean Coffee', 'No fixed agenda: propose topics, dot-vote, then talk in short time-boxes.'],
      zh: ['精益咖啡', '没有预设议程：提出话题、点投票，再分段限时讨论。'] },
    { view: 'icebreakers', icon: 'balloon', kind: 'icebreakers', live: true, hidden: true, Home: pick(ice, 'IcebreakersHome'), Room: pick(ice, 'IcebreakerRoom'),
      en: ['Icebreakers', 'Check-in questions and meeting bingo to warm up the room.'],
      zh: ['破冰', '签到问题和会议宾果，让现场热起来。'] },
    { view: 'agenda', icon: 'agenda', kind: 'agendas', live: true, noName: true, hidden: true, Home: pick(agenda, 'AgendaHome'), Room: pick(agenda, 'AgendaRoom'),
      en: ['Workshop agenda', 'Start from 37 workshop templates, plan time-boxed blocks, then run them full-screen with a countdown.'],
      zh: ['工作坊议程', '从 37 个工作坊模板起步，规划限时议程块，再全屏倒计时运行。'] },
    { view: 'meetingcost', icon: 'timer', live: false, hidden: true, Home: pick(cost, 'default'),
      en: ['Meeting cost clock', 'A live ticker of what this meeting costs, to keep it short and useful.'],
      zh: ['会议成本计时', '实时显示这场会议的花费，让会议短而有用。'] },
  ],
})
