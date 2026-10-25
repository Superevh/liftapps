import { useState } from "react";
import { useApp } from "./ctx.js";
import {
  objectiveProgress, objectiveStatus, krProgress, krStatus, krNeedsCheckin, childrenOf, inCycle, ownerName, unitObjectives, avgProgress,
  lastCheckin, fmtNum, pct,
} from "./logic.js";
import { Icon, LevelTag, StatusDot, Bar, Avatar, ago, QualityMark } from "./ui.jsx";

export const CHILD_LEVEL = { company: "department", department: "team", team: "personal", personal: null };
export function unitRoute(level, ownerId) {
  return level === "company" ? "/company" : level === "department" ? `/dept/${ownerId}` : level === "team" ? `/team/${ownerId}` : `/person/${ownerId}`;
}
// Default owner for a contributing objective: the first unit one level below that sits under this objective's owner.
export function childOwnerFor(data, obj) {
  const lvl = CHILD_LEVEL[obj.level];
  if (lvl === "department") return data.departments[0]?.id || "";
  if (lvl === "team") return data.teams.find((x) => x.deptId === obj.ownerId)?.id || data.teams[0]?.id || "";
  if (lvl === "personal") return data.people.find((x) => x.teamId === obj.ownerId)?.id || data.people[0]?.id || "";
  return "";
}

export function ObjectiveRow({ obj, depth = 0, showOwner = false }) {
  const { t, data, tf, tfById, go, openObjective, setModal } = useApp();
  const [open, setOpen] = useState(false);
  const prog = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  const kids = childrenOf(obj.id, data.objectives).filter((c) => inCycle(c, tf, tfById));
  const childLevel = CHILD_LEVEL[obj.level];
  return (
    <div className={`orow-wrap${open ? " open" : ""}${obj.closed ? " closed" : ""}`} data-obj={obj.id} data-level={obj.level}>
      <div className="orow">
        <button className="caret" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t(open ? "collapse" : "expand")} data-expand>
          <Icon name="caret" size={14} />
        </button>
        <StatusDot status={status} />
        <div className="otitle">
          <button className="olink" onClick={() => openObjective(obj.id)} data-open-obj>{obj.title}</button>
          {(showOwner || obj.closed) && (
            <div className="osub">
              {showOwner && <><LevelTag level={obj.level} /><button className="unitlink" onClick={() => go(unitRoute(obj.level, obj.ownerId))}>{ownerName(data, obj.level, obj.ownerId, t)}</button></>}
              {obj.closed && <span className="muted">{t("closedScore", { score: Number(obj.closed.score).toFixed(1) })}</span>}
            </div>
          )}
        </div>
        <span className="okids muted small" title={t("contributing")}>{kids.length > 0 && !open ? t("nContrib", { n: kids.length }) : ""}</span>
        <Avatar id={obj.leadId} />
        <div className={`oprog l-${obj.level}`}><Bar value={prog} level={obj.level} /><span className="pct" data-pct>{pct(prog)}%</span></div>
      </div>
      {open && (
        <div className="odetail">
          <div className="krlist">
            {obj.krs.map((kr) => <KrRow key={kr.id} obj={obj} kr={kr} />)}
            {!obj.krs.length && <p className="empty">{t("noKrs")}</p>}
            {!obj.closed && <button className="addlink" onClick={() => setModal({ kind: "kr", objId: obj.id })} data-add-kr><Icon name="plus" size={13} />{t("addKr")}</button>}
          </div>
          {childLevel && <Contributing obj={obj} kids={kids} depth={depth} />}
        </div>
      )}
    </div>
  );
}

function Contributing({ obj, kids, depth }) {
  const { t, data, setModal } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="contrib" data-contrib>
      <button className="contrib-h" onClick={() => setOpen(!open)} aria-expanded={open} data-contrib-toggle>
        <Icon name="caret" size={12} className="caret-ic" />
        {t("contributing")}<span className="muted">{kids.length}</span>
      </button>
      {open && (
        <div className="contrib-body">
          {kids.map((c) => <ObjectiveRow key={c.id} obj={c} depth={depth + 1} showOwner />)}
          {!kids.length && <p className="empty">{t("noContrib")}</p>}
          {!obj.closed && (
            <button className="addlink" data-add-contrib onClick={() => setModal({ kind: "objective", preset: { level: CHILD_LEVEL[obj.level], ownerId: childOwnerFor(data, obj), parent: `objective:${obj.id}`, timeframeId: obj.timeframeId } })}>
              <Icon name="plus" size={13} />{t("addContrib")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function KrRow({ obj, kr, context }) {
  const { t, openCheckin } = useApp();
  const p = krProgress(kr);
  const st = krStatus(kr);
  const needs = krNeedsCheckin(kr, obj);
  const last = lastCheckin(kr);
  return (
    <div className="krrow" data-kr={kr.id}>
      <StatusDot status={st} />
      <div className="krtitle">
        <span className="krt">{kr.title}<QualityMark kr={kr} /></span>
        {context && <span className="krctx muted small">{context}</span>}
        <span className={`krlast small${needs ? " due" : ""}`}>{needs ? t("checkinDue") : t("lastCheckin", { days: ago(t, last?.at) })}</span>
      </div>
      <span className="krval">{kr.type === "milestone" ? (kr.done ? t("done") : t("notDone")) : <>{fmtNum(kr.current)}<span className="muted"> / {fmtNum(kr.target)}{kr.unit ? ` ${kr.unit}` : ""}</span></>}</span>
      <div className="krprog"><Bar value={p} /><span className="pct">{pct(p)}%</span></div>
      {!obj.closed ? <button className="btn sm" onClick={() => openCheckin(obj.id, kr.id)} data-checkin={kr.id}>{t("checkinBtn")}</button> : <span className="krbtn-ph" />}
    </div>
  );
}

function Breadcrumb({ items }) {
  const { go } = useApp();
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="crumb-sep" aria-hidden="true">/</span>}
          {i < items.length - 1 ? <button onClick={() => go(it.to)}>{it.label}</button> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function crumbsFor(data, level, ownerId, t) {
  const c = [{ label: data.org.name, to: "/company" }];
  if (level === "company") return c;
  let deptId = null, teamId = null;
  if (level === "department") deptId = ownerId;
  if (level === "team") { teamId = ownerId; deptId = data.teams.find((x) => x.id === ownerId)?.deptId; }
  if (level === "personal") { const p = data.people.find((x) => x.id === ownerId); teamId = p?.teamId; deptId = p?.deptId || data.teams.find((x) => x.id === teamId)?.deptId; }
  if (deptId) c.push({ label: ownerName(data, "department", deptId, t), to: `/dept/${deptId}` });
  if (teamId) c.push({ label: ownerName(data, "team", teamId, t), to: `/team/${teamId}` });
  if (level === "personal") c.push({ label: ownerName(data, "personal", ownerId, t), to: `/person/${ownerId}` });
  return c;
}

function SubUnits({ level, ownerId }) {
  const { t, data, go } = useApp();
  let label = "", items = [];
  if (level === "company") { label = t("org_depts"); items = data.departments.map((d) => ({ id: d.id, name: d.name, to: `/dept/${d.id}` })); }
  if (level === "department") { label = t("org_teams"); items = data.teams.filter((x) => x.deptId === ownerId).map((d) => ({ id: d.id, name: d.name, to: `/team/${d.id}` })); }
  if (level === "team") { label = t("org_people"); items = data.people.filter((x) => x.teamId === ownerId).map((d) => ({ id: d.id, name: d.name, to: `/person/${d.id}`, person: true })); }
  if (!items.length) return null;
  return (
    <div className="subunits">
      <span className="muted small">{label}</span>
      {items.map((it) => (
        <button key={it.id} className="subunit" onClick={() => go(it.to)} data-subunit={it.id}>
          {it.person && <Avatar id={it.id} size={20} />}{it.name}
        </button>
      ))}
    </div>
  );
}

export function UnitPage({ level, ownerId, picker }) {
  const { t, data, tf, setModal } = useApp();
  const list = unitObjectives(data, level, ownerId, tf);
  const prog = avgProgress(list.filter((o) => !o.closed), data.objectives);
  const name = ownerName(data, level, ownerId, t);
  const person = level === "personal" ? data.people.find((p) => p.id === ownerId) : null;
  const { tfById } = useApp();
  const leading = person ? data.objectives.filter((o) => o.level !== "personal" && o.leadId === ownerId && inCycle(o, tf, tfById)) : [];
  const isMissing = level !== "company" && name === t("unknown");
  if (isMissing) return <section className="page"><p className="empty">{t("notFound")}</p></section>;
  return (
    <section className="page" data-unit={`${level}:${ownerId}`}>
      <header className="phead">
        <div className="phead-l">
          <Breadcrumb items={crumbsFor(data, level, ownerId, t)} />
          <h1 className="ptitle">{person && <Avatar id={person.id} size={34} />}<span data-unit-title>{name}</span></h1>
          <div className="pmeta"><LevelTag level={level} />{person?.role && <span className="muted">{person.role}</span>}{picker}</div>
        </div>
        <div className="phead-r">
          <div className="psum-n">{prog == null ? "–" : `${pct(prog)}%`}</div>
          <div className="psum-r"><Bar value={prog || 0} level={level} /><span className="muted small">{t(list.length === 1 ? "nObjective1" : "nObjectives", { n: list.length })}</span></div>
        </div>
      </header>
      <SubUnits level={level} ownerId={ownerId} />

      <div className="olist" role="list" data-olist>
        {list.map((o) => <ObjectiveRow key={o.id} obj={o} />)}
        {!list.length && (
          <div className="emptybox">
            <p>{t("emptyUnit")}</p>
          </div>
        )}
        <button className="addlink addobj" onClick={() => setModal({ kind: "objective", preset: { level, ownerId } })} data-add-obj>
          <Icon name="plus" size={13} />{t("addObjectiveHere")}
        </button>
      </div>

      {leading.length > 0 && (
        <>
          <h2 className="sec-title">{t("alsoLeads")}</h2>
          <div className="olist">{leading.map((o) => <ObjectiveRow key={o.id} obj={o} showOwner />)}</div>
        </>
      )}
    </section>
  );
}

export function MyPage() {
  const { t, data, update } = useApp();
  const me = data.people.find((p) => p.id === data.meId) || data.people[0];
  if (!me) return <section className="page"><p className="empty">{t("noPeople")}</p></section>;
  const picker = (
    <label className="mepick"><span className="muted">{t("viewingAs")}</span>
      <select value={me.id} onChange={(e) => update((d) => { d.meId = e.target.value; })} data-me-select aria-label={t("viewingAs")}>
        {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
  return <UnitPage level="personal" ownerId={me.id} picker={picker} />;
}

