import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, uid } from '../core/store.jsx'
import { useLang } from '../core/lang.js'
import { Icon } from '../core/icons.jsx'
import { navigate, useClickOutside } from '../core/ui.jsx'
import { useLiveDoc, createDoc, deleteDoc, newDocId, rememberDoc, rememberedDocs, forgetDoc, backend } from '../core/live.js'
import { InviteButton, DocStatus, HowTo, fill, ago } from '../core/tools-ui.jsx'
import { TYPES, LEVELS, WEIGHTS, GSC_COUNT, MAX_FUNCTIONS, newCount, reduce, compute, weightOf, countCsv, countMarkdown } from './model.js'
import './fpa.css'

const T = {
  en: {
    eyebrow: 'Function points', title: 'Size software by what it does for users', lead: 'Count the functions a system offers its users, IFPUG style: inputs, outputs, inquiries and the data it keeps or reads. Weights add up to a size that does not depend on technology or team speed. Count together from one link.',
    create: 'New count', name: 'Name', namePh: 'e.g. Customer portal, release 2', start: 'Create count', yours: 'Your counts', none: 'Counts you create or open show up here.', remove: 'Remove', created: 'Created {d}',
    localOnly: 'Saved in this browser only (live sharing is not configured).', notFound: 'Not found', back: 'All counts',
    steps: [
      ['Draw the boundary', 'Agree what is inside the application being counted and who its users are (people or other systems).'],
      ['List the functions', 'Add each elementary process (EI, EO, EQ) and each logical group of data (ILF, EIF) the user would recognise.'],
      ['Rate complexity', 'Low, average or high. When you have no detail yet, average is a fair default.'],
      ['Adjust if you need to', 'Optionally rate the 14 general system characteristics to get the value adjustment factor.'],
      ['Convert and share', 'Enter your own hours per function point to get an effort range, then copy the result as Markdown or CSV.'],
    ],
    tips: [
      'Count from the user’s point of view, not from screens, tables or code modules.',
      'Hours per FP depends heavily on your team and stack. Calibrate it from a finished project of your own.',
      'Function points are best for comparing scope, tracking scope change and benchmarking, not for sprint-level planning.',
    ],
    types: {
      EI: ['External input', 'Data or a command crossing into the system that maintains stored data or changes behaviour.', 'e.g. “Create customer” form'],
      EO: ['External output', 'Data sent out of the system with calculation, derived data or logic applied.', 'e.g. monthly sales report with totals'],
      EQ: ['External inquiry', 'Data retrieved and shown as stored, with no calculation and no update.', 'e.g. look up an order by number'],
      ILF: ['Internal logical file', 'A user-recognisable group of data that this system maintains.', 'e.g. customer records'],
      EIF: ['External interface file', 'A group of data this system reads but another system maintains.', 'e.g. exchange rates from the finance system'],
    },
    levels: { low: 'Low', avg: 'Average', high: 'High' },
    complexityHint: 'IFPUG rates complexity from data element types (DETs) and the files a transaction references (FTRs), or for files, their record element types (RETs). No detail yet? Use Average.',
    add: 'Add function', fnName: 'Function', fnNamePh: 'e.g. Register new customer', type: 'Type', complexity: 'Complexity', weight: 'Weight', notes: 'Notes', addBtn: 'Add',
    list: 'Functions', listEmpty: 'No functions yet. Add the first one, or think through one user goal at a time.', del: 'Remove function', limit: 'This count has the maximum number of functions.',
    breakdown: 'Breakdown', points: 'FP', total: 'Total', ufp: 'Unadjusted function points (UFP)', ufpShort: 'UFP',
    vaf: 'Value adjustment factor (optional)', vafOn: 'Apply the value adjustment factor', vafHint: 'Rate how much each characteristic influences the system: 0 none, 1 incidental, 2 moderate, 3 average, 4 significant, 5 essential.',
    tdi: 'Total degree of influence (TDI)', vafLabel: 'VAF = 0.65 + 0.01 × TDI', afp: 'Adjusted function points', afpShort: 'AFP', allTo: 'Set all to {n}',
    gsc: 'General system characteristic',
    gscNames: ['Data communications', 'Distributed data processing', 'Performance', 'Heavily used configuration', 'Transaction rate', 'Online data entry', 'End-user efficiency', 'Online update', 'Complex processing', 'Reusability', 'Installation ease', 'Operational ease', 'Multiple sites', 'Facilitate change'],
    effort: 'Effort estimate', effortHint: 'Optional. Use a rate from your own history; industry rates vary several-fold.', hoursPerFp: 'Hours per FP', hoursPerDay: 'Hours per day', hours: 'Estimated hours', days: 'Estimated days', daysUnit: 'days', hoursUnit: 'h',
    copyMd: 'Copy as Markdown', csv: 'Download CSV', copied: 'Copied!', more: 'More', deleteCount: 'Delete count', confirm: 'Click again to confirm', by: 'added by {name}',
    fn: 'Function',
  },
  zh: {
    eyebrow: '功能点估算', title: '按软件为用户做了什么来衡量规模', lead: '用 IFPUG 方法统计系统提供给用户的功能：输入、输出、查询，以及系统维护或读取的数据。按权重累加出与技术、团队速度无关的规模。分享一个链接，大家一起数。',
    create: '新建功能点统计', name: '名称', namePh: '例如：客户门户第 2 版', start: '创建统计', yours: '我的统计', none: '你创建或打开的统计会显示在这里。', remove: '移除', created: '创建于 {d}',
    localOnly: '只保存在本浏览器（未配置实时分享）。', notFound: '没有找到', back: '所有统计',
    steps: [
      ['划定边界', '先明确要统计的应用包含哪些部分、用户是谁（人或其他系统）。'],
      ['列出功能', '逐个添加用户能识别的基本处理（EI、EO、EQ）和逻辑数据组（ILF、EIF）。'],
      ['评定复杂度', '低、中、高三档。细节还不清楚时，选“中”是合理的默认值。'],
      ['按需调整', '可以为 14 项通用系统特征打分，得到值调整因子。'],
      ['换算并分享', '填入你们自己的每功能点工时，得到工作量估计，再复制为 Markdown 或 CSV。'],
    ],
    tips: [
      '从用户视角计数，而不是按页面、数据表或代码模块计数。',
      '每功能点工时与团队和技术栈关系很大，最好用自己做完的项目来校准。',
      '功能点最适合比较范围、跟踪范围变化和做基准对比，不适合用于迭代级别的计划。',
    ],
    types: {
      EI: ['外部输入', '从系统外进入的数据或指令，用于维护存储的数据或改变系统行为。', '例如：“新建客户”表单'],
      EO: ['外部输出', '发送到系统外的数据，包含计算、派生数据或业务逻辑。', '例如：带合计的月度销售报表'],
      EQ: ['外部查询', '按存储原样检索并展示数据，不做计算也不更新。', '例如：按订单号查询订单'],
      ILF: ['内部逻辑文件', '由本系统维护、用户可识别的一组数据。', '例如：客户档案'],
      EIF: ['外部接口文件', '本系统读取、但由其他系统维护的一组数据。', '例如：从财务系统读取的汇率'],
    },
    levels: { low: '低', avg: '中', high: '高' },
    complexityHint: 'IFPUG 依据数据元素类型（DET）和事务引用的文件类型（FTR）评定复杂度，数据文件则看记录元素类型（RET）。暂无细节时选“中”。',
    add: '添加功能', fnName: '功能', fnNamePh: '例如：注册新客户', type: '类型', complexity: '复杂度', weight: '权重', notes: '备注', addBtn: '添加',
    list: '功能清单', listEmpty: '还没有功能。添加第一个，或者一次只梳理一个用户目标。', del: '删除功能', limit: '功能数量已达上限。',
    breakdown: '明细', points: '功能点', total: '合计', ufp: '未调整功能点（UFP）', ufpShort: 'UFP',
    vaf: '值调整因子（可选）', vafOn: '应用值调整因子', vafHint: '为每项特征对系统的影响程度打分：0 无影响，1 偶然，2 适度，3 一般，4 显著，5 关键。',
    tdi: '总影响度（TDI）', vafLabel: 'VAF = 0.65 + 0.01 × TDI', afp: '调整后功能点', afpShort: 'AFP', allTo: '全部设为 {n}',
    gsc: '通用系统特征',
    gscNames: ['数据通信', '分布式数据处理', '性能', '高负荷配置', '事务率', '联机数据录入', '最终用户效率', '联机更新', '复杂处理', '可复用性', '易安装性', '易操作性', '多场地部署', '便于变更'],
    effort: '工作量估计', effortHint: '可选。请使用你们自己的历史数据，业界数值相差数倍。', hoursPerFp: '每功能点工时', hoursPerDay: '每天工时', hours: '估计工时', days: '估计人天', daysUnit: '人天', hoursUnit: '小时',
    copyMd: '复制为 Markdown', csv: '下载 CSV', copied: '已复制！', more: '更多', deleteCount: '删除统计', confirm: '再点一次确认', by: '由 {name} 添加',
    fn: '功能',
  },
}

const KIND = 'fpa-counts'

// ---------- storage: live document, or this browser when no backend is configured ----------

const LOCAL = id => `lift-fpa-local:${id}`
const readLocal = id => { try { return JSON.parse(localStorage.getItem(LOCAL(id))) } catch { return null } }
const writeLocal = (id, doc) => { try { localStorage.setItem(LOCAL(id), JSON.stringify(doc)) } catch { /* storage full or blocked */ } }

function useLocalDoc(id) {
  const [doc, setDoc] = useState(() => readLocal(id))
  useEffect(() => {
    const h = e => { if (e.key === LOCAL(id)) setDoc(readLocal(id)) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [id])
  const dispatch = useCallback(raw => {
    const action = { ...raw, nonce: uid() + uid(), at: Date.now() }
    setDoc(prev => { const next = reduce(prev, action); writeLocal(id, next); return next })
  }, [id])
  return { status: doc ? 'ready' : 'missing', doc, dispatch, error: null, local: true }
}

// `backend` never changes during a page's life, so the hook choice is stable.
const useCountDoc = backend ? id => useLiveDoc(id, reduce) : useLocalDoc

const num = n => (Number.isInteger(n) ? String(n) : n.toFixed(n * 10 % 1 === 0 ? 1 : 2))

// ---------- lobby ----------

export function FpaHome() {
  const { identity } = useStore()
  const lang = useLang()
  const t = T[lang]
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [list, setList] = useState(() => rememberedDocs(KIND))
  const create = e => {
    e.preventDefault()
    const id = newDocId('fp')
    const doc = newCount({ id, name: name.trim() || t.eyebrow, owner: { id: identity.id }, at: Date.now() })
    const done = () => { rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt }); navigate(`/fpa/${id}`) }
    if (!backend) { writeLocal(id, doc); done(); return }
    setBusy(true)
    createDoc(id, doc, identity.secret).then(done, err => { setBusy(false); setError(err.message) })
  }
  return (
    <main className="tool-page fp-home">
      <section className="tool-hero fp-hero">
        <div>
          <div className="hero-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <div className="fp-hero-art" aria-hidden="true">
          {TYPES.map((x, i) => <span key={x} className={i === 3 ? 'on' : ''}><b>{x}</b><i>{WEIGHTS[x].avg}</i></span>)}
        </div>
      </section>
      <HowTo tool="fpa" steps={t.steps} tips={t.tips} />
      <div className="fp-home-grid">
        <form className="tool-card" onSubmit={create}>
          <h2>{t.create}</h2>
          <label className="field-label" htmlFor="fp-name">{t.name}</label>
          <input id="fp-name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={120} />
          <TypeLegend t={t} />
          {!backend && <p className="muted small">{t.localOnly}</p>}
          {error && <p className="auth-error">{error}</p>}
          <div className="row end"><button className="btn primary" disabled={busy}><Icon name="plus" /> {t.start}</button></div>
        </form>
        <section className="tool-card">
          <h2>{t.yours}</h2>
          {list.length ? (
            <ul className="doc-list">
              {list.map(r => (
                <li key={r.id}>
                  <a href={`#/fpa/${r.id}`} className="grow"><b>{r.name}</b><span className="muted small">{fill(t.created, { d: ago(r.at, lang) })}</span></a>
                  <button className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => { forgetDoc(KIND, r.id); setList(rememberedDocs(KIND)) }}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.none}</p>}
        </section>
      </div>
    </main>
  )
}

function TypeLegend({ t }) {
  return (
    <dl className="fp-legend">
      {TYPES.map(x => (
        <div key={x}>
          <dt><span className={`fp-type t-${x}`}>{x}</span> {t.types[x][0]} <span className="fp-w">{WEIGHTS[x].low}/{WEIGHTS[x].avg}/{WEIGHTS[x].high}</span></dt>
          <dd>{t.types[x][1]} <em>{t.types[x][2]}</em></dd>
        </div>
      ))}
    </dl>
  )
}

// ---------- the count ----------

export function FpaRoom({ id }) {
  const { status, doc, dispatch, error, local } = useCountDoc(id)
  const lang = useLang()
  const t = T[lang]
  useEffect(() => {
    if (doc) rememberDoc(KIND, { id, name: doc.name, at: doc.createdAt })
  }, [id, doc?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  if (status !== 'ready') return status === 'missing' && !backend ? <div className="empty-page"><h2>{t.notFound}</h2></div> : <DocStatus status={status} />
  return <Count doc={doc} dispatch={dispatch} error={error} local={local} t={t} lang={lang} />
}

function Count({ doc, dispatch, error, local, t }) {
  const c = compute(doc)
  return (
    <main className="tool-page fp-page">
      <div className="fp-bar">
        <a className="icon-btn" href="#/fpa" aria-label={t.back} title={t.back}><Icon name="left" /></a>
        <Title doc={doc} dispatch={dispatch} />
        <span className="fp-chip" data-testid="fp-ufp">{t.ufpShort} <b>{c.ufp}</b></span>
        {doc.vafOn && <span className="fp-chip gold" data-testid="fp-afp-chip">{t.afpShort} <b>{num(c.afp)}</b></span>}
        <span className="spacer" />
        {!local && <InviteButton />}
        <CountMenu doc={doc} t={t} />
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div className="fp-layout">
        <div className="fp-main">
          {doc.functions.length < MAX_FUNCTIONS ? <AddFunction dispatch={dispatch} t={t} /> : <p className="muted small">{t.limit}</p>}
          <section className="tool-card">
            <div className="tool-card-head"><h2>{t.list} <span className="muted small">({doc.functions.length})</span></h2></div>
            {doc.functions.length === 0 ? <p className="muted">{t.listEmpty}</p> : (
              <ol className="fp-list">
                {doc.functions.map((f, i) => <FnRow key={f.id} f={f} i={i} dispatch={dispatch} t={t} />)}
              </ol>
            )}
          </section>
          <details className="tool-card howto fp-types-card">
            <summary><Icon name="info" /> {t.type}: EI · EO · EQ · ILF · EIF</summary>
            <div className="fp-types-body"><TypeLegend t={t} /><p className="muted small">{t.complexityHint}</p></div>
          </details>
        </div>
        <aside className="fp-side">
          <Breakdown c={c} t={t} />
          <Vaf doc={doc} c={c} dispatch={dispatch} t={t} />
          <Effort doc={doc} c={c} dispatch={dispatch} t={t} />
        </aside>
      </div>
    </main>
  )
}

function Title({ doc, dispatch }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(doc.name)
  if (editing) {
    const save = () => { if (v.trim() && v.trim() !== doc.name) dispatch({ type: 'RENAME', name: v.trim() }); setEditing(false) }
    return <input className="fp-name-input" autoFocus value={v} maxLength={120} onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
  }
  return <h1 className="fp-name" tabIndex={0} onClick={() => { setV(doc.name); setEditing(true) }} onKeyDown={e => { if (e.key === 'Enter') { setV(doc.name); setEditing(true) } }}>{doc.name}</h1>
}

function TypePick({ value, onChange, t, name }) {
  return (
    <div className="fp-pick" role="radiogroup" aria-label={name}>
      {TYPES.map(x => (
        <button type="button" key={x} role="radio" aria-checked={value === x} className={`fp-pick-btn ${value === x ? 'sel' : ''}`} title={`${t.types[x][0]}: ${t.types[x][1]}`} onClick={() => onChange(x)}>
          <b>{x}</b><span>{t.types[x][0]}</span>
        </button>
      ))}
    </div>
  )
}

function AddFunction({ dispatch, t }) {
  const { identity } = useStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('EI')
  const [level, setLevel] = useState('avg')
  const add = e => {
    e.preventDefault()
    if (!name.trim()) return
    dispatch({ type: 'ADD_FN', name: name.trim(), fnType: type, level, by: identity.name || '' })
    setName('')
  }
  return (
    <form className="tool-card fp-add" onSubmit={add}>
      <h2>{t.add}</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={t.fnNamePh} aria-label={t.fnName} maxLength={160} />
      <span className="field-label">{t.type}</span>
      <TypePick value={type} onChange={setType} t={t} name={t.type} />
      <p className="fp-type-line"><b>{t.types[type][0]}:</b> {t.types[type][1]} <em>{t.types[type][2]}</em></p>
      <span className="field-label">{t.complexity}</span>
      <div className="fp-add-foot">
        <div className="seg" role="radiogroup" aria-label={t.complexity}>
          {LEVELS.map(l => <button type="button" key={l} role="radio" aria-checked={level === l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{t.levels[l]} · {WEIGHTS[type][l]}</button>)}
        </div>
        <span className="spacer" />
        <button className="btn primary" disabled={!name.trim()}><Icon name="plus" /> {t.addBtn}</button>
      </div>
    </form>
  )
}

function FnRow({ f, i, dispatch, t }) {
  const [name, setName] = useState(f.name)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setName(f.name) }, [f.name])
  return (
    <li className="fp-row">
      <span className="fp-row-n">{i + 1}</span>
      <input className="fp-row-name" value={name} aria-label={t.fnName} maxLength={160} title={f.by ? fill(t.by, { name: f.by }) : undefined}
        onFocus={() => { focused.current = true }} onChange={e => setName(e.target.value)}
        onBlur={() => { focused.current = false; if (name !== f.name) dispatch({ type: 'UPDATE_FN', fid: f.id, name }) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      <select className={`fp-row-type t-${f.type}`} value={f.type} aria-label={t.type} onChange={e => dispatch({ type: 'UPDATE_FN', fid: f.id, fnType: e.target.value })}>
        {TYPES.map(x => <option key={x} value={x}>{x} · {t.types[x][0]}</option>)}
      </select>
      <select className="fp-row-level" value={f.level} aria-label={t.complexity} onChange={e => dispatch({ type: 'UPDATE_FN', fid: f.id, level: e.target.value })}>
        {LEVELS.map(l => <option key={l} value={l}>{t.levels[l]}</option>)}
      </select>
      <b className="fp-row-w" title={t.weight}>{weightOf(f)}</b>
      <button className="icon-btn sm" onClick={() => dispatch({ type: 'REMOVE_FN', fid: f.id })} aria-label={t.del} title={t.del}><Icon name="trash" size={15} /></button>
    </li>
  )
}

function Breakdown({ c, t }) {
  return (
    <section className="tool-card">
      <h2>{t.breakdown}</h2>
      <div className="fp-table-wrap">
        <table className="fc-table fp-table" data-testid="fp-breakdown">
          <thead><tr><th>{t.type}</th>{LEVELS.map(l => <th key={l}>{t.levels[l]}</th>)}<th>{t.points}</th></tr></thead>
          <tbody>
            {c.rows.map(r => (
              <tr key={r.type} className={r.count ? '' : 'zero'}>
                <td><span className={`fp-type t-${r.type}`}>{r.type}</span></td>
                {r.cells.map(x => <td key={x.level}><span className="fp-cell">{x.count}<small>×{x.weight}</small></span></td>)}
                <td><b>{r.points}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}>{t.ufp}</td><td><b data-testid="fp-ufp-total">{c.ufp}</b></td></tr></tfoot>
        </table>
      </div>
    </section>
  )
}

function Vaf({ doc, c, dispatch, t }) {
  return (
    <section className="tool-card fp-vaf">
      <h2>{t.vaf}</h2>
      <label className="check"><input type="checkbox" checked={doc.vafOn} onChange={e => dispatch({ type: 'VAF_ON', on: e.target.checked })} /> {t.vafOn}</label>
      {doc.vafOn && (
        <>
          <p className="muted small">{t.vafHint}</p>
          <div className="row wrap fp-allto">{[0, 3, 5].map(n => <button key={n} type="button" className="chip-btn" onClick={() => dispatch({ type: 'RESET_GSC', value: n })}>{fill(t.allTo, { n })}</button>)}</div>
          <ol className="fp-gsc">
            {Array.from({ length: GSC_COUNT }, (_, i) => (
              <li key={i}>
                <span className="fp-gsc-name">{i + 1}. {t.gscNames[i]}</span>
                <div className="fp-gsc-seg" role="radiogroup" aria-label={t.gscNames[i]}>
                  {[0, 1, 2, 3, 4, 5].map(v => <button type="button" key={v} role="radio" aria-checked={doc.gsc[i] === v} className={doc.gsc[i] === v ? 'on' : ''} onClick={() => dispatch({ type: 'SET_GSC', index: i, value: v })}>{v}</button>)}
                </div>
              </li>
            ))}
          </ol>
          <dl className="fp-result">
            <div><dt>{t.tdi}</dt><dd data-testid="fp-tdi">{c.tdi}</dd></div>
            <div><dt>{t.vafLabel}</dt><dd data-testid="fp-vaf">{c.vaf.toFixed(2)}</dd></div>
            <div className="big"><dt>{t.afp} <span className="muted small">= {c.ufp} × {c.vaf.toFixed(2)}</span></dt><dd data-testid="fp-afp">{num(c.afp)}</dd></div>
          </dl>
        </>
      )}
    </section>
  )
}

function NumField({ value, onCommit, label, min, max, step, placeholder }) {
  const [v, setV] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setV(String(value)) }, [value])
  return (
    <label className="fp-num"><span className="field-label">{label}</span>
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={v} placeholder={placeholder}
        onFocus={() => { focused.current = true }} onChange={e => setV(e.target.value)}
        onBlur={() => { focused.current = false; if (v !== String(value)) onCommit(v) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
    </label>
  )
}

function Effort({ doc, c, dispatch, t }) {
  return (
    <section className="tool-card fp-effort">
      <h2>{t.effort}</h2>
      <p className="muted small">{t.effortHint}</p>
      <div className="fp-effort-row">
        <NumField label={t.hoursPerFp} value={doc.hoursPerFp} min="0" max="1000" step="0.5" placeholder="e.g. 8" onCommit={v => dispatch({ type: 'SET_RATE', hoursPerFp: v === '' ? '' : Number(v) })} />
        <NumField label={t.hoursPerDay} value={doc.hoursPerDay} min="1" max="24" step="0.5" onCommit={v => dispatch({ type: 'SET_RATE', hoursPerDay: Number(v) || 8 })} />
      </div>
      {c.hours != null && (
        <dl className="fp-result">
          <div><dt>{t.hours} <span className="muted small">= {num(c.afp)} × {doc.hoursPerFp}</span></dt><dd data-testid="fp-hours">{num(c.hours)} {t.hoursUnit}</dd></div>
          <div className="big"><dt>{t.days}</dt><dd data-testid="fp-days">{num(c.days)} {t.daysUnit}</dd></div>
        </dl>
      )}
    </section>
  )
}

function CountMenu({ doc, t }) {
  const { identity } = useStore()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => { setOpen(false); setConfirm(false) }, open)
  const gscNames = T.en.gscNames
  const copy = () => navigator.clipboard?.writeText(countMarkdown(doc, t, t.gscNames)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  const csv = () => {
    const blob = new Blob(['﻿' + countCsv(doc, lang === 'zh' ? t.gscNames : gscNames)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'function-points'}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const del = () => {
    if (!confirm) { setConfirm(true); return }
    const after = () => { forgetDoc(KIND, doc.id); navigate('/fpa') }
    if (!backend) { try { localStorage.removeItem(LOCAL(doc.id)) } catch { /* ignore */ } after(); return }
    deleteDoc(doc.id, identity.secret).finally(after)
  }
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(o => !o)} aria-label={t.more} title={t.more} aria-expanded={open}><Icon name="more" /></button>
      {open && (
        <div className="menu right">
          <button className="menu-item" onClick={copy}><Icon name="copy" /> {copied ? t.copied : t.copyMd}</button>
          <button className="menu-item" onClick={csv}><Icon name="download" /> {t.csv}</button>
          {(doc.creatorId ?? doc.ownerId) === identity.id && <button className="menu-item danger" onClick={del}><Icon name="trash" /> {confirm ? t.confirm : t.deleteCount}</button>}
        </div>
      )}
    </div>
  )
}
