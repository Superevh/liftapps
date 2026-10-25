import { useApp } from "./ctx.js";
import {
  LEVELS, pct, objectiveProgress, objectiveStatus, objectiveNeedsCheckin, krQuality, krQualityFlag, ownerName, personName,
  inTimeframe, tfLabel, findParent, daysAgo, krProgress,
} from "./logic.js";

export function LevelBadge({ level, small }) {
  const { t } = useApp();
  return <span className={`lvl lvl-${level}${small ? " sm" : ""}`}><i aria-hidden="true">{LEVELS.indexOf(level) + 1}</i>{t(`level_${level}`)}</span>;
}

export function StatusPill({ status, needs }) {
  const { t } = useApp();
  return (
    <span className="pills">
      <span className={`st st-${status}`}><b aria-hidden="true" />{t(`status_${status}`)}</span>
      {needs && <span className="st st-needs" title={t("status_needs")}><b aria-hidden="true" />{t("needsBadge")}</span>}
    </span>
  );
}

export function Bar({ value, level, status }) {
  return (
    <span className={`bar bar-${level || "x"} ${status ? `bs-${status}` : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(value)}>
      <span style={{ width: `${pct(value)}%` }} />
    </span>
  );
}

export function Pct({ value }) { return <span className="pct">{pct(value)}%</span>; }

export function ago(t, isoStr) {
  if (!isoStr) return t("never");
  const n = daysAgo(isoStr);
  return n <= 0 ? t("today") : n === 1 ? t("dayAgo1") : t("daysAgoN", { n });
}

// Apply the shared filter bar to objectives.
export function useFiltered() {
  const { data, filters } = useApp();
  return filterObjectives(data, filters);
}
export function filterObjectives(data, filters) {
  const tfById = Object.fromEntries(data.timeframes.map((x) => [x.id, x]));
  const q = filters.q.trim().toLowerCase();
  return data.objectives.filter((o) => {
    if (!inTimeframe(o, filters.tf, tfById)) return false;
    if (filters.level !== "all" && o.level !== filters.level) return false;
    if (filters.owner !== "all") {
      const [kind, id] = filters.owner.split(":");
      if (kind === "unit" && o.ownerId !== id && !(id === "company" && o.level === "company")) return false;
      if (kind === "lead" && o.leadId !== id && !o.krs.some((k) => k.leadId === id)) return false;
    }
    if (filters.status !== "all") {
      if (filters.status === "needs") { if (!objectiveNeedsCheckin(o)) return false; }
      else if (filters.status === "closed") { if (!o.closed) return false; }
      else if (o.closed || objectiveStatus(o, data.objectives) !== filters.status) return false;
    }
    if (q && !(o.title.toLowerCase().includes(q) || o.krs.some((k) => k.title.toLowerCase().includes(q)))) return false;
    return true;
  });
}

export function FilterBar({ hideLevel }) {
  const { t, lang, data, filters, setFilters, timeframes } = useApp();
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const dirty = filters.level !== "all" || filters.owner !== "all" || filters.status !== "all" || filters.q;
  return (
    <div className="filters" role="search">
      <label><span>{t("timeframe")}</span>
        <select value={filters.tf} onChange={set("tf")} aria-label={t("timeframe")} data-filter="tf">
          <option value="all">{t("allTimeframes")}</option>
          {timeframes.map((x) => <option key={x.id} value={x.id}>{tfLabel(x, lang)}</option>)}
        </select>
      </label>
      {!hideLevel && (
        <label><span>{t("level")}</span>
          <select value={filters.level} onChange={set("level")} aria-label={t("level")} data-filter="level">
            <option value="all">{t("allLevels")}</option>
            {LEVELS.map((l) => <option key={l} value={l}>{t(`level_${l}`)}</option>)}
          </select>
        </label>
      )}
      <label><span>{t("owner")}</span>
        <select value={filters.owner} onChange={set("owner")} aria-label={t("owner")} data-filter="owner">
          <option value="all">{t("allOwners")}</option>
          <optgroup label={t("level_company")}><option value="unit:company">{data.org.name}</option></optgroup>
          <optgroup label={t("level_department")}>{data.departments.map((d) => <option key={d.id} value={`unit:${d.id}`}>{d.name}</option>)}</optgroup>
          <optgroup label={t("level_team")}>{data.teams.map((d) => <option key={d.id} value={`unit:${d.id}`}>{d.name}</option>)}</optgroup>
          <optgroup label={t("lead")}>{data.people.map((d) => <option key={d.id} value={`lead:${d.id}`}>{d.name}</option>)}</optgroup>
        </select>
      </label>
      <label><span>{t("status")}</span>
        <select value={filters.status} onChange={set("status")} aria-label={t("status")} data-filter="status">
          <option value="all">{t("allStatuses")}</option>
          {["on_track", "at_risk", "off_track", "none", "needs", "closed"].map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
        </select>
      </label>
      <label className="grow"><span>{t("search")}</span>
        <input type="search" value={filters.q} onChange={set("q")} placeholder={t("search")} aria-label={t("search")} />
      </label>
      {dirty && <button className="btn ghost sm" onClick={() => setFilters((f) => ({ ...f, level: "all", owner: "all", status: "all", q: "" }))}>{t("clearFilters")}</button>}
    </div>
  );
}

export function ObjectiveCard({ obj, compact }) {
  const { data, t, lang, openObjective } = useApp();
  const prog = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  const needs = objectiveNeedsCheckin(obj);
  const parent = findParent(obj, data.objectives);
  const tf = data.timeframes.find((x) => x.id === obj.timeframeId);
  const flagged = obj.krs.filter(krQualityFlag).length;
  return (
    <article className={`ocard l-${obj.level}${obj.closed ? " closed" : ""}`} data-obj={obj.id}>
      <button className="ocard-hit" onClick={() => openObjective(obj.id)} aria-label={`${t("open")}: ${obj.title}`} />
      <div className="ocard-top">
        <LevelBadge level={obj.level} small />
        <span className="owner">{ownerName(data, obj.level, obj.ownerId, t)}</span>
        {tf && <span className={`tf${tf.kind === "year" ? " year" : ""}`}>{tfLabel(tf, lang)}</span>}
      </div>
      <h3>{obj.title}</h3>
      <div className="ocard-prog"><Bar value={prog} level={obj.level} /><Pct value={prog} /></div>
      <div className="ocard-meta">
        <StatusPill status={status} needs={needs} />
        <span className="muted">{t("krCount", { done: obj.krs.filter((k) => krProgress(k) >= 1).length, n: obj.krs.length })}</span>
        {flagged > 0 && <span className="qflag" title={t("q_title")}>✎ {t("flagVague")}</span>}
      </div>
      {!compact && (
        <div className="ocard-align">
          {parent?.objective ? (
            <span><span className="muted">{t("alignedTo")}</span> <span className={`dot d-${parent.objective.level}`} aria-hidden="true" />{parent.kr ? parent.kr.title : parent.objective.title}</span>
          ) : obj.level !== "company" ? <span className="warn-text">{t("alignNoneLower")}</span> : null}
          <span className="muted lead">{personName(data, obj.leadId)}</span>
        </div>
      )}
    </article>
  );
}

export function QualityHint({ kr, endLabel }) {
  const { t } = useApp();
  const issues = krQuality(kr);
  if (!kr.title?.trim()) return null;
  if (!issues.length) return <div className="qhint good" role="status"><b>{t("q_title")}</b> {t("q_good")}</div>;
  const warn = issues.some((i) => i.severity === "warn");
  const down = kr.type === "metric" && Number(kr.target) < Number(kr.start);
  const unit = kr.unit ? (/^[%a-zA-Z]/.test(kr.unit) && kr.unit !== "%" ? ` ${kr.unit}` : kr.unit) : "";
  const suggestion = t("q_suggest", {
    verb: down ? t("q_verbDown") : t("q_verbUp"), metric: t("q_metric"),
    start: kr.type === "metric" && kr.start !== "" ? kr.start : "X", target: kr.type === "metric" && kr.target !== "" ? kr.target : "Y", unit, end: endLabel || "",
  });
  return (
    <div className={`qhint ${warn ? "warn" : "info"}`} role="status" data-quality={warn ? "warn" : "info"}>
      <b>{t("q_title")}</b>
      <ul>{issues.map((i) => <li key={i.code}>{t(`q_${i.code}`)}</li>)}</ul>
      {warn && <p className="sugg">{suggestion}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
