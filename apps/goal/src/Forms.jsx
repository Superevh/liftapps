import { useState } from "react";
import { useApp } from "./ctx.js";
import {
  LEVELS, PARENT_LEVEL, uid, alignmentCandidates, ownerName, parentUnitOf, tfLabel, currentTimeframe, objectiveProgress, lastCheckin, krProgress,
} from "./logic.js";
import { Modal, QualityHint, LevelBadge } from "./ui.jsx";

function defaultOwner(data, level) {
  if (level === "company") return "company";
  if (level === "department") return data.departments[0]?.id || "";
  if (level === "team") return data.teams[0]?.id || "";
  return data.people[0]?.id || "";
}

export function ObjectiveForm({ obj, preset, onClose }) {
  const { t, lang, data, update, openObjective, filters, timeframes } = useApp();
  const editing = !!obj;
  const initLevel = obj?.level || preset?.level || "company";
  const selTf = filters.tf !== "all" ? filters.tf : currentTimeframe(data.timeframes)?.id;
  const [f, setF] = useState(() => obj ? {
    title: obj.title, description: obj.description || "", level: obj.level, ownerId: obj.ownerId, leadId: obj.leadId, timeframeId: obj.timeframeId,
    parent: obj.parent ? `${obj.parent.type}:${obj.parent.id}` : "", driver: obj.driver || "krs",
  } : {
    title: "", description: "", level: initLevel, ownerId: defaultOwner(data, initLevel), leadId: data.people[0]?.id || "", timeframeId: selTf || data.timeframes[0]?.id,
    parent: preset?.parent || "", driver: "krs",
  });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setLevel = (level) => setF((s) => {
    const ownerId = defaultOwner(data, level);
    return { ...s, level, ownerId, parent: "", leadId: level === "personal" ? ownerId : s.leadId };
  });
  const setOwner = (ownerId) => setF((s) => ({ ...s, ownerId, leadId: s.level === "personal" ? ownerId : s.leadId }));

  const parentLevel = PARENT_LEVEL[f.level];
  const naturalParent = parentUnitOf(data, f.level, f.ownerId);
  const cands = alignmentCandidates(f.level, f.timeframeId, data, obj?.id)
    .sort((a, b) => (b.ownerId === naturalParent) - (a.ownerId === naturalParent));

  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) { setErr(t("title")); return; }
    if (f.level !== "company" && !f.ownerId) { setErr(t("owner")); return; }
    const [ptype, pid] = f.parent ? f.parent.split(":") : [];
    const parent = ptype ? { type: ptype, id: pid } : null;
    let newId = obj?.id;
    update((d) => {
      if (editing) {
        const o = d.objectives.find((x) => x.id === obj.id);
        Object.assign(o, { title: f.title.trim(), description: f.description.trim(), level: f.level, ownerId: f.ownerId, leadId: f.leadId, timeframeId: f.timeframeId, parent, driver: f.driver });
        // children that no longer sit exactly one level below are detached, keeping levels strict
        for (const c of d.objectives) if (c.parent && PARENT_LEVEL[c.level] !== o.level && (c.parent.id === o.id || o.krs.some((k) => k.id === c.parent.id))) c.parent = null;
      } else {
        newId = uid();
        d.objectives.push({ id: newId, title: f.title.trim(), description: f.description.trim(), level: f.level, ownerId: f.ownerId, leadId: f.leadId,
          timeframeId: f.timeframeId, parent, driver: f.driver, createdAt: new Date().toISOString(), closed: null, krs: [], initiatives: [] });
      }
    });
    onClose();
    if (!editing) openObjective(newId);
  };

  return (
    <Modal title={editing ? t("editObjective") : t("newObjective")} onClose={onClose} wide>
      <form onSubmit={submit} className="form" data-form="objective">
        <fieldset className="levelpick">
          <legend>{t("level")}</legend>
          {LEVELS.map((l) => (
            <label key={l} className={`lp lp-${l}${f.level === l ? " on" : ""}`}>
              <input type="radio" name="level" value={l} checked={f.level === l} onChange={() => setLevel(l)} />
              <LevelBadge level={l} />
              <small>{t(`levelHint_${l}`)}</small>
            </label>
          ))}
        </fieldset>
        <label className="field"><span>{t("title")}</span>
          <input name="title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={t("objTitlePh")} autoFocus required />
        </label>
        <label className="field"><span>{t("description")}</span>
          <textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="row3">
          <label className="field"><span>{t("owner")}</span>
            {f.level === "company" ? <input value={data.org.name} disabled /> : (
              <select name="owner" value={f.ownerId} onChange={(e) => setOwner(e.target.value)}>
                {f.level === "department" && data.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                {f.level === "team" && data.departments.map((dp) => (
                  <optgroup key={dp.id} label={dp.name}>{data.teams.filter((x) => x.deptId === dp.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
                ))}
                {f.level === "team" && data.teams.filter((x) => !data.departments.some((d) => d.id === x.deptId)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                {f.level === "personal" && data.people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
          </label>
          <label className="field"><span>{t("lead")}</span>
            <select name="lead" value={f.leadId} onChange={(e) => set("leadId", e.target.value)} disabled={f.level === "personal"}>
              {data.people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="field"><span>{t("timeframe")}</span>
            <select name="timeframe" value={f.timeframeId} onChange={(e) => setF((s) => ({ ...s, timeframeId: e.target.value, parent: "" }))}>
              {timeframes.map((x) => <option key={x.id} value={x.id}>{tfLabel(x, lang)}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>{t("alignTo")}</span>
          {parentLevel ? (
            <>
              <select name="parent" value={f.parent} onChange={(e) => set("parent", e.target.value)} data-align-select>
                <option value="">{t("alignNoneLower")}</option>
                {cands.map((o) => (
                  <optgroup key={o.id} label={`${ownerName(data, o.level, o.ownerId, t)} · ${tfLabel(data.timeframes.find((x) => x.id === o.timeframeId), lang)}`}>
                    <option value={`objective:${o.id}`}>{o.title}</option>
                    {o.krs.map((k) => <option key={k.id} value={`kr:${k.id}`}>{"  ↳ KR: "}{k.title}</option>)}
                  </optgroup>
                ))}
              </select>
              <small className="hint">{t("alignHint", { level: t(`level_${parentLevel}`) })}</small>
            </>
          ) : <small className="hint">{t("alignCompany")}</small>}
        </label>
        <label className="field"><span>{t("driver")}</span>
          <select value={f.driver} onChange={(e) => set("driver", e.target.value)}>
            {["krs", "aligned", "both"].map((m) => <option key={m} value={m}>{t(`driver_${m}`)}</option>)}
          </select>
        </label>
        {err && <p className="err">{err}</p>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("save")}</button></div>
      </form>
    </Modal>
  );
}

export function KrForm({ objId, kr, onClose }) {
  const { t, lang, data, update } = useApp();
  const obj = data.objectives.find((o) => o.id === objId);
  const tf = data.timeframes.find((x) => x.id === obj?.timeframeId);
  const [f, setF] = useState(() => kr ? { ...kr } : { title: "", type: "metric", start: 0, target: "", current: 0, unit: "", done: false, weight: 1, leadId: obj?.leadId || "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  if (!obj) return null;
  const endLabel = tf ? (tf.kind === "year" ? (lang === "zh" ? `${tf.year} 年底` : `end of ${tf.year}`) : (lang === "zh" ? `${tfLabel(tf, lang)} 末` : `end of ${tfLabel(tf, lang)}`)) : "";
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const clean = { ...f, title: f.title.trim(), start: Number(f.start) || 0, target: f.target === "" ? "" : Number(f.target), current: f.current === "" ? Number(f.start) || 0 : Number(f.current), weight: Math.max(0, Number(f.weight) || 0) };
    if (clean.target === "") clean.target = clean.start;
    update((d) => {
      const o = d.objectives.find((x) => x.id === objId);
      if (kr) Object.assign(o.krs.find((k) => k.id === kr.id), clean);
      else o.krs.push({ ...clean, id: uid(), createdAt: new Date().toISOString(), checkins: [] });
    });
    onClose();
  };
  return (
    <Modal title={kr ? t("editKr") : t("addKr")} onClose={onClose}>
      <form onSubmit={submit} className="form" data-form="kr">
        <p className="muted small">{t("objective")}: {obj.title}</p>
        <label className="field"><span>{t("title")}</span>
          <input name="krtitle" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={t("krTitlePh")} autoFocus required />
        </label>
        <fieldset className="seg">
          <legend>{t("krType")}</legend>
          {["metric", "milestone"].map((ty) => (
            <label key={ty} className={f.type === ty ? "on" : ""}><input type="radio" name="krtype" value={ty} checked={f.type === ty} onChange={() => set("type", ty)} />{t(ty === "metric" ? "krMetric" : "krMilestone")}</label>
          ))}
        </fieldset>
        {f.type === "metric" ? (
          <div className="row4">
            <label className="field"><span>{t("start")}</span><input name="start" type="number" step="any" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
            <label className="field"><span>{t("target")}</span><input name="target" type="number" step="any" value={f.target} onChange={(e) => set("target", e.target.value)} /></label>
            <label className="field"><span>{t("current")}</span><input name="current" type="number" step="any" value={f.current} onChange={(e) => set("current", e.target.value)} /></label>
            <label className="field"><span>{t("unit")}</span><input name="unit" value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder={t("unitPh")} /></label>
          </div>
        ) : (
          <label className="chk"><input type="checkbox" checked={!!f.done} onChange={(e) => set("done", e.target.checked)} /> {t("done")}</label>
        )}
        <div className="row3">
          <label className="field"><span>{t("lead")}</span>
            <select value={f.leadId} onChange={(e) => set("leadId", e.target.value)}>{data.people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label className="field"><span>{t("weight")}</span><input type="number" min="0" step="0.5" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></label>
        </div>
        <QualityHint kr={f} endLabel={endLabel} />
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("save")}</button></div>
      </form>
    </Modal>
  );
}

export function CheckinForm({ objId, krId, onClose }) {
  const { t, data, update } = useApp();
  const obj = data.objectives.find((o) => o.id === objId);
  const kr = obj?.krs.find((k) => k.id === krId);
  const last = kr && lastCheckin(kr);
  const [value, setValue] = useState(kr?.current ?? 0);
  const [done, setDone] = useState(!!kr?.done);
  const [confidence, setConfidence] = useState(last?.confidence || "on_track");
  const [comment, setComment] = useState("");
  if (!kr) return null;
  const preview = krProgress({ ...kr, current: Number(value), done });
  const submit = (e) => {
    e.preventDefault();
    update((d) => {
      const k = d.objectives.find((x) => x.id === objId).krs.find((x) => x.id === krId);
      if (k.type === "milestone") k.done = done; else k.current = Number(value);
      k.checkins.push({ id: uid(), at: new Date().toISOString(), value: k.type === "milestone" ? (done ? 1 : 0) : Number(value), done, confidence, comment: comment.trim(), by: k.leadId || obj.leadId });
    });
    onClose();
  };
  return (
    <Modal title={`${t("checkinTitle")}: ${kr.title}`} onClose={onClose}>
      <form onSubmit={submit} className="form" data-form="checkin">
        {kr.type === "metric" ? (
          <label className="field"><span>{t("newValue")} ({t("start")} {kr.start} → {t("target")} {kr.target}{kr.unit ? ` ${kr.unit}` : ""})</span>
            <input name="value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </label>
        ) : (
          <label className="chk"><input name="done" type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> {t("done")}</label>
        )}
        <p className="muted small">{t("progress")}: {Math.round(preview * 100)}%</p>
        <fieldset className="conf">
          <legend>{t("confidence")}</legend>
          {["on_track", "at_risk", "off_track"].map((c) => (
            <label key={c} className={`cf cf-${c}${confidence === c ? " on" : ""}`}><input type="radio" name="confidence" value={c} checked={confidence === c} onChange={() => setConfidence(c)} /><b aria-hidden="true" />{t(`status_${c}`)}</label>
          ))}
        </fieldset>
        <label className="field"><span>{t("comment")}</span><textarea name="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("commentPh")} /></label>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("save")}</button></div>
      </form>
    </Modal>
  );
}

export function CloseForm({ objId, onClose }) {
  const { t, data, update } = useApp();
  const obj = data.objectives.find((o) => o.id === objId);
  const [score, setScore] = useState(() => Math.round(objectiveProgress(obj, data.objectives) * 10) / 10);
  const [note, setNote] = useState("");
  const submit = (e) => {
    e.preventDefault();
    update((d) => { d.objectives.find((x) => x.id === objId).closed = { at: new Date().toISOString(), score: Math.min(1, Math.max(0, Number(score) || 0)), note: note.trim() }; });
    onClose();
  };
  return (
    <Modal title={`${t("closeObj")}: ${obj.title}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="field"><span>{t("score")}</span><input type="number" min="0" max="1" step="0.1" value={score} onChange={(e) => setScore(e.target.value)} /><small className="hint">{t("scoreHint")}</small></label>
        <label className="field"><span>{t("reflection")}</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("reflectionPh")} /></label>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("save")}</button></div>
      </form>
    </Modal>
  );
}

export function InitiativeForm({ objId, onClose }) {
  const { t, data, update } = useApp();
  const obj = data.objectives.find((o) => o.id === objId);
  const [title, setTitle] = useState("");
  const [krId, setKrId] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    update((d) => { d.objectives.find((x) => x.id === objId).initiatives.push({ id: uid(), title: title.trim(), done: false, krId: krId || null }); });
    onClose();
  };
  return (
    <Modal title={t("addInitiative")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="field"><span>{t("title")}</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("initiativePh")} autoFocus required /></label>
        <label className="field"><span>{t("kr_initiativeOf")}</span>
          <select value={krId} onChange={(e) => setKrId(e.target.value)}><option value="">–</option>{obj.krs.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select>
        </label>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("save")}</button></div>
      </form>
    </Modal>
  );
}
