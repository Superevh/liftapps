import { useSyncExternalStore } from 'react'
import { getLang, onLang } from '../../../shared/lift-shell.mjs'
import { ZH } from './i18n.js'

// Interface language follows the Lift Apps family switch (EN / 中文 in <lift-bar>, stored in "lift-lang").
let current = getLang() === 'zh' ? 'zh' : 'en'
const listeners = new Set()
const apply = () => { document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en' }
onLang(l => {
  current = l === 'zh' ? 'zh' : 'en'
  apply()
  listeners.forEach(fn => fn())
})

export const currentLang = () => current

// English text is the key. Chinese comes from the ZH table; missing entries fall back to English.
export function translate(lang, text, vars) {
  let s = lang === 'zh' ? (ZH[text] ?? text) : text
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function useLang() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => current)
}

export function useT() {
  const lang = useLang()
  const t = (text, vars) => translate(lang, text, vars)
  t.lang = lang
  return t
}
