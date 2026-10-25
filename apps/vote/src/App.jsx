import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppCtx, useApp, go } from './app-context.js'
import { finishSignInRedirect } from './backend.js'
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

  useEffect(() => api.auth.onChange((u, event) => {
    setUser(u)
    setAuthReady(true)
    if (u) setAuthOpen(false)
    if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    const err = finishSignInRedirect()
    if (err) toast(t('signInFailed', { e: err }))
  }), [api]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {authOpen && !user && <AuthModal onClose={() => setAuthOpen(false)} />}
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

function AuthModal({ onClose }) {
  const { api: { auth } } = useApp()
  const t = useT()
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const run = (key, fn) => { setBusy(key); setError(null); return fn().then(() => setBusy(null), e => { setError(t('signInFailed', { e: e.message })); setBusy(null) }) }
  const to = email.trim()
  const send = e => { e.preventDefault(); if (to) run('email', () => auth.sendLink(to).then(() => { if (!auth.local) setNotice(t('linkSent', { email: to })) })) }
  const signIn = e => { e.preventDefault(); if (to && (password || auth.local)) run('password', () => auth.signInPassword(to, password)) }
  const signUp = () => {
    if (!to) return setError(t('enterEmailFirst'))
    if (password.length < 6 && !auth.local) return setError(t('passwordPh'))
    run('signup', () => auth.signUp(to, password).then(confirm => { if (confirm) setNotice(t('confirmSent', { email: to })) }))
  }
  const forgot = () => {
    if (!to) return setError(t('enterEmailFirst'))
    run('reset', () => auth.resetPassword(to).then(() => setNotice(t('resetSent', { email: to }))))
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop auth-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-label={t('signInTitle')}>
        <button className="icon-btn modal-x" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
        <Mark className="welcome-mark" h={54} />
        <h2>{t('signInTitle')}</h2>
        <p className="muted">{t('signInHint')}</p>
        {auth.local && <p className="auth-sent"><Icon name="info" /> {t('localMode')}</p>}
        {auth.providers.length > 0 && <>
          <div className="auth-providers">
            {auth.providers.includes('google') && <button className="btn auth-btn" disabled={!!busy} onClick={() => run('google', () => auth.signIn('google'))}><ProviderMark name="google" /> {t('withGoogle')}</button>}
            {auth.providers.includes('github') && <button className="btn auth-btn" disabled={!!busy} onClick={() => run('github', () => auth.signIn('github'))}><ProviderMark name="github" /> {t('withGithub')}</button>}
          </div>
          <div className="auth-or"><span>{t('orEmail')}</span></div>
        </>}
        {notice ? <p className="auth-sent" role="status"><Icon name="mail" /> {notice}</p> : auth.local ? (
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
            </form>
          ) : (
            <form className="auth-email" onSubmit={signIn}>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPh')} aria-label="Email" />
              <input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordPh')} aria-label={t('tabPassword')} />
              <button className="btn primary" disabled={!!busy || !to || !password}>{t('signIn')}</button>
              <div className="auth-row">
                <button type="button" className="link-btn" disabled={!!busy} onClick={signUp}>{t('createAccount')}</button>
                <button type="button" className="link-btn muted-link" disabled={!!busy} onClick={forgot}>{t('forgotPassword')}</button>
              </div>
            </form>
          )}
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}
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
    auth.updatePassword(password).then(() => setState('done'), err => setState(err.message))
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
          {state && state !== 'busy' && <p className="auth-error" role="alert">{t('signInFailed', { e: state })}</p>}
        </>}
      </form>
    </div>
  )
}
