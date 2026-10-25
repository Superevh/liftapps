// Remembers the chosen language (shared with the apps' top bar) and sends first-time Chinese browsers to /zh/.
(() => {
  const KEY = "lift-lang";
  const isZh = location.pathname === "/zh" || location.pathname.startsWith("/zh/");
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!saved && !isZh && (navigator.language || "").toLowerCase().startsWith("zh") && !location.pathname.endsWith("404.html")) {
    location.replace("/zh" + location.pathname + location.hash);
    return;
  }
  try { localStorage.setItem(KEY, isZh ? "zh" : "en"); } catch { /* storage blocked */ }
  document.querySelectorAll("a[data-lang]").forEach((a) => a.addEventListener("click", () => {
    try { localStorage.setItem(KEY, a.dataset.lang); } catch { /* storage blocked */ }
  }));
})();
