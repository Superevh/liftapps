// Workspace persistence (localStorage, one workspace) and the fictional example organisation.
import { makeQuarter, makeYear, quarterOf, uid, DAY } from "./logic.js";

const KEY = "goallift-workspace-v1";
export const VERSION = 1;

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

// ---------- Example organisation ----------
const NAMES = {
  en: {
    org: "Example Co",
    depts: ["Product", "Engineering", "Marketing"],
    teams: [["Discovery", 0], ["Growth", 0], ["Platform", 1], ["Mobile", 1], ["Brand", 2], ["Demand", 2]],
    people: [["Ava Chen", "CEO", null, null], ["Ben Ortiz", "Head of Product", 0, null], ["Chloe Park", "Head of Engineering", 1, null], ["Dan Rossi", "Head of Marketing", 2, null],
      ["Eli Novak", "Product designer", 0, 0], ["Fay Lim", "Growth PM", 0, 1], ["Gus Patel", "Platform engineer", 1, 2], ["Hana Ito", "Mobile engineer", 1, 3], ["Ivy Moreau", "Brand lead", 2, 4], ["Jon Reyes", "Demand marketer", 2, 5]],
  },
  zh: {
    org: "示例公司",
    depts: ["产品部", "工程部", "市场部"],
    teams: [["探索组", 0], ["增长组", 0], ["平台组", 1], ["移动组", 1], ["品牌组", 2], ["获客组", 2]],
    people: [["陈思远", "CEO", null, null], ["王博文", "产品负责人", 0, null], ["李可欣", "工程负责人", 1, null], ["赵丹", "市场负责人", 2, null],
      ["刘逸", "产品设计师", 0, 0], ["林菲", "增长产品经理", 0, 1], ["张国栋", "平台工程师", 1, 2], ["黄小花", "移动端工程师", 1, 3], ["吴艾薇", "品牌负责人", 2, 4], ["孙乔", "增长营销", 2, 5]],
  },
};

// [key, level, ownerIndex, leadIndex, annual?, parentRef, title, krs[]]; parentRef "obj:key" or "kr:key.n"
// kr: [title, type, start, target, current, unit, checkins: [daysAgo, value, confidence, comment]]
const OKRS = {
  en: [
    ["c1", "company", 0, 0, true, null, "Become the go-to OKR tool for small agile teams", [
      ["Grow weekly active teams from 1,200 to 3,000", "metric", 1200, 3000, 2350, "teams", [[40, 1900, "on_track", "Steady after the summer dip."], [12, 2200, "on_track", ""], [3, 2350, "on_track", "Referral loop is kicking in."]]],
      ["Lift NPS from 32 to 45", "metric", 32, 45, 41, "", [[30, 37, "on_track", ""], [5, 41, "on_track", "Survey wave 3 in."]]],
      ["Reach 110% net revenue retention", "metric", 98, 110, 102, "%", [[20, 101, "at_risk", "Two large churns in Q3."], [6, 102, "at_risk", "Expansion pipeline is thin."]]],
    ]],
    ["c2", "company", 0, 0, false, null, "Make onboarding effortless", [
      ["Raise activation rate from 38% to 55%", "metric", 38, 55, 44, "%", [[16, 40, "on_track", ""], [4, 44, "at_risk", "Week-one drop-off is still high."]]],
      ["Cut time to first value from 3 days to 1 day", "metric", 3, 1, 2, "days", [[9, 2, "on_track", "Templates helped."]]],
    ]],
    ["d1", "department", 0, 1, false, "kr:c2.0", "Remove the biggest drop-offs in the first week", [
      ["Increase setup completion from 52% to 75%", "metric", 52, 75, 61, "%", [[14, 56, "on_track", ""], [2, 61, "on_track", "Guided setup A/B test is positive."]]],
      ["Launch guided setup for all new teams", "milestone", 0, 1, 0, "", [[10, 0, "at_risk", "Blocked on design review."]]],
    ]],
    ["d2", "department", 1, 2, false, "obj:c1", "Make the product fast and reliable", [
      ["Bring p95 page load from 2.4s to 1.2s", "metric", 2.4, 1.2, 1.7, "s", [[11, 1.9, "on_track", ""], [3, 1.7, "on_track", "Caching layer shipped."]]],
      ["Keep uptime at or above 99.9%", "metric", 99.5, 99.9, 99.85, "%", [[3, 99.85, "on_track", ""]]],
    ]],
    ["d3", "department", 2, 3, false, "kr:c1.0", "Fill the funnel with the right teams", [
      ["Grow monthly trial sign-ups from 800 to 1,400", "metric", 800, 1400, 1020, "sign-ups", [[18, 930, "at_risk", ""], [9, 1020, "off_track", "Paid search costs spiked."]]],
      ["Reduce acquisition cost from $210 to $160", "metric", 210, 160, 190, "$", [[9, 190, "at_risk", ""]]],
    ]],
    ["t1", "team", 1, 5, false, "obj:d1", "Turn trial teams into active teams", [
      ["Raise trial-to-active conversion from 22% to 35%", "metric", 22, 35, 27, "%", [[8, 25, "on_track", ""], [1, 27, "on_track", "Checklist nudges are working."]]],
      ["Build an in-app checklist", "milestone", 0, 1, 0, "", []],
    ]],
    ["t2", "team", 0, 4, false, "obj:d1", "Understand why teams stall in week one", [
      ["Validate the top 3 drop-off reasons with 20 interviewed teams", "metric", 0, 20, 14, "interviews", [[15, 6, "on_track", ""], [8, 14, "on_track", "Pattern is clear: invite flow."]]],
    ]],
    ["t3", "team", 2, 6, false, "kr:d2.0", "Halve dashboard load time", [
      ["Cut dashboard p95 from 2.4s to 1.2s", "metric", 2.4, 1.2, 1.6, "s", [[13, 2.0, "on_track", ""], [2, 1.6, "on_track", ""]]],
      ["Reduce error rate from 1.2% to 0.3%", "metric", 1.2, 0.3, 0.6, "%", [[2, 0.6, "at_risk", "Flaky sync job."]]],
    ]],
    ["t4", "team", 3, 7, false, "obj:d2", "Make mobile check-ins delightful", [
      ["Raise app store rating from 3.9 to 4.5", "metric", 3.9, 4.5, 4.0, "★", [[12, 4.0, "off_track", "Crash on older Android."]]],
    ]],
    ["t5", "team", 5, 9, false, "obj:d3", "Grow qualified trials from search", [
      ["Grow organic trials from 300 to 550 a month", "metric", 300, 550, 380, "trials", [[6, 380, "at_risk", "Content calendar slipped."]]],
    ]],
    ["t6", "team", 4, 8, false, null, "Give the brand a warmer voice", [
      ["Make the brand better", "milestone", 0, 1, 0, "", []],
    ]],
    ["p1", "personal", 5, 5, false, "kr:t1.0", "Become fluent in activation analytics", [
      ["Build 3 activation dashboards", "metric", 0, 3, 2, "dashboards", [[4, 2, "on_track", ""]]],
    ]],
    ["p2", "personal", 6, 6, false, "obj:t3", "Own our performance budget", [
      ["Shrink the main bundle from 480 KB to 300 KB", "metric", 480, 300, 360, "KB", [[9, 360, "on_track", "Split the chart library."]]],
    ]],
  ],
  zh: [
    ["c1", "company", 0, 0, true, null, "成为小型敏捷团队首选的 OKR 工具", [
      ["周活跃团队从 1,200 增长到 3,000", "metric", 1200, 3000, 2350, "个团队", [[40, 1900, "on_track", "暑期回落后稳定回升。"], [12, 2200, "on_track", ""], [3, 2350, "on_track", "推荐带来的增长开始显现。"]]],
      ["NPS 从 32 提升到 45", "metric", 32, 45, 41, "", [[30, 37, "on_track", ""], [5, 41, "on_track", "第三轮调研已回收。"]]],
      ["净收入留存达到 110%", "metric", 98, 110, 102, "%", [[20, 101, "at_risk", "三季度流失了两个大客户。"], [6, 102, "at_risk", "增购管道偏薄。"]]],
    ]],
    ["c2", "company", 0, 0, false, null, "让新用户轻松上手", [
      ["激活率从 38% 提升到 55%", "metric", 38, 55, 44, "%", [[16, 40, "on_track", ""], [4, 44, "at_risk", "第一周流失仍然偏高。"]]],
      ["首次见效时间从 3 天缩短到 1 天", "metric", 3, 1, 2, "天", [[9, 2, "on_track", "模板很有帮助。"]]],
    ]],
    ["d1", "department", 0, 1, false, "kr:c2.0", "消除第一周最大的流失环节", [
      ["设置完成率从 52% 提升到 75%", "metric", 52, 75, 61, "%", [[14, 56, "on_track", ""], [2, 61, "on_track", "引导式设置 A/B 测试结果正向。"]]],
      ["上线面向所有新团队的引导式设置", "milestone", 0, 1, 0, "", [[10, 0, "at_risk", "卡在设计评审。"]]],
    ]],
    ["d2", "department", 1, 2, false, "obj:c1", "让产品又快又稳", [
      ["p95 页面加载从 2.4 秒降到 1.2 秒", "metric", 2.4, 1.2, 1.7, "秒", [[11, 1.9, "on_track", ""], [3, 1.7, "on_track", "缓存层已上线。"]]],
      ["可用性保持在 99.9% 以上", "metric", 99.5, 99.9, 99.85, "%", [[3, 99.85, "on_track", ""]]],
    ]],
    ["d3", "department", 2, 3, false, "kr:c1.0", "为漏斗注入合适的团队", [
      ["月试用注册从 800 增长到 1,400", "metric", 800, 1400, 1020, "个注册", [[18, 930, "at_risk", ""], [9, 1020, "off_track", "付费搜索成本飙升。"]]],
      ["获客成本从 210 元降到 160 元", "metric", 210, 160, 190, "元", [[9, 190, "at_risk", ""]]],
    ]],
    ["t1", "team", 1, 5, false, "obj:d1", "把试用团队变成活跃团队", [
      ["试用转活跃率从 22% 提升到 35%", "metric", 22, 35, 27, "%", [[8, 25, "on_track", ""], [1, 27, "on_track", "清单提醒有效。"]]],
      ["开发应用内新手清单", "milestone", 0, 1, 0, "", []],
    ]],
    ["t2", "team", 0, 4, false, "obj:d1", "弄清团队为何在第一周停滞", [
      ["通过访谈 20 个团队验证前三大流失原因", "metric", 0, 20, 14, "次访谈", [[15, 6, "on_track", ""], [8, 14, "on_track", "规律已清楚：邀请流程。"]]],
    ]],
    ["t3", "team", 2, 6, false, "kr:d2.0", "仪表盘加载时间减半", [
      ["仪表盘 p95 从 2.4 秒降到 1.2 秒", "metric", 2.4, 1.2, 1.6, "秒", [[13, 2.0, "on_track", ""], [2, 1.6, "on_track", ""]]],
      ["错误率从 1.2% 降到 0.3%", "metric", 1.2, 0.3, 0.6, "%", [[2, 0.6, "at_risk", "同步任务不稳定。"]]],
    ]],
    ["t4", "team", 3, 7, false, "obj:d2", "让移动端跟进令人愉悦", [
      ["应用商店评分从 3.9 提升到 4.5", "metric", 3.9, 4.5, 4.0, "星", [[12, 4.0, "off_track", "旧版安卓会崩溃。"]]],
    ]],
    ["t5", "team", 5, 9, false, "obj:d3", "通过搜索获得更多优质试用", [
      ["自然流量试用从每月 300 增长到 550", "metric", 300, 550, 380, "个试用", [[6, 380, "at_risk", "内容排期延误。"]]],
    ]],
    ["t6", "team", 4, 8, false, null, "让品牌语气更温暖", [
      ["让品牌更好", "milestone", 0, 1, 0, "", []],
    ]],
    ["p1", "personal", 5, 5, false, "kr:t1.0", "熟练掌握激活数据分析", [
      ["搭建 3 个激活分析看板", "metric", 0, 3, 2, "个看板", [[4, 2, "on_track", ""]]],
    ]],
    ["p2", "personal", 6, 6, false, "obj:t3", "负责我们的性能预算", [
      ["主包体积从 480 KB 缩减到 300 KB", "metric", 480, 300, 360, "KB", [[9, 360, "on_track", "拆分了图表库。"]]],
    ]],
  ],
};

const INITS = {
  en: { t1: ["Interview 10 stalled trial teams", "Design checklist empty states"], d2: ["Introduce a caching layer"], t5: ["Publish 8 comparison guides"] },
  zh: { t1: ["访谈 10 个停滞的试用团队", "设计清单空状态"], d2: ["引入缓存层"], t5: ["发布 8 篇对比指南"] },
};

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
  const created = new Date(now - 45 * DAY).toISOString();
  const byKey = {};
  const objectives = OKRS[L].map(([key, level, owner, lead, annual, parentRef, title, krs]) => {
    const ownerId = level === "company" ? "company" : level === "department" ? depts[owner].id : level === "team" ? teams[owner].id : people[owner].id;
    const o = {
      id: uid(), title, description: "", level, ownerId, leadId: people[lead].id, timeframeId: annual ? timeframes[0].id : curQ.id,
      parentRef, parent: null, driver: "krs", createdAt: created, closed: null,
      krs: krs.map(([t, type, s, tg, cur, unit, cks]) => ({
        id: uid(), title: t, type, start: s, target: tg, current: type === "milestone" ? 0 : cur, unit, done: false, weight: 1, leadId: people[lead].id, createdAt: created,
        checkins: cks.map(([ago, v, conf, comment]) => ({ id: uid(), at: new Date(now - ago * DAY - 3600000).toISOString(), value: v, done: false, confidence: conf, comment, by: people[lead].id })),
      })),
      initiatives: (INITS[L][key] || []).map((t, i) => ({ id: uid(), title: t, done: i === 0 && key === "d2", krId: null })),
    };
    byKey[key] = o;
    return o;
  });
  // A KR with no check-ins yet should still look fresh-ish: count from creation (45 days ago → needs check-in). Keep it honest.
  for (const o of objectives) {
    if (o.parentRef) {
      const [type, ref] = o.parentRef.split(":");
      if (type === "obj") o.parent = { type: "objective", id: byKey[ref].id };
      else { const [k, n] = ref.split("."); o.parent = { type: "kr", id: byKey[k].krs[Number(n)].id }; }
    }
    delete o.parentRef;
  }
  // A closed objective from last quarter, to show scoring.
  objectives.push({
    id: uid(), title: L === "zh" ? "建立每周跟进的节奏" : "Build a weekly check-in rhythm", description: "", level: "company", ownerId: "company", leadId: people[0].id,
    timeframeId: prevQ.id, parent: null, driver: "krs", createdAt: new Date(now - 140 * DAY).toISOString(),
    closed: { at: new Date(now - 30 * DAY).toISOString(), score: 0.7, note: L === "zh" ? "多数团队坚持了每周跟进，个人层面还需加强。" : "Most teams kept a weekly habit; personal goals lagged." },
    krs: [{ id: uid(), title: L === "zh" ? "每周跟进率从 30% 提升到 80%" : "Raise weekly check-in rate from 30% to 80%", type: "metric", start: 30, target: 80, current: 66, unit: "%", done: false, weight: 1, leadId: people[0].id, createdAt: new Date(now - 140 * DAY).toISOString(),
      checkins: [{ id: uid(), at: new Date(now - 31 * DAY).toISOString(), value: 66, done: false, confidence: "at_risk", comment: "", by: people[0].id }] }],
    initiatives: [],
  });
  return { app: "goallift", version: VERSION, org: { name: N.org }, departments: depts, teams, people, timeframes, objectives, createdAt: new Date(now).toISOString() };
}
