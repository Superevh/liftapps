import { createClient } from '@supabase/supabase-js'

// One interface over two servers:
//   supabase — production: the shared Supabase project (live_* tables) with supabase/live.sql applied.
//   local    — development (VITE_BACKEND=local): the same live.sql running in PGlite inside the
//              browser, shared by every tab of this origin, with BroadcastChannel standing in for Realtime.
//
// Presenter (signed in):  list, create, get, save, remove, duplicate, setState, reset, results, moderate, exportData
// Audience (anonymous):   join, poll, respond, ask, upvote, questions, audienceResults, myQuiz, react
// Realtime:               channel(id) -> { on(event, fn), send(event, payload), close() }
// Auth:                   auth.onChange(fn(user|null)), signIn(provider), sendLink, signInPassword, signUp,
//                         resetPassword, updatePassword, signOut, providers
export async function createBackend() {
  const env = import.meta.env
  if (env.VITE_BACKEND === 'local') {
    const { localBackend } = await import('@local-backend')
    return localBackend()
  }
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return supabaseBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  throw new Error('No backend configured: set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, or VITE_BACKEND=local')
}

// The RPC surface shared by both servers; `call(fn, args)` runs one Postgres function.
export function rpcApi(call) {
  return {
    list: () => call('live_list', {}),
    create: ({ title, slides, settings = {}, template = '' }) => call('live_create', { p_title: title, p_slides: slides, p_settings: settings, p_template: template }),
    get: id => call('live_get', { p_id: id }),
    save: (id, { title, slides, settings }) => call('live_save', { p_id: id, p_title: title, p_slides: slides, p_settings: settings }),
    remove: id => call('live_delete', { p_id: id }),
    duplicate: (id, title) => call('live_duplicate', { p_id: id, p_title: title }),
    setState: (id, patch) => call('live_set_state', { p_id: id, p_patch: patch }),
    reset: id => call('live_reset', { p_id: id }),
    results: (id, slide, after = 0, reactionAfter = 0) => call('live_results', { p_id: id, p_slide: slide, p_after: after, p_reaction_after: reactionAfter }),
    moderate: (id, question, action) => call('live_moderate', { p_id: id, p_question: question, p_action: action }),
    exportData: (id, session = null) => call('live_export', { p_id: id, p_session: session }),

    join: (code, voter, name = '') => call('live_join', { p_code: code, p_voter: voter, p_name: name }),
    poll: (id, voter) => call('live_poll', { p_id: id, p_voter: voter }),
    respond: (id, voter, slide, value) => call('live_respond', { p_id: id, p_voter: voter, p_slide: slide, p_value: value }),
    ask: (id, voter, slide, text) => call('live_ask', { p_id: id, p_voter: voter, p_slide: slide, p_text: text }),
    upvote: (id, voter, question) => call('live_upvote', { p_id: id, p_voter: voter, p_question: question }),
    questions: (id, slide, voter) => call('live_questions_public', { p_id: id, p_slide: slide, p_voter: voter }),
    audienceResults: (id, slide) => call('live_audience_results', { p_id: id, p_slide: slide }),
    myQuiz: (id, voter) => call('live_my_quiz', { p_id: id, p_voter: voter }),
    react: (id, voter, kind) => call('live_react', { p_id: id, p_voter: voter, p_kind: kind }),
  }
}

// Postgres errors come back as "message"; keep only the human part.
export const cleanError = e => String(e?.message ?? e).replace(/^.*?ERROR:\s*/, '')

function supabaseBackend(url, key) {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'livepolls-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  const call = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data
  }
  const returnUrl = () => {
    try { localStorage.setItem(RETURN_KEY, window.location.hash) } catch { /* ignore */ }
    return window.location.origin + import.meta.env.BASE_URL
  }
  const ok = ({ error }) => { if (error) throw new Error(error.message) }
  return {
    kind: 'supabase',
    ...rpcApi(call),
    auth: {
      providers: (import.meta.env.VITE_AUTH_PROVIDERS ?? '').split(',').map(x => x.trim()).filter(Boolean),
      onChange(fn) {
        const { data } = sb.auth.onAuthStateChange((event, session) => fn(session?.user ?? null, event))
        return () => data.subscription.unsubscribe()
      },
      signIn: provider => sb.auth.signInWithOAuth({ provider, options: { redirectTo: returnUrl() } }).then(ok),
      sendLink: email => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: returnUrl() } }).then(ok),
      signInPassword: (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok),
      // Resolves to true when the address still has to be confirmed from the email Supabase sends.
      signUp: (email, password) => sb.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } })
        .then(({ data, error }) => { if (error) throw new Error(error.message); return !data.session }),
      resetPassword: email => sb.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }).then(ok),
      updatePassword: password => sb.auth.updateUser({ password }).then(ok),
      signOut: () => sb.auth.signOut({ scope: 'local' }).then(ok),
    },
    // Presenter → audience control messages. The audience never sends on this channel, so each
    // presenter action costs one message per connected phone, and votes cost no Realtime messages.
    channel(id) {
      const handlers = {}
      const ch = sb.channel(`live:${id}`, { config: { broadcast: { self: false, ack: false } } })
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => handlers[event]?.forEach(fn => fn(payload)))
      let joined = false
      const ready = []
      ch.subscribe(status => {
        joined = status === 'SUBSCRIBED'
        handlers.status?.forEach(fn => fn(status))
        if (joined) ready.splice(0).forEach(fn => fn())
      })
      return {
        on(event, fn) { (handlers[event] ??= []).push(fn); return this },
        send: (event, payload) => (joined ? ch.send({ type: 'broadcast', event, payload }) : ch.httpSend(event, payload)).catch(() => {}),
        close: () => sb.removeChannel(ch),
      }
    },
  }
}

// Sign-in providers send people back to the site root; the page they were on is restored afterwards.
const RETURN_KEY = 'livepolls-return'
export function finishSignInRedirect() {
  const q = new URLSearchParams(window.location.search)
  const hashQ = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = q.get('error_description') || hashQ.get('error_description')
  if (!q.has('code') && !error) return null
  let back = ''
  try { back = localStorage.getItem(RETURN_KEY) || ''; localStorage.removeItem(RETURN_KEY) } catch { /* ignore */ }
  window.history.replaceState(null, '', window.location.pathname + (back.startsWith('#/') ? back : '#/'))
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  return error
}

// The audience's anonymous id: random, kept in this browser so a refresh keeps your votes.
export function voterId() {
  const KEY = 'livepolls-voter'
  try {
    let v = localStorage.getItem(KEY)
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(KEY, v) }
    return v
  } catch {
    return (window.__voter ??= crypto.randomUUID())
  }
}
