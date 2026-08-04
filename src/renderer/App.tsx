import { useEffect, useState } from 'react'
import { ThemeControl } from './components/ThemeControl'
import { LoginScreen } from './screens/LoginScreen'
import { ConfiguracaoScreen } from './screens/ConfiguracaoScreen'
import { SubagentsScreen } from './screens/SubagentsScreen'

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#dashboard')

  useEffect(() => {
    const handler = (): void => setHash(window.location.hash || '#dashboard')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return hash
}

const NAV_LINK_BASE = 'text-[13px] font-medium transition-colors hover:text-fg'
const NAV_LINK_ACTIVE = 'text-fg'
const NAV_LINK_INACTIVE = 'text-muted'

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <a
      href={href}
      className={`${NAV_LINK_BASE} ${active ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </a>
  )
}

function DashboardPlaceholder(): React.ReactElement {
  return (
    <main className="flex h-[calc(100vh-57px)] items-center justify-center p-lg">
      <div className="w-full max-w-[28rem] rounded-lg border border-border bg-surface p-lg text-center">
        <h1 className="mb-sm font-display text-[26px] font-bold tracking-tight">EngrenaCode</h1>
        <p className="mb-md text-muted">IDE Local-First para Agentes de IA</p>
        <p className="text-[13px] text-muted">Dashboard em desenvolvimento...</p>
      </div>
    </main>
  )
}

function AuthenticatedApp(): React.ReactElement {
  const hash = useHash()

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
        <span className="font-display text-[15px] font-semibold tracking-tight">EngrenaCode</span>
        <nav className="flex items-center gap-md" aria-label="Navegação principal">
          <NavLink href="#dashboard" active={hash === '#dashboard' || hash === ''}>
            Dashboard
          </NavLink>
          <NavLink href="#configuracao" active={hash === '#configuracao'}>
            Configuração
          </NavLink>
          <NavLink href="#subagents" active={hash === '#subagents'}>
            SubAgents
          </NavLink>
        </nav>
        <ThemeControl />
      </header>
      <main className="h-[calc(100vh-57px)] overflow-y-auto">
        {hash === '#configuracao' ? (
          <ConfiguracaoScreen />
        ) : hash === '#subagents' ? (
          <SubagentsScreen />
        ) : (
          <DashboardPlaceholder />
        )}
      </main>
    </div>
  )
}

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
        <p className="text-muted">Inicializando...</p>
      </div>
    )
  }

  return isAuthenticated ? (
    <AuthenticatedApp />
  ) : (
    <LoginScreen onUnlock={() => setIsAuthenticated(true)} />
  )
}

export default App
