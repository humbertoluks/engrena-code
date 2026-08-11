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

/** Folder outline — project row (legacy ProjectTree). Same glyph as FilesIcon. */
export const FolderIcon = FilesIcon

/** Trash — remove project (legacy uses red/amber stroke, not ×). */
export function TrashIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6M14 11v6" />
      </>
    </IconShell>
  )
}

/** Chevron for project expand/collapse. Pass `open` to point down when expanded. */
export function ChevronIcon({ open }: Readonly<{ open: boolean }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${ICON_CLASS} transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/** Panel with left rail — collapse/expand sidebars (legacy shell). */
export function PanelLeftIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </>
    </IconShell>
  )
}

/** Panel with right rail — collapse right workspace sidebar. */
export function PanelRightIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M15 3v18" />
      </>
    </IconShell>
  )
}

/** Pencil — rename thread (replaces ✎ glyph). */
export function PencilIcon(): ReactElement {
  return (
    <IconShell>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </IconShell>
  )
}

/** Download — export thread (replaces ⤓ glyph). */
export function DownloadIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
      </>
    </IconShell>
  )
}

/** Square with `>_` — Terminal dock header (legacy). */
export function TerminalIcon(): ReactElement {
  return (
    <IconShell>
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="m8 9 3 3-3 3" />
        <path d="M13 15h4" />
      </>
    </IconShell>
  )
}

/** Close (×) — terminal tab dismiss. */
export function CloseIcon(): ReactElement {
  return (
    <IconShell>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconShell>
  )
}

/** Speech bubble with text lines — empty chat state (legacy). */
export function EmptyChatIcon({ className = 'h-[36px] w-[36px]' }: Readonly<{ className?: string }> = {}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  )
}
