import { useEffect, useState } from 'react'
import { ThemeControl } from './components/ThemeControl'
import { LoginScreen } from './screens/LoginScreen'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('sessionToken')
        if (token && window.electronAPI?.vault) {
          const isLocked = await window.electronAPI.vault.isLocked()
          setIsAuthenticated(!isLocked)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()

    if (window.electronAPI?.vault?.onLocked) {
      window.electronAPI.vault.onLocked(() => {
        localStorage.removeItem('sessionToken')
        setIsAuthenticated(false)
      })
    }
  }, [])

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
        <p className="text-muted">Inicializando...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onUnlock={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
        <span className="font-display text-[15px] font-semibold tracking-tight">
          EngrenaCode
        </span>
        <ThemeControl />
      </header>
      <main className="flex h-[calc(100vh-57px)] items-center justify-center p-lg">
        <div className="w-full max-w-[28rem] rounded-lg border border-border bg-surface p-lg text-center">
          <h1 className="mb-sm font-display text-[26px] font-bold tracking-tight">
            EngrenaCode
          </h1>
          <p className="mb-md text-muted">IDE Local-First para Agentes de IA</p>
          <p className="text-[13px] text-muted">Dashboard em desenvolvimento...</p>
        </div>
      </main>
    </div>
  )
}

export default App
