import type { ReactElement } from 'react'

export type BadgeTone = 'positive' | 'neutral'

interface BadgeProps {
  tone: BadgeTone
  children: string
}

const TONE_CLASS: Record<BadgeTone, string> = {
  positive: 'text-green',
  neutral: 'text-muted',
}

export function Badge({ tone, children }: Readonly<BadgeProps>): ReactElement {
  return (
    <span
      className={`rounded-sm border border-border bg-surface-2 px-sm py-[3px] font-mono text-[11.5px] ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  )
}
