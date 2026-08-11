import { useEffect, useState } from 'react'
import { LoginScreen } from '@engrena/ui'
import { ShellScreen } from './screens/ShellScreen'

function App(): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
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

    void checkAuth()

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
        <p className="text-muted">Inicializando EngrenaPlan...</p>
      </div>
    )
  }

  return isAuthenticated ? (
    <ShellScreen />
  ) : (
    <LoginScreen product="plan" onUnlock={() => setIsAuthenticated(true)} />
  )
}

export default App
