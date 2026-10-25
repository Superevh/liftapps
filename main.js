// Renders the icon wall and catalogue from apps.js, plus the EN/中文 switch, filters, nav and scroll reveals.
const T = {
  en: {
    navApps: "Apps", navHow: "How it works", navAbout: "About", eyebrow: "AIYun · Lift Apps",
    heroTitle: 'Tools that <span class="gold">lift</span><br />your team.',
    lede: "A family of light, AI-assisted apps for agile teams: retros, estimation, health checks, boards and forecasts. One account, one look, nothing to install.",
    ctaApps: "See all apps", ctaHow: "How it works →", factApps: "apps in the family", factGroups: "groups", factAccount: "account for all",
    appsEyebrow: "The family", appsTitle: "Every app is named for its job.", appsLede: "What it does, plus Lift. Pick one for your next ceremony, or use them together.",
    fAll: "All", fLive: "Available", fBuilding: "In development", fPlanned: "Planned",
    howEyebrow: "How it works", howTitle: "One family, not twenty-two logins.",
    p1t: "One account", p1: "Sign in once and every Lift app knows your team, boards and history.",
    p2t: "AI where it helps", p2: "Grouping retro cards, flagging stories too big to estimate, explaining a forecast. Never AI for its own sake.",
    p3t: "Share a link", p3: "Guests join from a link in the browser. No install, no seat to buy for a one-off workshop.",
    p4t: "Apps that connect", p4: "Actions from a retro land on your board; a story map exports to your sprint.",
    aboutEyebrow: "About", aboutTitle: "Made by AIYun.",
    aboutBody: "AIYun (AI云) builds practical AI products. Lift Apps grew out of years of coaching agile teams and wanting tools that feel calm, look good and do the boring parts for you.",
    footer: "Lift Apps™ by AIYun · Explore · Connect · Create", open: "Open", title: "Lift Apps by AIYun",
  },
  zh: {
    navApps: "应用", navHow: "使用方式", navAbout: "关于", eyebrow: "AI云 · Lift 系列",
    heroTitle: '让团队协作<br /><span class="gold">更上一层</span>。',
    lede: "一套为敏捷团队打造的轻量 AI 工具：复盘、估点、健康度、看板和交付预测。一个账号、统一风格，打开浏览器就能用。",
    ctaApps: "查看全部应用", ctaHow: "使用方式 →", factApps: "个应用", factGroups: "个分组", factAccount: "个账号通用",
    appsEyebrow: "应用家族", appsTitle: "每个应用都以它的用途命名。", appsLede: "用途 + Lift。下一次团队会议挑一个用，或者组合起来用。",
    fAll: "全部", fLive: "可用", fBuilding: "开发中", fPlanned: "计划中",
    howEyebrow: "使用方式", howTitle: "一个家族，而不是二十二个账号。",
    p1t: "一个账号", p1: "登录一次，每个 Lift 应用都认识你的团队、看板和历史记录。",
    p2t: "AI 用在刀刃上", p2: "归类复盘卡片、标出太大没法估的故事、解释交付预测。不为了用 AI 而用 AI。",
    p3t: "分享一个链接", p3: "参与者点链接就能在浏览器里加入。不用安装，开一次工作坊也不用买席位。",
    p4t: "应用之间互通", p4: "复盘里的行动项直接进看板，故事地图一键导出到迭代。",
    aboutEyebrow: "关于", aboutTitle: "由 AI云 打造。",
    aboutBody: "AI云（AIYun）专注做实用的 AI 产品。Lift 系列来自多年敏捷教练工作中的一个愿望：工具应该安静、好看，把琐碎的事替你做掉。",
    footer: "Lift Apps™ · AI云出品 · Explore · Connect · Create", open: "打开", title: "Lift 系列 · AI云",
  },
};
const STATUS = { live: ["fLive", "live"], building: ["fBuilding", "building"], planned: ["fPlanned", ""] };
const WALL = APPS.filter((a) => a.key !== "status" && a.key !== "incident"); // 20 tiles fill a 5 x 4 grid

let lang = "en", filter = "all";
const urlLang = new URLSearchParams(location.search).get("lang");
try { lang = localStorage.getItem("lift-lang") || (navigator.language.startsWith("zh") ? "zh" : "en"); } catch { /* storage blocked */ }
if (urlLang === "zh" || urlLang === "en") lang = urlLang;

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });

const label = (a) => (lang === "zh" ? a.zh : a.role);

function renderWall() {
  document.getElementById("iconWall").innerHTML = WALL.map((a, i) => `
    <a class="wall-item" href="#app-${a.key}" style="--d:${(i * 0.035).toFixed(3)}s">
      ${liftIcon(a.key)}<span class="wall-name">${a.word}<i>Lift</i></span><span class="wall-role">${label(a)}</span>
    </a>`).join("");
}

function renderGroups() {
  const t = T[lang], el = document.getElementById("groups");
  el.innerHTML = GROUPS.map((g) => {
    const apps = APPS.filter((a) => a.g === g.id && (filter === "all" || a.status === filter));
    if (!apps.length) return "";
    return `<div class="group"><div class="group-head" style="--cat:${g.cat}"><span class="dot"></span><h3>${lang === "zh" ? g.zh : g.name}</h3><span>${lang === "zh" ? g.noteZh : g.note}</span></div>
      <div class="cards">${apps.map((a, i) => `
        <article class="card reveal" id="app-${a.key}" style="--d:${(i % 3) * 0.06}s">
          <div class="card-top">${liftIcon(a.key)}<div><div class="name">${a.word}<i>Lift</i></div><div class="role">${lang === "zh" ? a.roleZh : a.role}</div></div></div>
          <p class="desc">${lang === "zh" ? a.descZh : a.desc}</p>
          <div class="card-foot"><span class="badge ${STATUS[a.status][1]}">${t[STATUS[a.status][0]]}</span>${a.url ? `<a class="open" href="${a.url}" target="_blank" rel="noopener">${t.open} ${a.word}Lift ↗</a>` : ""}</div>
        </article>`).join("")}</div></div>`;
  }).join("");
  el.querySelectorAll(".reveal").forEach((c) => io.observe(c));
}

function applyLang(next) {
  lang = next;
  try { localStorage.setItem("lift-lang", lang); } catch { /* storage blocked */ }
  const t = T[lang];
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = t.title;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  renderWall(); renderGroups();
}

document.getElementById("f-total").textContent = APPS.length;
document.getElementById("f-groups").textContent = GROUPS.length;
document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => {
  filter = b.dataset.f;
  document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderGroups();
}));
applyLang(lang);

const nav = document.querySelector(".nav-wrap");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
