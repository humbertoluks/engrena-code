import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

interface ButtonSecondaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingLabel?: ReactNode
  block?: boolean
}

const BASE_CLASSES = [
  'inline-flex items-center justify-center gap-sm',
  'rounded-sm border border-border',
  'bg-surface-2 text-fg',
  'px-md py-sm text-sm font-medium',
  'transition-colors',
  'hover:border-fg/20 hover:bg-surface',
  'active:translate-y-px',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
].join(' ')

function Spinner(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[15px] w-[15px] animate-spin"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function ButtonSecondary({
  loading = false,
  loadingLabel,
  block = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: Readonly<ButtonSecondaryProps>): ReactElement {
  const classes = [BASE_CLASSES, block ? 'w-full' : '', className ?? ''].filter(Boolean).join(' ')

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
