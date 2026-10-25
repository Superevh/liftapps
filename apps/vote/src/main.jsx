import { createRoot } from 'react-dom/client'
import '../../../shared/lift-shell.mjs'
import '../../../shared/lift-theme.css'
import { createBackend } from './backend.js'
import App from './App.jsx'
import './styles.css'

// Windows renders Inter softly; styles.css switches to Segoe UI there (was an inline script, moved here for the CSP).
if (/win/i.test(navigator.userAgentData?.platform || navigator.platform || '')) document.documentElement.classList.add('os-win')

const root = createRoot(document.getElementById('root'))
createBackend().then(
  api => root.render(<App api={api} />),
  e => root.render(<div className="spinner-page" role="alert">Could not start: {e.message}</div>),
)
