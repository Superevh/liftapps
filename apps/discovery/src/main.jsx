import { createRoot } from 'react-dom/client'
import '../../../shared/lift-shell.mjs'
import '../../../shared/lift-theme.css'
import { StoreProvider } from './store.jsx'
import App from './App.jsx'
import './styles.css'

// No StrictMode: its doubled effects in development would upload a first-visit workspace twice.
createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>
)
