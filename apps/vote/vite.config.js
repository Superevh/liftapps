import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// VITE_BACKEND=local talks to scripts/dev-server.mjs through the /dev-api proxy; every other build
// aliases the local client to a stub so production bundles never include it.
const local = process.env.VITE_BACKEND === 'local'
const src = p => fileURLToPath(new URL(`./src/${p}`, import.meta.url))
const siteAssets = fileURLToPath(new URL('../../site/assets/', import.meta.url))

// Dev server only. index.html carries the production CSP; Vite's dev server needs two relaxations:
//   script-src 'unsafe-inline' — @vitejs/plugin-react injects an inline React Refresh preamble;
//   connect-src ws: — the HMR websocket.
// Dev and preview also serve the family's /assets/* (favicon) from site/assets so nothing 404s locally.
function familyAssets(req, res, next) {
  const file = siteAssets + decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
  if (!file.startsWith(siteAssets) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
  res.setHeader('content-type', file.endsWith('.png') ? 'image/png' : 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}
function devServer() {
  return {
    name: 'votelift-dev',
    apply: 'serve',
    transformIndexHtml: html => html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'self'", "connect-src 'self' ws: wss:"),
    configureServer: server => { server.middlewares.use('/assets', familyAssets) },
    configurePreviewServer: server => { server.middlewares.use('/assets', familyAssets) },
  }
}

export default defineConfig({
  base: '/vote/app/',
  plugins: [react(), devServer()],
  resolve: { alias: { '@local-backend': src(local ? 'backend-local.js' : 'backend-local-off.js') } },
  build: { outDir: 'dist/vote/app', emptyOutDir: true },
  server: {
    port: 5302,
    fs: { allow: ['../..'] },
    proxy: { '/dev-api': `http://localhost:${process.env.DEV_API_PORT || 54302}` },
  },
  preview: { port: 5302 },
})
