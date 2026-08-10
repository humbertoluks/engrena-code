/**
 * Marca tipográfica EngrenaPlan (BrandMark + wordmark).
 * Mark geométrico distinto do Code (documento/plano); wordmark EngrenaPlan.
 */
import type { ReactElement } from 'react'

interface BrandMarkProps {
  size?: number
  className?: string
}

/** Mark geométrico (não leão): folha/documento com linhas de plano. */
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
        d="M7 3.5h7.5L19 8v12.5H7V3.5Z"
        className="stroke-accent"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 3.5V8H19"
        className="stroke-accent"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 12h6M10 15.5h6M10 9h2.5"
        className="stroke-fg"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Wordmark "EngrenaPlan" com "Plan" em accent. */
export function BrandWordmark({
  className,
}: Readonly<{
  className?: string
}>): ReactElement {
  return (
    <span className={className}>
      Engrena<b className="text-accent">Plan</b>
    </span>
  )
}
