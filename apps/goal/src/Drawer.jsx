import { useState } from "react";
import { useApp } from "./ctx.js";
import {
  objectiveProgress, objectiveStatus, krProgress, krStatus, krNeedsCheckin, krQuality, krQualityFlag, ownerName, personName,
  tfLabel, alignmentChain, findParent, childrenOf, fmtNum, lastCheckin,
} from "./logic.js";
import { LevelBadge, StatusPill, Bar, Pct, ago } from "./ui.jsx";

export default function Drawer({ obj, onClose }) {
  const { t, lang, data, update, setModal, openObjective } = useApp();
  const prog = objectiveProgress(obj, data.objectives);
  const status = obj.closed ? "closed" : objectiveStatus(obj, data.objectives);
  const tf = data.timeframes.find((x) => x.id === obj.timeframeId);
  const chain = alignmentChain(obj, data.objectives);
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

  return (
    <div className="scrim drawer-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className={`drawer l-${obj.level}`} role="dialog" aria-modal="true" aria-label={obj.title} data-drawer={obj.id}>
        <div className="drawer-rail" aria-hidden="true" />
        <div className="drawer-head">
          <div className="drawer-meta">
            <LevelBadge level={obj.level} />
            <span className="owner">{ownerName(data, obj.level, obj.ownerId, t)}</span>
            {tf && <span className={`tf${tf.kind === "year" ? " year" : ""}`}>{tfLabel(tf, lang)}</span>}
          </div>
          <button className="x" onClick={onClose} aria-label={t("close")}>×</button>
        </div>
        <div className="drawer-body">
          <h2 className="drawer-title">{obj.title}</h2>
          {obj.description && <p className="desc">{obj.description}</p>}
          <p className="muted small">{t("lead")}: {personName(data, obj.leadId)}</p>

          <div className="chain" aria-label={t("chain")}>
            <span className="chain-label">{t("chain")}</span>
            <ol>
              {chain.map((c, i) => (
                <li key={c.id} className={`l-${c.level}${c.id === obj.id ? " me" : ""}`}>
                  <button onClick={() => c.id !== obj.id && openObjective(c.id)} disabled={c.id === obj.id}>
                    <span className={`dot d-${c.level}`} aria-hidden="true" /><span className="chain-lvl">{t(`level_${c.level}`)}</span>
                    <span className="chain-t">{c.title}</span>
                  </button>
                  {i < chain.length - 1 && chain[i + 1] && findParent(chain[i + 1], data.objectives)?.kr && (
                    <span className="chain-kr">↳ {t("alignedVia")}: {findParent(chain[i + 1], data.objectives).kr.title}</span>
                  )}
                </li>
              ))}
            </ol>
            {!parent && obj.level !== "company" && <p className="warn-text small">{t("alignNoneLower")}</p>}
          </div>

          <div className="bigprog">
            <div className="bigprog-n"><Pct value={prog} /></div>
            <div className="bigprog-r">
              <Bar value={prog} level={obj.level} />
              <div className="bigprog-row">
                <StatusPill status={status} needs={!obj.closed && obj.krs.some((k) => krNeedsCheckin(k, obj))} />
                <label className="driver"><span>{t("driver")}</span>
                  <select value={obj.driver || "krs"} onChange={(e) => mut((o) => { o.driver = e.target.value; })} data-driver>
                    {["krs", "aligned", "both"].map((m) => <option key={m} value={m}>{t(`driver_${m}`)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
          {obj.closed && <p className="closednote">{t("closedOn", { date: new Date(obj.closed.at).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-AU"), score: Number(obj.closed.score).toFixed(1) })}{obj.closed.note ? ` · ${obj.closed.note}` : ""}</p>}

          <div className="sec-h">
            <h3 className="h3">{t("keyResults")} <span className="count">{obj.krs.length}</span></h3>
            {!obj.closed && <button className="btn sm" onClick={() => setModal({ kind: "kr", objId: obj.id })} data-add-kr>+ {t("addKr")}</button>}
          </div>
          <div className="krs">
            {obj.krs.map((kr) => <KrItem key={kr.id} obj={obj} kr={kr} />)}
          </div>

          <div className="sec-h">
            <h3 className="h3">{t("initiatives")} <span className="count">{obj.initiatives.length}</span></h3>
            {!obj.closed && <button className="btn sm ghost" onClick={() => setModal({ kind: "initiative", objId: obj.id })}>+ {t("addInitiative")}</button>}
          </div>
          <ul className="inits">
            {obj.initiatives.map((it) => (
              <li key={it.id}>
                <label className="chk">
                  <input type="checkbox" checked={it.done} onChange={() => mut((o) => { const x = o.initiatives.find((y) => y.id === it.id); x.done = !x.done; })} />
                  <span className={it.done ? "strike" : ""}>{it.title}</span>
                </label>
                {it.krId && <span className="muted small">↳ {obj.krs.find((k) => k.id === it.krId)?.title}</span>}
                <button className="x sm" aria-label={t("delete")} onClick={() => mut((o) => { o.initiatives = o.initiatives.filter((y) => y.id !== it.id); })}>×</button>
              </li>
            ))}
          </ul>

          <h3 className="h3">{t("alignedChildren")} <span className="count">{kids.length}</span></h3>
          {kids.length === 0 ? <p className="empty">{t("noAligned")}</p> : (
            <ul className="kids">
              {kids.map((c) => (
                <li key={c.id} className={`l-${c.level}`}>
                  <button onClick={() => openObjective(c.id)}>
                    <LevelBadge level={c.level} small /><span className="owner">{ownerName(data, c.level, c.ownerId, t)}</span>
                    <span className="kid-t">{c.title}</span>
                    <span className="kid-p"><Bar value={objectiveProgress(c, data.objectives)} level={c.level} /><Pct value={objectiveProgress(c, data.objectives)} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="drawer-actions">
            <button className="btn" onClick={() => setModal({ kind: "objective", obj })}>{t("edit")}</button>
            {obj.closed
              ? <button className="btn" onClick={() => mut((o) => { o.closed = null; })}>{t("reopen")}</button>
              : <button className="btn" onClick={() => setModal({ kind: "close", objId: obj.id })}>{t("closeObj")}</button>}
            <span className="grow" />
            <button className="btn danger" onClick={del}>{t("delete")}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function KrItem({ obj, kr }) {
  const { t, data, update, setModal } = useApp();
  const [open, setOpen] = useState(false);
  const p = krProgress(kr);
  const st = krStatus(kr);
  const needs = krNeedsCheckin(kr, obj);
  const issues = krQuality(kr).filter((i) => i.severity === "warn");
  const last = lastCheckin(kr);
  const del = () => {
    if (!confirm(t("confirmDelete", { name: kr.title }))) return;
    update((d) => {
      const o = d.objectives.find((x) => x.id === obj.id);
      o.krs = o.krs.filter((k) => k.id !== kr.id);
      for (const x of d.objectives) if (x.parent?.type === "kr" && x.parent.id === kr.id) x.parent = { type: "objective", id: obj.id };
    });
  };
  return (
    <div className={`kr${needs ? " needs" : ""}`} data-kr={kr.id}>
      <div className="kr-top">
        <span className="krtag">{kr.type === "milestone" ? "◇" : "KR"}</span>
        <span className="kr-t">{kr.title}</span>
        {Number(kr.weight ?? 1) !== 1 && <span className="muted small">×{kr.weight}</span>}
      </div>
      <div className="kr-prog">
        <Bar value={p} level={obj.level} status={st} />
        <span className="kr-val">{kr.type === "milestone" ? (kr.done ? t("done") : t("notDone")) : <>{fmtNum(kr.current)} / {fmtNum(kr.target)}{kr.unit ? ` ${kr.unit}` : ""}</>}</span>
        <span className="pct">{Math.round(p * 100)}%</span>
      </div>
      <div className="kr-meta">
        <span className={`st st-${st}`}><b />{t(`status_${st}`)}</span>
        {needs && <span className="st st-needs"><b />{t("needsBadge")}</span>}
        <span className="muted small">{t("lastCheckin", { days: ago(t, last?.at) })}{kr.leadId ? ` · ${personName(data, kr.leadId)}` : ""}</span>
      </div>
      {issues.length > 0 && <p className="qline" data-quality="warn">✎ {t(`q_${issues[0].code}`)}</p>}
      <div className="kr-actions">
        {!obj.closed && <button className="btn sm primary" onClick={() => setModal({ kind: "checkin", objId: obj.id, krId: kr.id })} data-checkin={kr.id}>{t("checkinBtn")}</button>}
        <button className="btn sm ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{t("history")} ({kr.checkins.length})</button>
        {!obj.closed && <button className="btn sm ghost" onClick={() => setModal({ kind: "kr", objId: obj.id, kr })}>{t("edit")}</button>}
        {!obj.closed && <button className="btn sm ghost" onClick={del}>{t("delete")}</button>}
      </div>
      {open && (
        <ol className="timeline">
          {kr.checkins.length === 0 && <li className="empty">{t("noHistory")}</li>}
          {[...kr.checkins].reverse().map((c) => (
            <li key={c.id}>
              <span className={`sdot s-${c.confidence}`} aria-hidden="true" />
              <div>
                <div><b>{kr.type === "milestone" ? (c.done ? t("done") : t("notDone")) : `${fmtNum(c.value)}${kr.unit ? ` ${kr.unit}` : ""}`}</b> · {t(`status_${c.confidence}`)}</div>
                <div className="muted small">{new Date(c.at).toLocaleDateString()} · {personName(data, c.by)}</div>
                {c.comment && <div className="tl-c">{c.comment}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
