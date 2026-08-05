import type { ReactElement, ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: ReactNode
}

export function MetricCard({ label, value }: Readonly<MetricCardProps>): ReactElement {
  return (
    <div className="rounded-md border border-border bg-surface px-md py-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="mt-sm text-[20px] font-semibold tracking-tight text-fg">{value}</p>
    </div>
  )
}
