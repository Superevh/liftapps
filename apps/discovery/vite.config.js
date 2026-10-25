import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const siteAssets = fileURLToPath(new URL('../../site/assets/', import.meta.url))

// index.html carries the production CSP. While serving, Vite needs an inline React Refresh preamble
// and the HMR websocket, so the dev server relaxes those two directives. It also serves the family's
// /assets/* (favicon) from site/assets so nothing 404s locally (dev and preview).
function liftDev() {
  const serveAssets = server => {
    server.middlewares.use('/assets', (req, res, next) => {
      const file = siteAssets + decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
      if (!file.startsWith(siteAssets) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
      res.setHeader('content-type', file.endsWith('.png') ? 'image/png' : 'application/octet-stream')
      fs.createReadStream(file).pipe(res)
    })
  }
  return {
    name: 'discoverylift-dev',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => (ctx.server ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'self'", "connect-src 'self' ws: wss:") : html),
    },
    configureServer: serveAssets,
    configurePreviewServer: serveAssets,
  }
}

export default defineConfig({
  base: '/discovery/app/',
  plugins: [react(), liftDev()],
  build: { outDir: 'dist/discovery/app', emptyOutDir: true },
  server: { port: 5305, fs: { allow: ['../..'] } },
  preview: { port: 5305 },
})
