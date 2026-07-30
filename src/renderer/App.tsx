import { useEffect, useState } from 'react'
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

    // Listen for vault lock events
    if (window.electronAPI?.vault?.onLocked) {
      window.electronAPI.vault.onLocked(() => {
        localStorage.removeItem('sessionToken')
        setIsAuthenticated(false)
      })
    }
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">Inicializando...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">EngrenaCode</h1>
          <p className="text-xl text-slate-300 mb-8">IDE Local-First para Agentes de IA</p>
          <p className="text-slate-400">Dashboard em desenvolvimento...</p>
        </div>
      </main>
    </div>
  )
}

export default App
