import { useState } from "react";
import { useApp } from "./ctx.js";
import { uid, makeQuarter, makeYear, tfLabel } from "./logic.js";

export default function OrgView() {
  const { t, lang, data, update, timeframes } = useApp();
  const owned = (id) => data.objectives.filter((o) => o.ownerId === id).length;
  const guardDelete = (item, fn) => {
    const n = owned(item.id);
    if (n) { alert(t("org_inUse", { name: item.name, n })); return; }
    if (confirm(t("confirmDelete", { name: item.name }))) update(fn);
  };
  const lastQ = [...data.timeframes].filter((x) => x.kind === "quarter").sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  const lastY = [...data.timeframes].filter((x) => x.kind === "year").sort((a, b) => b.year - a.year)[0];

  return (
    <section className="page org">
      <header className="phead"><div className="phead-l"><h1 className="ptitle">{t("org_title")}</h1><p className="muted small">{t("org_hint")}</p></div></header>
      <div className="panel org-company">
        <label className="field"><span>{t("org_name")}</span>
          <input value={data.org.name} onChange={(e) => update((d) => { d.org.name = e.target.value; })} data-org-name />
        </label>
      </div>

      <div className="org-grid">
        <div className="panel l-department">
          <div className="sec-h"><h3 className="h3">{t("org_depts")}</h3></div>
          <ul className="olist">
            {data.departments.map((d) => (
              <li key={d.id}>
                <input value={d.name} aria-label={t("rename")} onChange={(e) => update((x) => { x.departments.find((y) => y.id === d.id).name = e.target.value; })} />
                <span className="muted small">{data.teams.filter((tm) => tm.deptId === d.id).length} · {owned(d.id)} OKR</span>
                <button className="x sm" aria-label={t("delete")} onClick={() => guardDelete(d, (x) => {
                  x.departments = x.departments.filter((y) => y.id !== d.id);
                  x.teams.forEach((tm) => { if (tm.deptId === d.id) tm.deptId = null; });
                  x.people.forEach((p) => { if (p.deptId === d.id) p.deptId = null; });
                })}>×</button>
              </li>
            ))}
          </ul>
          <AddRow placeholder={t("org_namePh")} label={t("org_addDept")} onAdd={(name) => update((x) => { x.departments.push({ id: uid(), name }); })} />
        </div>

        <div className="panel l-team">
          <div className="sec-h"><h3 className="h3">{t("org_teams")}</h3></div>
          <ul className="olist">
            {data.teams.map((tm) => (
              <li key={tm.id}>
                <input value={tm.name} aria-label={t("rename")} onChange={(e) => update((x) => { x.teams.find((y) => y.id === tm.id).name = e.target.value; })} />
                <select value={tm.deptId || ""} aria-label={t("org_department")} onChange={(e) => update((x) => { x.teams.find((y) => y.id === tm.id).deptId = e.target.value || null; })}>
                  <option value="">{t("org_none")}</option>
                  {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button className="x sm" aria-label={t("delete")} onClick={() => guardDelete(tm, (x) => {
                  x.teams = x.teams.filter((y) => y.id !== tm.id);
                  x.people.forEach((p) => { if (p.teamId === tm.id) p.teamId = null; });
                })}>×</button>
              </li>
            ))}
          </ul>
          <AddRow placeholder={t("org_namePh")} label={t("org_addTeam")} onAdd={(name) => update((x) => { x.teams.push({ id: uid(), name, deptId: x.departments[0]?.id || null }); })} />
        </div>

        <div className="panel l-personal">
          <div className="sec-h"><h3 className="h3">{t("org_people")}</h3></div>
          <ul className="olist">
            {data.people.map((p) => (
              <li key={p.id} className="person">
                <input value={p.name} aria-label={t("rename")} onChange={(e) => update((x) => { x.people.find((y) => y.id === p.id).name = e.target.value; })} />
                <input value={p.role || ""} placeholder={t("org_role")} aria-label={t("org_role")} onChange={(e) => update((x) => { x.people.find((y) => y.id === p.id).role = e.target.value; })} />
                <select value={p.teamId || ""} aria-label={t("org_team")} onChange={(e) => update((x) => {
                  const y = x.people.find((z) => z.id === p.id); y.teamId = e.target.value || null;
                  const tm = x.teams.find((z) => z.id === y.teamId); if (tm) y.deptId = tm.deptId;
                })}>
                  <option value="">{t("org_none")}</option>
                  {data.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
                <button className="x sm" aria-label={t("delete")} onClick={() => {
                  const n = owned(p.id) + data.objectives.filter((o) => o.leadId === p.id && o.level !== "personal").length;
                  if (n) { alert(t("org_inUse", { name: p.name, n })); return; }
                  if (confirm(t("confirmDelete", { name: p.name }))) update((x) => { x.people = x.people.filter((y) => y.id !== p.id); });
                }}>×</button>
              </li>
            ))}
          </ul>
          <AddRow placeholder={t("org_namePh")} label={t("org_addPerson")} onAdd={(name) => update((x) => { x.people.push({ id: uid(), name, role: "", teamId: null, deptId: null }); })} />
        </div>

        <div className="panel">
          <div className="sec-h"><h3 className="h3">{t("org_timeframes")}</h3></div>
          <ul className="olist tfs">
            {timeframes.map((x) => <li key={x.id}><span className={`tf${x.kind === "year" ? " year" : ""}`}>{tfLabel(x, lang)}</span><span className="muted small">{x.start} → {x.end}</span></li>)}
          </ul>
          <div className="btnrow">
            <button className="btn sm" onClick={() => update((d) => { const n = lastQ.q === 4 ? makeQuarter(lastQ.year + 1, 1) : makeQuarter(lastQ.year, lastQ.q + 1); if (!d.timeframes.some((x) => x.id === n.id)) d.timeframes.push(n); })}>+ {t("org_addQuarter")}</button>
            <button className="btn sm" onClick={() => update((d) => { const n = makeYear((lastY?.year || new Date().getFullYear()) + 1); if (!d.timeframes.some((x) => x.id === n.id)) d.timeframes.push(n); })}>+ {t("org_addYear")}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AddRow({ placeholder, label, onAdd }) {
  const [v, setV] = useState("");
  return (
    <form className="addrow" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={label} />
      <button className="btn sm" type="submit">+ {label}</button>
    </form>
  );
}
