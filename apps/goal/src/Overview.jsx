import { useApp } from "./ctx.js";
import { LEVELS, inCycle, avgProgress, krStatus, krNeedsCheckin, krProgress, ownerName, pct, unitObjectives, tfLabel } from "./logic.js";
import { LevelTag, Bar, StatusDot, Avatar } from "./ui.jsx";
import { unitRoute } from "./OkrList.jsx";

const MAX = 6;

export default function Overview() {
  const { t, lang, data, tf, tfById, go, openCheckin, openObjective } = useApp();
  const open = data.objectives.filter((o) => !o.closed && inCycle(o, tf, tfById));
  const overall = avgProgress(open, data.objectives);
  const byLevel = LEVELS.map((l) => { const list = open.filter((o) => o.level === l); return { l, n: list.length, p: avgProgress(list, data.objectives) }; });
  const krs = open.flatMap((o) => o.krs.map((kr) => ({ o, kr })));
  const risky = krs.filter(({ kr }) => ["at_risk", "off_track"].includes(krStatus(kr)))
    .sort((a, b) => (krStatus(b.kr) === "off_track") - (krStatus(a.kr) === "off_track"));
  const due = krs.filter(({ o, kr }) => krNeedsCheckin(kr, o));
  const depts = data.departments.map((d) => { const list = unitObjectives(data, "department", d.id, tf).filter((o) => !o.closed); return { d, n: list.length, p: avgProgress(list, data.objectives) }; });

  return (
    <section className="page overview" data-overview>
      <header className="phead">
        <div className="phead-l">
          <h1 className="ptitle">{t("nav_overview")}</h1>
          <div className="pmeta"><span className="muted">{data.org.name} · {tfLabel(tfById[tf], lang)}</span></div>
        </div>
        <div className="phead-r">
          <div className="psum-n">{overall == null ? "–" : `${pct(overall)}%`}</div>
          <div className="psum-r"><Bar value={overall || 0} /><span className="muted small">{t("overall")}</span></div>
        </div>
      </header>

      <div className="ov-grid">
        <div className="ov-card">
          <h2 className="ov-h">{t("dash_levels")}</h2>
          <ul className="ov-levels">
            {byLevel.map(({ l, n, p }) => (
              <li key={l}>
                <LevelTag level={l} />
                <Bar value={p || 0} level={l} />
                <span className="pct">{p == null ? "–" : `${pct(p)}%`}</span>
                <span className="muted small ov-n">{t(n === 1 ? "nObjective1" : "nObjectives", { n })}</span>
              </li>
            ))}
          </ul>
          <h2 className="ov-h ov-h2">{t("org_depts")}</h2>
          <ul className="ov-levels">
            {depts.map(({ d, n, p }) => (
              <li key={d.id}>
                <button className="linkish" onClick={() => go(unitRoute("department", d.id))}>{d.name}</button>
                <Bar value={p || 0} level="department" />
                <span className="pct">{p == null ? "–" : `${pct(p)}%`}</span>
                <span className="muted small ov-n">{t(n === 1 ? "nObjective1" : "nObjectives", { n })}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ov-card">
          <h2 className="ov-h">{t("dash_risk")} <span className="muted">{risky.length}</span></h2>
          {risky.length === 0 ? <p className="empty">{t("dash_noRisk")}</p> : (
            <ul className="ov-list">
              {risky.slice(0, MAX).map(({ o, kr }) => (
                <li key={kr.id}>
                  <StatusDot status={krStatus(kr)} />
                  <button className="ov-t" onClick={() => openObjective(o.id)}>
                    <span>{kr.title}</span><span className="muted small">{ownerName(data, o.level, o.ownerId, t)}</span>
                  </button>
                  <span className="pct">{pct(krProgress(kr))}%</span>
                </li>
              ))}
            </ul>
          )}
          {risky.length > MAX && <p className="muted small">{t("andMore", { n: risky.length - MAX })}</p>}
        </div>

        <div className="ov-card">
          <h2 className="ov-h">{t("dash_needs")} <span className="muted">{due.length}</span></h2>
          {due.length === 0 ? <p className="empty">{t("dash_noNeeds")}</p> : (
            <ul className="ov-list">
              {due.slice(0, MAX).map(({ o, kr }) => (
                <li key={kr.id}>
                  <Avatar id={kr.leadId || o.leadId} size={22} />
                  <span className="ov-t"><span>{kr.title}</span><span className="muted small">{ownerName(data, o.level, o.ownerId, t)}</span></span>
                  <button className="btn sm" onClick={() => openCheckin(o.id, kr.id)}>{t("checkinBtn")}</button>
                </li>
              ))}
            </ul>
          )}
          {due.length > MAX && <p className="muted small">{t("andMore", { n: due.length - MAX })}</p>}
        </div>
      </div>
    </section>
  );
}
