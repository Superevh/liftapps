// Renders the icon wall and catalogue from apps.js, plus filters, nav and scroll reveals.
const STATUS = { live: ["Available", "live"], building: ["In development", "building"], planned: ["Planned", ""] };
const CHEV = '<svg class="chev" viewBox="0 0 10 10"><path d="M2 6.5L5 3.5 8 6.5"/></svg>';
const catOf = (gid) => GROUPS.find((g) => g.id === gid).cat;
const tile = (app, extra = "") =>
  `<span class="tile" style="--cat:${catOf(app.g)};${extra}"><svg class="glyph" viewBox="0 0 24 24">${GLYPHS[app.key]}</svg>${CHEV}</span>`;

document.getElementById("iconWall").innerHTML = APPS.slice(0, 20).map((a, i) => tile(a, `--d:${(i * 0.035).toFixed(3)}s`)).join("");
document.getElementById("f-total").textContent = APPS.length;
document.getElementById("f-groups").textContent = GROUPS.length;

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });

function render(filter) {
  const el = document.getElementById("groups");
  el.innerHTML = GROUPS.map((g) => {
    const apps = APPS.filter((a) => a.g === g.id && (filter === "all" || a.status === filter));
    if (!apps.length) return "";
    return `<div class="group"><div class="group-head" style="--cat:${g.cat}"><span class="dot"></span><h3>${g.name} · ${g.zh}</h3><span>${g.note}</span></div>
      <div class="cards">${apps.map((a, i) => `
        <article class="card reveal" style="--d:${(i % 3) * 0.06}s">
          <div class="card-top">${tile(a)}<div><div class="name">${a.word}<i>Lift</i></div><div class="role">${a.zh} · ${a.role}</div></div></div>
          <p class="desc">${a.desc}</p>
          <div class="card-foot"><span class="badge ${STATUS[a.status][1]}">${STATUS[a.status][0]}</span>${a.url ? `<a class="open" href="${a.url}" target="_blank" rel="noopener">Open ${a.word}Lift ↗</a>` : ""}</div>
        </article>`).join("")}</div></div>`;
  }).join("");
  el.querySelectorAll(".reveal").forEach((c) => io.observe(c));
}
render("all");

document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  render(b.dataset.f);
}));

const nav = document.querySelector(".nav-wrap");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
