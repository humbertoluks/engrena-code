/**
 * btn-primary — CTA travado (design lock). Estados: default, loading, disabled.
 * Texto sobre accent usa `text-bg` (não branco).
 */
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingLabel?: ReactNode
  block?: boolean
}

const BASE_CLASSES = [
  'inline-flex items-center justify-center gap-sm',
  'rounded-sm border border-transparent',
  'bg-accent text-bg',
  'px-md py-sm text-sm font-semibold',
  'transition-colors',
  'hover:bg-accent-2',
  'active:translate-y-px',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  '[&_svg]:h-[15px] [&_svg]:w-[15px]',
].join(' ')

function Spinner(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeOpacity="0.3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ButtonPrimary({
  loading = false,
  loadingLabel,
  block = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: Readonly<ButtonPrimaryProps>): ReactElement {
  const classes = [BASE_CLASSES, block ? 'w-full' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
