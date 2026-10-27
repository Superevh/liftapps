import { useMemo } from 'react'
import { slipDays, initials, copyText } from './logic.js'
import { dayRange, dayMonth } from './format.js'
import Icon from './icons.jsx'

const DAY = 86400000

// One change, in words: "Priya moved dates 1 Aug – 30 Nov → 1 Aug – 31 Dec".
export function describe(e, t, ws) {
  const rm = ws.roadmaps.find(r => r.id === e.rm)
  const lane = id => rm?.lanes.find(l => l.id === id)?.name || '—'
  const dates = v => (v?.[0] ? dayRange(t, v[0], v[1]) : t.noDates)
  switch (e.kind) {
    case 'add': return t.ch.add
    case 'delete': return t.ch.delete
    case 'status': return t.ch.status(t.st[e.from] || e.from, t.st[e.to] || e.to)
    case 'dates': return t.ch.dates(dates(e.from), dates(e.to))
    case 'lane': return t.ch.lane(lane(e.from), lane(e.to))
    case 'madd': return t.ch.madd
    case 'mdate': return t.ch.mdate(dayMonth(t, e.from), dayMonth(t, e.to))
    case 'mdelete': return t.ch.mdelete
    case 'comment': return t.ch.comment(e.to)
    default: return ''
  }
}

export function ChangeRow({ e, t, ws, meId, showRm, onOpenItem }) {
  const rm = ws.roadmaps.find(r => r.id === e.rm)
  const live = rm?.items.find(i => i.id === e.item)
  const title = live?.title || e.title || (e.kind.startsWith('m') ? t.untitledMilestone : t.untitledItem)
  const slip = slipDays(e)
  const name = e.wid === meId ? t.youLabel : e.who || t.someone
  const tone = e.kind === 'status' ? (e.to === 'risk' ? 'warn' : e.to === 'done' ? 'good' : '') : e.kind === 'delete' || e.kind === 'mdelete' ? 'gone' : e.kind === 'add' || e.kind === 'madd' ? 'new' : ''
  return (
    <li className={`chg ${tone}`}>
      <span className="avatar" aria-hidden="true">{e.wid === meId ? <Icon name="user" size={14} /> : initials(e.who || '?')}</span>
      <div className="chg-body">
        <div className="chg-title">
          {live && onOpenItem ? <button className="link-btn" onClick={() => onOpenItem(e.item)}>{title}</button> : <b className={e.kind.endsWith('delete') ? 'struck' : ''}>{title}</b>}
          {e.kind.startsWith('m') && <span className="chg-kind"><Icon name="diamond" size={11} />{t.milestone}</span>}
          {showRm && rm && <span className="chg-rm">{rm.name}</span>}
        </div>
        <div className="chg-what">
          <span>{name} {describe(e, t, ws)}</span>
          {slip !== 0 && <span className={`slip ${slip > 0 ? 'later' : 'earlier'}`}>{t.slip(slip)}</span>}
        </div>
      </div>
      <time className="chg-when" dateTime={new Date(e.at).toISOString()} title={new Date(e.at).toLocaleString()}>{t.ago(Date.now() - e.at)}</time>
    </li>
  )
}

export default function Changes({ ws, rm, t, lang, meId, me, period, scope, patchUi, onName, onOpenItem, onFlash }) {
  const list = useMemo(() => {
    const since = period === 'all' ? 0 : Date.now() - +period * DAY
    return ws.log.filter(e => e.at >= since && (scope === 'all' || e.rm === rm.id)).sort((a, b) => b.at - a.at)
  }, [ws.log, period, scope, rm.id])

  const groups = useMemo(() => {
    const out = []
    const fmt = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
    for (const e of list) {
      const label = fmt.format(new Date(e.at))
      if (out[out.length - 1]?.label !== label) out.push({ label, list: [] })
      out[out.length - 1].list.push(e)
    }
    return out
  }, [list, lang])

  const stats = {
    slipped: list.filter(e => slipDays(e) > 0).length, earlier: list.filter(e => slipDays(e) < 0).length,
    risk: list.filter(e => e.kind === 'status' && e.to === 'risk').length, done: list.filter(e => e.kind === 'status' && e.to === 'done').length,
    added: list.filter(e => e.kind === 'add').length,
  }
  const copyUpdate = async () => {
    const lines = [t.updateTitle(scope === 'all' ? ws.name || t.allRoadmaps : rm.name, t.period[period].toLowerCase())]
    for (const e of list) {
      const r = ws.roadmaps.find(x => x.id === e.rm)
      const title = r?.items.find(i => i.id === e.item)?.title || e.title || t.untitledItem
      const slip = slipDays(e)
      lines.push(`- ${title}: ${describe(e, t, ws)}${slip ? ` (${t.slip(slip)})` : ''} — ${e.wid === meId ? me || t.youLabel : e.who || t.someone}, ${t.ago(Date.now() - e.at)}`)
    }
    await copyText(lines.join('\n'))
    onFlash(t.copiedMd)
  }

  return (
    <div className="changes">
      <div className="changes-inner">
        <header className="changes-head">
          <div>
            <h2>{t.changesTitle}</h2>
            <p>{t.changesSub}</p>
          </div>
          <div className="changes-tools">
            <div className="seg" role="group" aria-label={t.changesTitle}>
              {['7', '30', 'all'].map(p => <button key={p} className={period === p ? 'on' : ''} aria-pressed={period === p} onClick={() => patchUi({ period: p })}>{t.period[p]}</button>)}
            </div>
            <div className="seg" role="group" aria-label={t.roadmaps}>
              <button className={scope === 'rm' ? 'on' : ''} aria-pressed={scope === 'rm'} onClick={() => patchUi({ scope: 'rm' })}>{t.thisRoadmap}</button>
              <button className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} onClick={() => patchUi({ scope: 'all' })}>{t.allRoadmaps}</button>
            </div>
            <button className="btn small" onClick={copyUpdate} disabled={!list.length}><Icon name="copy" size={14} />{t.copyUpdate}</button>
          </div>
        </header>

        {!me && <div className="notice"><Icon name="user" size={16} /><span>{t.nameAsk}</span><button className="btn small" onClick={onName}>{t.setName}</button></div>}

        {list.length > 0 && (
          <div className="chg-stats">
            {stats.slipped > 0 && <span className="stat warn"><b>{stats.slipped}</b> {t.statLater}</span>}
            {stats.earlier > 0 && <span className="stat good"><b>{stats.earlier}</b> {t.statEarlier}</span>}
            {stats.risk > 0 && <span className="stat warn"><b>{stats.risk}</b> {t.st.risk}</span>}
            {stats.done > 0 && <span className="stat good"><b>{stats.done}</b> {t.st.done}</span>}
            {stats.added > 0 && <span className="stat"><b>{stats.added}</b> {t.statAdded}</span>}
          </div>
        )}

        {!list.length && <div className="list-empty"><Icon name="history" size={22} /><span>{t.noChanges}</span></div>}
        {groups.map(g => (
          <section key={g.label} className="chg-day">
            <h3>{g.label}</h3>
            <ul>{g.list.map(e => <ChangeRow key={e.id} e={e} t={t} ws={ws} meId={meId} showRm={scope === 'all'} onOpenItem={e.rm === rm.id ? onOpenItem : null} />)}</ul>
          </section>
        ))}
      </div>
    </div>
  )
}
