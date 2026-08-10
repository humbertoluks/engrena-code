import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react'

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export interface ModalProps {
  children: ReactNode
  onClose: () => void
  title?: ReactNode
  /** Accessible name when title is not a string (or omitted). */
  ariaLabel?: string
  /** Show header close button. Default true when title is set. */
  showCloseButton?: boolean
  closeLabel?: string
  /** Close when clicking the backdrop. Default false. */
  closeOnBackdrop?: boolean
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean
  /** Panel size/layout utilities. Default max-w-[40rem] rounded-lg. */
  panelClassName?: string
  /** Extra classes on the overlay. */
  overlayClassName?: string
  /** When false, omit default panel padding. */
  padded?: boolean
}

/**
 * Generic modal shell — backdrop + centered surface panel.
 * Domain content stays in the app; this only owns chrome.
 */
export function Modal({
  children,
  onClose,
  title,
  ariaLabel,
  showCloseButton,
  closeLabel = 'Fechar',
  closeOnBackdrop = false,
  closeOnEscape = true,
  panelClassName = 'max-w-[40rem] rounded-lg',
  overlayClassName,
  padded = true,
}: Readonly<ModalProps>): ReactElement {
  const resolvedShowClose = showCloseButton ?? title !== undefined
  const label =
    ariaLabel ?? (typeof title === 'string' ? title : undefined) ?? closeLabel

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>): void {
    if (!closeOnBackdrop) return
    if (e.target === e.currentTarget) onClose()
  }

  function handleOverlayKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (closeOnEscape && e.key === 'Escape') onClose()
  }

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-lg',
        overlayClassName ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className={[
          'w-full border border-border bg-surface shadow-lg',
          padded ? 'p-lg' : '',
          panelClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {title !== undefined || resolvedShowClose ? (
          <div className="mb-md flex items-center justify-between gap-sm">
            {title !== undefined ? (
              <h2 className="font-display text-[16px] font-semibold text-fg">{title}</h2>
            ) : (
              <span />
            )}
            {resolvedShowClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="text-muted hover:text-fg"
              >
                <CloseIcon />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
