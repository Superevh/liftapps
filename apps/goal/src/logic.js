// Pure OKR logic: levels, progress rollup, statuses, check-in staleness, alignment rules, KR quality.

export const LEVELS = ["company", "department", "team", "personal"];
export const PARENT_LEVEL = { company: null, department: "company", team: "department", personal: "team" };
export const STATUSES = ["on_track", "at_risk", "off_track"];
const STATUS_RANK = { off_track: 3, at_risk: 2, on_track: 1, none: 0 };
export const DAY = 86400000;
export const STALE_DAYS = 7;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
export const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
export const pct = (p) => Math.round(clamp01(p) * 100);

// ---------- Timeframes ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function quarterOf(date) { return Math.floor(date.getMonth() / 3) + 1; }
export function makeQuarter(year, q) {
  const start = new Date(year, (q - 1) * 3, 1), end = new Date(year, q * 3, 0);
  return { id: `${year}-q${q}`, kind: "quarter", year, q, start: iso(start), end: iso(end) };
}
export function makeYear(year) { return { id: `${year}`, kind: "year", year, start: `${year}-01-01`, end: `${year}-12-31` }; }
export function tfLabel(tf, lang) {
  if (!tf) return "";
  if (tf.kind === "year") return lang === "zh" ? `${tf.year} 年度` : `${tf.year} annual`;
  return `Q${tf.q} ${tf.year}`;
}
export function tfContains(outer, inner) { return outer && inner && outer.start <= inner.start && outer.end >= inner.end; }
export function tfOverlaps(a, b) { return a && b && a.start <= b.end && b.start <= a.end; }
export function currentTimeframe(timeframes, now = new Date()) {
  const today = iso(now);
  return timeframes.find((t) => t.kind === "quarter" && t.start <= today && t.end >= today) || timeframes.find((t) => t.kind === "quarter") || timeframes[0];
}
export function sortTimeframes(tfs) {
  return [...tfs].sort((a, b) => (a.start === b.start ? (a.kind === "year" ? -1 : 1) : a.start < b.start ? -1 : 1));
}
// Does an objective belong in the view for the selected timeframe? A quarter view also shows the annual goals that span it.
export function inTimeframe(obj, selId, tfById) {
  if (selId === "all") return true;
  if (obj.timeframeId === selId) return true;
  const sel = tfById[selId], own = tfById[obj.timeframeId];
  return sel?.kind === "quarter" && own?.kind === "year" && tfContains(own, sel);
}

// ---------- Key results ----------
export function krProgress(kr) {
  if (kr.type === "milestone") return kr.done ? 1 : 0;
  const start = Number(kr.start), target = Number(kr.target), cur = Number(kr.current);
  const span = target - start;
  if (!span) return cur === target ? 1 : 0;
  return clamp01((cur - start) / span);
}
export function lastCheckin(kr) { return kr.checkins?.length ? kr.checkins[kr.checkins.length - 1] : null; }
export function krStatus(kr) {
  if (kr.type === "milestone" && kr.done) return "on_track";
  return lastCheckin(kr)?.confidence || "none";
}
export function krLastTouch(kr) { return lastCheckin(kr)?.at || kr.createdAt; }
export function krNeedsCheckin(kr, obj, now = Date.now()) {
  if (obj?.closed) return false;
  if (kr.type === "milestone" && kr.done) return false;
  return now - new Date(krLastTouch(kr)).getTime() > STALE_DAYS * DAY;
}
export function weakest(statuses) {
  let w = "none";
  for (const s of statuses) if (STATUS_RANK[s] > STATUS_RANK[w]) w = s;
  return w;
}

// ---------- Objectives ----------
export function childrenOf(objId, objectives) {
  const obj = objectives.find((o) => o.id === objId);
  const krIds = new Set((obj?.krs || []).map((k) => k.id));
  return objectives.filter((o) => o.parent && ((o.parent.type === "objective" && o.parent.id === objId) || (o.parent.type === "kr" && krIds.has(o.parent.id))));
}

// Rollup: progress driver "krs" (default), "aligned" or "both". Equal weights unless a KR weight is set. Initiatives never count.
export function objectiveProgress(obj, objectives, seen = new Set()) {
  if (seen.has(obj.id)) return 0;
  seen.add(obj.id);
  const mode = obj.driver || "krs";
  const parts = [];
  if (mode !== "aligned") for (const kr of obj.krs || []) parts.push([krProgress(kr), Number(kr.weight ?? 1)]);
  const kids = childrenOf(obj.id, objectives);
  if (mode !== "krs" || (!obj.krs?.length && kids.length)) for (const c of kids) parts.push([objectiveProgress(c, objectives, new Set(seen)), 1]);
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  if (!totalW) return 0;
  return parts.reduce((s, [p, w]) => s + p * w, 0) / totalW;
}
export function objectiveStatus(obj, objectives, seen = new Set()) {
  if (seen.has(obj.id)) return "none";
  seen.add(obj.id);
  const list = (obj.driver === "aligned" ? [] : (obj.krs || []).map(krStatus));
  if (obj.driver && obj.driver !== "krs") for (const c of childrenOf(obj.id, objectives)) list.push(objectiveStatus(c, objectives, new Set(seen)));
  return weakest(list);
}
export function objectiveNeedsCheckin(obj, now = Date.now()) {
  return !obj.closed && (obj.krs || []).some((kr) => krNeedsCheckin(kr, obj, now));
}

// Alignment candidates: objectives exactly one level up, in an overlapping timeframe.
export function alignmentCandidates(level, timeframeId, data, selfId) {
  const parentLevel = PARENT_LEVEL[level];
  if (!parentLevel) return [];
  const tfById = Object.fromEntries(data.timeframes.map((t) => [t.id, t]));
  const tf = tfById[timeframeId];
  return data.objectives.filter((o) => o.id !== selfId && o.level === parentLevel && !o.closed && (!tf || tfOverlaps(tfById[o.timeframeId], tf)));
}
export function findParent(obj, objectives) {
  if (!obj?.parent) return null;
  if (obj.parent.type === "objective") return { objective: objectives.find((o) => o.id === obj.parent.id), kr: null };
  for (const o of objectives) { const kr = (o.krs || []).find((k) => k.id === obj.parent.id); if (kr) return { objective: o, kr }; }
  return null;
}
export function alignmentChain(obj, objectives) {
  const chain = [];
  let cur = obj, guard = 0;
  while (cur && guard++ < 10) { chain.unshift(cur); cur = findParent(cur, objectives)?.objective; }
  return chain;
}

// ---------- Org helpers ----------
export function ownerName(data, level, ownerId, t) {
  if (level === "company") return data.org.name;
  const list = level === "department" ? data.departments : level === "team" ? data.teams : data.people;
  return list.find((x) => x.id === ownerId)?.name || t("unknown");
}
export function personName(data, id) { return data.people.find((p) => p.id === id)?.name || ""; }
// The natural parent unit of an owner: team → its department, person → their team.
export function parentUnitOf(data, level, ownerId) {
  if (level === "team") return data.teams.find((x) => x.id === ownerId)?.deptId;
  if (level === "personal") return data.people.find((x) => x.id === ownerId)?.teamId;
  return null;
}

// ---------- KR quality helper (rule-based) ----------
const ACTIVITY_EN = /^(launch|do|build|create|implement|develop|write|run|hold|start|complete|finish|deliver|ship|organi[sz]e|support|help|work on|set up|setup|roll out|introduce|design|plan|prepare|conduct|attend|hire|migrate|release|publish|redesign|refactor|add)\b/i;
const ACTIVITY_ZH = /^(上线|完成|推出|发布|开发|做|实施|举办|组织|编写|撰写|支持|协助|开展|建立|搭建|启动|设计|规划|准备|召开|参加|招聘|迁移|重构|新增|制定)/;
const VAGUE_EN = /\b(improve|better|enhance|optimi[sz]e|boost|grow|increase|reduce|decrease|more|less|maximi[sz]e|minimi[sz]e|strengthen)\b/i;
const VAGUE_ZH = /(提升|优化|改善|加强|提高|降低|增加|减少|更好|更多)/;
const HAS_NUMBER = /\d/;

// Returns a list of { code, severity: "warn" | "info" } for a draft KR.
export function krQuality(kr) {
  const title = (kr.title || "").trim();
  const issues = [];
  if (!title) return issues;
  const isActivity = ACTIVITY_EN.test(title) || ACTIVITY_ZH.test(title);
  const isVague = VAGUE_EN.test(title) || VAGUE_ZH.test(title);
  const titleHasNumber = HAS_NUMBER.test(title);
  if (isActivity) issues.push({ code: "activity", severity: "warn" });
  if (kr.type === "metric") {
    const s = Number(kr.start), tg = Number(kr.target);
    if (kr.target === "" || kr.target == null || !Number.isFinite(tg)) issues.push({ code: "noTarget", severity: "warn" });
    else if (Number.isFinite(s) && s === tg) issues.push({ code: "sameStartTarget", severity: "warn" });
    if (isVague && !titleHasNumber) issues.push({ code: "vague", severity: "info" });
    if (!kr.unit && !titleHasNumber) issues.push({ code: "noUnit", severity: "info" });
  } else {
    if (!titleHasNumber && !isActivity) issues.push({ code: isVague ? "vague" : "noNumber", severity: "warn" });
    issues.push({ code: "milestone", severity: "info" });
  }
  if (title.length > 120) issues.push({ code: "long", severity: "info" });
  return issues;
}
export function krQualityFlag(kr) { return krQuality(kr).some((i) => i.severity === "warn"); }

export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : String(Math.round(v * 100) / 100);
}
export function daysAgo(isoStr, now = Date.now()) { return Math.floor((now - new Date(isoStr).getTime()) / DAY); }
