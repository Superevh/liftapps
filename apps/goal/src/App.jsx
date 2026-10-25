import { useEffect, useMemo, useState, useCallback } from "react";
import { getLang, onLang } from "../../../shared/lift-shell.mjs";
import { makeT } from "./i18n.js";
import { load, save, seed } from "./store.js";
import { currentTimeframe, sortTimeframes } from "./logic.js";
import { Ctx } from "./ctx.js";
import Dashboard from "./Dashboard.jsx";
import Levels from "./Levels.jsx";
import MapView from "./MapView.jsx";
import OrgView from "./OrgView.jsx";
import DataView from "./DataView.jsx";
import Drawer from "./Drawer.jsx";
import { ObjectiveForm, KrForm, CheckinForm, CloseForm, InitiativeForm } from "./Forms.jsx";

const VIEWS = ["dashboard", "levels", "map", "org", "data"];

export default function App() {
  const [lang, setLang] = useState(getLang());
  const [data, setData] = useState(() => load() || seed(getLang()));
  const [view, setView] = useState(() => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : "dashboard"; });
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null); // { kind, ...props }
  const [filters, setFilters] = useState(() => ({ tf: currentTimeframe(data.timeframes)?.id || "all", level: "all", owner: "all", status: "all", q: "" }));

  useEffect(() => onLang((l) => { setLang(l); document.documentElement.lang = l === "zh" ? "zh-CN" : "en"; }), []);
  useEffect(() => { save(data); }, [data]);
  useEffect(() => { location.replace(`#${view}`); window.scrollTo(0, 0); }, [view]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (modal) setModal(null); else setOpenId(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const t = useMemo(() => makeT(lang), [lang]);
  // update(fn): fn receives a deep copy it may mutate.
  const update = useCallback((fn) => setData((d) => { const c = structuredClone(d); fn(c); return c; }), []);
  const replaceData = useCallback((d) => { setData(d); setOpenId(null); setFilters((f) => ({ ...f, tf: currentTimeframe(d.timeframes)?.id || "all", owner: "all" })); }, []);

  const ctx = { data, update, replaceData, t, lang, filters, setFilters, openObjective: setOpenId, setModal, setView,
    timeframes: sortTimeframes(data.timeframes) };

  const open = data.objectives.find((o) => o.id === openId);
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="apphead">
          <div className="apphead-title">
            <h1>{data.org.name}</h1>
            <p>{t("appTagline")}</p>
          </div>
          <button className="btn primary" onClick={() => setModal({ kind: "objective" })}>+ {t("newObjective")}</button>
        </header>
        <nav className="tabs" role="tablist" aria-label="GoalLift">
          {VIEWS.map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)} data-view={v}>{t(`nav_${v}`)}</button>
          ))}
        </nav>
        <main className="main">
          {view === "dashboard" && <Dashboard />}
          {view === "levels" && <Levels />}
          {view === "map" && <MapView />}
          {view === "org" && <OrgView />}
          {view === "data" && <DataView />}
        </main>
        <footer className="foot">GoalLift · Lift Apps by AIYun</footer>
      </div>
      {open && <Drawer obj={open} onClose={() => setOpenId(null)} />}
      {modal?.kind === "objective" && <ObjectiveForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "kr" && <KrForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "checkin" && <CheckinForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "close" && <CloseForm {...modal} onClose={() => setModal(null)} />}
      {modal?.kind === "initiative" && <InitiativeForm {...modal} onClose={() => setModal(null)} />}
    </Ctx.Provider>
  );
}
