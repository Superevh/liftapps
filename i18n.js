// Shared UI strings and language state for every Lift Apps page.
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
    allApps: "All apps", back: "← All Lift apps", features: "What it does", related: "Works well with",
    noteBuilding: "We are building this now. It will join your Lift account when it is ready.", notePlanned: "On the roadmap. Here is what it will do.",
    tryLive: "Try RetroLift today", learn: "Learn more →",
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
    allApps: "全部应用", back: "← 全部 Lift 应用", features: "它能做什么", related: "搭配使用",
    noteBuilding: "正在开发中，完成后会直接加入你的 Lift 账号。", notePlanned: "已列入路线图，下面是它将提供的功能。",
    tryLive: "先试试 RetroLift", learn: "了解更多 →",
  },
};
const urlLang = new URLSearchParams(location.search).get("lang");
let lang = "en";
try { lang = localStorage.getItem("lift-lang") || (navigator.language.startsWith("zh") ? "zh" : "en"); } catch { /* storage blocked */ }
if (urlLang === "zh" || urlLang === "en") lang = urlLang;

// Applies static [data-i18n] strings, then calls onChange so each page can re-render its dynamic parts.
function setupLang(onChange) {
  const apply = (next) => {
    lang = next;
    try { localStorage.setItem("lift-lang", lang); } catch { /* storage blocked */ }
    const t = T[lang];
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n]; });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    onChange(t);
  };
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => apply(b.dataset.lang)));
  apply(lang);
}
