import type { ReactElement, ReactNode } from 'react'
import { StatusDot } from './StatusDot'
import type { DotVariant } from './StatusDot'

interface CardProps {
  children: ReactNode
}

export function Card({ children }: Readonly<CardProps>): ReactElement {
  return (
    <div className="rounded-lg border border-border bg-surface p-lg">
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  dot?: DotVariant
  dotTitle?: string
}

export function CardHeader({ title, subtitle, dot, dotTitle }: Readonly<CardHeaderProps>): ReactElement {
  return (
    <div className="mb-md">
      <div className="flex items-center gap-sm">
        {dot !== undefined ? <StatusDot variant={dot} title={dotTitle} /> : null}
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      </div>
      {subtitle !== undefined ? (
        <p className="mt-xs text-[12.5px] text-muted">{subtitle}</p>
      ) : null}
    </div>
  )
}
