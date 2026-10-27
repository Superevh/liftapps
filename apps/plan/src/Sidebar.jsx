import { colorVar } from './store.js'
import Icon from './icons.jsx'

// Workspace navigation: overview, the roadmaps in this workspace, and who "you" are.
export default function Sidebar({ ws, cur, page, t, me, docked, onWsName, onOpen, onHome, onNew, onKeys, onName, onClose }) {
  return (
    <aside className={`side ${docked ? '' : 'drawer'}`} aria-label={t.workspace}>
      <div className="side-top">
        <div className="side-ws">
          <span className="eyebrow">{t.workspace}</span>
          <input value={ws.name} placeholder={t.untitledWs} aria-label={t.workspaceName} onChange={e => onWsName(e.target.value.slice(0, 120))} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </div>
        <button className="icon-btn" aria-label={docked ? t.hideSidebar : t.closeMenu} title={docked ? t.hideSidebar : t.closeMenu} onClick={onClose}><Icon name={docked ? 'chevronL' : 'close'} size={17} /></button>
      </div>
      <nav className="side-nav">
        <button className={`side-item ${page === 'home' ? 'on' : ''}`} aria-current={page === 'home' ? 'page' : undefined} onClick={onHome}><Icon name="grid" size={16} /><span>{t.overview}</span></button>
        <div className="side-label"><span>{t.roadmaps}</span><button className="icon-btn sm" aria-label={t.newRoadmap} title={t.newRoadmap} onClick={onNew}><Icon name="plus" size={15} /></button></div>
        <ul className="side-list">
          {ws.roadmaps.map(r => {
            const on = page === 'roadmap' && cur?.id === r.id
            const risk = r.items.filter(i => i.status === 'risk').length
            return (
              <li key={r.id}>
                <button className={`side-item ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => onOpen(r.id)}>
                  <span className="side-swatch" aria-hidden="true">{r.lanes.slice(0, 3).map(l => <i key={l.id} style={{ background: colorVar(l.color) }} />)}</span>
                  <span className="side-name">{r.name || t.untitled}</span>
                  {risk > 0 && <span className="side-risk" title={t.statRisk(risk)} aria-label={t.statRisk(risk)}><Icon name="warn" size={12} sw={2.2} /></span>}
                  <span className="side-count">{r.items.length}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <button className="side-item add" onClick={onNew}><Icon name="plus" size={15} /><span>{t.newRoadmap}</span></button>
      </nav>
      <div className="side-foot">
        <button className="side-item" onClick={onName}><Icon name="user" size={15} /><span>{me ? <>{t.you}: <b>{me}</b></> : t.setName}</span></button>
        <button className="side-item" onClick={onKeys}><Icon name="keyboard" size={15} /><span>{t.shortcuts}</span><kbd>?</kbd></button>
        <p className="side-brand">PlanLift · <a href="https://liftapps.com.au" target="_blank" rel="noopener">Lift Apps</a></p>
      </div>
    </aside>
  )
}
