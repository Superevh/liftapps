import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../../shared/lift-shell.mjs'
import '../../../shared/lift-theme.css'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
