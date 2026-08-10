/** Small stroke icons for workspace sidebar section headers (not copied from legacy paths). */
import type { ReactElement } from 'react'

const ICON_CLASS = 'h-[13px] w-[13px]'

function IconShell({ children }: Readonly<{ children: ReactElement }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={ICON_CLASS}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function AmbienteIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    </IconShell>
  )
}

export function ThreadIcon(): ReactElement {
  return (
    <IconShell>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </IconShell>
  )
}

export function RepoIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <path d="M6 8v8M10 6h6a2 2 0 0 1 2 2v3" />
        <circle cx="18" cy="14" r="2" />
      </>
    </IconShell>
  )
}

export function HarnessIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </>
    </IconShell>
  )
}

export function LimitesIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </>
    </IconShell>
  )
}

export function PlusIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-[13px] w-[13px]"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function FilesIcon(): ReactElement {
  return (
    <IconShell>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </IconShell>
  )
}
