// Home page: renders the icon wall and catalogue from apps.js, plus filters, nav and scroll reveals.
const STATUS = { live: ["fLive", "live"], building: ["fBuilding", "building"], planned: ["fPlanned", ""] };
const WALL = APPS.filter((a) => a.key !== "status" && a.key !== "incident"); // 20 tiles fill a 5 x 4 grid
let filter = "all";

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });

// Live apps open directly; everything else goes to its intro page.
const href = (a) => (a.url ? `href="${a.url}" target="_blank" rel="noopener"` : `href="${a.key}/"`);

function renderWall() {
  document.getElementById("iconWall").innerHTML = WALL.map((a, i) => `
    <a class="wall-item" ${href(a)} style="--d:${(i * 0.035).toFixed(3)}s">
      ${liftIcon(a.key)}<span class="wall-name">${a.word}<i>Lift</i></span><span class="wall-role">${lang === "zh" ? a.zh : a.role}</span>
    </a>`).join("");
}

function renderGroups(t) {
  const el = document.getElementById("groups");
  el.innerHTML = GROUPS.map((g) => {
    const apps = APPS.filter((a) => a.g === g.id && (filter === "all" || a.status === filter));
    if (!apps.length) return "";
    return `<div class="group"><div class="group-head" style="--cat:${g.cat}"><span class="dot"></span><h3>${lang === "zh" ? g.zh : g.name}</h3><span>${lang === "zh" ? g.noteZh : g.note}</span></div>
      <div class="cards">${apps.map((a, i) => `
        <article class="card reveal" id="app-${a.key}" style="--d:${(i % 3) * 0.06}s">
          <div class="card-top">${liftIcon(a.key)}<div><div class="name">${a.word}<i>Lift</i></div><div class="role">${lang === "zh" ? a.roleZh : a.role}</div></div></div>
          <p class="desc">${lang === "zh" ? a.descZh : a.desc}</p>
          <div class="card-foot"><span class="badge ${STATUS[a.status][1]}">${t[STATUS[a.status][0]]}</span><a class="open" ${href(a)}>${a.url ? `${t.open} ${a.word}Lift ↗` : t.learn}</a></div>
        </article>`).join("")}</div></div>`;
  }).join("");
  el.querySelectorAll(".reveal").forEach((c) => io.observe(c));
}

document.getElementById("f-total").textContent = APPS.length;
document.getElementById("f-groups").textContent = GROUPS.length;
let current;
setupLang((t) => { current = t; document.title = t.title; renderWall(); renderGroups(t); });
document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => {
  filter = b.dataset.f;
  document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderGroups(current);
}));

const nav = document.querySelector(".nav-wrap");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
