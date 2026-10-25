import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const page = p => fileURLToPath(new URL(p, import.meta.url))

// The pages carry a strict Content-Security-Policy. The dev server needs inline scripts (React
// refresh) and a websocket (HMR), so the policy is dropped while serving and kept in the build.
const devCsp = {
  name: 'lift-dev-csp',
  apply: 'serve',
  transformIndexHtml: html => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
}

export default defineConfig({
  root,
  base: '/',
  plugins: [react(), devCsp],
  server: { port: 5301, fs: { allow: ['../..'] } },
  preview: { port: 5301 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        estimate: page('estimate/app/index.html'),
        meeting: page('meeting/app/index.html'),
        pulse: page('pulse/app/index.html'),
      },
    },
  },
})
