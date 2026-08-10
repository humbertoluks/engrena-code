import '@engrena/ui/fonts'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {
  applyThemeBoot,
  configureThemeStorageKey,
  initThemeStore,
} from '@engrena/ui'
import './index.css'

configureThemeStorageKey('engrenaplan:theme')
applyThemeBoot()
initThemeStore()

requestAnimationFrame(() => {
  document.documentElement.classList.remove('no-transitions')
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
