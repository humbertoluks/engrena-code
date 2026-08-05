import { useEffect, useState } from 'react'
import { ThemeControl } from './components/ThemeControl'
import { LoginScreen } from './screens/LoginScreen'
import { ConfiguracaoScreen } from './screens/ConfiguracaoScreen'
import { SubagentsScreen } from './screens/SubagentsScreen'
import { SkillsScreen } from './screens/SkillsScreen'
import { RulesScreen } from './screens/RulesScreen'
import { McpsScreen } from './screens/McpsScreen'
import { RegistrosScreen } from './screens/RegistrosScreen'
import { ConsumoScreen } from './screens/ConsumoScreen'
import { PrincipalScreen } from './screens/PrincipalScreen'
import { DashboardScreen } from './screens/DashboardScreen'

/** Rota sem query string (ex.: "#principal?project=x" → "#principal") — deep-links usam a query. */
function useHash(): string {
  const [hash, setHash] = useState(() => (window.location.hash || '#dashboard').split('?')[0])

  useEffect(() => {
    const handler = (): void => setHash((window.location.hash || '#dashboard').split('?')[0])
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
          <NavLink href="#principal" active={hash === '#principal'}>
            Workspace
          </NavLink>
          <NavLink href="#configuracao" active={hash === '#configuracao'}>
            Configuração
          </NavLink>
          <NavLink href="#subagents" active={hash === '#subagents'}>
            SubAgents
          </NavLink>
          <NavLink href="#skills" active={hash === '#skills'}>
            Skills
          </NavLink>
          <NavLink href="#rules" active={hash === '#rules'}>
            Rules
          </NavLink>
          <NavLink href="#mcps" active={hash === '#mcps'}>
            MCPs
          </NavLink>
          <NavLink href="#registros" active={hash === '#registros'}>
            Registros
          </NavLink>
          <NavLink href="#consumo" active={hash === '#consumo'}>
            Consumo
          </NavLink>
        </nav>
        <ThemeControl />
      </header>
      <main className="h-[calc(100vh-57px)] overflow-y-auto">
        {hash === '#principal' ? (
          <PrincipalScreen />
        ) : hash === '#configuracao' ? (
          <ConfiguracaoScreen />
        ) : hash === '#subagents' ? (
          <SubagentsScreen />
        ) : hash === '#skills' ? (
          <SkillsScreen />
        ) : hash === '#rules' ? (
          <RulesScreen />
        ) : hash === '#mcps' ? (
          <McpsScreen />
        ) : hash === '#registros' ? (
          <RegistrosScreen />
        ) : hash === '#consumo' ? (
          <ConsumoScreen />
        ) : (
          <DashboardScreen />
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
