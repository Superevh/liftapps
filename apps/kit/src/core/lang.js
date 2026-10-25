import { useSyncExternalStore } from 'react'
import { getLang, onLang } from '../../../../shared/lift-shell.mjs'

// Language follows the shared Lift Apps bar (EN / 中文), stored family-wide as "lift-lang".
let current = getLang()
const listeners = new Set()
const apply = () => { document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en' }
apply()
onLang(l => {
  if (l !== 'zh' && l !== 'en') return
  current = l
  apply()
  listeners.forEach(fn => fn())
})

export function useLang() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => current)
}
export const lang = () => current
