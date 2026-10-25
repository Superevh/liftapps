// Full build: pre-render the site into dist/, then build every app in apps/* and merge its output.
// Each app's Vite build writes dist/<key>/app/ (apps/kit writes estimate, meeting and pulse).
// Run: node tools/build-all.mjs   (CI runs the same command; see .github/workflows/pages.yml)
import { execSync } from "node:child_process";
import { readdirSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit", env: process.env });
run("node tools/build-site.mjs dist", ".");
for (const name of readdirSync("apps")) {
  const dir = join("apps", name);
  if (!existsSync(join(dir, "package.json"))) continue;
  console.log(`\n▸ building apps/${name}`);
  if (!existsSync(join(dir, "node_modules"))) run(existsSync(join(dir, "package-lock.json")) ? "npm ci" : "npm install", dir);
  run("npm run build", dir);
  cpSync(join(dir, "dist"), "dist", { recursive: true });
}
console.log("\n✓ dist/ ready");
