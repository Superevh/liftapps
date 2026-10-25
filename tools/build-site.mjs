// Pre-renders the Lift Apps site into dist/: English at /, Chinese at /zh/, one page per app, plus
// 404, sitemap, robots and redirects for retired URLs. Content comes from shared/catalog.mjs.
// Run: node tools/build-site.mjs   (tools/build-all.mjs calls it, then adds the apps under /<key>/app/)
import { mkdirSync, writeFileSync, cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { APPS, STAGES } from "../shared/catalog.mjs";
import { liftIcon } from "../shared/icons.mjs";

const ORIGIN = "https://liftapps.com.au";
const OUT = process.argv[2] || "dist";

const T = {
  en: {
    lang: "en", htmlLang: "en", other: "zh", otherLabel: "中文", prefix: "",
    navApps: "Apps", navHow: "How it works", navAbout: "About", openRetro: "Start a retro", skip: "Skip to content",
    homeTitle: "Lift Apps by AIYun: tools for the whole delivery cycle",
    homeDesc: "Nine light tools for agile teams, from OKRs and product discovery to estimation, meetings, team health and retros. One family, one look, in your browser.",
    eyebrow: "AIYun · Lift Apps",
    h1: 'From goals to retros, nine tools that <span class="lift">lift</span> your team.',
    lede: "One family of light, browser-based tools for agile teams: set goals, shape the product, plan, estimate, run better meetings, check team health and learn from every sprint.",
    ctaPrimary: "Start a free retro", ctaSecondary: "Explore the apps",
    trust: ["Free during beta", "Most apps need no sign-up", "No ads, no tracking cookies", "English and 中文"],
    appsEyebrow: "The family", appsTitle: "One app for each step of delivery.",
    appsLede: "Follow the cycle from why to what we learned, or jump straight to the one you need today.",
    open: "Open", details: "Details", live: "Live", beta: "Beta", soon: "Coming soon",
    howEyebrow: "How it works", howTitle: "Built like one product, not nine.",
    pillars: [["Share a link", "Teammates join from a link or QR code in the browser. Nothing to install."], ["Private by default", "Sessions are reached only through their own unguessable link. No ads and no tracking cookies."], ["One look, one switch", "Every app shares the same top bar, app switcher and language setting."], ["Made for the cycle", "Each app covers one step, so they fit together from goals to retros."]],
    startEyebrow: "Start here", startTitle: "New to Lift? Three good first steps.",
    start: [["retro", "Run your next retro", "Pick a themed template and share the link with the team."], ["estimate", "Estimate the next sprint", "Planning poker with a simultaneous reveal, then a confidence vote."], ["pulse", "Check how the team is doing", "A ten-minute health check every sprint shows the trend."]],
    aboutEyebrow: "About", aboutTitle: "Made by AIYun.",
    about: ["AIYun (AI云) builds practical AI products. Lift Apps brings the tools an agile team reaches for every week into one calm, consistent family.", "Let AI lift us higher."],
    footerApps: "Apps", footerNote: "Lift Apps™ by AIYun", rights: "© 2026 AIYun",
    crumbsHome: "Lift Apps", readMore: "Why it exists ↓", whyEyebrow: "Why", whyTitle: "The problem it solves", whatEyebrow: "What", whatTitle: (w) => `What ${w}Lift does`, howEyebrow: "How", howTitle2: "How it works", summaryEyebrow: "Summary", whatItDoes: "What it does", whereFits: "Where it fits in the cycle", prev: "Previous", next: "Next",
    openApp: (w) => `Open ${w}Lift`, allApps: "All apps", appTitle: (a) => `${a.word}Lift: ${a.en.label} · Lift Apps by AIYun`,
    nfTitle: "This page lifted off.", nfBody: "The page you were looking for isn't here. Try one of the apps instead.", nfHome: "Back to Lift Apps",
    retroNote: "Opens on fun-retro.com, where RetroLift runs today.",
  },
  zh: {
    lang: "zh", htmlLang: "zh-CN", other: "en", otherLabel: "EN", prefix: "/zh",
    navApps: "应用", navHow: "使用方式", navAbout: "关于", openRetro: "开始复盘", skip: "跳到正文",
    homeTitle: "Lift 系列 · AI云：覆盖完整交付周期的团队工具",
    homeDesc: "九个轻量的敏捷团队工具：从 OKR、产品探索到估算、会议、团队健康和复盘。一个家族，统一风格，打开浏览器就能用。",
    eyebrow: "AI云 · Lift 系列",
    h1: '从目标到复盘，九个工具<span class="lift">托举</span>你的团队。',
    lede: "一套轻量的浏览器工具，专为敏捷团队打造：定目标、做产品探索、排路线图、估算、开好会、看团队健康，再从每个迭代里学到东西。",
    ctaPrimary: "免费开始复盘", ctaSecondary: "查看全部应用",
    trust: ["测试期间免费", "大部分应用无需注册", "无广告、无跟踪 Cookie", "中英文双语"],
    appsEyebrow: "应用家族", appsTitle: "交付的每一步，都有一个应用。",
    appsLede: "从「为什么做」一路走到「学到什么」，或者直接打开你今天需要的那一个。",
    open: "打开", details: "详情", live: "已上线", beta: "测试版", soon: "即将推出",
    howEyebrow: "使用方式", howTitle: "像一个产品那样打造，而不是九个。",
    pillars: [["分享一个链接", "队友点链接或扫码，在浏览器里加入，不用安装。"], ["默认私密", "每个会话只能通过它自己的随机链接进入。无广告、无跟踪 Cookie。"], ["统一风格和切换", "所有应用共用同一个顶栏、应用切换和语言设置。"], ["为交付周期设计", "每个应用负责一步，从目标到复盘自然衔接。"]],
    startEyebrow: "从这里开始", startTitle: "第一次用 Lift？推荐三步。",
    start: [["retro", "开一次复盘", "选一个主题模板，把链接发给团队。"], ["estimate", "估算下个迭代", "计划扑克同时亮牌，再做一次信心投票。"], ["pulse", "看看团队状态", "每个迭代花十分钟做健康检查，就能看到趋势。"]],
    aboutEyebrow: "关于", aboutTitle: "由 AI云 打造。",
    about: ["AI云（AIYun）专注做实用的 AI 产品。Lift 系列把敏捷团队每周都会用到的工具，整合成一个安静、统一的家族。", "Let AI lift us higher."],
    footerApps: "应用", footerNote: "Lift Apps™ · AI云出品", rights: "© 2026 AIYun",
    crumbsHome: "Lift 系列", readMore: "为什么需要它 ↓", whyEyebrow: "为什么", whyTitle: "它要解决的问题", whatEyebrow: "是什么", whatTitle: (w) => `${w}Lift 能做什么`, howEyebrow: "怎么用", howTitle2: "使用步骤", summaryEyebrow: "总结", whatItDoes: "它能做什么", whereFits: "在交付周期中的位置", prev: "上一个", next: "下一个",
    openApp: (w) => `打开 ${w}Lift`, allApps: "全部应用", appTitle: (a) => `${a.word}Lift：${a.zh.label} · AI云 Lift 系列`,
    nfTitle: "这个页面飞走了。", nfBody: "你要找的页面不在这里，试试下面的应用吧。", nfHome: "回到 Lift 系列",
    retroNote: "在 fun-retro.com 打开，RetroLift 目前运行在那里。",
  },
};

// Retired URLs from the first lineup → where that job lives now.
const REDIRECTS = { point: "estimate", topic: "meeting", agenda: "meeting", kudo: "retro", incident: "retro", standup: "pulse", team: "pulse", quiz: "vote", road: "discovery", story: "discovery", flow: "plan", ship: "plan", board: "", sprint: "", status: "", note: "" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stageOf = (id) => STAGES.find((s) => s.id === id);
const appUrl = (a) => (a.href.startsWith("http") ? a.href : a.href);
const ext = (a) => (a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "");
const name = (a) => `${a.word}<span class="lift">Lift</span>`;
const badge = (a, t) => `<span class="badge ${a.status === "live" ? "live" : ""}">${t[a.status]}</span>`;

// Collects every character set in the display serif so each page requests only those glyphs.
let glyphs = new Set();
const D = (s) => { for (const ch of String(s).replace(/<[^>]+>/g, "")) glyphs.add(ch); return s; };
const fontHref = () => `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&display=swap&text=${encodeURIComponent([...glyphs].sort().join(""))}`;

function layout(t, { path, title, desc, body, og = "home", jsonld }) {
  const enPath = path, zhPath = "/zh" + (path === "/" ? "/" : path);
  const self = t.lang === "zh" ? zhPath : enPath, other = t.lang === "zh" ? enPath : zhPath;
  D(t.nfTitle); // keep 404 headline glyphs available on every page cache-wise
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${ORIGIN}${self}" />
<link rel="alternate" hreflang="en" href="${ORIGIN}${enPath}" />
<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}${zhPath}" />
<link rel="alternate" hreflang="x-default" href="${ORIGIN}${enPath}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Lift Apps by AIYun" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${ORIGIN}${self}" />
<meta property="og:image" content="${ORIGIN}/assets/og/${og}-${t.lang}.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="${t.lang === "zh" ? "zh_CN" : "en_AU"}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#FBF8F2" />
<link rel="icon" href="/assets/favicon.png" />
<link rel="apple-touch-icon" href="/assets/mark.png" />
<link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="${fontHref()}" />
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body>
<a class="skip" href="#main">${t.skip}</a>
<header class="nav-wrap">
  <nav class="nav wrap" aria-label="Main">
    <a href="${t.prefix}/" class="logo" aria-label="Lift Apps by AIYun"><img src="/assets/aiyun-mark.png" alt="AIYun" width="91" height="28" /></a>
    <div class="nav-links">
      <a href="${t.prefix}/#apps">${t.navApps}</a>
      <a href="${t.prefix}/#how">${t.navHow}</a>
      <a href="${t.prefix}/#about">${t.navAbout}</a>
    </div>
    <a class="lang-link" href="${other}" hreflang="${t.other === "zh" ? "zh-CN" : "en"}" data-lang="${t.other}">${t.otherLabel}</a>
    <a class="btn btn-gold btn-sm" href="https://fun-retro.com" target="_blank" rel="noopener">${t.openRetro} ↗</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div><img src="/assets/aiyun-mark.png" alt="AIYun" class="footer-logo" width="78" height="24" /><p>${t.footerNote} · Explore · Connect · Create</p></div>
      <ul class="footer-apps" aria-label="${t.footerApps}">${APPS.map((a) => `<li><a href="${t.prefix}/${a.key}/">${a.word}Lift · ${a[t.lang].label}</a></li>`).join("")}</ul>
    </div>
    <div class="footer-base"><span>${t.rights}</span><a href="${other}" data-lang="${t.other}">${t.other === "zh" ? "中文版" : "English"}</a></div>
  </div>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}

function card(a, t) {
  const n = String(APPS.indexOf(a) + 1).padStart(2, "0");
  return `<article class="card">
        <p class="eyebrow"><b>${n}</b> · ${stageOf(a.stage)[t.lang]}</p>
        <div class="card-top">${liftIcon(a.key, "c")}<div><h3 class="name">${D(name(a))}</h3><p class="role">${a[t.lang].label}</p></div></div>
        <p class="desc">${a[t.lang].line}</p>
        <div class="card-foot">${badge(a, t)}<a class="more" href="${t.prefix}/${a.key}/">${t.details}</a><a class="open" href="${appUrl(a)}"${ext(a)}>${t.open} ↗</a></div>
      </article>`;
}

function home(t) {
  const body = `
<section class="hero">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap">
    <div class="hero-inner">
      <p class="eyebrow">${t.eyebrow}</p>
      <h1>${D(t.h1)}</h1>
      <p class="lede">${t.lede}</p>
      <div class="cta"><a class="btn btn-gold" href="https://fun-retro.com" target="_blank" rel="noopener">${t.ctaPrimary} ↗</a><a class="btn btn-ghost" href="#apps">${t.ctaSecondary}</a></div>
      <ul class="trust">${t.trust.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
    <ol class="cycle" aria-label="${t.appsTitle}">${APPS.map((a) => `<li><a href="${t.prefix}/${a.key}/">${liftIcon(a.key, "w")}<b>${a.word}Lift</b><small>${stageOf(a.stage)[t.lang]}</small></a></li>`).join("")}</ol>
  </div>
</section>
<section id="apps" class="section">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow"><b>01</b> / ${t.appsEyebrow}</p><h2>${D(t.appsTitle)}</h2><p>${t.appsLede}</p></div>
    <div class="cards">${APPS.map((a) => card(a, t)).join("")}</div>
  </div>
</section>
<section id="how" class="section soft">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow"><b>02</b> / ${t.howEyebrow}</p><h2>${D(t.howTitle)}</h2></div>
    <div class="pillars">${t.pillars.map(([h, p], i) => `<div class="pillar"><span class="pill-num">${D("0" + (i + 1))}</span><h3>${D(h)}</h3><p>${p}</p></div>`).join("")}</div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow"><b>03</b> / ${t.startEyebrow}</p><h2>${D(t.startTitle)}</h2></div>
    <ol class="start">${t.start.map(([k, h, p]) => { const a = APPS.find((x) => x.key === k); return `<li><b>${D(h)}</b><span>${p}</span><a href="${appUrl(a)}"${ext(a)}>${t.openApp(a.word)} ↗</a></li>`; }).join("")}</ol>
  </div>
</section>
<section id="about" class="section soft">
  <div class="wrap about">
    <div><p class="eyebrow"><b>04</b> / ${t.aboutEyebrow}</p><h2>${D(t.aboutTitle)}</h2></div>
    <div class="about-copy"><p>${t.about[0]}</p><p class="motto">${D(t.about[1])}</p></div>
  </div>
</section>`;
  return layout(t, { path: "/", title: t.homeTitle, desc: t.homeDesc, body, og: "home",
    jsonld: { "@context": "https://schema.org", "@type": "Organization", name: "AIYun", url: ORIGIN, logo: `${ORIGIN}/assets/mark.png` } });
}

function appPage(a, i, t) {
  const L = a[t.lang], prev = APPS[i - 1], next = APPS[i + 1];
  const shot = existsSync(`site/assets/shots/${a.key}-${t.lang}.png`) ? `/assets/shots/${a.key}-${t.lang}.png` : existsSync(`site/assets/shots/${a.key}.png`) ? `/assets/shots/${a.key}.png` : "";
  const openBtn = `<a class="btn btn-gold" href="${appUrl(a)}"${ext(a)}>${t.openApp(a.word)} ↗</a>`;
  const body = `
<section class="hero">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap">
    <p class="crumbs"><a href="${t.prefix}/">${t.crumbsHome}</a> / <a href="${t.prefix}/#apps">${stageOf(a.stage)[t.lang]}</a></p>
    <div class="app-hero">
      ${liftIcon(a.key, "h")}
      <div>
        <p class="eyebrow">${stageOf(a.stage)[t.lang]} · ${badge(a, t)}</p>
        <h1 class="app-title">${D(name(a))}</h1>
        <p class="app-role">${L.label}</p>
        <p class="lede">${L.line}</p>
        <div class="cta">${openBtn}<a class="btn btn-ghost" href="#why">${t.readMore}</a></div>
        ${a.key === "retro" ? `<p class="app-role">${t.retroNote}</p>` : ""}
      </div>
    </div>
  </div>
</section>
<section id="why" class="section">
  <div class="wrap split">
    <div class="sec-head"><p class="eyebrow"><b>01</b> / ${t.whyEyebrow}</p><h2>${D(t.whyTitle)}</h2></div>
    <div class="why"><p class="why-text">${L.why}</p><ul class="pains">${L.pains.map((x) => `<li>${x}</li>`).join("")}</ul></div>
  </div>
</section>
<section class="section soft">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow"><b>02</b> / ${t.whatEyebrow}</p><h2>${D(t.whatTitle(a.word))}</h2></div>
    <ul class="feats">${L.feats.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${shot ? `<figure class="shot"><img src="${shot}" alt="${a.word}Lift" loading="lazy" width="1440" height="900" /></figure>` : ""}
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow"><b>03</b> / ${t.howEyebrow}</p><h2>${D(t.howTitle2)}</h2></div>
    <ol class="steps">${L.how.map((x, n) => `<li><span class="step-n">${D(String(n + 1))}</span><p>${x}</p></li>`).join("")}</ol>
  </div>
</section>
<section class="section soft">
  <div class="wrap">
    <div class="summary">
      <p class="eyebrow"><b>04</b> / ${t.summaryEyebrow}</p>
      <p class="summary-text">${D(L.summary)}</p>
      <div class="cta">${openBtn}<a class="btn btn-ghost" href="${t.prefix}/#apps">${t.allApps}</a></div>
    </div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">${t.whereFits}</p></div>
    <ol class="chain">${APPS.map((x) => `<li><a href="${t.prefix}/${x.key}/"${x.key === a.key ? ' aria-current="page"' : ""}>${liftIcon(x.key, "ch")}${x.word}Lift</a></li>`).join("")}</ol>
    <div class="pager">${prev ? `<a href="${t.prefix}/${prev.key}/">← ${t.prev}: ${prev.word}Lift</a>` : "<span></span>"}${next ? `<a href="${t.prefix}/${next.key}/">${t.next}: ${next.word}Lift →</a>` : ""}</div>
  </div>
</section>`;
  return layout(t, { path: `/${a.key}/`, title: t.appTitle(a), desc: L.summary, body, og: a.key,
    jsonld: { "@context": "https://schema.org", "@type": "SoftwareApplication", name: `${a.word}Lift`, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${ORIGIN}${t.prefix}/${a.key}/`, description: L.summary, inLanguage: ["en", "zh-CN"], publisher: { "@type": "Organization", name: "AIYun" } } });
}

function notFound(t) {
  const body = `<section class="wrap notfound"><h1>${D(t.nfTitle)}</h1><p class="lede">${t.nfBody}</p><a class="btn btn-gold" href="${t.prefix}/">${t.nfHome}</a></section>`;
  return layout(t, { path: "/404.html", title: t.nfTitle, desc: t.nfBody, body });
}

function redirect(to) {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Lift Apps</title><meta name="robots" content="noindex" /><link rel="canonical" href="${ORIGIN}${to}" /><meta http-equiv="refresh" content="0; url=${to}" /></head><body><a href="${to}">${ORIGIN}${to}</a></body></html>\n`;
}

const write = (p, s) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s); };

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
cpSync("site", OUT, { recursive: true });
for (const t of [T.en, T.zh]) {
  glyphs = new Set(); write(`${t.prefix}/index.html`, home(t));
  APPS.forEach((a, i) => { glyphs = new Set(); write(`${t.prefix}/${a.key}/index.html`, appPage(a, i, t)); });
}
glyphs = new Set(); write("404.html", notFound(T.en));
for (const [old, to] of Object.entries(REDIRECTS)) write(`${old}/index.html`, redirect(to ? `/${to}/` : "/"));

const urls = ["/", ...APPS.map((a) => `/${a.key}/`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap((u) => [u, "/zh" + u]).map((u) => { const en = u.replace(/^\/zh/, "") || "/"; return `  <url><loc>${ORIGIN}${u}</loc><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}${en}"/><xhtml:link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/zh${en}"/></url>`; }).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
console.log(`site → ${OUT}: ${urls.length * 2} pages, ${Object.keys(REDIRECTS).length} redirects`);
