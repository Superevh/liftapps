import { useApp } from "./ctx.js";
import {
  LEVELS, objectiveProgress, objectiveStatus, inTimeframe, krStatus, krNeedsCheckin, krProgress, krQualityFlag, krQuality,
  ownerName, personName, tfLabel, pct, fmtNum, lastCheckin,
} from "./logic.js";
import { LevelBadge, Bar, Pct, ago } from "./ui.jsx";

export default function Dashboard() {
  const { t, lang, data, filters, setFilters, setView, openObjective, setModal, timeframes } = useApp();
  const tfById = Object.fromEntries(data.timeframes.map((x) => [x.id, x]));
  const active = data.objectives.filter((o) => !o.closed && inTimeframe(o, filters.tf, tfById));
  const krRows = active.flatMap((o) => o.krs.map((kr) => ({ o, kr })));
  const risky = krRows.filter(({ kr }) => ["off_track", "at_risk"].includes(krStatus(kr)))
    .sort((a, b) => (krStatus(a.kr) === "off_track" ? -1 : 1) - (krStatus(b.kr) === "off_track" ? -1 : 1));
  const needs = krRows.filter(({ o, kr }) => krNeedsCheckin(kr, o));
  const flagged = krRows.filter(({ kr }) => krQualityFlag(kr));
  const recent = data.objectives.flatMap((o) => o.krs.flatMap((kr) => (kr.checkins || []).map((c) => ({ o, kr, c }))))
    .sort((a, b) => (a.c.at < b.c.at ? 1 : -1)).slice(0, 8);

  const goLevel = (level) => { setFilters((f) => ({ ...f, level, owner: "all", status: "all", q: "" })); setView("levels"); };

  return (
    <section className="dash">
      <div className="dash-top">
        <label className="tfpick"><span>{t("timeframe")}</span>
          <select value={filters.tf} onChange={(e) => setFilters((f) => ({ ...f, tf: e.target.value }))} data-filter="tf">
            <option value="all">{t("allTimeframes")}</option>
            {timeframes.map((x) => <option key={x.id} value={x.id}>{tfLabel(x, lang)}</option>)}
          </select>
        </label>
      </div>
      <h2 className="h2">{t("dash_levels")}</h2>
      <div className="levelcards">
        {LEVELS.map((level, i) => {
          const objs = active.filter((o) => o.level === level);
          const avg = objs.length ? objs.reduce((s, o) => s + objectiveProgress(o, data.objectives), 0) / objs.length : 0;
          const counts = { on_track: 0, at_risk: 0, off_track: 0, none: 0 };
          objs.forEach((o) => { counts[objectiveStatus(o, data.objectives)]++; });
          return (
            <button key={level} className={`lcard l-${level}`} onClick={() => goLevel(level)} data-level-card={level}>
              <span className="lcard-top"><LevelBadge level={level} /><span className="muted">{t("count", { n: objs.length })}</span></span>
              <span className="lcard-num">{pct(avg)}<small>%</small></span>
              <Bar value={avg} level={level} />
              <span className="lcard-stats">
                {["on_track", "at_risk", "off_track", "none"].map((s) => counts[s] > 0 && <span key={s} className={`st st-${s}`}><b />{counts[s]} {t(`status_${s}`)}</span>)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dash-grid">
        <Panel title={t("dash_risk")} count={risky.length} empty={t("dash_noRisk")}>
          {risky.slice(0, 8).map(({ o, kr }) => (
            <KrRow key={kr.id} o={o} kr={kr} onOpen={() => openObjective(o.id)}
              right={<span className={`st st-${krStatus(kr)}`}><b />{t(`status_${krStatus(kr)}`)}</span>} />
          ))}
        </Panel>
        <Panel title={t("dash_needs")} count={needs.length} empty={t("dash_noNeeds")}>
          {needs.slice(0, 8).map(({ o, kr }) => (
            <KrRow key={kr.id} o={o} kr={kr} onOpen={() => openObjective(o.id)}
              sub={`${t("lastCheckin", { days: ago(t, lastCheckin(kr)?.at) })} · ${personName(data, kr.leadId || o.leadId)}`}
              right={<button className="btn sm" onClick={() => setModal({ kind: "checkin", objId: o.id, krId: kr.id })}>{t("checkinBtn")}</button>} />
          ))}
        </Panel>
        <Panel title={t("dash_recent")} count={null} empty={t("dash_noRecent")}>
          {recent.map(({ o, kr, c }) => (
            <div key={c.id} className="feed" onClick={() => openObjective(o.id)}>
              <span className={`sdot s-${c.confidence}`} aria-hidden="true" />
              <div>
                <div className="feed-t"><b>{personName(data, c.by)}</b> · {kr.title}</div>
                <div className="muted small">{kr.type === "milestone" ? (c.done ? t("done") : t("notDone")) : `${fmtNum(c.value)}${kr.unit ? ` ${kr.unit}` : ""}`} · {t(`status_${c.confidence}`)} · {ago(t, c.at)}{c.comment ? ` · “${c.comment}”` : ""}</div>
              </div>
            </div>
          ))}
        </Panel>
        <Panel title={t("dash_quality")} count={flagged.length} empty={t("dash_noQuality")}>
          {flagged.slice(0, 6).map(({ o, kr }) => (
            <KrRow key={kr.id} o={o} kr={kr} onOpen={() => openObjective(o.id)} sub={t(`q_${krQuality(kr).find((i) => i.severity === "warn").code}`)} />
          ))}
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, count, empty, children }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="panel">
      <h3 className="h3">{title}{count != null && <span className="count">{count}</span>}</h3>
      {has ? <div className="panel-list">{children}</div> : <p className="empty">{empty}</p>}
    </div>
  );
}

function KrRow({ o, kr, right, sub, onOpen }) {
  const { t, data } = useApp();
  return (
    <div className={`krrow l-${o.level}`}>
      <button className="krrow-main" onClick={onOpen}>
        <span className="krrow-top"><LevelBadge level={o.level} small /><span className="owner">{ownerName(data, o.level, o.ownerId, t)}</span></span>
        <span className="krrow-t">{kr.title}</span>
        <span className="muted small">{sub || o.title}</span>
      </button>
      <span className="krrow-r"><span className="pct">{pct(krProgress(kr))}%</span>{right}</span>
    </div>
  );
}
