// Slide types: the single source of truth for fields, defaults, labels and result aggregation.
// The server (supabase/live.sql → live_respond) validates the same shapes; keep the two in step.
//
// Common fields: { id, type, question, image?, notes? }   (`notes` and quiz `correct` never reach the audience)
//   mc         options: string[], multiple: bool, chart: 'bars' | 'donut' | 'pie' | 'dots'
//   wordcloud  maxEntries: 1..10 (default 3)
//   open       maxEntries: 1..10 (default 1), layout: 'cards' | 'list'
//   scales     statements: string[], min: int, max: int, lowLabel, highLabel
//   ranking    items: string[]
//   points     items: string[], total: int (default 100)
//   qa         (question is the prompt)
//   quiz       options: string[], correct: int, time: seconds
//   leaderboard
//   heading    subtitle
//   bullets    bullets: string[]
//   quote      author
//   image      image (url) — question is the caption
// Answer values (what live_respond accepts):
//   mc {choices:[i]}  quiz {choice:i}  wordcloud/open {text}  scales {ratings:[n|null]}  ranking {order:[i]}  points {points:[n]}

export const uid = () => Math.random().toString(36).slice(2, 10)

const L = (en, zh) => ({ en, zh })

export const TYPES = {
  mc: { group: 'poll', icon: 'bars', answers: true, label: L('Multiple choice', '单选/多选'), hint: L('Vote on options, results as bars, donut or pie', '投票选择，结果显示为柱状、环形或饼图') },
  wordcloud: { group: 'poll', icon: 'words', answers: true, label: L('Word cloud', '词云'), hint: L('Short answers that grow with popularity', '短词回答，越多人写字越大') },
  open: { group: 'poll', icon: 'comment', answers: true, label: L('Open ended', '开放式问题'), hint: L('Longer free-text answers on a wall', '自由文字回答，显示为卡片墙') },
  scales: { group: 'poll', icon: 'sliders', answers: true, label: L('Scales', '量表'), hint: L('Rate statements on a scale', '为多条陈述打分') },
  ranking: { group: 'poll', icon: 'ranking', answers: true, label: L('Ranking', '排序'), hint: L('Put items in order of preference', '按偏好给选项排序') },
  points: { group: 'poll', icon: 'coins', answers: true, label: L('100 points', '100 分分配'), hint: L('Split 100 points across items', '把 100 分分配给各选项') },
  qa: { group: 'poll', icon: 'question', answers: false, label: L('Q&A', '问答'), hint: L('Audience asks and upvotes questions', '观众提问并点赞') },
  quiz: { group: 'quiz', icon: 'bolt', answers: true, label: L('Quiz question', '抢答题'), hint: L('Timed question, faster correct answers score more', '限时作答，答对越快得分越高') },
  leaderboard: { group: 'quiz', icon: 'trophy', answers: false, label: L('Leaderboard', '排行榜'), hint: L('Quiz scores so far', '目前的抢答得分') },
  heading: { group: 'content', icon: 'heading', answers: false, label: L('Heading', '标题页'), hint: L('A big title with a subtitle', '大标题加副标题') },
  bullets: { group: 'content', icon: 'list', answers: false, label: L('Bullets', '要点'), hint: L('A short list of points', '几条要点') },
  quote: { group: 'content', icon: 'quote', answers: false, label: L('Quote', '引言'), hint: L('A quote and who said it', '一句引言和出处') },
  image: { group: 'content', icon: 'image', answers: false, label: L('Image', '图片'), hint: L('A full-slide picture with a caption', '整页图片和说明') },
}

export const GROUPS = [
  { id: 'poll', label: L('Interactive questions', '互动问题') },
  { id: 'quiz', label: L('Quiz competition', '抢答竞赛') },
  { id: 'content', label: L('Content slides', '内容页') },
]

export const typeLabel = (type, lang) => TYPES[type]?.label[lang] ?? TYPES[type]?.label.en ?? type

const DEFAULTS = {
  mc: lang => ({ question: '', options: lang === 'zh' ? ['选项 1', '选项 2', '选项 3'] : ['Option 1', 'Option 2', 'Option 3'], multiple: false, chart: 'bars' }),
  wordcloud: () => ({ question: '', maxEntries: 3 }),
  open: () => ({ question: '', maxEntries: 1, layout: 'cards' }),
  scales: lang => ({ question: '', statements: lang === 'zh' ? ['陈述 1', '陈述 2'] : ['Statement 1', 'Statement 2'], min: 1, max: 5,
    lowLabel: lang === 'zh' ? '非常不同意' : 'Strongly disagree', highLabel: lang === 'zh' ? '非常同意' : 'Strongly agree' }),
  ranking: lang => ({ question: '', items: lang === 'zh' ? ['选项 1', '选项 2', '选项 3'] : ['Item 1', 'Item 2', 'Item 3'] }),
  points: lang => ({ question: '', items: lang === 'zh' ? ['选项 1', '选项 2', '选项 3'] : ['Item 1', 'Item 2', 'Item 3'], total: 100 }),
  qa: lang => ({ question: lang === 'zh' ? '有什么想问的？' : 'Ask me anything' }),
  quiz: lang => ({ question: '', options: lang === 'zh' ? ['答案 1', '答案 2', '答案 3', '答案 4'] : ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4'], correct: 0, time: 20 }),
  leaderboard: lang => ({ question: lang === 'zh' ? '排行榜' : 'Leaderboard' }),
  heading: () => ({ question: '', subtitle: '' }),
  bullets: () => ({ question: '', bullets: ['', ''] }),
  quote: () => ({ question: '', author: '' }),
  image: () => ({ question: '', image: '' }),
}

export function newSlide(type, lang = 'en', fields = {}) {
  return { id: uid(), type, ...DEFAULTS[type](lang), ...fields }
}

// Switching type keeps the question and anything list-like that fits the new type.
export function changeType(slide, type, lang = 'en') {
  const base = newSlide(type, lang, { id: slide.id, question: slide.question, notes: slide.notes, image: slide.image })
  const list = slide.options ?? slide.items ?? slide.statements
  if (list?.length) {
    if ('options' in base) base.options = [...list]
    if ('items' in base) base.items = [...list]
    if ('statements' in base) base.statements = [...list]
  }
  return base
}

export const takesAnswers = slide => !!TYPES[slide?.type]?.answers
export const isQuiz = slide => slide?.type === 'quiz'
export const hasQuiz = slides => slides.some(isQuiz)

// Warm Lift Apps palette for chart series. Light and dark variants keep contrast on each background.
// gold, forest, bronze, terracotta, walnut, sage, sand, then deeper/lighter steps of the same hues.
export const SERIES = ['#CCA06A', '#3E6E57', '#8C613A', '#E2A27F', '#6A472D', '#A9C8AE', '#DBBE94', '#5E8A72', '#B9875A', '#C98F6E']
export const SERIES_DARK = ['#DBBE94', '#A9C8AE', '#E2A27F', '#CCA06A', '#7FA88E', '#C9A47C', '#F0DDBF', '#B98B5E', '#93B5A4', '#E8BFA3']
export const seriesColor = (i, dark) => (dark ? SERIES_DARK : SERIES)[i % SERIES.length]
// Text drawn in series colours (word cloud) needs the deeper end of the palette on ivory.
export const TEXT_SERIES = ['#6A472D', '#3E6E57', '#8C613A', '#A97A44', '#A8664A', '#56806A', '#2B1E14']
export const TEXT_SERIES_DARK = ['#DBBE94', '#A9C8AE', '#E2A27F', '#CCA06A', '#F0DDBF', '#C9A47C', '#F6EEE2']
// Quiz answer tiles: four to six strong, distinct warm colours.
export const QUIZ_COLORS = ['#E2A27F', '#3E6E57', '#6A472D', '#CCA06A', '#A9C8AE', '#8C613A']
// Ink or ivory, whichever reads better on a filled colour.
export function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2B1E14' : '#FFFCF7'
}

// Reduce raw responses [{ id, voter, entry, value, at }] to what each chart draws.
export function aggregate(slide, responses = []) {
  const voters = new Set(responses.map(r => r.voter)).size
  switch (slide?.type) {
    case 'mc': {
      const counts = slide.options.map(() => 0)
      for (const r of responses) for (const c of r.value.choices ?? []) if (c in counts) counts[c]++
      return { counts, voters, total: counts.reduce((a, b) => a + b, 0) }
    }
    case 'quiz': {
      const counts = slide.options.map(() => 0)
      for (const r of responses) if (r.value.choice in counts) counts[r.value.choice]++
      return { counts, voters, total: responses.length }
    }
    case 'wordcloud': {
      const map = new Map()
      for (const r of responses) {
        const text = String(r.value.text ?? '').trim()
        const key = text.toLowerCase()
        if (!key) continue
        const w = map.get(key) ?? { text, count: 0 }
        w.count++
        map.set(key, w)
      }
      const words = [...map.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
      return { words, voters, total: responses.length }
    }
    case 'open': {
      const items = responses.map(r => ({ id: r.id, text: r.value.text, at: r.at })).sort((a, b) => b.id - a.id)
      return { items, voters, total: items.length }
    }
    case 'scales': {
      const min = slide.min ?? 1, max = slide.max ?? 5
      const stats = slide.statements.map((_, i) => {
        const dist = Array.from({ length: max - min + 1 }, () => 0)
        let sum = 0, count = 0
        for (const r of responses) {
          const v = r.value.ratings?.[i]
          if (typeof v === 'number') { dist[v - min]++; sum += v; count++ }
        }
        return { avg: count ? sum / count : null, count, dist }
      })
      return { stats, voters, total: responses.length }
    }
    case 'ranking': {
      // Borda count: first place earns n points, last earns 1; also the average position.
      const n = slide.items.length
      const scores = slide.items.map((text, index) => ({ index, text, score: 0, rankSum: 0 }))
      for (const r of responses) (r.value.order ?? []).forEach((item, pos) => {
        if (scores[item]) { scores[item].score += n - pos; scores[item].rankSum += pos + 1 }
      })
      const ranked = scores.map(s => ({ ...s, avgRank: responses.length ? s.rankSum / responses.length : null }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
      return { ranked, voters, total: responses.length }
    }
    case 'points': {
      const totals = slide.items.map(() => 0)
      for (const r of responses) (r.value.points ?? []).forEach((p, i) => { if (i in totals) totals[i] += p })
      const sum = totals.reduce((a, b) => a + b, 0)
      return { totals, sum, voters, total: responses.length }
    }
    default:
      return { voters, total: responses.length }
  }
}

// Plausible fake results so the editor preview shows what a slide will look like when people vote.
export function sampleResponses(slide) {
  const seq = [5, 8, 3, 6, 2, 7, 4, 1, 9, 2]
  const out = []
  const push = value => out.push({ id: out.length + 1, voter: `s${out.length}`, entry: 0, value, at: 0 })
  switch (slide?.type) {
    case 'mc': slide.options.forEach((_, i) => { for (let k = 0; k < seq[i % seq.length]; k++) push({ choices: [i] }) }); break
    case 'quiz': slide.options.forEach((_, i) => { for (let k = 0; k < seq[i % seq.length]; k++) push({ choice: i }) }); break
    case 'wordcloud': ['ideas', 'fun', 'team', 'ideas', 'growth', 'focus', 'ideas', 'team', 'energy', 'clarity', 'fun', 'trust'].forEach(text => push({ text })); break
    case 'open': ['This is what an answer looks like', 'People’s answers appear here as they come in', 'Each one gets its own card'].forEach(text => push({ text })); break
    case 'scales': for (let k = 0; k < 6; k++) push({ ratings: slide.statements.map((_, i) => Math.min(slide.max ?? 5, (slide.min ?? 1) + ((k + i * 2) % ((slide.max ?? 5) - (slide.min ?? 1) + 1)))) }); break
    case 'ranking': for (let k = 0; k < 5; k++) push({ order: slide.items.map((_, i) => (i + k) % slide.items.length) }); break
    case 'points': for (let k = 0; k < 4; k++) push({ points: slide.items.map((_, i) => (i === k % slide.items.length ? (slide.total ?? 100) - 10 * (slide.items.length - 1) : 10)) }); break
    default: break
  }
  return out
}

// Columns of a CSV for one slide's raw responses.
export function describeValue(slide, value) {
  switch (slide?.type) {
    case 'mc': return (value.choices ?? []).map(i => slide.options[i]).join('; ')
    case 'quiz': return slide.options[value.choice] ?? ''
    case 'wordcloud': case 'open': return value.text ?? ''
    case 'scales': return slide.statements.map((s, i) => `${s}: ${value.ratings?.[i] ?? '–'}`).join('; ')
    case 'ranking': return (value.order ?? []).map((i, pos) => `${pos + 1}. ${slide.items[i]}`).join('; ')
    case 'points': return slide.items.map((s, i) => `${s}: ${value.points?.[i] ?? 0}`).join('; ')
    default: return JSON.stringify(value)
  }
}
