import { useEffect } from 'react'
import type { ReactElement } from 'react'
import type { SubagentRun } from '../../../services/db/repositories/subagents.js'
import { t } from './copy.js'

export interface SubagentRunAuditModalProps {
  run: SubagentRun
  onClose: () => void
}

function statusLabel(run: SubagentRun): string {
  switch (run.status) {
    case 'running':
      return t('subagentsRun.activity.status.running')
    case 'completed':
      return t('subagentsRun.activity.status.completed')
    case 'cancelled':
      return t('subagentsRun.activity.status.cancelled')
    case 'timeout':
      return t('subagentsRun.activity.status.timeout')
    default:
      return t('subagentsRun.activity.status.error')
  }
}

export function SubagentRunAuditModal({ run, onClose }: Readonly<SubagentRunAuditModalProps>): ReactElement {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const isTerminal = run.status !== 'running'
  const hasText = run.text !== null && run.text.trim() !== ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-lg"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('subagentsRun.audit.aria', { name: run.subagentName })}
        className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg"
      >
        <div className="mb-md flex items-start justify-between gap-md">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">{run.subagentName}</h2>
            <p className="mt-xs font-mono text-[11.5px] text-muted">
              {run.provider}
              {run.model ? ` · ${run.model}` : ''}
              {run.reasoningLevel ? ` · ${run.reasoningLevel}` : ''} ·{' '}
              <span className={run.status === 'timeout' ? 'text-amber' : undefined}>{statusLabel(run)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('subagentsRun.audit.close')}
            className="text-muted hover:text-fg"
          >
            ×
          </button>
        </div>

        <div className="rounded-md border border-border bg-surface-2/30 p-md">
          <p className="mb-xs text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {t('subagentsRun.audit.section.activity', { N: run.actionCount })}
          </p>
          {hasText ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{run.text}</p>
          ) : (
            <p className="text-[12.5px] text-muted">
              {isTerminal ? t('subagentsRun.audit.empty.done') : t('subagentsRun.audit.empty.waiting')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
