import { useState, type ReactElement, type ReactNode, type SyntheticEvent } from 'react'

export interface SidebarSectionProps {
  title: string
  icon?: ReactNode
  /** Trailing meta in the summary (e.g. CodeGraph badge). Replaces the chevron when set. */
  trailing?: ReactNode
  collapsible?: boolean
  /** Initial open state when collapsible. */
  defaultOpen?: boolean
  /** Fired after the user toggles open/closed (collapsible only). */
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

const CARD_SURFACE =
  'rounded-xl border border-border bg-[color-mix(in_srgb,var(--fg)_5%,var(--surface-2))]'

/**
 * Card da sidebar direita: título em caps + ícone.
 * Com `collapsible`, usa `<details>` nativo (chevron gira ao abrir).
 * Aberto: título `text-fg` e ícone `text-accent`.
 */
export function SidebarSection({
  title,
  icon,
  trailing,
  collapsible = false,
  defaultOpen = false,
  onOpenChange,
  children,
}: Readonly<SidebarSectionProps>): ReactElement {
  const [open, setOpen] = useState(defaultOpen)

  if (!collapsible) {
    return (
      <section className={`${CARD_SURFACE} p-xs`}>
        <h3 className="m-0 mb-[2px] flex items-center gap-xs px-sm py-[3px] text-[11px] font-bold uppercase tracking-[0.07em] text-fg">
          {icon ? <span className="text-accent">{icon}</span> : null}
          {title}
        </h3>
        <div className="flex flex-col gap-[2px]">{children}</div>
      </section>
    )
  }

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    const next = event.currentTarget.open
    setOpen(next)
    onOpenChange?.(next)
  }

  return (
    <details open={open} onToggle={onToggle} className={`group/section ${CARD_SURFACE}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-sm px-sm py-[7px] text-[11px] font-bold uppercase tracking-[0.07em] text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-xs group-open/section:text-fg">
          {icon ? <span className="shrink-0 group-open/section:text-accent">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </span>
        {trailing ?? <ChevronIcon />}
      </summary>
      <div className="flex flex-col gap-[2px] p-xs pt-0">{children}</div>
    </details>
  )
}

export function SidebarInfoRow({
  label,
  title,
  children,
}: Readonly<{ label: string; title?: string; children: ReactNode }>): ReactElement {
  return (
    <div
      title={title}
      className="flex items-center justify-between gap-sm px-sm py-[4px] text-[12px] text-fg/85"
    >
      <span className="shrink-0 text-muted">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-xs truncate">{children}</span>
    </div>
  )
}

function ChevronIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-[12px] w-[12px] shrink-0 transition-transform group-open/section:rotate-180"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
