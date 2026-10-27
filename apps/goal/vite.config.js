import { defineConfig } from "vite";

// Plain esbuild JSX (no React plugin) keeps the dev server free of inline scripts, so the strict CSP works in dev too.
export default defineConfig({
  base: "/goal/app/",
  esbuild: { jsx: "automatic" },
  // shared/cloud imports react and supabase-js; resolve them from this app's node_modules.
  resolve: { dedupe: ["react", "react-dom", "@supabase/supabase-js"] },
  build: { outDir: "dist/goal/app", emptyOutDir: true },
  server: { port: 5306, fs: { allow: ["../.."] } },
  preview: { port: 5306 },
});
