import { lazy } from 'react'
import { boot } from './core/boot.jsx'

// PulseLift (团队健康): team spaces with regular health checks, a weekly pulse, an improvement
// plan and the trend over time. Links to single health checks (#/health/<id>) keep working.
const pulse = () => import('./pulse/index.jsx')
const pick = name => lazy(() => pulse().then(m => ({ default: m[name] })))

boot({
  key: 'pulse',
  name: 'PulseLift',
  // Anonymous by design: no name chip in the tool strip.
  noIdentity: true,
  en: {
    title: 'Know how your team is really doing',
    lead: 'Anonymous health checks every sprint, a 20-second weekly pulse, an improvement plan you follow up, and the trend to show leadership.',
    how: 'create a team space, share one link, run a check, reveal together, agree one to three actions, then review them at the next check.',
  },
  zh: {
    title: '真正了解团队的状态',
    lead: '每个迭代一次匿名健康检查，每周 20 秒脉搏调查，持续跟进的改进计划，以及可以拿给管理层看的趋势。',
    how: '创建团队空间，分享一个链接，做一次检查并一起揭晓，商定 1–3 个行动项，下次检查时回顾。',
  },
  tools: [
    // noName: voting is anonymous, so nobody is asked for a name on arrival.
    { view: 'health', icon: 'pulse', kind: 'health-checks', live: true, noName: true, Home: pick('PulseHome'), Room: pick('PulseRoom'),
      en: ['Team health', 'Team spaces with anonymous health checks, a weekly pulse, improvement actions and trends.'],
      zh: ['团队健康', '团队空间：匿名健康检查、每周脉搏、改进行动项和趋势。'] },
  ],
})
