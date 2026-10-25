import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppCtx, useApp, go } from './app-context.js'
import { finishSignInRedirect, strandedSignIn, clearStrandedSignIn } from './backend.js'
import { Icon, Mark, ProviderMark } from './icons.jsx'
import { useLang, setLang } from './lang.js'
import { useTheme, setTheme } from './theme.js'
import { useT } from './i18n.js'

const Dashboard = lazy(() => import('./Dashboard.jsx'))
const Landing = lazy(() => import('./Landing.jsx'))
const Editor = lazy(() => import('./Editor.jsx'))
const Present = lazy(() => import('./Present.jsx'))
const ResultsPage = lazy(() => import('./ResultsPage.jsx'))
const Audience = lazy(() => import('./Audience.jsx'))

export { useApp, go }

// Hash routes. An 8-digit code (with or without a space) opens the audience view directly.
function parseRoute(hash) {
  const h = decodeURIComponent(hash.replace(/^#\/?/, ''))
  const [head, arg] = h.split('/')
  if (/^\d{4}\s?\d{4}$/.test(head)) return { name: 'audience', code: head.replace(/\D/g, '') }
  if (head === 'join' || head === 'v') return { name: 'audience', code: (arg ?? '').replace(/\D/g, '') }
  if (head === 'edit' && arg) return { name: 'edit', id: arg }
  if (head === 'present' && arg) return { name: 'present', id: arg }
  if (head === 'results' && arg) return { name: 'results', id: arg }
  return { name: 'home' }
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    // ?c=12345678 (from a QR code or a printed link) becomes the audience route.
    const c = new URLSearchParams(window.location.search).get('c')
    if (c) {
      window.history.replaceState(null, '', window.location.pathname + `#/${c.replace(/\D/g, '')}`)
      setRoute(parseRoute(window.location.hash))
    }
    const on = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export default function App({ api }) {
  const route = useRoute()
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)
  const t = useT()

  const toast = useCallback(msg => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200)
  }, [])

  const [authError, setAuthError] = useState(null)
  useEffect(() => api.auth.onChange((u, event) => {
    setUser(u)
    setAuthReady(true)
    if (u) { setAuthOpen(false); setAuthError(null); clearStrandedSignIn() }
    if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    const back = finishSignInRedirect()
    // Coming back from Google / GitHub / an email link with an error: reopen sign-in and explain it there.
    if (back && !u) { setAuthError(back); setAuthOpen(true) }
  }), [api]) // eslint-disable-line react-hooks/exhaustive-deps
  // Came back with ?code=… but no session could be made from it (e.g. the link was opened in another browser).
  useEffect(() => {
    api.auth.redirectResult?.().then(r => { if (r) { setAuthError(r); setAuthOpen(true) } }, () => {})
  }, [api])

  const ctx = useMemo(() => ({ api, user, authReady, openSignIn: () => setAuthOpen(true), toast, go }), [api, user, authReady, toast])

  // Presenting and voting are full-screen experiences without the site chrome (the audience view keeps its own EN/中文, wired to the family switch).
  const bare = route.name === 'present' || route.name === 'audience'
  let page
  if (route.name === 'audience') page = <Audience code={route.code} />
  else if (route.name === 'present') page = <Gate><Present id={route.id} /></Gate>
  else if (route.name === 'edit') page = <Gate><Editor id={route.id} /></Gate>
  else if (route.name === 'results') page = <Gate><ResultsPage id={route.id} /></Gate>
  else page = !authReady ? <Spinner /> : user ? <Dashboard /> : <Landing />

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${bare ? 'bare' : ''}`}>
        {/* The Lift Apps family bar (app switcher + EN/中文). Hidden on the full-screen presenter and phone views. */}
        {!bare && <lift-bar app="vote"></lift-bar>}
        {!bare && <Topbar wide={route.name === 'edit'} />}
        <Suspense fallback={<Spinner />}>{page}</Suspense>
      </div>
      {authOpen && !user && <AuthModal initialError={authError} onClose={() => { setAuthOpen(false); setAuthError(null) }} />}
      {recovering && <RecoveryModal onDone={() => setRecovering(false)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  )
}

// Presenter pages need a signed-in owner.
function Gate({ children }) {
  const { user, authReady, openSignIn } = useApp()
  const t = useT()
  if (!authReady) return <Spinner />
  if (!user) return (
    <div className="page narrow center-page">
      <Mark h={56} />
      <h2>{t('signInTitle')}</h2>
      <p className="muted">{t('signInHint')}</p>
      <button className="btn primary" onClick={openSignIn}>{t('signIn')}</button>
    </div>
  )
  return children
}

export function Spinner({ label }) {
  const t = useT()
  return <div className="spinner-page" role="status"><span className="spinner" /> {label ?? t('loading')}</div>
}

export function Brand() {
  const t = useT()
  return <a className="brand" href="#/"><Mark h={30} /><span>Vote<b>Lift</b></span><span className="sr-only">{t('appName')}</span></a>
}

export function LangToggle() {
  const lang = useLang()
  return (
    <div className="lang-toggle" role="group" aria-label="Language / 语言">
      <button className={lang === 'zh' ? 'on' : ''} aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>中文</button>
      <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
    </div>
  )
}

export function ThemeToggle() {
  const theme = useTheme()
  const t = useT()
  const dark = theme === 'dark'
  return (
    <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} title={t(dark ? 'lightTheme' : 'darkTheme')} aria-label={t(dark ? 'lightTheme' : 'darkTheme')}>
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}

function Topbar({ wide }) {
  const { user, openSignIn, api } = useApp()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const on = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  return (
    <header className={`topbar ${wide ? 'wide' : ''}`}>
      <Brand />
      {user && <a className="top-link" href="#/"><Icon name="grid" /> <span className="lbl">{t('myPresentations')}</span></a>}
      <span className="spacer" />
      <a className="top-link" href="#/join"><Icon name="users" /> <span className="lbl">{t('joinCode')}</span></a>
      <ThemeToggle />
      {user ? (
        <div className="dropdown" ref={ref}>
          <button className="user-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <span className="avatar" style={{ width: 30, height: 30, background: 'var(--bronze)' }}>{name.slice(0, 1).toUpperCase()}</span>
          </button>
          {open && (
            <div className="menu right">
              <div className="menu-title">{user.email}</div>
              <button className="menu-item" onClick={() => { setOpen(false); api.auth.signOut() }}><Icon name="logout" /> {t('signOut')}</button>
            </div>
          )}
        </div>
      ) : <button className="btn primary sm" onClick={openSignIn}>{t('signIn')}</button>}
    </header>
  )
}

// Turn a Supabase auth error (code, status, message) into a clear sentence in the current language.
export function authMessage(e, t) {
  const code = e?.code || '', msg = String(e?.message ?? e ?? ''), status = e?.status || 0
  const has = re => re.test(msg)
  if (code === 'invalid_credentials' || has(/invalid login credentials/i)) return t('errCredentials')
  if (code === 'email_not_confirmed' || has(/email not confirmed/i)) return t('errNotConfirmed')
  if (code === 'user_already_exists' || code === 'email_exists' || has(/already registered|already exists/i)) return t('errExists')
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429 || has(/rate limit|only request this after/i)) return t('errRateLimit')
  if (code === 'email_address_not_authorized' || has(/not authorized/i)) return t('errEmailNotAuthorized')
  if (has(/error sending .*email|sending (confirmation|magic link|recovery)/i) || status === 500 && has(/email/i)) return t('errEmailSend')
  if (code === 'signup_disabled' || has(/signups? not allowed/i)) return t('errSignupDisabled')
  if (code === 'email_provider_disabled' || has(/email logins are disabled/i)) return t('errEmailDisabled')
  if (code === 'provider_disabled' || has(/provider is not enabled|unsupported provider/i)) return t('errProviderDisabled')
  if (code === 'weak_password' || has(/password should be/i)) return t('passwordPh')
  if (code === 'email_address_invalid' || has(/invalid.*email|email.*invalid/i)) return t('errEmailInvalid')
  if (code === 'otp_expired' || has(/expired|invalid.*link/i)) return t('errLinkExpired')
  if (/flow_state|code_verifier|bad_code_verifier/.test(code) || has(/flow state|code verifier/i)) return t('errOtherBrowser')
  if (code === 'access_denied' || has(/access.?denied|cancel/i)) return t('errCancelled')
  if (has(/failed to fetch|network|load failed/i)) return t('errNetwork')
  return t('signInFailed', { e: msg || code || '?' })
}

function AuthModal({ onClose, initialError }) {
  const { api: { auth } } = useApp()
  const t = useT()
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(() => (initialError ? { text: authMessage(initialError, t), code: initialError.code } : null))
  const [cfg, setCfg] = useState(null)
  const [stranded] = useState(() => { const m = strandedSignIn(); clearStrandedSignIn(); return m })
  useEffect(() => { let on = true; auth.settings?.().then(c => { if (on) setCfg(c) }); return () => { on = false } }, [auth])
  const fail = e => setError({ text: authMessage(e, t), code: e?.code || (/email not confirmed/i.test(e?.message) ? 'email_not_confirmed' : '') })
  const run = (key, fn) => { setBusy(key); setError(null); return fn().then(() => setBusy(null), e => { fail(e); setBusy(null) }) }
  const to = email.trim()
  const available = p => !cfg || cfg.providers[p] !== false
  const emailOn = !cfg || cfg.providers.email
  const signupOn = !cfg || !cfg.signupDisabled
  const send = e => { e.preventDefault(); if (to) run('email', () => auth.sendLink(to).then(() => { if (!auth.local) setNotice({ text: t('linkSent', { email: to }) }) })) }
  const signIn = e => { e.preventDefault(); if (to && (password || auth.local)) run('password', () => auth.signInPassword(to, password)) }
  const signUp = () => {
    if (!to) return setError({ text: t('enterEmailFirst') })
    if (password.length < 6 && !auth.local) return setError({ text: t('passwordPh') })
    run('signup', () => auth.signUp(to, password).then(r => {
      if (r === 'exists') setError({ text: t('errExists') })
      else if (r === 'confirm' || r === true) setNotice({ text: t('confirmSent', { email: to }), resend: true })
    }))
  }
  const resend = () => {
    if (!to) return setError({ text: t('enterEmailFirst') })
    run('resend', () => auth.resendConfirmation(to).then(() => setNotice({ text: t('confirmResent', { email: to }) })))
  }
  const forgot = () => {
    if (!to) return setError({ text: t('enterEmailFirst') })
    run('reset', () => auth.resetPassword(to).then(() => setNotice({ text: t('resetSent', { email: to }) })))
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const providerBtn = (p, label) => available(p)
    ? <button className="btn auth-btn" disabled={!!busy} onClick={() => run(p, () => auth.signIn(p))}><ProviderMark name={p} /> {label}</button>
    : <button className="btn auth-btn" disabled title={t('providerOff')}><ProviderMark name={p} /> {label}<span className="auth-off">{t('notAvailable')}</span></button>
  const unavailable = auth.providers.filter(p => !available(p))
  return (
    <div className="modal-backdrop auth-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-label={t('signInTitle')}>
        <button className="icon-btn modal-x" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
        <Mark className="welcome-mark" h={54} />
        <h2>{t('signInTitle')}</h2>
        <p className="muted">{t('signInHint')}</p>
        {auth.local && <p className="auth-sent"><Icon name="info" /> {t('localMode')}</p>}
        {stranded && !error && <p className="auth-note" role="status"><Icon name="info" /> {t('strandedNote', { p: stranded === 'github' ? 'GitHub' : 'Google' })}</p>}
        {auth.providers.length > 0 && <>
          <div className="auth-providers">
            {auth.providers.includes('google') && providerBtn('google', t('withGoogle'))}
            {auth.providers.includes('github') && providerBtn('github', t('withGithub'))}
          </div>
          {unavailable.length > 0 && <p className="auth-note small"><Icon name="info" /> {t('providerOff')}</p>}
          {emailOn && <div className="auth-or"><span>{t('orEmail')}</span></div>}
        </>}
        {!emailOn && !auth.local ? <p className="auth-note"><Icon name="info" /> {t('errEmailDisabled')}</p>
        : notice ? <>
          <p className="auth-sent" role="status"><Icon name="mail" /> {notice.text}</p>
          {notice.resend && <button type="button" className="link-btn small" disabled={!!busy} onClick={resend}>{t('resendConfirm')}</button>}
        </> : auth.local ? (
          <form className="auth-email" onSubmit={signIn}>
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPh')} aria-label="Email" />
            <button className="btn primary" disabled={!!busy || !to}>{t('signIn')}</button>
          </form>
        ) : <>
          <div className="seg auth-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'on' : ''} onClick={() => { setMode('password'); setError(null) }}>{t('tabPassword')}</button>
            <button role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => { setMode('link'); setError(null) }}>{t('tabLink')}</button>
          </div>
          {mode === 'link' ? (
            <form className="auth-email" onSubmit={send}>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPh')} aria-label="Email" />
              <button className="btn primary" disabled={!!busy || !to}><Icon name="mail" /> {t('sendLink')}</button>
              <p className="auth-hint">{t('linkHint')}</p>
            </form>
          ) : (
            <form className="auth-email" onSubmit={signIn}>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPh')} aria-label="Email" />
              <input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordPh')} aria-label={t('tabPassword')} />
              <button className="btn primary" disabled={!!busy || !to || !password}>{t('signIn')}</button>
              <div className="auth-row">
                {signupOn ? <button type="button" className="link-btn" disabled={!!busy} onClick={signUp}>{t('createAccount')}</button> : <span className="auth-hint">{t('errSignupDisabled')}</span>}
                <button type="button" className="link-btn muted-link" disabled={!!busy} onClick={forgot}>{t('forgotPassword')}</button>
              </div>
              {signupOn && cfg && !cfg.autoconfirm && <p className="auth-hint">{t('confirmHint')}</p>}
            </form>
          )}
        </>}
        {error && <p className="auth-error" role="alert">{error.text}</p>}
        {error?.code === 'email_not_confirmed' && <button type="button" className="link-btn small" disabled={!!busy} onClick={resend}>{t('resendConfirm')}</button>}
      </div>
    </div>
  )
}

// Opened from a password-reset email: the person is signed in and picks a new password.
function RecoveryModal({ onDone }) {
  const { api: { auth } } = useApp()
  const t = useT()
  const [password, setPassword] = useState('')
  const [state, setState] = useState(null) // null | 'busy' | 'done' | error message
  const save = e => {
    e.preventDefault()
    setState('busy')
    auth.updatePassword(password).then(() => setState('done'), err => setState(authMessage(err, t)))
  }
  return (
    <div className="modal-backdrop auth-backdrop">
      <form className="modal auth-modal" role="dialog" aria-modal="true" aria-label={t('newPasswordTitle')} onSubmit={save}>
        <Mark className="welcome-mark" h={54} />
        <h2>{t('newPasswordTitle')}</h2>
        {state === 'done' ? <>
          <p className="auth-sent" role="status"><Icon name="check" /> {t('passwordSaved')}</p>
          <div className="row end"><button type="button" className="btn primary" onClick={onDone}>{t('continue')}</button></div>
        </> : <>
          <p className="muted">{t('newPasswordHint')}</p>
          <div className="auth-email">
            <input type="password" required minLength={6} autoFocus autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordPh')} aria-label={t('tabPassword')} />
            <button className="btn primary" disabled={state === 'busy' || password.length < 6}>{t('savePassword')}</button>
          </div>
          {state && state !== 'busy' && <p className="auth-error" role="alert">{state}</p>}
        </>}
      </form>
    </div>
  )
}
