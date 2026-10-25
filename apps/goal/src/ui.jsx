import { useEffect, useRef } from "react";
import { useApp } from "./ctx.js";
import { pct, krQuality, daysAgo, initials, personName } from "./logic.js";

// Small inline icons (own drawings, 16px grid, stroke = currentColor).
const P = {
  overview: "M2.5 13.5h11M4 11V7m4 4V4m4 7V8.5",
  me: "M8 8a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 8 8Zm-4.8 5.5c.6-2.3 2.5-3.6 4.8-3.6s4.2 1.3 4.8 3.6",
  tree: "M8 2.5v3M4 9V7.5h8V9M8 5.5v2M2.5 9h3v3.5h-3zM10.5 9h3v3.5h-3zM6.5 2h3v3h-3z",
  company: "M3 13.5V4l5-1.8L13 4v9.5M2 13.5h12M6 6.5h1M9 6.5h1M6 9h1M9 9h1",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5-2c0-.4 0-.8-.1-1.1l1.3-1-1.2-2-1.5.5a5 5 0 0 0-1.9-1.1L9.3 1.8H6.7L6.4 3.3a5 5 0 0 0-1.9 1.1L3 3.9l-1.2 2 1.3 1A5 5 0 0 0 3 8c0 .4 0 .8.1 1.1l-1.3 1 1.2 2 1.5-.5c.5.5 1.2.9 1.9 1.1l.3 1.5h2.6l.3-1.5c.7-.2 1.4-.6 1.9-1.1l1.5.5 1.2-2-1.3-1c.1-.3.1-.7.1-1.1Z",
  data: "M3 4c0-1 2.2-1.7 5-1.7S13 3 13 4s-2.2 1.7-5 1.7S3 5 3 4Zm0 0v8c0 1 2.2 1.7 5 1.7s5-.7 5-1.7V4M3 8c0 1 2.2 1.7 5 1.7S13 9 13 8",
  caret: "M6 4l4 4-4 4",
  plus: "M8 3.5v9M3.5 8h9",
  close: "M4 4l8 8M12 4l-8 8",
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  pen: "M10.5 3l2.5 2.5L6 12.5H3.5V10L10.5 3Z",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5",
  hint: "M8 1.8a4.2 4.2 0 0 0-2.4 7.7V11h4.8V9.5A4.2 4.2 0 0 0 8 1.8ZM6 13.3h4",
  minus: "M3.5 8h9",
  fit: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  check: "M3 8.5l3 3 7-7",
  link: "M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1",
};
export function Icon({ name, size = 16, className = "" }) {
  return (
    <svg className={`ic ${className}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

// Level: a quiet text label with one accent dot.
export function LevelTag({ level }) {
  const { t } = useApp();
  return <span className={`ltag l-${level}`}><i aria-hidden="true" />{t(`level_${level}`)}</span>;
}

export function StatusDot({ status }) {
  const { t } = useApp();
  return <span className={`sdot s-${status}`} title={t(`status_${status}`)} role="img" aria-label={t(`status_${status}`)} />;
}

export function Bar({ value, level }) {
  return (
    <span className={`bar l-${level || "x"}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(value)}>
      <span style={{ width: `${pct(value)}%` }} />
    </span>
  );
}

const TONES = ["#E9D6B8", "#D9E4D6", "#F0D3C1", "#E6DCCB", "#DCD3C6"];
export function Avatar({ id, size = 26 }) {
  const { data } = useApp();
  const name = personName(data, id);
  if (!name) return null;
  const tone = TONES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];
  return <span className="avatar" title={name} style={{ width: size, height: size, background: tone, fontSize: size * 0.4 }} aria-label={name} role="img">{initials(name)}</span>;
}

export function ago(t, isoStr) {
  if (!isoStr) return t("never");
  const n = daysAgo(isoStr);
  return n <= 0 ? t("today") : n === 1 ? t("dayAgo1") : t("daysAgoN", { n });
}

// Full rule-based hint, shown only inside the key result form.
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

// Subtle marker on a KR row when the wording could be sharper.
export function QualityMark({ kr }) {
  const { t } = useApp();
  const warn = krQuality(kr).find((i) => i.severity === "warn");
  if (!warn) return null;
  return <span className="qmark" title={`${t("q_title")}: ${t(`q_${warn.code}`)}`} aria-label={t("flagVague")} data-quality="warn"><Icon name="hint" size={13} /></span>;
}

// Escape closes only the top-most layer.
const layers = [];
function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const me = {};
    layers.push(me);
    const h = (e) => { if (e.key === "Escape" && layers[layers.length - 1] === me) { e.stopPropagation(); ref.current(); } };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); layers.splice(layers.indexOf(me), 1); };
  }, []);
}

export function Modal({ title, onClose, children, wide }) {
  const { t } = useApp();
  useEscape(onClose);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="iconbtn" onClick={onClose} aria-label={t("close")}><Icon name="close" /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Right-hand side panel for objective details and check-ins.
export function Sheet({ label, onClose, children, head, attrs = {} }) {
  const { t } = useApp();
  useEscape(onClose);
  return (
    <div className="scrim sheet-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={label} {...attrs}>
        <div className="sheet-head">{head}<span className="grow" /><button className="iconbtn" onClick={onClose} aria-label={t("close")}><Icon name="close" /></button></div>
        <div className="sheet-body">{children}</div>
      </aside>
    </div>
  );
}
