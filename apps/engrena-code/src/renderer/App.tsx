import { lazy, Suspense, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import {
  LoginScreen,
  LOGIN_PRODUCT_CONFIG,
  ThemeControl,
  clearUnlockedWorkspace,
  readUnlockedWorkspace,
} from '@engrena/ui'
import { BrandMark, BrandWordmark } from './components/BrandMark'
import {
  NavConfigIcon,
  NavConsumoIcon,
  NavDashboardIcon,
  NavMcpsIcon,
  NavRegistrosIcon,
  NavRulesIcon,
  NavSkillsIcon,
  NavSubagentsIcon,
  NavWorkspaceIcon,
} from './components/navIcons'

const ConfiguracaoScreen = lazy(() =>
  import('./screens/ConfiguracaoScreen').then((m) => ({ default: m.ConfiguracaoScreen })),
)
const SubagentsScreen = lazy(() =>
  import('./screens/SubagentsScreen').then((m) => ({ default: m.SubagentsScreen })),
)
const SkillsScreen = lazy(() =>
  import('./screens/SkillsScreen').then((m) => ({ default: m.SkillsScreen })),
)
const RulesScreen = lazy(() =>
  import('./screens/RulesScreen').then((m) => ({ default: m.RulesScreen })),
)
const McpsScreen = lazy(() =>
  import('./screens/McpsScreen').then((m) => ({ default: m.McpsScreen })),
)
const RegistrosScreen = lazy(() =>
  import('./screens/RegistrosScreen').then((m) => ({ default: m.RegistrosScreen })),
)
const ConsumoScreen = lazy(() =>
  import('./screens/ConsumoScreen').then((m) => ({ default: m.ConsumoScreen })),
)
const PrincipalScreen = lazy(() =>
  import('./screens/PrincipalScreen').then((m) => ({ default: m.PrincipalScreen })),
)
const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
)

const SCREEN_BY_HASH: Record<string, ReturnType<typeof lazy>> = {
  '#principal': PrincipalScreen,
  '#configuracao': ConfiguracaoScreen,
  '#subagents': SubagentsScreen,
  '#skills': SkillsScreen,
  '#rules': RulesScreen,
  '#mcps': McpsScreen,
  '#registros': RegistrosScreen,
  '#consumo': ConsumoScreen,
}

const CODE_LOGIN = LOGIN_PRODUCT_CONFIG.code
const SCREEN_LOADING = 'Carregando…'

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

const NAV_LINK_BASE =
  'inline-flex items-center gap-[6px] rounded-[20px] px-md py-[6px] text-[13px] font-medium transition-colors hover:text-fg'
const NAV_LINK_ACTIVE = 'bg-surface-2 text-fg'
const NAV_LINK_INACTIVE = 'text-muted'
const NAV_ICON_ACTIVE = 'text-accent'
const NAV_ICON_INACTIVE = 'text-muted'

function NavLink({
  href,
  active,
  icon,
  children,
}: Readonly<{
  href: string
  active: boolean
  icon: ReactNode
  children: ReactNode
}>): ReactElement {
  return (
    <a
      href={href}
      className={`${NAV_LINK_BASE} ${active ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className={active ? NAV_ICON_ACTIVE : NAV_ICON_INACTIVE}>{icon}</span>
      {children}
    </a>
  )
}

function HashScreen({ hash }: Readonly<{ hash: string }>): ReactElement {
  const Screen = SCREEN_BY_HASH[hash] ?? DashboardScreen
  return <Screen />
}

function WorkspaceChromeLabel(): ReactElement {
  const label = readUnlockedWorkspace(CODE_LOGIN.workspaceStorageKey, CODE_LOGIN.defaultWorkspace)
  return (
    <span className="inline-flex items-center gap-[6px] text-[12.5px] text-fg" title={label}>
      <span
        className="inline-block h-[8px] w-[8px] shrink-0 rounded-full bg-green"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}

function AuthenticatedApp(): ReactElement {
  const hash = useHash()

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
        <span className="inline-flex items-center gap-sm font-display text-[15px] font-semibold tracking-tight">
          <BrandMark size={22} />
          <BrandWordmark />
        </span>
        <nav className="flex items-center gap-xs" aria-label="Navegação principal">
          <NavLink href="#dashboard" active={hash === '#dashboard' || hash === ''} icon={<NavDashboardIcon />}>
            Dashboard
          </NavLink>
          <NavLink href="#principal" active={hash === '#principal'} icon={<NavWorkspaceIcon />}>
            Workspace
          </NavLink>
          <NavLink href="#configuracao" active={hash === '#configuracao'} icon={<NavConfigIcon />}>
            Configuração
          </NavLink>
          <NavLink href="#subagents" active={hash === '#subagents'} icon={<NavSubagentsIcon />}>
            SubAgents
          </NavLink>
          <NavLink href="#skills" active={hash === '#skills'} icon={<NavSkillsIcon />}>
            Skills
          </NavLink>
          <NavLink href="#rules" active={hash === '#rules'} icon={<NavRulesIcon />}>
            Rules
          </NavLink>
          <NavLink href="#mcps" active={hash === '#mcps'} icon={<NavMcpsIcon />}>
            MCPs
          </NavLink>
          <NavLink href="#registros" active={hash === '#registros'} icon={<NavRegistrosIcon />}>
            Registros
          </NavLink>
          <NavLink href="#consumo" active={hash === '#consumo'} icon={<NavConsumoIcon />}>
            Consumo
          </NavLink>
        </nav>
        <div className="flex items-center gap-sm">
          <ThemeControl variant="icon" />
          <span className="h-[14px] w-px bg-border" aria-hidden="true" />
          <WorkspaceChromeLabel />
        </div>
      </header>
      <main className="h-[calc(100vh-57px)] overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-[13px] text-muted">
              {SCREEN_LOADING}
            </div>
          }
        >
          <HashScreen hash={hash} />
        </Suspense>
      </main>
    </div>
  )
}

function App(): ReactElement {
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
        clearUnlockedWorkspace(CODE_LOGIN.workspaceStorageKey)
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
    <LoginScreen product="code" onUnlock={() => setIsAuthenticated(true)} />
  )
}

export default App
