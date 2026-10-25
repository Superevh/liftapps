import { useApp } from "./ctx.js";
import { LEVELS, objectiveProgress, ownerName } from "./logic.js";
import { FilterBar, ObjectiveCard, useFiltered, filterObjectives, Bar, Pct } from "./ui.jsx";

export default function Levels() {
  const { t, data, filters, setFilters, setModal } = useApp();
  const list = useFiltered();
  const all = filterObjectives(data, { ...filters, level: "all" }); // tab counts ignore the level filter itself
  const shown = filters.level === "all" ? LEVELS : [filters.level];
  return (
    <section>
      <div className="leveltabs" role="tablist" aria-label={t("level")}>
        {["all", ...LEVELS].map((l) => (
          <button key={l} role="tab" aria-selected={filters.level === l} className={`lt lt-${l}${filters.level === l ? " on" : ""}`} data-level-tab={l}
            onClick={() => setFilters((f) => ({ ...f, level: l }))}>
            {l === "all" ? t("allLevels") : <><i aria-hidden="true">{LEVELS.indexOf(l) + 1}</i>{t(`level_${l}`)}</>}
            <small>{l === "all" ? all.length : all.filter((o) => o.level === l).length}</small>
          </button>
        ))}
      </div>
      <FilterBar hideLevel />
      {shown.map((level) => {
        const items = list.filter((o) => o.level === level);
        const groups = groupByOwner(items);
        const avg = items.length ? items.reduce((s, o) => s + objectiveProgress(o, data.objectives), 0) / items.length : 0;
        return (
          <div key={level} className={`lsection ls-${level}`} data-level-section={level}>
            <header className="lhead">
              <div className="lhead-l">
                <span className="lnum" aria-hidden="true">{LEVELS.indexOf(level) + 1}</span>
                <div><h2>{t(`levels_${level}`)}</h2><p>{t(`levelHint_${level}`)}</p></div>
              </div>
              <div className="lhead-r">
                {items.length > 0 && <span className="lavg"><Bar value={avg} level={level} /><Pct value={avg} /></span>}
                <button className="btn sm" onClick={() => setModal({ kind: "objective", preset: { level } })}>+ {t("addObjectiveAt", { level: t(`level_${level}`) })}</button>
              </div>
            </header>
            {items.length === 0 && <p className="empty">{t("empty_level", { level: t(`level_${level}`) })}</p>}
            <div className="ogroups">
            {groups.map(([ownerId, objs]) => (
              <div key={ownerId} className={`ogroup${objs.length > 1 ? " many" : ""}`}>
                {level !== "company" && <h4 className="ogroup-h">{ownerName(data, level, ownerId, t)}</h4>}
                <div className="ogrid">{objs.map((o) => <ObjectiveCard key={o.id} obj={o} />)}</div>
              </div>
            ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function groupByOwner(items) {
  const m = new Map();
  for (const o of items) { if (!m.has(o.ownerId)) m.set(o.ownerId, []); m.get(o.ownerId).push(o); }
  return [...m.entries()];
}

