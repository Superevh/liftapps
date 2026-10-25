import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// One anonymous identity per browser: a random id, a display name, a colour and an owner secret
// (used to delete documents this browser created). In mock mode it is kept per tab so two tabs
// can play two people.

export const uid = () => Math.random().toString(36).slice(2, 10)

// Document ids double as the share link, so they must be hard to guess (~80 bits).
export function newBoardId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, x => (x % 36).toString(36)).join('')
}

export const PARTICIPANT_COLORS = ['#8C613A', '#3E6E57', '#B0643F', '#6A472D', '#1F4A3B', '#A88445', '#5F8270', '#94472F']

const ID_KEY = 'lift-identity'
// Per-person storage: per tab in mock mode so two tabs can act as two people.
export const personalStorage = () => (import.meta.env.VITE_BACKEND === 'mock' ? sessionStorage : localStorage)
const store = personalStorage
const newIdentity = () => ({ id: uid() + uid(), name: '', color: PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)], secret: newBoardId() + newBoardId() })
function loadIdentity() {
  try {
    const saved = JSON.parse(store().getItem(ID_KEY))
    if (saved?.id && saved.secret) return saved
  } catch { /* storage blocked */ }
  const fresh = newIdentity()
  save(fresh)
  return fresh
}
function save(identity) {
  try { store().setItem(ID_KEY, JSON.stringify(identity)) } catch { /* storage blocked */ }
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [identity, setIdentity] = useState(loadIdentity)
  const rename = useCallback(name => {
    setIdentity(prev => { const next = { ...prev, name: name.trim().slice(0, 40) }; save(next); return next })
  }, [])
  const value = useMemo(() => ({ identity, rename, me: identity.id }), [identity, rename])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
