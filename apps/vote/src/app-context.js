import { createContext, useContext } from 'react'

// Shared app context: { api, user, authReady, openSignIn(), toast(msg), go(path) }.
// Kept out of App.jsx so hot reloads of App never create a second context object.
export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)
export const go = path => { window.location.hash = path }

// The app lives under Vite's base (/vote/app/), so links and QR codes are derived from the current
// location: https://liftapps.com.au/vote/app/#/12345678 in production, the dev server locally.
export const BASE = import.meta.env.BASE_URL
export const appUrl = () => window.location.origin + BASE
export const joinUrl = code => `${appUrl()}#/${code}`
// What the presenter reads out: "liftapps.com.au/vote/app".
export const joinHost = () => (window.location.host + BASE).replace(/\/$/, '')
