/** Stroke icons for AppShell top nav — shapes match the legacy shell (Lucide-equivalent paths). */
import type { ReactElement } from 'react'

const ICON_CLASS = 'h-[14px] w-[14px] shrink-0'

function IconShell({ children }: Readonly<{ children: ReactElement }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_CLASS}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** 2×2 grid — Dashboard */
export function NavDashboardIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </>
    </IconShell>
  )
}

/** Three rising bars — Consumo */
export function NavConsumoIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M6 20V14" />
        <path d="M12 20V10" />
        <path d="M18 20V4" />
      </>
    </IconShell>
  )
}

/** Three horizontal lines — Registros */
export function NavRegistrosIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M3 6h18" />
        <path d="M3 12h18" />
        <path d="M3 18h18" />
      </>
    </IconShell>
  )
}

/** Monitor — SubAgents */
export function NavSubagentsIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </>
    </IconShell>
  )
}

/** Square outline — Skills */
export function NavSkillsIcon(): ReactElement {
  return (
    <IconShell>
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </IconShell>
  )
}

/** Two stacked rounded rails — MCPs */
export function NavMcpsIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      </>
    </IconShell>
  )
}

/** Clipboard — Rules */
export function NavRulesIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </>
    </IconShell>
  )
}

/** Gear — Configuração */
export function NavConfigIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    </IconShell>
  )
}

/** Dual panes — Workspace (EngrenaCode-only route; not in legacy top bar) */
export function NavWorkspaceIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </>
    </IconShell>
  )
}
