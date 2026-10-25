import { defineConfig } from "vite";

// Plain esbuild JSX (no React plugin) keeps the dev server free of inline scripts, so the strict CSP works in dev too.
export default defineConfig({
  base: "/goal/app/",
  esbuild: { jsx: "automatic" },
  build: { outDir: "dist/goal/app", emptyOutDir: true },
  server: { port: 5306, fs: { allow: ["../.."] } },
  preview: { port: 5306 },
});
