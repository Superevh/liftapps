import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../../shared/lift-shell.mjs'
import '../../../shared/lift-theme.css'
import './core/styles.css'
import { StoreProvider } from './core/store.jsx'
import App from './estimate/App.jsx'

// EstimateLift (估算): estimation sessions built around a backlog. Paste the stories, share one link,
// vote in private, reveal together, settle on numbers, check the plan against capacity, take a
// confidence vote, and export the result for Jira. Silent t-shirt sizing, a stand-alone confidence
// vote, function points and a methods guide with a PERT calculator sit under "Methods & tools".
// It has its own shell (estimate/App.jsx) instead of the kit's tool-card shell: the home page is the
// list of your sessions, and nobody is asked for a name before they need one.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider><App /></StoreProvider>
  </React.StrictMode>
)
