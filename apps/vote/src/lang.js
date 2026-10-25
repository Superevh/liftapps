import { useSyncExternalStore } from 'react'
import { getLang, setLang as setFamilyLang, onLang } from '../../../shared/lift-shell.mjs'

// Interface language follows the Lift Apps family switch (the EN/中文 in <lift-bar>, stored in
// localStorage "lift-lang"). Any in-app switch calls setLang, which tells the bar and every other listener.
let current = getLang()
const listeners = new Set()
// Lets CSS pick the Chinese fonts via :lang(zh).
const apply = () => { document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en' }
onLang(l => {
  current = l === 'zh' ? 'zh' : 'en'
  apply()
  listeners.forEach(fn => fn())
})

export function setLang(l) { setFamilyLang(l) }

export function useLang() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => current)
}
