import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../../../shared/lift-shell.mjs'
import '../../../../shared/lift-theme.css'
import './styles.css'
import { StoreProvider } from './store.jsx'
import { AppShell } from './ui.jsx'

export function boot(app) {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <StoreProvider><AppShell app={app} /></StoreProvider>
    </React.StrictMode>
  )
}
