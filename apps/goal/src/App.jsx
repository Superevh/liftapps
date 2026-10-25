import { useEffect, useMemo, useState, useCallback } from "react";
import { getLang, onLang } from "../../../shared/lift-shell.mjs";
import { makeT } from "./i18n.js";
import { load, save, seed } from "./store.js";
import { currentTimeframe, sortTimeframes, tfLabel, unitObjectives, avgProgress, pct } from "./logic.js";
import { Ctx, useApp } from "./ctx.js";
import { Icon } from "./ui.jsx";
import Overview from "./Overview.jsx";
import TreeView from "./TreeView.jsx";
import OrgView from "./OrgView.jsx";
import DataView from "./DataView.jsx";
import { UnitPage, MyPage } from "./OkrList.jsx";
import { ObjectivePanel, CheckinPanel } from "./Panels.jsx";
import { ObjectiveForm, KrForm, CloseForm, InitiativeForm } from "./Forms.jsx";

const readRoute = () => { const h = location.hash.replace(/^#/, ""); return h.startsWith("/") ? h : "/overview"; };

export default function App() {
  const [lang, setLang] = useState(getLang());
  const [data, setData] = useState(() => load() || seed(getLang()));
  const [route, setRoute] = useState(readRoute);
  const [panel, setPanel] = useState(null); // { kind: "objective", id } | { kind: "checkin", objId, krId }
  const [modal, setModal] = useState(null);
  const [tf, setTf] = useState(() => currentTimeframe(data.timeframes)?.id);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => onLang((l) => { setLang(l); document.documentElement.lang = l === "zh" ? "zh-CN" : "en"; }), []);
  useEffect(() => { save(data); }, [data]);
  useEffect(() => {
    const h = () => { setRoute(readRoute()); setNavOpen(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => { if (!data.timeframes.some((x) => x.id === tf)) setTf(currentTimeframe(data.timeframes)?.id); }, [data.timeframes, tf]);

  const t = useMemo(() => makeT(lang), [lang]);
  const update = useCallback((fn) => setData((d) => { const c = structuredClone(d); fn(c); return c; }), []);
  const replaceData = useCallback((d) => { setData(d); setPanel(null); setTf(currentTimeframe(d.timeframes)?.id); }, []);
  const go = useCallback((to) => { if (location.hash !== `#${to}`) location.hash = to; setPanel(null); setNavOpen(false); }, []);
  const tfById = useMemo(() => Object.fromEntries(data.timeframes.map((x) => [x.id, x])), [data.timeframes]);
  const timeframes = useMemo(() => sortTimeframes(data.timeframes), [data.timeframes]);

  const ctx = {
    data, update, replaceData, t, lang, tf, setTf, tfById, timeframes, route, go, setModal,
    openObjective: (id) => setPanel({ kind: "objective", id }),
    openCheckin: (objId, krId) => setPanel({ kind: "checkin", objId, krId }),
  };

  const [, a, b] = route.split("/");
  let page, preset = null;
  if (a === "company") { page = <UnitPage key="company" level="company" ownerId="company" />; preset = { level: "company", ownerId: "company" }; }
  else if (a === "dept") { page = <UnitPage key={b} level="department" ownerId={b} />; preset = { level: "department", ownerId: b }; }
  else if (a === "team") { page = <UnitPage key={b} level="team" ownerId={b} />; preset = { level: "team", ownerId: b }; }
  else if (a === "person") { page = <UnitPage key={b} level="personal" ownerId={b} />; preset = { level: "personal", ownerId: b }; }
  else if (a === "me") { page = <MyPage />; preset = { level: "personal", ownerId: data.meId }; }
  else if (a === "tree") page = <TreeView />;
  else if (a === "org") page = <OrgView />;
  else if (a === "data") page = <DataView />;
  else page = <Overview />;
  const showCycle = !["org", "data"].includes(a);

  const panelObj = panel?.kind === "objective" && data.objectives.find((o) => o.id === panel.id);
  return (
    <Ctx.Provider value={ctx}>
      <div className={`shell${navOpen ? " nav-open" : ""}`}>
        <Sidebar onClose={() => setNavOpen(false)} />
        {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <div className="main">
          <div className="toolbar">
            <button className="iconbtn navbtn" onClick={() => setNavOpen(true)} aria-label={t("menu")} data-nav-toggle><Icon name="menu" size={18} /></button>
            <span className="grow" />
            {showCycle && (
              <label className="cycle">
                <span className="muted small">{t("cycle")}</span>
                <select value={tf} onChange={(e) => setTf(e.target.value)} data-cycle aria-label={t("cycle")}>
                  {timeframes.map((x) => <option key={x.id} value={x.id}>{tfLabel(x, lang)}</option>)}
                </select>
              </label>
            )}
            {showCycle && <button className="btn primary" onClick={() => setModal({ kind: "objective", preset })} data-new-obj><Icon name="plus" size={14} />{t("newObjective")}</button>}
          </div>
          <main>{page}</main>
          <footer className="foot">GoalLift · Lift Apps by AIYun</footer>
        </div>
      </div>
      {panelObj && <ObjectivePanel obj={panelObj} onClose={() => setPanel(null)} />}
      {panel?.kind === "checkin" && <CheckinPanel key={panel.krId} objId={panel.objId} krId={panel.krId} onClose={() => setPanel(null)} />}
      {modal?.kind === "objective" && <ObjectiveForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "kr" && <KrForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "close" && <CloseForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "initiative" && <InitiativeForm {...modal} onClose={() => setModal(null)} />}
    </Ctx.Provider>
  );
}

function NavItem({ to, icon, label, level, pctVal, indent, children }) {
  const { route, go } = useApp();
  const active = route === to;
  return (
    <li>
      <a href={`#${to}`} className={`nav-item${active ? " on" : ""}${indent ? ` ind${indent}` : ""}`} aria-current={active ? "page" : undefined}
        onClick={(e) => { e.preventDefault(); go(to); }} data-nav={to}>
        {icon ? <Icon name={icon} /> : <i className={`nav-dot l-${level}`} aria-hidden="true" />}
        <span className="nav-l">{label}</span>
        {pctVal != null && <span className="nav-p">{pctVal}%</span>}
      </a>
      {children}
    </li>
  );
}

function Sidebar({ onClose }) {
  const { t, data, tf } = useApp();
  const unitPct = (level, id) => { const p = avgProgress(unitObjectives(data, level, id, tf).filter((o) => !o.closed), data.objectives); return p == null ? null : pct(p); };
  return (
    <nav className="sidebar" aria-label={t("navLabel")}>
      <div className="side-head">
        <span className="side-org">{data.org.name}</span>
        <button className="iconbtn side-x" onClick={onClose} aria-label={t("close")}><Icon name="close" /></button>
      </div>
      <ul className="nav">
        <NavItem to="/overview" icon="overview" label={t("nav_overview")} />
        <NavItem to="/me" icon="me" label={t("nav_me")} />
        <NavItem to="/tree" icon="tree" label={t("nav_tree")} />
      </ul>
      <div className="side-sec">{t("nav_org")}</div>
      <ul className="nav">
        <NavItem to="/company" level="company" label={data.org.name} pctVal={unitPct("company", "company")} />
        {data.departments.map((d) => (
          <NavItem key={d.id} to={`/dept/${d.id}`} level="department" label={d.name} pctVal={unitPct("department", d.id)} indent={1}>
            <ul className="nav">
              {data.teams.filter((x) => x.deptId === d.id).map((tm) => (
                <NavItem key={tm.id} to={`/team/${tm.id}`} level="team" label={tm.name} pctVal={unitPct("team", tm.id)} indent={2} />
              ))}
            </ul>
          </NavItem>
        ))}
        {data.teams.filter((x) => !data.departments.some((d) => d.id === x.deptId)).map((tm) => (
          <NavItem key={tm.id} to={`/team/${tm.id}`} level="team" label={tm.name} pctVal={unitPct("team", tm.id)} indent={1} />
        ))}
      </ul>
      <div className="side-foot">
        <ul className="nav">
          <NavItem to="/org" icon="settings" label={t("nav_settings")} />
          <NavItem to="/data" icon="data" label={t("nav_data")} />
        </ul>
      </div>
    </nav>
  );
}
