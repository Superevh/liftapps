import { useSyncExternalStore } from 'react'

// Light (ivory paper) or warm-dark theme. Stored per browser; light is the default look.
const KEY = 'livepolls-theme'
const listeners = new Set()

function read() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

let current = read()
const apply = () => { document.documentElement.dataset.theme = current }
apply()

export function setTheme(t) {
  current = t
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  apply()
  listeners.forEach(fn => fn())
}

export function useTheme() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => current)
}
