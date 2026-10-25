import { useState } from "react";
import { useApp } from "./ctx.js";
import { objectiveProgress, objectiveStatus, objectiveNeedsCheckin, ownerName, inTimeframe, krProgress, krStatus, pct } from "./logic.js";
import { FilterBar, filterObjectives, LevelBadge, Bar, Pct } from "./ui.jsx";

export default function MapView() {
  const { t, data, filters } = useApp();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [showKrs, setShowKrs] = useState(false);
  const tfById = Object.fromEntries(data.timeframes.map((x) => [x.id, x]));
  const inView = data.objectives.filter((o) => inTimeframe(o, filters.tf, tfById));
  const inViewIds = new Set(inView.map((o) => o.id));
  const match = new Set(filterObjectives(data, { ...filters, level: "all" }).map((o) => o.id));
  const dimming = filters.owner !== "all" || filters.status !== "all" || filters.q.trim();

  const kidsOf = (o) => inView.filter((c) => c.parent && ((c.parent.type === "objective" && c.parent.id === o.id) || (c.parent.type === "kr" && o.krs.some((k) => k.id === c.parent.id))));
  const roots = inView.filter((o) => o.level === "company");
  const parentInView = (o) => {
    if (!o.parent) return false;
    if (o.parent.type === "objective") return inViewIds.has(o.parent.id);
    return inView.some((p) => p.krs.some((k) => k.id === o.parent.id));
  };
  const orphans = inView.filter((o) => o.level !== "company" && !parentInView(o));

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allIds = inView.map((o) => o.id);
  const ctx = { kidsOf, collapsed, toggle, showKrs, match, dimming };

  return (
    <section className="mapview">
      <div className="maphead">
        <div><h2 className="h2">{t("map_title")}</h2><p className="muted">{t("map_hint")}</p></div>
        <div className="maptools">
          <label className="chk"><input type="checkbox" checked={showKrs} onChange={(e) => setShowKrs(e.target.checked)} data-map-krs /> {t("map_showKrs")}</label>
          <button className="btn ghost sm" onClick={() => setCollapsed(new Set())}>{t("map_expand")}</button>
          <button className="btn ghost sm" onClick={() => setCollapsed(new Set(allIds))}>{t("map_collapse")}</button>
        </div>
      </div>
      <FilterBar hideLevel />
      <div className="legend" aria-hidden="true">
        {["company", "department", "team", "personal"].map((l) => <LevelBadge key={l} level={l} small />)}
      </div>
      <div className="tree" role="tree" aria-label={t("map_title")}>
        {roots.length === 0 && orphans.length === 0 && <p className="empty">{t("empty_filtered")}</p>}
        {roots.map((o) => <Node key={o.id} obj={o} ctx={ctx} seen={new Set()} />)}
      </div>
      {orphans.length > 0 && (
        <div className="orphans">
          <h3 className="h3">{t("map_unaligned")}</h3>
          <p className="muted">{t("map_unalignedHint")}</p>
          <div className="tree" role="tree">{orphans.map((o) => <Node key={o.id} obj={o} ctx={ctx} seen={new Set()} />)}</div>
        </div>
      )}
    </section>
  );
}

function Node({ obj, ctx, seen, via }) {
  const { t, data, openObjective } = useApp();
  if (seen.has(obj.id)) return null;
  const nextSeen = new Set(seen).add(obj.id);
  const kids = ctx.kidsOf(obj);
  const isCollapsed = ctx.collapsed.has(obj.id);
  const prog = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  const needs = objectiveNeedsCheckin(obj);
  const dim = ctx.dimming && !ctx.match.has(obj.id);
  const hasChildren = kids.length > 0 || (ctx.showKrs && obj.krs.length > 0);
  return (
    <div className={`tnode tl-${obj.level}`} role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined} data-tree-obj={obj.id}>
      <div className={`tcard l-${obj.level}${dim ? " dim" : ""}`}>
        {hasChildren ? (
          <button className={`twist${isCollapsed ? "" : " open"}`} onClick={() => ctx.toggle(obj.id)} aria-label={isCollapsed ? "Expand" : "Collapse"}>▸</button>
        ) : <span className="twist none" aria-hidden="true" />}
        <button className="tbody" onClick={() => openObjective(obj.id)}>
          <span className="trow1">
            <LevelBadge level={obj.level} small />
            <span className="owner">{ownerName(data, obj.level, obj.ownerId, t)}</span>
            {via && <span className="via">↳ {t("alignedVia")}: {via}</span>}
          </span>
          <span className="ttitle">{obj.title}</span>
          <span className="trow2">
            <Bar value={prog} level={obj.level} /><Pct value={prog} />
            <span className={`sdot s-${status}`} title={t(`status_${status}`)} aria-label={t(`status_${status}`)} />
            {needs && <span className="needs-mini" title={t("status_needs")}>!</span>}
            {kids.length > 0 && <span className="kidcount">{kids.length}</span>}
          </span>
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <div className="tkids" role="group">
          {ctx.showKrs ? (
            <>
              {obj.krs.map((kr) => {
                const viaKids = kids.filter((c) => c.parent.type === "kr" && c.parent.id === kr.id);
                return (
                  <div key={kr.id} className="tkr">
                    <div className="tkr-row"><span className="krtag">KR</span><span className="tkr-t">{kr.title}</span><span className={`sdot s-${krStatus(kr)}`} /><span className="pct">{pct(krProgress(kr))}%</span></div>
                    {viaKids.length > 0 && <div className="tkids">{viaKids.map((c) => <Node key={c.id} obj={c} ctx={ctx} seen={nextSeen} />)}</div>}
                  </div>
                );
              })}
              {kids.filter((c) => c.parent.type === "objective").map((c) => <Node key={c.id} obj={c} ctx={ctx} seen={nextSeen} />)}
            </>
          ) : kids.map((c) => <Node key={c.id} obj={c} ctx={ctx} seen={nextSeen} via={c.parent.type === "kr" ? obj.krs.find((k) => k.id === c.parent.id)?.title : null} />)}
        </div>
      )}
    </div>
  );
}
