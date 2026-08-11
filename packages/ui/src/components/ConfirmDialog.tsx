import type { ReactElement, ReactNode } from 'react'
import { ButtonPrimary } from './ButtonPrimary'
import { ButtonSecondary } from './ButtonSecondary'
import { Modal } from './Modal'

export type ConfirmDialogTone = 'default' | 'danger'

export interface ConfirmDialogProps {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` styles the confirm CTA as destructive (bg-red). Default `default` (accent). */
  tone?: ConfirmDialogTone
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Themed confirm shell — replaces native `window.confirm` so chrome follows light/dark tokens.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>): ReactElement {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      closeOnEscape
      closeOnBackdrop
      panelClassName="max-w-[24rem] rounded-lg"
    >
      <p className="mb-lg text-[13px] leading-relaxed text-fg">{message}</p>
      <div className="flex justify-end gap-xs">
        <ButtonSecondary type="button" onClick={onCancel}>
          {cancelLabel}
        </ButtonSecondary>
        {tone === 'danger' ? (
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'inline-flex items-center justify-center gap-sm',
              'rounded-sm border border-transparent',
              'bg-red px-md py-sm text-sm font-semibold text-bg',
              'transition-colors hover:opacity-90 active:translate-y-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        ) : (
          <ButtonPrimary type="button" onClick={onConfirm}>
            {confirmLabel}
          </ButtonPrimary>
        )}
      </div>
    </Modal>
  )
}
