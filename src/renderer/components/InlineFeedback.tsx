import type { ReactElement } from 'react'

export type FeedbackVariant = 'success' | 'error' | 'warn' | 'info'

interface InlineFeedbackProps {
  variant: FeedbackVariant
  message: string
}

const VARIANT_CLASS: Record<FeedbackVariant, string> = {
  success: 'text-green',
  error: 'text-red',
  warn: 'text-amber',
  info: 'text-muted',
}

export function InlineFeedback({ variant, message }: Readonly<InlineFeedbackProps>): ReactElement {
  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      className={`text-[12.5px] ${VARIANT_CLASS[variant]}`}
    >
      {message}
    </p>
  )
}
