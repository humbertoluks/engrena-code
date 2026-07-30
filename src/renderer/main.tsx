import '@fontsource-variable/dm-sans'
import '@fontsource-variable/figtree'
import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyThemeBoot, initThemeStore } from './hooks/useTheme'
import './index.css'

applyThemeBoot()
initThemeStore()

requestAnimationFrame(() => {
  document.documentElement.classList.remove('no-transitions')
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
