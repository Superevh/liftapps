import { useState } from "react";
import { useApp } from "./ctx.js";
import {
  objectiveProgress, objectiveStatus, krProgress, krStatus, ownerName, personName, tfLabel, findParent, childrenOf, fmtNum, lastCheckin, pct, uid,
} from "./logic.js";
import { Icon, LevelTag, StatusDot, Bar, Avatar, Sheet, ago } from "./ui.jsx";
import { KrRow, unitRoute, CHILD_LEVEL, childOwnerFor } from "./OkrList.jsx";

export function ObjectivePanel({ obj, onClose }) {
  const { t, lang, data, update, setModal, openObjective, go } = useApp();
  const prog = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  const tf = data.timeframes.find((x) => x.id === obj.timeframeId);
  const parent = findParent(obj, data.objectives);
  const kids = childrenOf(obj.id, data.objectives);
  const mut = (fn) => update((d) => { const o = d.objectives.find((x) => x.id === obj.id); if (o) fn(o, d); });
  const del = () => {
    if (!confirm(t("confirmDelete", { name: obj.title }))) return;
    update((d) => {
      const krIds = new Set(obj.krs.map((k) => k.id));
      d.objectives = d.objectives.filter((x) => x.id !== obj.id);
      for (const o of d.objectives) if (o.parent && (o.parent.id === obj.id || krIds.has(o.parent.id))) o.parent = null;
    });
    onClose();
  };
  const delKr = (kr) => {
    if (!confirm(t("confirmDelete", { name: kr.title }))) return;
    update((d) => {
      const o = d.objectives.find((x) => x.id === obj.id);
      o.krs = o.krs.filter((k) => k.id !== kr.id);
      for (const x of d.objectives) if (x.parent?.type === "kr" && x.parent.id === kr.id) x.parent = { type: "objective", id: obj.id };
    });
  };
  const unitName = ownerName(data, obj.level, obj.ownerId, t);
  return (
    <Sheet label={obj.title} onClose={onClose} attrs={{ "data-panel": obj.id }}
      head={<><LevelTag level={obj.level} /><button className="unitlink" onClick={() => { onClose(); go(unitRoute(obj.level, obj.ownerId)); }}>{unitName}</button></>}>
      <h2 className="sheet-title">{obj.title}</h2>
      {obj.description && <p className="desc">{obj.description}</p>}

      <div className="bigprog">
        <span className="bigprog-n">{pct(prog)}%</span>
        <div className="bigprog-r">
          <Bar value={prog} level={obj.level} />
          <span className="muted small"><StatusDot status={status} /> {t(`status_${status}`)}</span>
        </div>
      </div>

      <dl className="facts">
        <dt>{t("lead")}</dt><dd><Avatar id={obj.leadId} size={20} /> {personName(data, obj.leadId)}</dd>
        <dt>{t("timeframe")}</dt><dd>{tfLabel(tf, lang)}</dd>
        <dt>{t("alignTo")}</dt>
        <dd>
          {parent?.objective ? (
            <button className="linkish" onClick={() => openObjective(parent.objective.id)} data-parent-link>
              {parent.objective.title}{parent.kr && <span className="muted"> · {parent.kr.title}</span>}
            </button>
          ) : <span className="muted">{obj.level === "company" ? t("topLevel") : t("alignNoneLower")}</span>}
        </dd>
        <dt>{t("driver")}</dt><dd>{t(`driver_${obj.driver || "krs"}`)}</dd>
      </dl>
      {obj.closed && <p className="closednote">{t("closedOn", { date: new Date(obj.closed.at).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-AU"), score: Number(obj.closed.score).toFixed(1) })}{obj.closed.note ? ` · ${obj.closed.note}` : ""}</p>}

      <div className="sec-h"><h3>{t("keyResults")}</h3>{!obj.closed && <button className="btn sm ghost" onClick={() => setModal({ kind: "kr", objId: obj.id })}><Icon name="plus" size={13} />{t("addKr")}</button>}</div>
      <div className="krlist inpanel">
        {obj.krs.map((kr) => (
          <div key={kr.id} className="krwrap">
            <KrRow obj={obj} kr={kr} />
            {!obj.closed && (
              <div className="kr-tools">
                <button className="iconbtn sm" onClick={() => setModal({ kind: "kr", objId: obj.id, kr })} aria-label={`${t("edit")}: ${kr.title}`} title={t("edit")}><Icon name="pen" size={13} /></button>
                <button className="iconbtn sm" onClick={() => delKr(kr)} aria-label={`${t("delete")}: ${kr.title}`} title={t("delete")}><Icon name="trash" size={13} /></button>
              </div>
            )}
          </div>
        ))}
        {!obj.krs.length && <p className="empty">{t("noKrs")}</p>}
      </div>

      {CHILD_LEVEL[obj.level] && (
        <>
          <div className="sec-h"><h3>{t("contributing")}</h3>
            {!obj.closed && <button className="btn sm ghost" onClick={() => setModal({ kind: "objective", preset: { level: CHILD_LEVEL[obj.level], ownerId: childOwnerFor(data, obj), parent: `objective:${obj.id}`, timeframeId: obj.timeframeId } })}><Icon name="plus" size={13} />{t("addContrib")}</button>}
          </div>
          {kids.length === 0 ? <p className="empty">{t("noContrib")}</p> : (
            <ul className="kidlist">
              {kids.map((c) => (
                <li key={c.id}>
                  <button onClick={() => openObjective(c.id)}>
                    <span className="kid-t">{c.title}<span className="muted small">{ownerName(data, c.level, c.ownerId, t)}</span></span>
                    <span className="kid-p"><Bar value={objectiveProgress(c, data.objectives)} level={c.level} /><span className="pct">{pct(objectiveProgress(c, data.objectives))}%</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="sec-h"><h3>{t("initiatives")}</h3>{!obj.closed && <button className="btn sm ghost" onClick={() => setModal({ kind: "initiative", objId: obj.id })}><Icon name="plus" size={13} />{t("add")}</button>}</div>
      {obj.initiatives.length === 0 ? <p className="empty">{t("noInitiatives")}</p> : (
        <ul className="inits">
          {obj.initiatives.map((it) => (
            <li key={it.id}>
              <label className="chk">
                <input type="checkbox" checked={it.done} onChange={() => mut((o) => { const x = o.initiatives.find((y) => y.id === it.id); x.done = !x.done; })} />
                <span className={it.done ? "strike" : ""}>{it.title}</span>
              </label>
              <button className="iconbtn sm" aria-label={t("delete")} onClick={() => mut((o) => { o.initiatives = o.initiatives.filter((y) => y.id !== it.id); })}><Icon name="close" size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="sheet-actions">
        <button className="btn" onClick={() => setModal({ kind: "objective", obj })} data-edit-obj>{t("edit")}</button>
        {obj.closed
          ? <button className="btn" onClick={() => mut((o) => { o.closed = null; })}>{t("reopen")}</button>
          : <button className="btn" onClick={() => setModal({ kind: "close", objId: obj.id })}>{t("closeObj")}</button>}
        <span className="grow" />
        <button className="btn danger" onClick={del}>{t("delete")}</button>
      </div>
    </Sheet>
  );
}

export function CheckinPanel({ objId, krId, onClose }) {
  const { t, lang, data, update } = useApp();
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
  const st = krStatus(kr);
  return (
    <Sheet label={`${t("checkinTitle")}: ${kr.title}`} onClose={onClose} attrs={{ "data-checkin-panel": kr.id }}
      head={<span className="muted small">{t("checkinTitle")} · {obj.title}</span>}>
      <h2 className="sheet-title">{kr.title}</h2>
      <div className="bigprog">
        <span className="bigprog-n">{pct(krProgress(kr))}%</span>
        <div className="bigprog-r"><Bar value={krProgress(kr)} /><span className="muted small"><StatusDot status={st} /> {t(`status_${st}`)} · {t("lastCheckin", { days: ago(t, last?.at) })}</span></div>
      </div>

      <form onSubmit={submit} className="form ciform" data-form="checkin">
        {kr.type === "metric" ? (
          <label className="field"><span>{t("newValue")}</span>
            <div className="valrow">
              <input name="value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              <span className="muted small">{t("startTarget", { start: fmtNum(kr.start), target: fmtNum(kr.target), unit: kr.unit || "" })}</span>
            </div>
          </label>
        ) : (
          <label className="chk"><input name="done" type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> {t("done")}</label>
        )}
        <p className="muted small preview">{t("progressWillBe", { p: Math.round(preview * 100) })}</p>
        <fieldset className="conf">
          <legend>{t("confidence")}</legend>
          {["on_track", "at_risk", "off_track"].map((c) => (
            <label key={c} className={`cf cf-${c}${confidence === c ? " on" : ""}`}><input type="radio" name="confidence" value={c} checked={confidence === c} onChange={() => setConfidence(c)} /><b aria-hidden="true" />{t(`status_${c}`)}</label>
          ))}
        </fieldset>
        <label className="field"><span>{t("comment")}</span><textarea name="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("commentPh")} /></label>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button><button className="btn primary" type="submit">{t("saveCheckin")}</button></div>
      </form>

      <h3 className="hist-h">{t("history")}</h3>
      <ol className="timeline">
        {kr.checkins.length === 0 && <li className="empty">{t("noHistory")}</li>}
        {[...kr.checkins].reverse().map((c) => (
          <li key={c.id}>
            <StatusDot status={c.confidence} />
            <div>
              <div><b>{kr.type === "milestone" ? (c.done ? t("done") : t("notDone")) : `${fmtNum(c.value)}${kr.unit ? ` ${kr.unit}` : ""}`}</b> <span className="muted small">· {new Date(c.at).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-AU")} · {personName(data, c.by)}</span></div>
              {c.comment && <div className="tl-c">{c.comment}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
