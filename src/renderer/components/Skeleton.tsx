import type { ReactElement } from 'react'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: Readonly<SkeletonProps>): ReactElement {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className ?? 'h-4 w-full'}`} aria-hidden="true" />
}
