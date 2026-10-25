// Renders 1200×630 share images into site/assets/og/ (home + each app, EN and 中文) with local Chrome.
// Run after changing catalog copy: node tools/make-og.mjs   (images are committed; CI doesn't need Chrome)
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { APPS } from "../shared/catalog.mjs";
import { liftIcon } from "../shared/icons.mjs";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = join(tmpdir(), "lift-og"); mkdirSync(tmp, { recursive: true });
const logo = "file://" + resolve("site/assets/aiyun-mark.png");
const page = (icon, title, sub, line, zh) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;background:#FBF8F2;font-family:${zh ? '"PingFang SC",' : ""}Inter,"Helvetica Neue",sans-serif;color:#2B1E14;overflow:hidden;position:relative}
.g{position:absolute;inset:0;background:radial-gradient(600px 480px at 95% 0%,rgba(219,190,148,.6),transparent 70%),radial-gradient(420px 380px at 0% 100%,rgba(185,205,182,.4),transparent 70%)}
.w{position:relative;display:flex;gap:64px;align-items:center;padding:0 90px;height:100%}
.i svg{width:300px;height:300px;filter:drop-shadow(0 30px 40px rgba(106,71,45,.28))}
h1{font:900 96px/1.02 "Songti SC","Noto Serif SC",Georgia,serif;margin:0 0 14px;letter-spacing:-.01em}h1 span{color:#8C613A}
.s{font-size:30px;color:rgba(43,30,20,.6);margin-bottom:22px}.l{font-size:32px;line-height:1.4;color:rgba(43,30,20,.78);max-width:640px}
img{position:absolute;left:90px;bottom:48px;height:40px}.u{position:absolute;right:90px;bottom:56px;font-size:24px;color:#8C613A;letter-spacing:.04em}
</style><div class="g"></div><div class="w"><div class="i">${icon}</div><div><h1>${title}</h1><div class="s">${sub}</div><div class="l">${line}</div></div></div><img src="${logo}"><div class="u">liftapps.com.au</div>`;

const jobs = [];
for (const lang of ["en", "zh"]) {
  const zh = lang === "zh";
  jobs.push(["home", lang, page(liftIcon("retro"), 'Lift<span>Apps</span>', zh ? "AI云 Lift 系列" : "by AIYun", zh ? "从目标到复盘，九个工具托举你的团队。" : "From goals to retros, nine tools that lift your team.", zh)]);
  for (const a of APPS) jobs.push([a.key, lang, page(liftIcon(a.key), `${a.word}<span>Lift</span>`, a[lang].label, a[lang].line, zh)]);
}
mkdirSync("site/assets/og", { recursive: true });
for (const [key, lang, html] of jobs) {
  const f = join(tmp, `${key}-${lang}.html`); writeFileSync(f, html);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--window-size=1200,630", `--screenshot=${resolve(`site/assets/og/${key}-${lang}.png`)}`, "file://" + f], { stdio: "ignore" });
}
console.log(`og images: ${jobs.length}`);
