// <lift-bar app="estimate"></lift-bar>: the shared Lift Apps top bar.
// Shows the family mark, the current app, an app switcher and the EN/中文 switch.
// Language is shared across the family in localStorage "lift-lang"; apps follow it with:
//   import { getLang, onLang } from "<path>/shared/lift-shell.mjs";  onLang((lang) => ...)
import { APPS, appByKey } from "./catalog.mjs";
import { liftIcon } from "./icons.mjs";

const KEY = "lift-lang";
export function getLang() {
  try { const v = localStorage.getItem(KEY); if (v === "zh" || v === "en") return v; } catch { /* storage blocked */ }
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}
export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent("lift:lang", { detail: lang }));
}
export function onLang(fn) {
  const h = (e) => fn(e.detail);
  window.addEventListener("lift:lang", h);
  fn(getLang());
  return () => window.removeEventListener("lift:lang", h);
}

// Absolute links work on liftapps.com.au; during local development they point at the live site.
const SITE = location.hostname === "liftapps.com.au" || location.hostname === "www.liftapps.com.au" ? "" : "https://liftapps.com.au";
const href = (a) => (a.href.startsWith("http") ? a.href : SITE + a.href);

const CSS = `
:host { --ink:#2B1E14; --ink-2:rgba(43,30,20,.66); --ink-3:rgba(43,30,20,.7); --line:rgba(140,97,58,.16); --paper:#FBF8F2; --card:#FFFCF7; --gold-ink:#8C613A;
  display:block; position:sticky; top:0; z-index:1000; font-family: Inter, "PingFang SC", "Noto Sans SC", system-ui, sans-serif; color:var(--ink); }
* { box-sizing:border-box; }
.bar { height:52px; display:flex; align-items:center; gap:10px; padding:0 14px; background:rgba(251,248,242,.92); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
a { color:inherit; text-decoration:none; }
.home { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; letter-spacing:.02em; }
.home img { width:22px; height:22px; }
.sep { width:1px; height:20px; background:var(--line); margin:0 4px; }
.cur { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; white-space:nowrap; }
.cur svg { width:26px; height:26px; }
i { font-style:normal; color:var(--gold-ink); }
button { font:inherit; cursor:pointer; border:0; background:transparent; color:inherit; }
.switch { display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid var(--line); font-size:13px; color:var(--ink-2); background:var(--card); }
.switch:hover, .switch[aria-expanded="true"] { color:var(--ink); }
.grow { flex:1; }
.lang { display:flex; padding:2px; border:1px solid var(--line); border-radius:999px; background:var(--card); }
.lang button { font-size:12px; padding:4px 9px; border-radius:999px; color:var(--ink-3); }
.lang button[aria-pressed="true"] { background:var(--ink); color:var(--paper); }
.panel { position:absolute; top:56px; left:12px; width:min(560px, calc(100vw - 24px)); background:var(--card); border:1px solid var(--line); border-radius:18px; box-shadow:0 24px 60px -28px rgba(74,52,35,.45); padding:12px; display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:4px; }
.panel[hidden] { display:none; }
.panel a { display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; min-width:0; }
.panel a:hover, .panel a:focus-visible, .panel a[aria-current="page"] { background:rgba(204,160,106,.14); outline:none; }
.panel svg { width:36px; height:36px; flex:none; }
.panel b { display:block; font-size:13.5px; font-weight:600; }
.panel small { display:block; font-size:11.5px; color:var(--ink-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.panel .all { grid-column:1/-1; justify-content:center; font-size:13px; color:var(--gold-ink); padding:8px; }
button:focus-visible, a:focus-visible { outline:2px solid var(--gold-ink); outline-offset:2px; }
@media (max-width:640px) { .home span, .sep { display:none; } .panel { grid-template-columns:repeat(2, minmax(0,1fr)); } .switch span { display:none; } }
`;

class LiftBar extends HTMLElement {
  connectedCallback() {
    this.root = this.attachShadow({ mode: "open" });
    this.render();
    this.off = onLang(() => this.render());
    this.onDoc = (e) => { if (!this.contains(e.target) && !e.composedPath().includes(this)) this.toggle(false); };
    document.addEventListener("click", this.onDoc);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.toggle(false); });
  }
  disconnectedCallback() { this.off?.(); document.removeEventListener("click", this.onDoc); }
  toggle(open) {
    const p = this.root.querySelector(".panel"), b = this.root.querySelector(".switch");
    if (!p) return;
    p.hidden = !open; b.setAttribute("aria-expanded", String(open));
  }
  render() {
    const lang = getLang(), zh = lang === "zh", app = appByKey[this.getAttribute("app")];
    const home = SITE + (zh ? "/zh/" : "/");
    this.root.innerHTML = `<style>${CSS}</style>
      <div class="bar">
        <a class="home" href="${home}" aria-label="Lift Apps"><img src="/assets/mark.png" alt="" width="22" height="22" /><span>Lift Apps</span></a>
        ${app ? `<span class="sep"></span><span class="cur">${liftIcon(app.key, "bar")}<span>${app.word}<i>Lift</i></span></span>` : ""}
        <button class="switch" aria-expanded="false" aria-haspopup="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.6"/><circle cx="7" cy="2" r="1.6"/><circle cx="12" cy="2" r="1.6"/><circle cx="2" cy="7" r="1.6"/><circle cx="7" cy="7" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="2" cy="12" r="1.6"/><circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/></svg>
          <span>${zh ? "全部应用" : "All apps"}</span></button>
        <span class="grow"></span>
        <div class="lang" role="group" aria-label="Language">
          <button data-l="en" aria-pressed="${!zh}">EN</button><button data-l="zh" aria-pressed="${zh}">中文</button>
        </div>
      </div>
      <nav class="panel" hidden aria-label="${zh ? "Lift 应用" : "Lift apps"}">
        ${APPS.map((a) => `<a href="${href(a)}"${a.key === app?.key ? ' aria-current="page"' : ""}>${liftIcon(a.key, "sw")}<span><b>${a.word}<i>Lift</i></b><small>${a[lang].label}</small></span></a>`).join("")}
        <a class="all" href="${home}">liftapps.com.au →</a>
      </nav>`;
    this.root.querySelector(".switch").addEventListener("click", (e) => { e.stopPropagation(); this.toggle(this.root.querySelector(".panel").hidden); });
    this.root.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.l)));
  }
}
if (!customElements.get("lift-bar")) customElements.define("lift-bar", LiftBar);
