import { useEffect, useRef, useState } from 'react'
import { useStore, orderedIdeas, applyFiltersAndSort, userById, fieldById, getValue, optionById, exportable, validProject } from './store.jsx'
import { Icon, Avatar, Popover, Dropdown, InlineText, RichText, VIEW_ICONS, Modal, downloadText, timeAgo } from './ui.jsx'
import { fmtMonth } from './fields.jsx'
import Toolbar from './Toolbar.jsx'
import ListView from './ListView.jsx'
import BoardView from './BoardView.jsx'
import MatrixView from './MatrixView.jsx'
import TimelineView from './TimelineView.jsx'
import IdeaPanel from './IdeaPanel.jsx'
import { useT } from './lang.js'

// Routes: #/view/:id?idea=KEY&layout=sidebar|full   #/archive   and read-only  #/share/:id?p=PROJECT&selectedIssue=KEY
function parse() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const [mode, id] = path.split('/')
  return { mode: mode || 'view', id, params: new URLSearchParams(query) }
}

export function useRoute() {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export const navigate = path => { window.location.hash = path }

let shareProject = ''
export function openIdea(mode, viewId, key, layout = 'sidebar') {
  if (mode === 'share') return navigate(`/share/${viewId}?p=${shareProject}&selectedIssue=${key}`)
  if (viewId === '__archive') return navigate(`/archive?idea=${key}`)
  navigate(`/view/${viewId}?idea=${key}&layout=${layout}`)
}

const VIEW_BODIES = { list: ListView, board: BoardView, matrix: MatrixView, timeline: TimelineView }
const VIEW_TYPE_LABELS = { list: 'List', board: 'Board', matrix: 'Matrix', timeline: 'Timeline' }
const SECTION_LABELS = { prioritize: 'Prioritise', roadmap: 'Roadmaps', discover: 'Discover' }

// Plain-text value used by CSV export.
function textOf(state, idea, f, lang) {
  const v = getValue(state, idea, f.id)
  if (v == null) return ''
  switch (f.type) {
    case 'select': return optionById(f, v)?.label ?? ''
    case 'multiselect': return v.map(id => optionById(f, id)?.label).filter(Boolean).join('; ')
    case 'user': return userById(state, v)?.name ?? ''
    case 'interval': return `${fmtMonth(v.start, lang)} – ${fmtMonth(v.end, lang)}`
    case 'delivery': return `${v.done}/${v.total}`
    case 'checkbox': return v ? 'yes' : 'no'
    default: return String(v)
  }
}
const csvCell = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const slug = s => s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '') || 'project'

function CreateView({ section, close }) {
  const t = useT()
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('list')
  return (
    <form className="create-view" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; dispatch({ type: 'CREATE_VIEW', section, viewType: type, name: name.trim() }); close() }}>
      <div className="popover-title">{t('Create a view')}</div>
      <div className="view-types">
        {Object.keys(VIEW_ICONS).map(vt => (
          <button type="button" key={vt} className={`view-type ${type === vt ? 'sel' : ''}`} onClick={() => setType(vt)} aria-pressed={type === vt}>
            <Icon name={VIEW_ICONS[vt]} size={20} />{t(VIEW_TYPE_LABELS[vt])}
          </button>
        ))}
      </div>
      <input autoFocus aria-label={t('View name')} placeholder={t('View name')} value={name} onChange={e => setName(e.target.value)} />
      <div className="row end"><button type="button" className="btn subtle" onClick={close}>{t('Cancel')}</button><button className="btn primary" disabled={!name.trim()}>{t('Create')}</button></div>
    </form>
  )
}

function ProjectMenu({ onSettings, onNotice }) {
  const t = useT()
  const { state, ws, dispatch } = useStore()
  const fileRef = useRef(null)
  const closeRef = useRef(() => {})
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const projects = Object.values(ws.projects)

  const onFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!validProject(data)) throw new Error('shape')
      dispatch({ type: 'IMPORT_PROJECT', project: data })
      closeRef.current()
      navigate('/view')
      onNotice(t('Imported “{name}”.', { name: data.space.name }))
    } catch {
      onNotice(t('That file isn’t a DiscoveryLift project export.'))
    }
  }

  return (
    <Popover align="left" className="project-pop" trigger={({ toggle }) => (
      <button className="space-head" onClick={toggle} aria-label={t('Projects')}>
        <span className="space-mark">{state.space.name.slice(0, 1).toUpperCase()}</span>
        <span className="grow"><span className="space-name">{state.space.name}</span><span className="muted small">{t('{n} ideas', { n: Object.values(state.ideas).filter(i => !i.archived).length })}</span></span>
        <Icon name="chevron" size={14} />
      </button>
    )}>
      {({ close }) => (closeRef.current = close) && (
        <div className="project-menu">
          <div className="popover-title">{t('Projects')}</div>
          {projects.map(p => (
            <button key={p.id} className={`menu-item ${p.id === ws.current ? 'selected' : ''}`} onClick={() => { dispatch({ type: 'SWITCH_PROJECT', id: p.id }); navigate('/view'); close() }}>
              <span className="space-mark small">{p.space.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow ellipsis">{p.space.name}</span>
              {p.id === ws.current && <Icon name="check" size={14} />}
            </button>
          ))}
          {naming ? (
            <form className="row" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; dispatch({ type: 'NEW_PROJECT', name: name.trim() }); setNaming(false); setName(''); navigate('/view'); close() }}>
              <input autoFocus aria-label={t('Project name')} placeholder={t('Project name')} value={name} onChange={e => setName(e.target.value)} />
              <button className="btn primary" disabled={!name.trim()}>{t('Create')}</button>
            </form>
          ) : (
            <button className="menu-item" onClick={() => setNaming(true)}><Icon name="plus" size={14} /> {t('New blank project')}</button>
          )}
          <button className="menu-item" onClick={() => { dispatch({ type: 'NEW_PROJECT', example: true }); navigate('/view'); close() }}><Icon name="bulb" size={14} /> {t('New example project')}</button>
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => { downloadText(`${slug(state.space.name)}.discoverylift.json`, JSON.stringify(exportable(state), null, 2)); close() }}><Icon name="download" size={14} /> {t('Export project (JSON)')}</button>
          <button className="menu-item" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> {t('Import project (JSON)')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="import-file" />
          <button className="menu-item" onClick={() => { onSettings(); close() }}><Icon name="gear" size={14} /> {t('Project settings')}</button>
          <div className="menu-sep" />
          {confirmDelete ? (
            <div className="confirm-inline">
              <span className="small">{t('Delete “{name}” and all its ideas?', { name: state.space.name })}</span>
              <div className="row"><button className="btn danger-btn" onClick={() => { dispatch({ type: 'DELETE_PROJECT', id: ws.current }); setConfirmDelete(false); navigate('/view'); close() }}>{t('Delete')}</button><button className="btn subtle" onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button></div>
            </div>
          ) : (
            <button className="menu-item danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14} /> {t('Delete project')}</button>
          )}
        </div>
      )}
    </Popover>
  )
}

function SettingsModal({ onClose }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('general')
  const [person, setPerson] = useState('')
  const [tplName, setTplName] = useState('')
  return (
    <Modal title={t('Project settings')} onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {[['general', t('General')], ['team', t('Team')], ['templates', t('Idea templates')]].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      <div className="settings-body">
        {tab === 'general' && (
          <div className="form-grid">
            <label className="field-label" htmlFor="ps-name">{t('Project name')}</label>
            <input id="ps-name" value={state.space.name} onChange={e => dispatch({ type: 'UPDATE_SPACE', patch: { name: e.target.value || ' ' } })} />
            <label className="field-label" htmlFor="ps-key">{t('Idea key prefix')}</label>
            <input id="ps-key" maxLength={5} value={state.space.key} onChange={e => dispatch({ type: 'UPDATE_SPACE', patch: { key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') || 'ID' } })} />
            {state.example && (
              <>
                <span className="field-label">{t('Example data')}</span>
                <div><button className="btn subtle" onClick={() => { dispatch({ type: 'RESET_EXAMPLE' }); navigate('/view'); onClose() }}>{t('Reset example project')}</button></div>
              </>
            )}
          </div>
        )}
        {tab === 'team' && (
          <>
            <p className="muted small">{t('Everything is stored in this browser. Pick who you are acting as to vote, comment and own ideas as that person.')}</p>
            {state.users.map(u => (
              <label key={u.id} className="check-row team-row">
                <input type="radio" name="me" checked={state.me === u.id} onChange={() => dispatch({ type: 'SET_ME', id: u.id })} />
                <Avatar user={u} size={24} /> <span className="grow">{u.name}</span>
                {state.me === u.id && <span className="count-pill">{t('You')}</span>}
              </label>
            ))}
            <form className="row" onSubmit={e => { e.preventDefault(); if (!person.trim()) return; dispatch({ type: 'ADD_USER', name: person.trim() }); setPerson('') }}>
              <input aria-label={t('Teammate name')} placeholder={t('Teammate name')} value={person} onChange={e => setPerson(e.target.value)} />
              <button className="btn subtle" disabled={!person.trim()}>{t('Add')}</button>
            </form>
          </>
        )}
        {tab === 'templates' && (
          <>
            <p className="muted small">{t('Templates give new ideas a consistent description. Pick one when creating an idea, or from an empty description.')}</p>
            {state.templates.map(tp => (
              <div key={tp.id} className="template-edit">
                <div className="row">
                  <input aria-label={t('Template name')} value={tp.name} onChange={e => dispatch({ type: 'UPDATE_TEMPLATE', id: tp.id, patch: { name: e.target.value } })} />
                  <button className="icon-btn" aria-label={t('Delete template')} onClick={() => dispatch({ type: 'DELETE_TEMPLATE', id: tp.id })}><Icon name="trash" size={14} /></button>
                </div>
                <textarea rows={5} aria-label={t('Template text')} value={tp.body} onChange={e => dispatch({ type: 'UPDATE_TEMPLATE', id: tp.id, patch: { body: e.target.value } })} />
              </div>
            ))}
            <form className="row" onSubmit={e => { e.preventDefault(); if (!tplName.trim()) return; dispatch({ type: 'ADD_TEMPLATE', name: tplName.trim() }); setTplName('') }}>
              <input aria-label={t('New template name')} placeholder={t('New template name')} value={tplName} onChange={e => setTplName(e.target.value)} />
              <button className="btn subtle" disabled={!tplName.trim()}>{t('Add')}</button>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

function Sidebar({ activeId, open, onClose, onSettings, onNotice }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const archived = Object.values(state.ideas).filter(i => i.archived).length
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={t('Views')}>
        <ProjectMenu onSettings={onSettings} onNotice={onNotice} />
        <div className="nav-heading">{t('Views')}</div>
        {state.sections.map(section => (
          <div key={section} className="view-section">
            <div className="section-title">
              <span>{t(SECTION_LABELS[section] ?? section)}</span>
              <Popover align="left" className="create-view-pop"
                trigger={({ toggle }) => <button className="icon-btn tiny" aria-label={t('Create view in {s}', { s: t(SECTION_LABELS[section] ?? section) })} onClick={toggle}><Icon name="plus" size={14} /></button>}>
                {({ close }) => <CreateView section={section} close={close} />}
              </Popover>
            </div>
            {state.views.filter(v => v.section === section).map(v => (
              <a key={v.id} href={`#/view/${v.id}`} onClick={onClose} className={`view-link ${v.id === activeId ? 'active' : ''}`} aria-current={v.id === activeId ? 'page' : undefined}>
                <Icon name={VIEW_ICONS[v.type]} size={14} />
                <span className="view-name">{v.name}</span>
                {v.published && <Icon name="globe" size={12} className="pub-icon" />}
              </a>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <a href="#/archive" onClick={onClose} className={`view-link ${activeId === '__archive' ? 'active' : ''}`}>
            <Icon name="archive" size={14} /><span className="view-name">{t('Archived ideas')}</span>{archived > 0 && <span className="count-pill">{archived}</span>}
          </a>
          <div className="acting">
            <span className="muted small">{t('Acting as')}</span>
            <Dropdown align="left" options={state.users.map(u => ({ value: u.id, label: u.name, user: u, selected: u.id === state.me }))}
              onSelect={id => dispatch({ type: 'SET_ME', id })}
              render={o => <><Avatar user={o.user} size={20} /> {o.label}</>}
              trigger={({ toggle }) => <button className="cell-btn" onClick={toggle}><Avatar user={userById(state, state.me)} size={22} /> <span className="ellipsis">{userById(state, state.me)?.name}</span> <Icon name="chevron" size={12} /></button>} />
          </div>
        </div>
      </aside>
    </>
  )
}

function AboutPanel({ view, readOnly, onClose }) {
  const t = useT()
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(view.about)
  return (
    <aside className="right-panel about-panel" aria-label={t('About this view')}>
      <div className="panel-head">
        <h2>{view.name}</h2>
        <span className="spacer" />
        <button className="icon-btn" aria-label={t('Close')} onClick={onClose}><Icon name="close" /></button>
      </div>
      <h3>{t('About this view')}</h3>
      {editing ? (
        <>
          <textarea autoFocus rows={10} aria-label={t('About this view')} value={text} onChange={e => setText(e.target.value)} />
          <div className="row"><button className="btn primary" onClick={() => { dispatch({ type: 'UPDATE_VIEW', id: view.id, patch: { about: text } }); setEditing(false) }}>{t('Save')}</button>
            <button className="btn subtle" onClick={() => { setText(view.about); setEditing(false) }}>{t('Cancel')}</button></div>
        </>
      ) : (
        <div className={`about-body ${readOnly ? '' : 'editable'}`} onClick={() => !readOnly && setEditing(true)}>
          {view.about ? <RichText text={view.about} /> : <span className="muted">{readOnly ? t('No description.') : t('Describe who this view is for and how to read it…')}</span>}
        </div>
      )}
    </aside>
  )
}

function CreateIdea({ view, onClose }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [summary, setSummary] = useState('')
  const [template, setTemplate] = useState('')
  const [another, setAnother] = useState(false)
  const submit = e => {
    e.preventDefault()
    if (!summary.trim()) return
    const body = state.templates.find(x => x.id === template)?.body ?? ''
    // New ideas pick up the board column / list group this view is filtered to, so they appear here.
    const values = {}
    for (const f of view.filters ?? []) {
      const fd = fieldById(state, f.field)
      if (fd && f.values?.length === 1 && f.values[0] !== '__none' && (fd.type === 'select' || fd.type === 'user')) values[f.field] = f.values[0]
    }
    dispatch({ type: 'CREATE_IDEA', summary: summary.trim(), desc: body, values })
    setSummary('')
    if (!another) onClose()
  }
  return (
    <Modal title={t('Create idea')} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="idea-summary">{t('Summary')}<span className="req">*</span></label>
        <input id="idea-summary" autoFocus value={summary} onChange={e => setSummary(e.target.value)} placeholder={t('What’s the idea?')} />
        <label className="field-label" htmlFor="idea-template">{t('Template')}</label>
        <select id="idea-template" value={template} onChange={e => setTemplate(e.target.value)}>
          <option value="">{t('Blank description')}</option>
          {state.templates.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
        {template && <pre className="template-preview">{state.templates.find(x => x.id === template)?.body}</pre>}
        <p className="muted small">{t('It will show in “{view}” if it matches the view’s filters.', { view: view.name })}</p>
        <div className="row end">
          <label className="check-row grow"><input type="checkbox" checked={another} onChange={e => setAnother(e.target.checked)} /> {t('Create another')}</label>
          <button type="button" className="btn subtle" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!summary.trim()}>{t('Create')}</button>
        </div>
      </form>
    </Modal>
  )
}

function PublishPop({ view }) {
  const t = useT()
  const { ws, dispatch } = useStore()
  const link = `${location.origin}${location.pathname}#/share/${view.id}?p=${ws.current}`
  return (
    <div className="publish-pop">
      <div className="popover-title">{t('Publish this view')}</div>
      <p className="muted small">{t('Publishing turns this view into a clean, read-only roadmap page for stakeholders: no editing, only the fields shown here. Viewers can still filter and open ideas.')}</p>
      <label className="check-row">
        <input type="checkbox" checked={!!view.published} onChange={e => dispatch({ type: 'UPDATE_VIEW', id: view.id, patch: { published: e.target.checked } })} />
        {t('Published')}
      </label>
      {view.published && (
        <>
          <div className="row">
            <input readOnly aria-label={t('Link')} value={link} onFocus={e => e.target.select()} />
            <a className="btn subtle" href={`#/share/${view.id}?p=${ws.current}`}>{t('Open')}</a>
          </div>
          <p className="muted small">{t('Data lives in this browser, so the link works on this device. Export the project to share it with others.')}</p>
        </>
      )}
    </div>
  )
}

function ViewPage({ view: savedView, mode, params, onMenu }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const readOnly = mode === 'share'
  const [about, setAbout] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Visitors of a published view (and the archive) filter/sort locally without changing the saved view.
  const [local, setLocal] = useState({})
  const view = readOnly || savedView.archive ? { ...savedView, ...local } : savedView
  const patch = p => (readOnly || savedView.archive ? setLocal(l => ({ ...l, ...p })) : dispatch({ type: 'UPDATE_VIEW', id: view.id, patch: p }))
  const ideas = applyFiltersAndSort(state, view, orderedIdeas(state))
  const ideaKey = params.get(readOnly ? 'selectedIssue' : 'idea')
  const layout = params.get('layout') || 'sidebar'
  const idea = ideaKey && state.ideas[ideaKey]
  const Body = VIEW_BODIES[view.type]
  const close = () => navigate(readOnly ? `/share/${view.id}?p=${shareProject}` : view.archive ? '/archive' : `/view/${view.id}`)

  const exportCsv = () => {
    const fields = view.fields.map(id => fieldById(state, id)).filter(Boolean)
    const rows = [[t('Key'), t('Summary'), ...fields.map(f => f.name)], ...ideas.map(i => [i.key, i.summary, ...fields.map(f => textOf(state, i, f, t.lang))])]
    downloadText(`${slug(view.name)}.csv`, '﻿' + rows.map(r => r.map(c => csvCell(String(c))).join(',')).join('\n'), 'text/csv')
  }

  if (idea && layout === 'full' && !readOnly) {
    return <div className="full-idea"><IdeaPanel idea={idea} view={view} mode={mode} layout="full" onClose={close} /></div>
  }

  const viewActions = [
    { value: 'csv', label: t('Export view as CSV'), icon: 'download' },
    ...(!view.archive ? [{ value: 'dup', label: t('Duplicate view'), icon: 'copy' }, { value: 'delete', label: t('Delete view'), icon: 'trash', danger: true }] : []),
  ]

  return (
    <div className="view-page">
      <div className="view-main">
        {readOnly && (
          <div className="share-banner">
            <span className="share-kicker">{state.space.name}</span>
            <span className="muted small">{t('Read-only roadmap · updated {when}', { when: timeAgo(Math.max(...Object.values(state.ideas).map(i => i.updated), 0), t.lang) })}</span>
          </div>
        )}
        <header className="view-header">
          {!readOnly && <button className="icon-btn show-mobile" aria-label={t('Open menu')} onClick={onMenu}><Icon name="menu" /></button>}
          <Icon name={view.archive ? 'archive' : VIEW_ICONS[view.type]} size={18} className="view-head-icon" />
          <InlineText className="view-title" value={view.name} readOnly={readOnly || view.archive} label={t('View name')} onSave={name => dispatch({ type: 'UPDATE_VIEW', id: view.id, patch: { name } })} />
          <span className="count-pill">{t('{n} ideas', { n: ideas.length })}</span>
          {!view.archive && !readOnly && (
            <button className="about-btn" onClick={() => setAbout(a => !a)} aria-expanded={about}>
              <Icon name="info" size={14} /> <span>{view.about ? view.about.split('\n')[0] : t('About this view')}</span>
            </button>
          )}
          <span className="spacer" />
          {readOnly ? (
            <a className="btn subtle" href={`#/view/${view.id}`}>{t('Open in editor')}</a>
          ) : (
            <>
              {!view.archive && (
                <Popover align="right"
                  trigger={({ toggle }) => <button className={`btn ${view.published ? 'published' : 'subtle'}`} onClick={toggle}><Icon name="globe" size={14} /> <span className="hide-mobile">{view.published ? t('Published') : t('Publish')}</span></button>}>
                  {() => <PublishPop view={view} />}
                </Popover>
              )}
              <Dropdown align="right" options={viewActions}
                onSelect={v => {
                  if (v === 'csv') exportCsv()
                  if (v === 'dup') dispatch({ type: 'DUPLICATE_VIEW', id: view.id, name: t('{name} (copy)', { name: view.name }) })
                  if (v === 'delete') setConfirmDelete(true)
                }}
                render={o => <span className={o.danger ? 'danger' : ''}><Icon name={o.icon} size={14} /> {o.label}</span>}
                trigger={({ toggle }) => <button className="icon-btn" aria-label={t('View actions')} onClick={toggle}><Icon name="more" /></button>} />
            </>
          )}
        </header>
        {readOnly && view.about && <div className="share-about"><RichText text={view.about} /></div>}
        {confirmDelete && (
          <div className="confirm-bar" role="alert">
            <span>{t('Delete the view “{name}”? Ideas are not affected.', { name: view.name })}</span>
            <button className="btn danger-btn" onClick={() => { dispatch({ type: 'DELETE_VIEW', id: view.id }); navigate('/view') }}>{t('Delete')}</button>
            <button className="btn subtle" onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button>
          </div>
        )}
        <Toolbar view={view} patch={patch} readOnly={readOnly} onCreate={() => setCreating(true)} />
        <div className="view-body">
          <Body view={view} ideas={ideas} mode={mode} readOnly={readOnly} selectedKey={ideaKey} />
        </div>
      </div>
      {idea ? <IdeaPanel idea={idea} view={view} mode={mode} layout="sidebar" onClose={close} />
        : about && <AboutPanel key={view.id} view={view} readOnly={readOnly} onClose={() => setAbout(false)} />}
      {creating && <CreateIdea view={view} onClose={() => setCreating(false)} />}
    </div>
  )
}

export default function App() {
  const t = useT()
  const { state, ws, dispatch } = useStore()
  const { mode, id, params } = useRoute()
  const [drawer, setDrawer] = useState(false)
  const [settings, setSettings] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { if (state.lastView) navigate(`/view/${state.lastView}`) }, [state.lastView])
  useEffect(() => { if (!notice) return; const h = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(h) }, [notice])

  // A shared link names its project; switch to it if it exists in this browser.
  const wantProject = mode === 'share' ? params.get('p') : null
  useEffect(() => { if (wantProject && ws.projects[wantProject] && ws.current !== wantProject) dispatch({ type: 'SWITCH_PROJECT', id: wantProject }) }, [wantProject, ws, dispatch])
  shareProject = wantProject || ws.current

  const archiveView = { id: '__archive', archive: true, type: 'list', name: t('Archived ideas'), about: '', fields: ['status', 'insights', 'votes', 'owner'].filter(f => fieldById(state, f)), filters: [], sort: null }
  const view = mode === 'archive' ? archiveView : state.views.find(v => v.id === id) ?? (mode !== 'share' ? state.views[0] : null)

  if (mode === 'share') {
    if (!view || !view.published || (wantProject && ws.current !== wantProject && ws.projects[wantProject])) {
      return (
        <div className="share-missing">
          <Icon name="globe" size={32} />
          <h2>{t('This view isn’t published')}</h2>
          <p className="muted">{t('Ask the project owner to publish it, or open the editor.')}</p>
          <a className="btn subtle" href="#/view">{t('Open the editor')}</a>
        </div>
      )
    }
    return (
      <div className="app share">
        <ViewPage key={view.id} view={view} mode="share" params={params} />
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar activeId={view?.id} open={drawer} onClose={() => setDrawer(false)} onSettings={() => setSettings(true)} onNotice={setNotice} />
      <main className="main">
        {view ? <ViewPage key={`${ws.current}:${view.id}`} view={view} mode="view" params={params} onMenu={() => setDrawer(true)} /> : (
          <div className="empty">
            <button className="icon-btn show-mobile" aria-label={t('Open menu')} onClick={() => setDrawer(true)}><Icon name="menu" /></button>
            {t('No views yet. Create one from the sidebar.')}
          </div>
        )}
      </main>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}
