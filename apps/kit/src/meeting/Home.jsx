import { useMemo, useState } from 'react'
import { useStore, uid } from '../core/store.jsx'
import { backend } from '../core/live.js'
import { navigate } from '../core/ui.jsx'
import { useT } from './i18n.js'
import { Icon, Toaster, showToast, useNameGate } from './common.jsx'
import { useMeetings, forget, createMeeting, collectActions, sendTo, rememberedTeams } from './store.js'
import { MEETING_TEMPLATES, templateItems, templateMinutes } from './templates.js'
import { status, plannedMinutes, todayStr, fmtDate } from './model.js'
import { ActionRow } from './ActionsPage.jsx'
import { ToolkitStrip } from './Toolkit.jsx'
import './meeting.css'

export function MeetingHome() {
  const [t, lang] = useT()
  const { identity } = useStore()
  const { status: st, docs, error, reload, setDocs } = useMeetings()
  const today = todayStr()
  const [busy, setBusy] = useState(false)
  const [gate, nameDialog] = useNameGate()

  const groups = useMemo(() => {
    const live = [], upcoming = [], recent = []
    for (const d of docs) {
      const s = status(d, today)
      if (s === 'live') live.push(d)
      else if (s === 'planned') upcoming.push(d)
      else recent.push(d)
    }
    const key = d => `${d.date || '9999'} ${d.time || '99:99'}`
    upcoming.sort((a, b) => key(a).localeCompare(key(b)) || a.createdAt - b.createdAt)
    recent.sort((a, b) => (b.run.endedAt ?? b.createdAt) - (a.run.endedAt ?? a.createdAt))
    return { live, upcoming, recent: recent.slice(0, 8) }
  }, [docs, today])
  const actions = useMemo(() => collectActions(docs).filter(a => !a.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')), [docs])

  const toggle = async a => {
    setDocs(ds => ds.map(d => (d.id === a.doc.id ? { ...d, actions: d.actions.map(x => (x.id === a.id ? { ...x, done: !a.done } : x)) } : d)))
    try {
      await sendTo(a.doc.id, { type: 'EDIT', coll: 'actions', eid: a.id, patch: { done: !a.done }, pid: identity.id })
      if (!a.done) showToast(t.doneLabel, () => sendTo(a.doc.id, { type: 'EDIT', coll: 'actions', eid: a.id, patch: { done: false }, pid: identity.id }).then(reload))
    } catch { reload() }
  }

  const sample = () => { if (!busy) gate(makeSample) }
  const makeSample = async () => {
    setBusy(true)
    const tpl = MEETING_TEMPLATES[0]
    const zh = lang === 'zh'
    const people = zh ? ['小林', '阿敏', '大卫', '佳佳'] : ['Alex', 'Sam', 'Priya', 'Jordan']
    const at = Date.now()
    const entry = (text, extra) => ({ id: uid() + uid(), text, by: null, at, ...extra })
    const act = (text, owner, due) => { const e = entry(text, { owner, due, done: false, doneAt: null, itemId: null, topicId: null, carried: true }); return { ...e, origin: e.id } }
    const due = new Date(at + 2 * 86400000).toISOString().slice(0, 10)
    try {
      const doc = await createMeeting({
        title: t.sampleTitle, date: today, time: '10:00', cadence: 'weekly', goal: zh ? tpl.goal[1] : tpl.goal[0],
        items: templateItems(tpl, lang), attendees: people,
        carried: {
          actions: [act(zh ? '把发布清单发到群里' : 'Share the release checklist', people[1], due), act(zh ? '约客户做访谈' : 'Book two customer interviews', people[2], '')],
          topics: [entry(zh ? '值班轮换要不要调整？' : 'Should we change the on-call rota?', { votes: {}, status: 'open' }), entry(zh ? '下个季度的团队活动' : 'Team offsite next quarter', { votes: {}, status: 'open' })],
          parking: [],
        },
      }, identity)
      navigate(`/m/${doc.id}/plan`)
    } catch (err) { setBusy(false); showToast(err.message) }
  }

  const empty = st === 'ready' && !docs.length
  return (
    <main className="tool-page mt-home">
      <header className="mt-home-head">
        <div>
          <div className="hero-eyebrow">{t.homeEyebrow}</div>
          <h1>{empty ? t.firstTitle : t.homeTitle}</h1>
          <p className="mt-lead">{empty ? t.firstLead : t.homeLead}</p>
          {backend?.kind === 'mock' && <p className="tool-note small mt-note">{t.mock}</p>}
          {!backend && <p className="tool-note small mt-note">{t.offline}</p>}
        </div>
        <div className="mt-home-cta">
          <a className="btn primary lg" href="#/m/new"><Icon name="plus" /> {t.newMeeting}</a>
          {empty && <button className="btn ghost" onClick={sample} disabled={busy}><Icon name="sparkle" /> {t.sample}</button>}
        </div>
      </header>

      {st === 'loading' && <div className="mt-skeleton" aria-busy="true" aria-label={t.loadingMeetings}><span /><span /><span /></div>}
      {error && <p className="mt-error" role="alert">{t.loadError} <button className="link-btn" onClick={reload}>{t.retry}</button></p>}

      {empty && <FirstRun t={t} />}

      {st === 'ready' && docs.length > 0 && (
        <div className="mt-home-grid">
          <div className="mt-col">
            {groups.live.length > 0 && <MeetingList title={t.liveNow} docs={groups.live} t={t} lang={lang} today={today} live onForget={reload} />}
            <MeetingList title={t.upcoming} docs={groups.upcoming} t={t} lang={lang} today={today} empty={t.noUpcoming} onForget={reload} />
            {groups.recent.length > 0 && <MeetingList title={t.recent} docs={groups.recent} t={t} lang={lang} today={today} onForget={reload} />}
            <p className="muted small mt-device-note">{t.deviceNote}</p>
          </div>
          <aside className="mt-col">
            <section className="tool-card mt-card">
              <div className="mt-card-head"><h2><Icon name="action" size={18} /> {t.openActions}</h2>{actions.length > 0 && <span className="mt-count">{actions.length}</span>}</div>
              {actions.length ? (
                <ul className="mt-actions">
                  {actions.slice(0, 6).map(a => <ActionRow key={a.doc.id + a.id} a={a} t={t} lang={lang} today={today} onToggle={() => toggle(a)} showMeeting />)}
                </ul>
              ) : <p className="muted mt-empty-line">{t.noOpenActions}</p>}
              {actions.length > 0 && <a className="mt-more-link" href="#/actions">{t.seeAllActions} <Icon name="right" size={14} /></a>}
            </section>
            <TeamsCard t={t} />
            <QuickTemplates t={t} lang={lang} />
          </aside>
        </div>
      )}

      <ToolkitStrip t={t} lang={lang} />
      {nameDialog}
      <Toaster />
    </main>
  )
}

function TeamsCard({ t }) {
  const teams = rememberedTeams()
  return (
    <section className="tool-card mt-card">
      <div className="mt-card-head"><h2><Icon name="users" size={18} /> {t.teams}</h2><a className="mt-more-link" href="#/team">{t.newTeam} <Icon name="right" size={14} /></a></div>
      {teams.length ? (
        <ul className="mt-plain-list mt-team-links">{teams.slice(0, 5).map(x => <li key={x.id}><a href={`#/team/${x.id}`}>{x.name}</a></li>)}</ul>
      ) : <p className="muted small mt-empty-line">{t.teamHint}</p>}
    </section>
  )
}

function FirstRun({ t }) {
  const [, lang] = useT()
  return (
    <>
      <ol className="mt-steps">
        {[t.step1, t.step2, t.step3].map(([h, p], i) => (
          <li key={i} className="tool-card">
            <span className="mt-step-n">{i + 1}</span>
            <h2>{h}</h2>
            <p>{p}</p>
          </li>
        ))}
      </ol>
      <QuickTemplates t={t} lang={lang} wide />
    </>
  )
}

function QuickTemplates({ t, lang, wide }) {
  return (
    <section className={`tool-card mt-card ${wide ? 'mt-quick-wide' : ''}`}>
      <div className="mt-card-head"><h2>{t.quickStart}</h2><a className="mt-more-link" href="#/m/new">{t.allTemplates} <Icon name="right" size={14} /></a></div>
      <div className="mt-quick">
        {MEETING_TEMPLATES.slice(0, wide ? 8 : 6).map(x => (
          <a key={x.id} className="mt-quick-tpl" href={`#/m/new/${x.id}`}>
            <b>{x[lang][0]}</b>
            <span>{t.minutes(templateMinutes(x))} · {t.cadence[x.cadence]}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

export function dayLabel(date, today, t, lang) {
  if (!date) return t.noDate
  if (date === today) return t.today
  const tm = new Date(today); tm.setDate(tm.getDate() + 1)
  if (date === tm.toISOString().slice(0, 10)) return t.tomorrow
  return fmtDate(date, lang)
}

export function MeetingList({ title, docs, t, lang, today, empty, live, onForget }) {
  return (
    <section className="tool-card mt-card">
      <div className="mt-card-head"><h2>{live && <span className="mt-live-dot" aria-hidden="true" />}{title}</h2></div>
      {docs.length ? (
        <ul className={`mt-meetings ${onForget ? '' : 'noforget'}`}>
          {docs.map(d => {
            const s = status(d, today)
            const open = d.actions.filter(a => !a.done).length
            const dd = (d.date || '').split('-')[2]
            const mon = d.date ? new Date(d.date + 'T00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-AU', { month: 'short' }) : ''
            const tab = s === 'live' ? 'run' : s === 'done' ? 'summary' : 'plan'
            return (
              <li key={d.id} className={`mt-meeting s-${s}`}>
                <a href={`#/m/${d.id}/${tab}`} className="mt-meeting-link">
                  <span className="mt-date" aria-hidden="true">{d.date ? <><b>{Number(dd)}</b><i>{mon}</i></> : <Icon name="calendar" size={18} />}</span>
                  <span className="mt-meeting-main">
                    <b>{d.title || t.untitled}</b>
                    <span className="muted small">
                      {[dayLabel(d.date, today, t, lang), d.time, t.items(d.items.length) + ' · ' + t.minutes(plannedMinutes(d)), d.cadence !== 'none' ? t.cadence[d.cadence] : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="mt-meeting-side">
                    <span className={`mt-chip s-${s}`}>{t.st[s]}</span>
                    {open > 0 && <span className="muted small">{t.actionsN(open)}</span>}
                  </span>
                </a>
                {onForget && <button className="icon-btn sm mt-forget" aria-label={`${t.forget}: ${d.title}`} title={t.forget} onClick={() => { forget(d.id); showToast(t.forgotten); onForget() }}><Icon name="x" size={14} /></button>}
              </li>
            )
          })}
        </ul>
      ) : <p className="muted mt-empty-line">{empty}</p>}
    </section>
  )
}

