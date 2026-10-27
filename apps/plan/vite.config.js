import { defineConfig } from 'vite'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const siteAssets = fileURLToPath(new URL('../../site/assets/', import.meta.url))

// Serves the family's /assets/* (favicon, mark) from site/assets so nothing 404s locally.
function assets(req, res, next) {
  const file = siteAssets + decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
  if (!file.startsWith(siteAssets) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
  res.setHeader('content-type', file.endsWith('.png') ? 'image/png' : 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}

// index.html carries the production CSP. Plain esbuild JSX (no React Refresh preamble) keeps script-src strict
// in dev too; only the HMR websocket needs connect-src ws: on the dev server.
function local() {
  return {
    name: 'lift-local',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => (ctx.server ? html.replace("connect-src 'self'", "connect-src 'self' ws: wss:") : html),
    },
    configureServer(server) { server.middlewares.use('/assets', assets) },
    configurePreviewServer(server) { server.middlewares.use('/assets', assets) },
  }
}

export default defineConfig({
  base: '/plan/app/',
  esbuild: { jsx: 'automatic' },
  plugins: [local()],
  // shared/cloud imports react and supabase-js; resolve them from this app's node_modules.
  resolve: { dedupe: ['react', 'react-dom', '@supabase/supabase-js'] },
  build: { outDir: 'dist/plan/app', emptyOutDir: true },
  server: { port: 5304, fs: { allow: ['../..'] } },
  preview: { port: 5304 },
})
