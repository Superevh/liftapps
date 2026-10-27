// Workspace persistence (localStorage, one workspace) and the fictional example organisation.
import { makeQuarter, makeYear, quarterOf, uid, DAY } from "./logic.js";

// v2: new information architecture and a fresh, clean example organisation.
const KEY = "goallift-workspace-v2";
export const VERSION = 2;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (isWorkspace(d)) return d; }
  } catch { /* storage blocked or corrupt */ }
  return null;
}
export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}
export function isWorkspace(d) {
  return !!d && typeof d === "object" && d.app === "goallift" && d.org && Array.isArray(d.objectives) && Array.isArray(d.departments)
    && Array.isArray(d.teams) && Array.isArray(d.people) && Array.isArray(d.timeframes);
}

// ---------- Example organisation: a fictional coffee roaster ----------
// people: [name, role, deptIndex, teamIndex]
const NAMES = {
  en: {
    org: "Juniper Roasters",
    depts: ["Customer", "Operations"],
    teams: [["Cafés", 0], ["Online", 0], ["Roastery", 1], ["Supply", 1]],
    people: [["Mia Russo", "Founder & CEO", null, null], ["Leo Grant", "Head of Customer", 0, null], ["Priya Shah", "Head of Operations", 1, null],
      ["Nora Bell", "Café manager", 0, 0], ["Ruby Fox", "Barista trainer", 0, 0], ["Sam Hughes", "Online lead", 0, 1], ["Jack Ward", "Growth marketer", 0, 1],
      ["Theo Clarke", "Head roaster", 1, 2], ["Ana Costa", "Sourcing lead", 1, 3]],
  },
  zh: {
    org: "杜松咖啡烘焙",
    depts: ["客户部", "运营部"],
    teams: [["门店组", 0], ["线上组", 0], ["烘焙组", 1], ["供应组", 1]],
    people: [["罗米娅", "创始人兼 CEO", null, null], ["高乐", "客户部负责人", 0, null], ["沙佩雅", "运营部负责人", 1, null],
      ["白诺", "门店经理", 0, 0], ["傅如", "咖啡师培训师", 0, 0], ["许山", "线上负责人", 0, 1], ["魏杰", "增长营销", 0, 1],
      ["柯西奥", "首席烘焙师", 1, 2], ["柯安娜", "采购负责人", 1, 3]],
  },
};

// [key, level, ownerIndex, leadIndex, annual?, parentRef, title, krs[]]; parentRef "obj:key" or "kr:key.n"
// kr: [title, type, start, target, current, unit, checkins: [daysAgo, value, confidence, comment]]
const OKRS = {
  en: [
    ["c1", "company", 0, 0, true, null, "Become the neighbourhood's favourite coffee", [
      ["Grow monthly customers from 18,000 to 25,000", "metric", 18000, 25000, 21400, "customers", [[30, 20100, "on_track", ""], [4, 21400, "on_track", "Autumn menu brought people back."]]],
      ["Lift NPS from 41 to 60", "metric", 41, 60, 52, "", [[25, 48, "on_track", ""], [6, 52, "on_track", "Survey wave 2 is in."]]],
    ]],
    ["c2", "company", 0, 0, false, null, "Build a profitable online business", [
      ["Raise online share of revenue from 12% to 20%", "metric", 12, 20, 15, "%", [[16, 14, "on_track", ""], [5, 15, "at_risk", "Growth slowed after the launch bump."]]],
      ["Grow active subscriptions from 600 to 1,000", "metric", 600, 1000, 760, "subscriptions", [[12, 720, "on_track", ""], [3, 760, "on_track", ""]]],
    ]],
    ["d1", "department", 0, 1, false, "obj:c1", "Make every visit feel personal", [
      ["Raise repeat-visit rate from 34% to 45%", "metric", 34, 45, 39, "%", [[14, 37, "on_track", ""], [2, 39, "on_track", "Loyalty cards are working."]]],
      ["Cut average wait from 6 to 3 minutes", "metric", 6, 3, 4.5, "min", [[9, 4.5, "at_risk", "Morning rush still slow."]]],
    ]],
    ["d2", "department", 0, 1, false, "kr:c2.1", "Turn one-off buyers into subscribers", [
      ["Raise trial-to-subscription conversion from 8% to 15%", "metric", 8, 15, 10, "%", [[11, 9, "on_track", ""], [4, 10, "at_risk", "Checkout drop-off is the blocker."]]],
      ["Reduce monthly churn from 7% to 4%", "metric", 7, 4, 6.2, "%", [[6, 6.2, "on_track", ""]]],
    ]],
    ["d3", "department", 1, 2, false, "obj:c1", "Roast consistently great coffee", [
      ["Lift average cupping score from 84 to 87", "metric", 84, 87, 85.5, "pts", [[10, 85, "on_track", ""], [3, 85.5, "on_track", ""]]],
      ["Bring batch rejections down from 5% to 2%", "metric", 5, 2, 3.1, "%", [[5, 3.1, "on_track", "New moisture checks help."]]],
    ]],
    ["t1", "team", 0, 3, false, "obj:d1", "Faster, friendlier mornings", [
      ["Cut peak-hour wait from 8 to 4 minutes", "metric", 8, 4, 6, "min", [[8, 6.5, "at_risk", ""], [2, 6, "at_risk", "Second grinder arrives next week."]]],
      ["Raise review rating from 4.4 to 4.7", "metric", 4.4, 4.7, 4.5, "★", [[12, 4.5, "on_track", ""]]],
    ]],
    ["t2", "team", 1, 5, false, "obj:d2", "A subscription checkout people finish", [
      ["Raise checkout completion from 61% to 80%", "metric", 61, 80, 68, "%", [[9, 65, "on_track", ""], [3, 68, "on_track", "Fewer form fields."]]],
      ["Cut first-box delivery from 4 to 2 days", "metric", 4, 2, 3, "days", [[10, 3, "off_track", "Courier change delayed."]]],
    ]],
    ["t3", "team", 2, 7, false, "kr:d3.0", "Dial in every roast profile", [
      ["Document 12 roast profiles with target curves", "metric", 0, 12, 7, "profiles", [[13, 5, "on_track", ""], [4, 7, "on_track", ""]]],
    ]],
    ["t4", "team", 3, 8, false, "obj:d3", "Never run out of our core beans", [
      ["Reduce stock-out days from 9 to 0", "metric", 9, 0, 3, "days", [[7, 3, "on_track", ""]]],
      ["Set up a second green-coffee supplier", "milestone", 0, 1, 0, "", [[15, 0, "at_risk", "Samples still in transit."]]],
    ]],
    ["p1", "personal", 4, 4, false, "obj:t1", "Get every barista confident on the new bar flow", [
      ["Certify 14 baristas on the new bar flow", "metric", 0, 14, 9, "baristas", [[10, 6, "on_track", ""], [3, 9, "on_track", "Two sessions left."]]],
    ]],
    ["p2", "personal", 6, 6, false, "kr:t2.0", "Understand what stops people at checkout", [
      ["Watch 10 customers complete a checkout", "metric", 0, 10, 6, "sessions", [[5, 6, "on_track", "Shipping cost surprise is the top issue."]]],
    ]],
    ["p3", "personal", 7, 7, false, "obj:t3", "Share roasting know-how across the team", [
      ["Grow the number of team members who pass the cupping test from 2 to 6", "metric", 2, 6, 4, "people", [[9, 4, "on_track", ""]]],
    ]],
  ],
  zh: [
    ["c1", "company", 0, 0, true, null, "成为街坊最喜爱的咖啡", [
      ["月顾客数从 18,000 增长到 25,000", "metric", 18000, 25000, 21400, "人", [[30, 20100, "on_track", ""], [4, 21400, "on_track", "秋季菜单带回了老顾客。"]]],
      ["NPS 从 41 提升到 60", "metric", 41, 60, 52, "", [[25, 48, "on_track", ""], [6, 52, "on_track", "第二轮调研已回收。"]]],
    ]],
    ["c2", "company", 0, 0, false, null, "做出盈利的线上业务", [
      ["线上收入占比从 12% 提升到 20%", "metric", 12, 20, 15, "%", [[16, 14, "on_track", ""], [5, 15, "at_risk", "上线热度过后增长放缓。"]]],
      ["有效订阅从 600 增长到 1,000", "metric", 600, 1000, 760, "个", [[12, 720, "on_track", ""], [3, 760, "on_track", ""]]],
    ]],
    ["d1", "department", 0, 1, false, "obj:c1", "让每次光临都有温度", [
      ["回头客比例从 34% 提升到 45%", "metric", 34, 45, 39, "%", [[14, 37, "on_track", ""], [2, 39, "on_track", "会员卡效果不错。"]]],
      ["平均等待时间从 6 分钟降到 3 分钟", "metric", 6, 3, 4.5, "分钟", [[9, 4.5, "at_risk", "早高峰依然偏慢。"]]],
    ]],
    ["d2", "department", 0, 1, false, "kr:c2.1", "把一次性买家变成订阅用户", [
      ["试用转订阅率从 8% 提升到 15%", "metric", 8, 15, 10, "%", [[11, 9, "on_track", ""], [4, 10, "at_risk", "结账流失是主要障碍。"]]],
      ["月流失率从 7% 降到 4%", "metric", 7, 4, 6.2, "%", [[6, 6.2, "on_track", ""]]],
    ]],
    ["d3", "department", 1, 2, false, "obj:c1", "稳定烘出好咖啡", [
      ["平均杯测分从 84 提升到 87", "metric", 84, 87, 85.5, "分", [[10, 85, "on_track", ""], [3, 85.5, "on_track", ""]]],
      ["批次退回率从 5% 降到 2%", "metric", 5, 2, 3.1, "%", [[5, 3.1, "on_track", "新的含水率检测有效。"]]],
    ]],
    ["t1", "team", 0, 3, false, "obj:d1", "更快、更友好的早晨", [
      ["高峰等待从 8 分钟降到 4 分钟", "metric", 8, 4, 6, "分钟", [[8, 6.5, "at_risk", ""], [2, 6, "at_risk", "第二台磨豆机下周到。"]]],
      ["点评评分从 4.4 提升到 4.7", "metric", 4.4, 4.7, 4.5, "星", [[12, 4.5, "on_track", ""]]],
    ]],
    ["t2", "team", 1, 5, false, "obj:d2", "让人愿意走完的订阅结账", [
      ["结账完成率从 61% 提升到 80%", "metric", 61, 80, 68, "%", [[9, 65, "on_track", ""], [3, 68, "on_track", "减少了表单字段。"]]],
      ["首单发货从 4 天缩短到 2 天", "metric", 4, 2, 3, "天", [[10, 3, "off_track", "更换快递导致延误。"]]],
    ]],
    ["t3", "team", 2, 7, false, "kr:d3.0", "调准每一条烘焙曲线", [
      ["记录 12 条带目标曲线的烘焙方案", "metric", 0, 12, 7, "条", [[13, 5, "on_track", ""], [4, 7, "on_track", ""]]],
    ]],
    ["t4", "team", 3, 8, false, "obj:d3", "核心豆种从不断货", [
      ["断货天数从 9 天降到 0 天", "metric", 9, 0, 3, "天", [[7, 3, "on_track", ""]]],
      ["建立第二家生豆供应商", "milestone", 0, 1, 0, "", [[15, 0, "at_risk", "样品还在运输中。"]]],
    ]],
    ["p1", "personal", 4, 4, false, "obj:t1", "让每位咖啡师都熟练新出品流程", [
      ["14 位咖啡师通过新出品流程认证", "metric", 0, 14, 9, "位", [[10, 6, "on_track", ""], [3, 9, "on_track", "还剩两场培训。"]]],
    ]],
    ["p2", "personal", 6, 6, false, "kr:t2.0", "弄清顾客为何在结账时放弃", [
      ["观察 10 位顾客完成结账", "metric", 0, 10, 6, "次", [[5, 6, "on_track", "运费意外是首要问题。"]]],
    ]],
    ["p3", "personal", 7, 7, false, "obj:t3", "在团队中传授烘焙经验", [
      ["通过杯测考核的同事从 2 人增加到 6 人", "metric", 2, 6, 4, "人", [[9, 4, "on_track", ""]]],
    ]],
  ],
};

const INITS = {
  en: { t1: ["Add a second grinder at the bar", "Pre-batch cold brew before 7am"], t2: ["Show shipping cost on the first screen"] },
  zh: { t1: ["吧台增加第二台磨豆机", "早上 7 点前预制冷萃"], t2: ["在第一屏显示运费"] },
};

// An empty organisation for a new workspace: this year and the quarters around today, one person (you).
export function blank(lang = "en", nowDate = new Date()) {
  const zh = lang === "zh";
  const y = nowDate.getFullYear(), q = quarterOf(nowDate);
  const timeframes = [makeYear(y), q === 1 ? makeQuarter(y - 1, 4) : makeQuarter(y, q - 1), makeQuarter(y, q), q === 4 ? makeQuarter(y + 1, 1) : makeQuarter(y, q + 1)];
  const me = { id: uid(), name: zh ? "我" : "Me", role: "", deptId: null, teamId: null };
  return { app: "goallift", version: VERSION, org: { name: zh ? "我的组织" : "My organisation" }, departments: [], teams: [], people: [me], timeframes, objectives: [], meId: me.id, createdAt: nowDate.toISOString() };
}

export function seed(lang = "en", nowDate = new Date()) {
  const L = NAMES[lang] ? lang : "en", N = NAMES[L];
  const now = nowDate.getTime();
  const y = nowDate.getFullYear(), q = quarterOf(nowDate);
  const prevQ = q === 1 ? makeQuarter(y - 1, 4) : makeQuarter(y, q - 1);
  const nextQ = q === 4 ? makeQuarter(y + 1, 1) : makeQuarter(y, q + 1);
  const curQ = makeQuarter(y, q);
  const timeframes = [makeYear(y), prevQ, curQ, nextQ];
  const depts = N.depts.map((name) => ({ id: uid(), name }));
  const teams = N.teams.map(([name, d]) => ({ id: uid(), name, deptId: depts[d].id }));
  const people = N.people.map(([name, role, d, tm]) => ({ id: uid(), name, role, deptId: d == null ? null : depts[d].id, teamId: tm == null ? null : teams[tm].id }));
  const created = new Date(now - 40 * DAY).toISOString();
  const byKey = {};
  const objectives = OKRS[L].map(([key, level, owner, lead, annual, parentRef, title, krs]) => {
    const ownerId = level === "company" ? "company" : level === "department" ? depts[owner].id : level === "team" ? teams[owner].id : people[owner].id;
    const o = {
      id: uid(), title, description: "", level, ownerId, leadId: people[lead].id, timeframeId: annual ? timeframes[0].id : curQ.id,
      parentRef, parent: null, driver: "both", createdAt: created, closed: null,
      krs: krs.map(([t, type, s, tg, cur, unit, cks]) => ({
        id: uid(), title: t, type, start: s, target: tg, current: type === "milestone" ? 0 : cur, unit, done: false, weight: 1, leadId: people[lead].id, createdAt: created,
        checkins: cks.map(([ago, v, conf, comment]) => ({ id: uid(), at: new Date(now - ago * DAY - 3600000).toISOString(), value: v, done: false, confidence: conf, comment, by: people[lead].id })),
      })),
      initiatives: (INITS[L][key] || []).map((t, i) => ({ id: uid(), title: t, done: i === 0 && key === "t2", krId: null })),
    };
    byKey[key] = o;
    return o;
  });
  for (const o of objectives) {
    if (o.parentRef) {
      const [type, ref] = o.parentRef.split(":");
      if (type === "obj") o.parent = { type: "objective", id: byKey[ref].id };
      else { const [k, n] = ref.split("."); o.parent = { type: "kr", id: byKey[k].krs[Number(n)].id }; }
    }
    delete o.parentRef;
  }
  // One closed objective from last quarter, to show scoring.
  objectives.push({
    id: uid(), title: L === "zh" ? "开出第二家门店" : "Open our second café", description: "", level: "company", ownerId: "company", leadId: people[0].id,
    timeframeId: prevQ.id, parent: null, driver: "both", createdAt: new Date(now - 140 * DAY).toISOString(),
    closed: { at: new Date(now - 30 * DAY).toISOString(), score: 0.8, note: L === "zh" ? "按时开业，首月客流略低于预期。" : "Opened on time; first-month traffic a little under plan." },
    krs: [{ id: uid(), title: L === "zh" ? "首月日均杯数从 0 达到 300" : "Reach 300 cups a day in the first month", type: "metric", start: 0, target: 300, current: 250, unit: L === "zh" ? "杯" : "cups", done: false, weight: 1, leadId: people[0].id, createdAt: new Date(now - 140 * DAY).toISOString(),
      checkins: [{ id: uid(), at: new Date(now - 31 * DAY).toISOString(), value: 250, done: false, confidence: "on_track", comment: "", by: people[0].id }] }],
    initiatives: [],
  });
  return { app: "goallift", version: VERSION, org: { name: N.org }, departments: depts, teams, people, timeframes, objectives, meId: people[4].id, createdAt: new Date(now).toISOString() };
}
