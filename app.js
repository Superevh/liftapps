// Intro page for one app. The page sets <body data-app="key">; content comes from apps.js and details.js.
const KEY = document.body.dataset.app;
const APP = APPS.find((a) => a.key === KEY);
const D = DETAILS[KEY];
const GROUP = GROUPS.find((g) => g.id === APP.g);
const STATUS = { live: ["fLive", "live"], building: ["fBuilding", "building"], planned: ["fPlanned", ""] };
const zh = () => lang === "zh";
const linkTo = (a) => (a.url ? `href="${a.url}" target="_blank" rel="noopener"` : `href="../${a.key}/"`);

function render(t) {
  document.title = `${APP.word}Lift · ${zh() ? "AI云 Lift 系列" : "Lift Apps by AIYun"}`;
  const retro = APPS.find((a) => a.key === "retro");
  document.getElementById("intro").innerHTML = `
    <section class="hero app-hero">
      <div class="hero-glow" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="wrap app-hero-grid">
        <div class="app-hero-icon">${liftIcon(KEY)}</div>
        <div>
          <p class="eyebrow">${zh() ? GROUP.zh : GROUP.name}</p>
          <h1 class="app-title">${APP.word}<i>Lift</i></h1>
          <p class="app-role">${zh() ? APP.roleZh : APP.role}</p>
          <p class="lede">${D.tag[zh() ? 1 : 0]}</p>
          <div class="app-status"><span class="badge ${STATUS[APP.status][1]}">${t[STATUS[APP.status][0]]}</span><span>${APP.status === "building" ? t.noteBuilding : t.notePlanned}</span></div>
          <div class="cta">
            <a class="btn btn-gold" href="${retro.url}" target="_blank" rel="noopener">${t.tryLive} ↗</a>
            <a class="btn btn-ghost" href="../#apps">${t.back}</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section soft">
      <div class="wrap">
        <div class="sec-head"><p class="eyebrow"><b>01</b> / ${t.features}</p><h2>${zh() ? APP.descZh : APP.desc}</h2></div>
        <div class="pillars three">${D.feats.map((f, i) => `
          <div class="pillar"><span class="pill-num">0${i + 1}</span><h3>${zh() ? f[2] : f[0]}</h3><p>${zh() ? f[3] : f[1]}</p></div>`).join("")}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="wrap">
        <div class="sec-head"><p class="eyebrow"><b>02</b> / ${t.related}</p></div>
        <div class="cards">${D.rel.map((k) => APPS.find((a) => a.key === k)).map((a) => `
          <article class="card">
            <div class="card-top">${liftIcon(a.key)}<div><div class="name">${a.word}<i>Lift</i></div><div class="role">${zh() ? a.roleZh : a.role}</div></div></div>
            <div class="card-foot"><span class="badge ${STATUS[a.status][1]}">${t[STATUS[a.status][0]]}</span><a class="open" ${linkTo(a)}>${a.url ? `${t.open} ↗` : t.learn}</a></div>
          </article>`).join("")}
        </div>
      </div>
    </section>`;
}

setupLang(render);
const nav = document.querySelector(".nav-wrap");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
