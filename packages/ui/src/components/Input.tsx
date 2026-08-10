import type { InputHTMLAttributes, ReactElement } from 'react'

const INPUT_BASE =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  error?: boolean
  mono?: boolean
  className?: string
}

/** Generic text input — Design Lock field chrome. */
export function Input({
  error = false,
  mono = false,
  className,
  type = 'text',
  ...rest
}: Readonly<InputProps>): ReactElement {
  const classes = [
    INPUT_BASE,
    mono ? 'font-mono' : '',
    error ? 'border-red focus:border-red focus:ring-red/30' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <input type={type} className={classes} {...rest} />
}

export const inputBaseClassName = INPUT_BASE
