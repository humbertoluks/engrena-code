/**
 * Marca tipográfica EngrenaCode (BrandMark + wordmark).
 * Sprite definitivo ainda aberto no copy.md — mark geométrico mínimo + wordmark.
 */
import type { ReactElement } from 'react'

interface BrandMarkProps {
  size?: number
  className?: string
}

/** Mark geométrico (não leão): hexágono simplificado em accent. */
export function BrandMark({
  size = 24,
  className,
}: Readonly<BrandMarkProps>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
        className="stroke-accent"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5v9M8.5 10.25 12 12.25l3.5-2M8.5 13.75 12 15.75l3.5-2"
        className="stroke-fg"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Wordmark "EngrenaCode" com "Code" em accent. */
export function BrandWordmark({
  className,
}: Readonly<{
  className?: string
}>): ReactElement {
  return (
    <span className={className}>
      Engrena<b className="text-accent">Code</b>
    </span>
  )
}
