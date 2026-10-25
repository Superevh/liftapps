import { rpcApi } from './backend.js'

// VITE_BACKEND=local: talks to scripts/dev-server.mjs (the production live.sql in PGlite), which every
// browser and phone on the network shares through Vite's /dev-api proxy. Sign-in is password-less and
// keyed by email; Realtime broadcasts travel over Server-Sent Events.
const USER_KEY = 'livepolls-local-user'

export async function localBackend() {
  let user = null
  try { user = JSON.parse(localStorage.getItem(USER_KEY)) } catch { /* ignore */ }
  const listeners = new Set()
  const setUser = u => {
    user = u
    try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
    listeners.forEach(fn => fn(user, u ? 'SIGNED_IN' : 'SIGNED_OUT'))
  }
  window.addEventListener('storage', e => {
    if (e.key !== USER_KEY) return
    try { user = JSON.parse(e.newValue) } catch { user = null }
    listeners.forEach(fn => fn(user, user ? 'SIGNED_IN' : 'SIGNED_OUT'))
  })

  const post = async (path, value, headers = {}) => {
    const res = await fetch(`/dev-api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.message ?? res.statusText)
    return json
  }
  const call = (fn, args) => post(`/rpc/${fn}`, args, user ? { 'x-user': user.id } : {})

  const signInEmail = async email => {
    const u = await post('/users', { email })
    setUser({ id: u.id, email: u.email, user_metadata: { name: u.email.split('@')[0] } })
  }

  return {
    kind: 'local',
    ...rpcApi(call),
    auth: {
      providers: [],
      local: true,
      onChange(fn) {
        listeners.add(fn)
        fn(user, 'INITIAL_SESSION')
        return () => listeners.delete(fn)
      },
      signIn: () => Promise.reject(new Error('Social sign-in is not available in local mode')),
      sendLink: signInEmail,
      signInPassword: email => signInEmail(email),
      signUp: email => signInEmail(email).then(() => false),
      resetPassword: () => Promise.resolve(),
      updatePassword: () => Promise.resolve(),
      signOut: async () => setUser(null),
    },
    channel(id) {
      const handlers = {}
      const es = new EventSource(`/dev-api/live/live:${id}`)
      es.onopen = () => handlers.status?.forEach(fn => fn('SUBSCRIBED'))
      es.onerror = () => handlers.status?.forEach(fn => fn('CHANNEL_ERROR'))
      es.onmessage = e => {
        const { event, payload } = JSON.parse(e.data)
        handlers[event]?.forEach(fn => fn(payload))
      }
      return {
        on(event, fn) { (handlers[event] ??= []).push(fn); return this },
        send: (event, payload) => post(`/live/live:${id}`, { event, payload }).catch(() => {}),
        close: () => es.close(),
      }
    },
  }
}
