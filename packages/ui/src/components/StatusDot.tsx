import type { ReactElement } from 'react'

export type DotVariant = 'ok' | 'warn' | 'off' | 'error' | 'unknown'

interface StatusDotProps {
  variant: DotVariant
  title?: string
}

const VARIANT_CLASS: Record<DotVariant, string> = {
  ok: 'bg-green',
  warn: 'bg-amber',
  off: 'bg-muted opacity-50',
  error: 'bg-red',
  unknown: 'bg-border',
}

export function StatusDot({ variant, title }: Readonly<StatusDotProps>): ReactElement {
  return (
    <span
      className={`inline-block h-[9px] w-[9px] flex-shrink-0 rounded-[3px] ${VARIANT_CLASS[variant]}`}
      title={title}
      aria-hidden="true"
    />
  )
}
