import { useState, useRef, useLayoutEffect } from "react";
import { useApp } from "./ctx.js";
import { childrenOf, inCycle, objectiveProgress, objectiveStatus, ownerName, pct, findParent } from "./logic.js";
import { Icon, Bar, StatusDot, Avatar } from "./ui.jsx";

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15];

export default function TreeView() {
  const { t, data, tf, tfById } = useApp();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [zi, setZi] = useState(3);
  const vp = useRef(null), canvas = useRef(null);
  // On open, zoom out (down to 60%) until the whole tree fits the width of the viewport.
  useLayoutEffect(() => {
    const v = vp.current, c = canvas.current;
    if (!v || !c) return;
    const avail = v.clientWidth - 40, natural = c.scrollWidth;
    let i = 3;
    while (i > 0 && natural * ZOOMS[i] > avail) i--;
    setZi(i);
  }, []);
  const visible = data.objectives.filter((o) => inCycle(o, tf, tfById));
  const visibleIds = new Set(visible.map((o) => o.id));
  const kidsOf = (o) => childrenOf(o.id, data.objectives).filter((c) => visibleIds.has(c.id));
  const roots = visible.filter((o) => o.level === "company");
  const orphans = visible.filter((o) => o.level !== "company" && !(findParent(o, data.objectives)?.objective && visibleIds.has(findParent(o, data.objectives).objective.id)));
  const withKids = visible.filter((o) => kidsOf(o).length);
  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="page treepage" data-tree>
      <header className="phead">
        <div className="phead-l">
          <h1 className="ptitle">{t("nav_tree")}</h1>
          <p className="muted small">{t("tree_hint")}</p>
        </div>
      </header>
      <div className="tree-tools">
        <button className="btn sm" onClick={() => setCollapsed(new Set())} data-expand-all>{t("map_expand")}</button>
        <button className="btn sm" onClick={() => setCollapsed(new Set(withKids.map((o) => o.id)))} data-collapse-all>{t("map_collapse")}</button>
        <span className="grow" />
        <div className="zoom" role="group" aria-label={t("zoom")}>
          <button className="iconbtn" onClick={() => setZi(Math.max(0, zi - 1))} aria-label={t("zoomOut")} disabled={zi === 0}><Icon name="minus" /></button>
          <button className="zoom-n" onClick={() => setZi(3)} title={t("zoomReset")}>{Math.round(ZOOMS[zi] * 100)}%</button>
          <button className="iconbtn" onClick={() => setZi(Math.min(ZOOMS.length - 1, zi + 1))} aria-label={t("zoomIn")} disabled={zi === ZOOMS.length - 1}><Icon name="plus" /></button>
        </div>
      </div>
      <div className="tree-viewport" ref={vp}>
        <div className="tree-canvas" ref={canvas} style={{ zoom: ZOOMS[zi] }}>
          {roots.length === 0 ? <p className="empty">{t("emptyUnit")}</p> : (
            <ul className="tree">
              {roots.map((o) => <Node key={o.id} obj={o} kidsOf={kidsOf} collapsed={collapsed} toggle={toggle} />)}
            </ul>
          )}
        </div>
      </div>
      {orphans.length > 0 && (
        <div className="orphans">
          <h2 className="sec-title">{t("map_unaligned")}</h2>
          <p className="muted small">{t("map_unalignedHint")}</p>
          <div className="orphan-row">{orphans.map((o) => <Card key={o.id} obj={o} />)}</div>
        </div>
      )}
    </section>
  );
}

function Node({ obj, kidsOf, collapsed, toggle }) {
  const kids = kidsOf(obj);
  const isCollapsed = collapsed.has(obj.id);
  return (
    <li className={kids.length && !isCollapsed ? "has-kids" : ""}>
      <Card obj={obj} kids={kids.length} isCollapsed={isCollapsed} onToggle={() => toggle(obj.id)} />
      {kids.length > 0 && !isCollapsed && (
        <ul>{kids.map((c) => <Node key={c.id} obj={c} kidsOf={kidsOf} collapsed={collapsed} toggle={toggle} />)}</ul>
      )}
    </li>
  );
}

function Card({ obj, kids = 0, isCollapsed, onToggle }) {
  const { t, data, openObjective } = useApp();
  const p = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  return (
    <div className={`tcard l-${obj.level}`} data-tree-node={obj.id}>
      <button className="tcard-hit" onClick={() => openObjective(obj.id)}>
        <span className="tcard-top"><i className="tl-dot" aria-hidden="true" /><span className="muted small">{t(`level_${obj.level}`)} · {ownerName(data, obj.level, obj.ownerId, t)}</span></span>
        <span className="tcard-t">{obj.title}</span>
        <span className="tcard-p"><StatusDot status={status} /><Bar value={p} level={obj.level} /><span className="pct">{pct(p)}%</span><Avatar id={obj.leadId} size={20} /></span>
      </button>
      {kids > 0 && (
        <button className="tcard-fold" onClick={onToggle} aria-expanded={!isCollapsed} aria-label={t(isCollapsed ? "expand" : "collapse")} data-fold={obj.id}>
          {isCollapsed ? `+${kids}` : <Icon name="minus" size={12} />}
        </button>
      )}
    </div>
  );
}
