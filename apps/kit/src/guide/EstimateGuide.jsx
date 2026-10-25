import { useState } from 'react'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import './guide.css'

// "How teams estimate": a short, neutral field guide shown on the EstimateLift home, before the tool cards.
// Each method: [name, what it is, when to use it, pros, cons, tool view or null, tool label].

const T = {
  en: {
    title: 'How teams estimate', lead: 'There is no single right way. Pick the method that matches the question you need answered: how big, how long, how sure, or how much scope.',
    show: 'Show the guide', hide: 'Hide the guide', what: 'What it is', when: 'When to use', pros: 'Pros', cons: 'Cons', tool: 'In EstimateLift', open: 'Open', noTool: 'No tool needed', more: 'Details',
    groups: { relative: 'Relative size', time: 'Time and effort', confidence: 'Confidence', scope: 'Functional size' },
    pert: {
      title: 'Three-point (PERT) calculator', lead: 'Enter optimistic, most likely and pessimistic values in any unit (hours, days, points).',
      o: 'Optimistic (O)', m: 'Most likely (M)', p: 'Pessimistic (P)', e: 'Expected', sd: 'Std. deviation', range: 'About 95% range', formula: 'E = (O + 4M + P) / 6 · σ = (P − O) / 6',
      bad: 'Use O ≤ M ≤ P.',
    },
    methods: [
      ['relative', 'Story points with planning poker', 'A relative size for each backlog item, combining effort, complexity and uncertainty. Everyone picks a card from a Fibonacci (1, 2, 3, 5, 8, 13…) or modified Fibonacci (½, 1, 2, 3, 5, 8, 13, 20, 40, 100) deck in private, then all cards are revealed at once.',
        'Sprint-level backlog items for a stable team that tracks velocity. The growing gaps in the scale reflect growing uncertainty.',
        'Simultaneous reveal stops anchoring; disagreement surfaces hidden assumptions; fast once a team has reference stories.',
        'Points are team-specific and easily misread as hours or productivity; slow for very large backlogs.', 'poker', 'Planning poker'],
      ['relative', 'T-shirt sizing', 'Items are sorted into XS, S, M, L, XL buckets instead of numbers.',
        'Early roadmap or epic-level sizing, and with stakeholders who would over-read precise numbers.',
        'Quick, intuitive, and honest about low precision.', 'Sizes do not add up without mapping them to numbers; the mapping is often argued about.', 'sizing', 'T-shirt sizing'],
      ['relative', 'Affinity, bucket and relative sizing', 'The whole group places items along a scale, usually silently, comparing each one with items already placed. Bucket sizing uses fixed columns of a point scale; affinity sizing starts with a free “smaller to larger” line.',
        'Sizing dozens or hundreds of items in one session, such as a new backlog or release scope.',
        'Very fast; only disputed items get discussed; works well with large groups.', 'Less discussion per item, so misunderstandings can stay hidden; quiet people can still be overruled by repeated moves.', 'sizing', 'T-shirt sizing (silent board)'],
      ['relative', 'Wideband Delphi', 'Experts estimate anonymously, see the spread and the reasoning, discuss assumptions, then estimate again for a few rounds until the range narrows.',
        'Larger, riskier pieces of work where expert judgement matters and individual voices should not dominate.',
        'Reduces groupthink and anchoring; records assumptions; converges with reasons, not pressure.', 'Takes several rounds and a facilitator; heavier than a quick poker round.', 'poker', 'Planning poker (re-vote rounds)'],
      ['time', 'Three-point estimation (PERT)', 'Give an optimistic (O), most likely (M) and pessimistic (P) value; the expected value is (O + 4M + P) / 6 and the spread (P − O) / 6 shows the risk.',
        'Tasks or projects that need a time or cost range for a plan, a budget or a risk discussion.',
        'Makes uncertainty explicit; simple maths; ranges add up across tasks.', 'The three numbers are still guesses; people tend to give a pessimistic value that is not pessimistic enough.', null, 'Calculator below'],
      ['time', 'Ideal days and hours', 'How long the work would take one person with no interruptions, later scaled by availability or focus factor.',
        'Short tasks within a sprint, or teams new to estimation who find time easier than points.',
        'Easy to understand; maps directly to calendars and capacity.', 'Easily confused with elapsed time and turned into a commitment; varies by who does the work.', 'poker', 'Planning poker (hours deck)'],
      ['time', '#NoEstimates and throughput forecasting', 'Instead of sizing items, split work into similarly small pieces and forecast from how many items the team actually finishes per week, often with a range or a Monte Carlo simulation.',
        'Teams with a steady flow of small items and some history, answering “when will it be done?”',
        'Uses real data rather than opinions; saves estimation time; gives probabilistic dates.', 'Needs history and consistently small items; less useful for one-off, novel or very large work.', 'sizing', 'T-shirt sizing (check items are small)'],
      ['confidence', 'Confidence vote (fist of five)', 'Everyone shows 0 to 5 fingers for how confident they are in a plan, sprint goal or forecast. Low votes start a conversation, not a debate about numbers.',
        'At the end of sprint planning, release or big-room planning, or before committing to a date.',
        'Seconds to run; surfaces hidden doubts; works for any plan.', 'Says nothing about size; only useful if low votes are followed up.', 'confidence', 'Confidence vote'],
      ['scope', 'Function point analysis', 'A standardised (IFPUG) count of what software does for its users: external inputs, outputs and inquiries, plus internal and external logical files, each weighted by complexity. An optional value adjustment factor reflects 14 system characteristics.',
        'Contracts, outsourcing, benchmarking, portfolio comparison or measuring scope change in larger systems, independent of technology.',
        'Technology-neutral and repeatable; comparable across teams and projects; tracks scope growth.', 'Needs training and fairly complete requirements; slow for small changes; converting to effort still needs your own historical rate.', 'fpa', 'Function points'],
    ],
  },
  zh: {
    title: '团队怎样做估算', lead: '没有唯一正确的方法。根据你要回答的问题来选：有多大、要多久、有多大把握，还是范围有多少。',
    show: '展开指南', hide: '收起指南', what: '是什么', when: '何时使用', pros: '优点', cons: '缺点', tool: '在 EstimateLift 中', open: '打开', noTool: '无需工具', more: '详情',
    groups: { relative: '相对规模', time: '时间与工作量', confidence: '信心', scope: '功能规模' },
    pert: {
      title: '三点估算（PERT）计算器', lead: '输入乐观、最可能和悲观值，单位任意（小时、天、故事点）。',
      o: '乐观值（O）', m: '最可能值（M）', p: '悲观值（P）', e: '期望值', sd: '标准差', range: '约 95% 区间', formula: 'E = (O + 4M + P) / 6 · σ = (P − O) / 6',
      bad: '请保证 O ≤ M ≤ P。',
    },
    methods: [
      ['relative', '故事点与计划扑克', '为每个待办条目给出相对规模，综合考虑工作量、复杂度和不确定性。每人从斐波那契（1、2、3、5、8、13…）或改良斐波那契（½、1、2、3、5、8、13、20、40、100）牌组中私下选牌，然后同时亮牌。',
        '稳定团队估算迭代级别的待办条目，并跟踪速率。刻度间隔越来越大，体现不确定性随规模增长。',
        '同时亮牌避免锚定；分歧能暴露隐含假设；有了参照故事后速度很快。',
        '故事点只对本团队有意义，容易被误读为工时或生产率；待办很多时会比较慢。', 'poker', '计划扑克'],
      ['relative', 'T 恤尺码估算', '把条目分到 XS、S、M、L、XL 等尺码，而不是给数字。',
        '路线图早期或史诗级别的粗估，以及面对容易过度解读精确数字的干系人时。',
        '快速、直观，坦率表明精度有限。', '尺码不能直接相加，需要映射成数字，而映射本身常引发争论。', 'sizing', 'T 恤尺码估算'],
      ['relative', '亲和估算、分桶估算与相对估算', '全员把条目放到一条刻度上，通常不说话，每个条目都和已放好的条目比较。分桶估算使用固定的点数列；亲和估算先排出一条“从小到大”的队列。',
        '一次估算几十上百个条目，例如新的待办列表或一个版本的范围。',
        '非常快；只讨论有争议的条目；适合人多的场合。', '每个条目讨论较少，误解可能被掩盖；反复移动卡片也可能压过安静的人。', 'sizing', 'T 恤尺码估算（静默估算板）'],
      ['relative', '宽带德尔菲法', '专家匿名估算，查看分布和理由，讨论假设后再估，重复几轮直到区间收敛。',
        '规模较大、风险较高、需要专家判断，且不希望个别声音主导的工作。',
        '减少从众和锚定；记录假设；靠理由而非压力达成收敛。', '需要多轮和一位引导者，比一轮计划扑克重。', 'poker', '计划扑克（多轮重投）'],
      ['time', '三点估算（PERT）', '给出乐观值（O）、最可能值（M）和悲观值（P）；期望值为 (O + 4M + P) / 6，(P − O) / 6 表示风险大小。',
        '需要为计划、预算或风险讨论给出时间或成本区间的任务或项目。',
        '把不确定性摆上台面；计算简单；区间可以跨任务累加。', '三个数仍是猜测；人们给出的悲观值往往还不够悲观。', null, '见下方计算器'],
      ['time', '理想人天与工时', '一个人不受打扰完成这项工作需要多久，之后再按可用时间或专注系数换算。',
        '迭代内的小任务，或觉得时间比故事点更好理解的新团队。',
        '容易理解；能直接对应日历和容量。', '容易和实际耗时混淆并被当成承诺；结果因人而异。', 'poker', '计划扑克（工时牌组）'],
      ['time', '#NoEstimates 与吞吐量预测', '不给条目估大小，而是把工作拆成差不多小的块，根据团队每周实际完成的条目数来预测，常给出区间或用蒙特卡洛模拟。',
        '有稳定的小条目流动、并有一定历史数据的团队，回答“什么时候能完成？”。',
        '用真实数据而非意见；节省估算时间；给出带概率的日期。', '需要历史数据，条目大小要一致；对一次性、全新或特别大的工作作用有限。', 'sizing', 'T 恤尺码估算（检查条目是否够小）'],
      ['confidence', '信心投票（举手五指）', '每人伸出 0 到 5 根手指，表示对计划、迭代目标或预测的信心。低分用来引出对话，而不是争论数字。',
        '迭代计划、版本计划或大型联合规划结束时，或在承诺日期之前。',
        '几秒钟完成；暴露隐藏的顾虑；适用于任何计划。', '不反映规模；低分如果没有跟进就没有意义。', 'confidence', '信心投票'],
      ['scope', '功能点分析', '按 IFPUG 标准统计软件为用户提供的功能：外部输入、外部输出、外部查询，以及内部逻辑文件和外部接口文件，并按复杂度加权。可选的值调整因子反映 14 项系统特征。',
        '合同、外包、基准对比、项目组合比较，或在较大系统中衡量范围变化，且与技术无关。',
        '与技术无关、可重复；可在团队和项目间比较；能跟踪范围增长。', '需要培训和比较完整的需求；小改动时显得慢；换算成工作量仍需自己的历史数据。', 'fpa', '功能点估算'],
    ],
  },
}

const KEY = 'lift-estimate-guide'

export default function EstimateGuide() {
  const lang = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(() => {
    // Open by default on wide screens; on phones it starts folded so the tools stay in reach.
    const wide = window.matchMedia?.('(min-width: 720px)').matches ?? true
    try { const v = localStorage.getItem(KEY); return v ? v === 'open' : wide } catch { return wide }
  })
  const toggle = e => {
    const next = e.currentTarget.open
    setOpen(next)
    try { localStorage.setItem(KEY, next ? 'open' : 'closed') } catch { /* private mode */ }
  }
  return (
    <details className="tool-card eg" open={open} onToggle={toggle} id="guide">
      <summary>
        <span className="eg-ico"><Icon name="compass" size={20} /></span>
        <span className="eg-head"><h2>{t.title}</h2><span className="muted">{t.lead}</span></span>
        <span className="eg-toggle">{open ? t.hide : t.show}</span>
      </summary>
      <div className="eg-body">
        {Object.keys(t.groups).map(g => (
          <section key={g} className="eg-group">
            <h3>{t.groups[g]}</h3>
            <div className="eg-grid">
              {t.methods.filter(m => m[0] === g).map(([, name, what, when, pros, cons, view, label]) => (
                <details key={name} className="eg-method">
                  <summary><b>{name}</b><span className="eg-what">{what}</span><span className="eg-more">{t.more}</span></summary>
                  <dl>
                    <dt>{t.when}</dt><dd>{when}</dd>
                    <dt>{t.pros}</dt><dd>{pros}</dd>
                    <dt>{t.cons}</dt><dd>{cons}</dd>
                  </dl>
                  <div className="eg-tool">
                    <span className="muted small">{t.tool}:</span>
                    {view ? <a className="btn ghost sm" href={`#/${view}`}>{label} <Icon name="right" size={13} /></a> : <button type="button" className="link-btn" onClick={() => document.getElementById('pert')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{label}</button>}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <Pert t={t.pert} />
      </div>
    </details>
  )
}

const r1 = n => Math.round(n * 100) / 100

function Pert({ t }) {
  const [v, setV] = useState({ o: '2', m: '4', p: '9' })
  const o = Number(v.o), m = Number(v.m), p = Number(v.p)
  const valid = [v.o, v.m, v.p].every(x => x !== '' && Number.isFinite(Number(x))) && o <= m && m <= p
  const e = (o + 4 * m + p) / 6
  const sd = (p - o) / 6
  return (
    <section className="eg-pert" id="pert">
      <h3>{t.title}</h3>
      <p className="muted small">{t.lead}</p>
      <div className="eg-pert-row">
        {['o', 'm', 'p'].map(k => (
          <label key={k}><span className="field-label">{t[k]}</span><input type="number" inputMode="decimal" min="0" step="any" value={v[k]} onChange={ev => setV(s => ({ ...s, [k]: ev.target.value }))} data-pert={k} /></label>
        ))}
      </div>
      {valid ? (
        <dl className="eg-pert-out">
          <div><dt>{t.e}</dt><dd data-testid="pert-e">{r1(e)}</dd></div>
          <div><dt>{t.sd}</dt><dd>{r1(sd)}</dd></div>
          <div><dt>{t.range}</dt><dd>{r1(Math.max(0, e - 2 * sd))} – {r1(e + 2 * sd)}</dd></div>
        </dl>
      ) : <p className="auth-error">{t.bad}</p>}
      <p className="muted small eg-formula">{t.formula}</p>
    </section>
  )
}
