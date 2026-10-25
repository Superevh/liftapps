import { lazy } from 'react'
import { boot } from './core/boot.jsx'

// PulseLift (团队健康): the team health check.
const health = () => import('./health/Health.jsx')
const pick = name => lazy(() => health().then(m => ({ default: m[name] })))

boot({
  key: 'pulse',
  name: 'PulseLift',
  en: {
    title: 'How is the team really doing?',
    lead: 'An anonymous team health check. Everyone rates each area from their phone, you reveal together and follow the trend over time.',
    how: 'create a check, share the link or QR code, wait for at least three votes, reveal, then pick one or two areas to improve. Repeat each sprint or quarter.',
  },
  zh: {
    title: '团队的真实状态如何？',
    lead: '匿名的团队健康检查。每个人用手机为各个方面打分，一起揭晓结果，并持续跟踪趋势。',
    how: '创建一次检查，分享链接或二维码，至少等三人投完再揭晓，然后挑一两个方面改进。每个迭代或季度重复一次。',
  },
  tools: [
    { view: 'health', icon: 'pulse', kind: 'health-checks', live: true, Home: pick('HealthHome'), Room: pick('HealthCheck'),
      en: ['Team health check', 'Green, amber or red for the areas that matter, voted in private, with trends across checks.'],
      zh: ['团队健康检查', '为关键维度投绿、黄或红，私下投票，跨多次检查看趋势。'] },
  ],
})
