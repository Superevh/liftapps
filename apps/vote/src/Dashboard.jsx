import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp, go } from './app-context.js'
import { Spinner } from './App.jsx'
import { Icon } from './icons.jsx'
import { useT } from './i18n.js'
import { TYPES, typeLabel } from './slides.js'
import { TEMPLATES, templateById } from './templates.js'
import { cleanError } from './backend.js'
import { JoinBox } from './Landing.jsx'
import './dashboard.css'

const DICT = {
  en: {
    title: 'My presentations', newPres: 'New presentation', search: 'Search presentations', sortRecent: 'Recent', sortName: 'Name',
    slides: '{n} slides', slide: '1 slide', participants: '{n} joined', responses: '{n} responses', code: 'Code',
    edit: 'Edit', present: 'Present', results: 'Results', duplicate: 'Duplicate', del: 'Delete', confirmDel: 'Delete for good?', copyOf: 'Copy of {t}',
    emptyTitle: 'No presentations yet', emptyHint: 'Start from a template — you can change everything afterwards.',
    noMatch: 'No presentations match “{q}”.', pickTitle: 'Start a new presentation', pickHint: 'Pick a template. Every question can be edited later.',
    useTpl: 'Use template', creating: 'Creating…', untitled: 'Untitled presentation', deleted: 'Presentation deleted', duplicated: 'Duplicated',
    justNow: 'just now', minAgo: '{n} min ago', hAgo: '{n} h ago', dAgo: '{n} d ago', updated: 'Updated {when}', more: 'More actions',
  },
  zh: {
    title: '我的演示', newPres: '新建演示', search: '搜索演示', sortRecent: '最近', sortName: '名称',
    slides: '{n} 页', slide: '1 页', participants: '{n} 人参与', responses: '{n} 条回答', code: '代码',
    edit: '编辑', present: '演示', results: '结果', duplicate: '复制', del: '删除', confirmDel: '确定永久删除？', copyOf: '{t} 的副本',
    emptyTitle: '还没有演示', emptyHint: '从一个模板开始吧，之后所有内容都可以修改。',
    noMatch: '没有与“{q}”匹配的演示。', pickTitle: '新建演示', pickHint: '选择一个模板，所有问题之后都能编辑。',
    useTpl: '使用模板', creating: '创建中…', untitled: '未命名演示', deleted: '演示已删除', duplicated: '已复制',
    justNow: '刚刚', minAgo: '{n} 分钟前', hAgo: '{n} 小时前', dAgo: '{n} 天前', updated: '更新于 {when}', more: '更多操作',
  },
}

export const fmtCode = c => (c ? `${c.slice(0, 4)} ${c.slice(4)}` : '')

function ago(t, iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return t('justNow')
  if (s < 3600) return t('minAgo', { n: Math.floor(s / 60) })
  if (s < 86400) return t('hAgo', { n: Math.floor(s / 3600) })
  if (s < 86400 * 30) return t('dAgo', { n: Math.floor(s / 86400) })
  return new Date(iso).toLocaleDateString(t.lang === 'zh' ? 'zh-CN' : 'en')
}

export default function Dashboard() {
  const { api, toast } = useApp()
  const t = useT(DICT)
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [picking, setPicking] = useState(false)

  const load = useCallback(() => api.list().then(setItems, e => { toast(t('error', { e: cleanError(e) })); setItems(x => x ?? []) }), [api]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    if (!items) return []
    const needle = q.trim().toLowerCase()
    const list = items.filter(p => !needle || (p.title || '').toLowerCase().includes(needle) || p.code.includes(needle.replace(/\s/g, '')))
    return sort === 'name' ? [...list].sort((a, b) => (a.title || '').localeCompare(b.title || '')) : list
  }, [items, q, sort])

  return (
    <main className="page dash">
      <div className="dash-head">
        <h1>{t('title')}</h1>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setPicking(true)}><Icon name="plus" /> {t('newPres')}</button>
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? (
        <div className="dash-empty">
          <div className="empty">
            <Icon name="present" size={36} />
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyHint')}</p>
          </div>
          <TemplateGrid inline />
        </div>
      ) : <>
        <div className="dash-tools">
          <label className="dash-search">
            <Icon name="search" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
          </label>
          <div className="seg" role="group">
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>{t('sortRecent')}</button>
            <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>{t('sortName')}</button>
          </div>
        </div>
        {shown.length === 0 ? <p className="empty">{t('noMatch', { q })}</p> : (
          <div className="pres-grid">
            {shown.map(p => <PresCard key={p.id} p={p} t={t} onChanged={load} />)}
          </div>
        )}
        <aside className="dash-join"><JoinBox compact /></aside>
      </>}
      {picking && <TemplatePicker onClose={() => setPicking(false)} />}
    </main>
  )
}

function PresCard({ p, t, onChanged }) {
  const { api, toast } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const tpl = templateById(p.template)
  const types = [...new Set(p.types ?? [])].slice(0, 6)
  const run = (fn, msg) => { setBusy(true); fn().then(() => { if (msg) toast(msg); onChanged() }, e => toast(t('error', { e: cleanError(e) }))).finally(() => setBusy(false)) }
  return (
    <article className="pres-card" style={{ '--c': tpl?.color ?? 'var(--bronze)' }}>
      <a className="pres-cover" href={`#/edit/${p.id}`} aria-label={`${t('edit')} ${p.title || t('untitled')}`}>
        <span className="pres-cover-ico"><Icon name={tpl?.icon ?? 'present'} size={22} /></span>
        <span className="pres-types">{types.map(ty => <span key={ty} title={typeLabel(ty, t.lang)}><Icon name={TYPES[ty]?.icon ?? 'bars'} size={14} /></span>)}</span>
      </a>
      <div className="pres-body">
        <a className="pres-title" href={`#/edit/${p.id}`}>{p.title || t('untitled')}</a>
        <div className="pres-meta">
          <span>{p.slides === 1 ? t('slide') : t('slides', { n: p.slides })}</span>
          <span>·</span>
          <span>{t('updated', { when: ago(t, p.updated_at) })}</span>
        </div>
        <div className="pres-meta">
          <span className="pill gold" title={t('code')}>{fmtCode(p.code)}</span>
          {p.participants > 0 && <span className="pill"><Icon name="users" size={12} /> {t('participants', { n: p.participants })}</span>}
          {p.responses > 0 && <span className="pill"><Icon name="chart" size={12} /> {t('responses', { n: p.responses })}</span>}
        </div>
      </div>
      <div className="pres-actions">
        {confirm ? <>
          <span className="pres-confirm">{t('confirmDel')}</span>
          <button className="btn sm ghost" onClick={() => setConfirm(false)}>{t('cancel')}</button>
          <button className="btn sm danger-btn" disabled={busy} onClick={() => run(() => api.remove(p.id), t('deleted'))}>{t('del')}</button>
        </> : <>
          <a className="btn sm primary" href={`#/present/${p.id}`}><Icon name="play" size={14} /> {t('present')}</a>
          <a className="btn sm ghost" href={`#/edit/${p.id}`}><Icon name="edit" size={14} /> {t('edit')}</a>
          <a className="btn sm ghost" href={`#/results/${p.id}`}><Icon name="chart" size={14} /> {t('results')}</a>
          <span className="spacer" />
          <button className="icon-btn sm" title={t('duplicate')} aria-label={t('duplicate')} disabled={busy}
            onClick={() => run(() => api.duplicate(p.id, t('copyOf', { t: p.title || t('untitled') })), t('duplicated'))}><Icon name="dup" /></button>
          <button className="icon-btn sm" title={t('del')} aria-label={t('del')} onClick={() => setConfirm(true)}><Icon name="trash" /></button>
        </>}
      </div>
    </article>
  )
}

export function TemplatePicker({ onClose }) {
  const t = useT(DICT)
  useEffect(() => {
    const on = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal wide tpl-modal" role="dialog" aria-modal="true" aria-label={t('pickTitle')}>
        <div className="modal-head">
          <div><h2>{t('pickTitle')}</h2><p className="muted">{t('pickHint')}</p></div>
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
        </div>
        <TemplateGrid />
      </div>
    </div>
  )
}

function TemplateGrid({ inline }) {
  const { api, toast } = useApp()
  const t = useT(DICT)
  const [busy, setBusy] = useState(null)
  const use = tpl => {
    setBusy(tpl.id)
    const title = tpl.id === 'blank' ? t('untitled') : tpl.title[t.lang] ?? tpl.title.en
    api.create({ title, slides: tpl.slides(t.lang), template: tpl.id })
      .then(({ id }) => go(`/edit/${id}`), e => { toast(t('error', { e: cleanError(e) })); setBusy(null) })
  }
  return (
    <div className={`tpl-grid ${inline ? 'inline' : ''}`}>
      {TEMPLATES.map(tpl => {
        const slides = tpl.slides(t.lang)
        return (
          <button key={tpl.id} className="tpl-card" style={{ '--c': tpl.color }} disabled={!!busy} onClick={() => use(tpl)}>
            <span className="tpl-top">
              <span className="tpl-ico"><Icon name={tpl.icon} size={22} /></span>
              <span className="tpl-count">{slides.length === 1 ? t('slide') : t('slides', { n: slides.length })}</span>
            </span>
            <b>{tpl.title[t.lang] ?? tpl.title.en}</b>
            <span className="tpl-desc">{tpl.description[t.lang] ?? tpl.description.en}</span>
            <span className="tpl-types">
              {slides.map(s => <span key={s.id} title={typeLabel(s.type, t.lang)}><Icon name={TYPES[s.type].icon} size={13} /></span>)}
            </span>
            <span className="tpl-use">{busy === tpl.id ? t('creating') : t('useTpl')} <Icon name="right" size={14} /></span>
          </button>
        )
      })}
    </div>
  )
}
