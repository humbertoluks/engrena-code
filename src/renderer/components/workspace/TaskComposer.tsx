import { useState } from 'react'
import type { ReactElement, KeyboardEvent } from 'react'
import type { ComposerDraft, QueueItem } from '../../hooks/usePrincipalWorkspace'
import type { Thread, ThreadAccessLevel, ThreadExecutionMode, ThreadProvider } from '../../services/threads-service'
import type { ConfigStatus } from '../../services/configuracao-service'
import type { VcsStatus } from '../../services/projects-service'

const COPY = {
  placeholderNew: 'Descreva a task para o agente…  (Enter envia)',
  placeholderFollowUp: 'Responder nesta conversa…  (Enter envia, Shift+Enter quebra linha)',
  placeholderRunning: 'Agente trabalhando — Enter enfileira para o próximo turno',
  placeholderStopping: 'Cancelando execução…',
  accessGroup: 'Access',
  accessSupervised: 'Supervised',
  accessAutoAccept: 'Auto-accept edits',
  accessFullAccess: 'Full access',
  executionGroup: 'Execution',
  executionMain: 'Main',
  executionWorktree: 'Worktree',
  lockProvider: 'Modelos do provider da thread — o provider é imutável.',
  gitGateTitle: 'Inicialize o Git para conversar com o agente',
  gitGateBody: 'O EngrenaCode precisa de um commit inicial para proteger e acompanhar as alterações do agente.',
  gitGateCta: 'Inicializar Git',
  gitGateCtaLoading: 'Inicializando Git…',
  send: 'Enviar',
  sendStop: 'Parar execução',
  errorSend: 'Falha ao enviar a mensagem.',
  queueQueued: 'na fila',
  queueEdit: 'Editar',
  queueCancel: 'Cancelar',
} as const

const PROVIDERS: ThreadProvider[] = ['claude', 'codex', 'kimi']
const ACCESS_LEVELS: ThreadAccessLevel[] = ['supervised', 'auto-accept-edits', 'full-access']
const EXECUTION_MODES: ThreadExecutionMode[] = ['main', 'worktree']

const ACCESS_LABEL: Record<ThreadAccessLevel, string> = {
  supervised: COPY.accessSupervised,
  'auto-accept-edits': COPY.accessAutoAccept,
  'full-access': COPY.accessFullAccess,
}

const EXECUTION_LABEL: Record<ThreadExecutionMode, string> = {
  main: COPY.executionMain,
  worktree: COPY.executionWorktree,
}

export interface TaskComposerProps {
  composer: ComposerDraft
  updateComposer: (patch: Partial<ComposerDraft>) => void
  selectedThread: Thread | null
  queue: QueueItem[]
  onDequeue: (id: string) => void
  sendError: string | null
  configStatus: ConfigStatus | null
  vcsStatus: VcsStatus | null
  onSend: () => void
  onCancel: () => void
  onGitInit: () => Promise<unknown>
  hasProject: boolean
}

export function TaskComposer({
  composer,
  updateComposer,
  selectedThread,
  queue,
  onDequeue,
  sendError,
  configStatus,
  vcsStatus,
  onSend,
  onCancel,
  onGitInit,
  hasProject,
}: Readonly<TaskComposerProps>): ReactElement {
  const [gitInitLoading, setGitInitLoading] = useState(false)

  const isRunning = selectedThread?.state === 'running'
  const isStopping = selectedThread?.state === 'stopping'
  const providerLocked = selectedThread !== null
  const executionLocked = selectedThread !== null

  const providerHealth = configStatus?.clis[composer.provider]
  const providerUnavailable = providerHealth !== undefined && !providerHealth.installed
  const gitGateActive = hasProject && vcsStatus !== null && !vcsStatus.hasHead

  const placeholder = isStopping
    ? COPY.placeholderStopping
    : isRunning
      ? COPY.placeholderRunning
      : selectedThread
        ? COPY.placeholderFollowUp
        : COPY.placeholderNew

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  async function handleGitInit(): Promise<void> {
    setGitInitLoading(true)
    try {
      await onGitInit()
    } finally {
      setGitInitLoading(false)
    }
  }

  const disabled = !hasProject || (providerUnavailable && !providerLocked) || gitGateActive

  return (
    <div className="mx-auto w-full max-w-5xl">
      {queue.length > 0 ? (
        <div className="mb-xs flex flex-wrap gap-xs">
          {queue.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-xs rounded-md border border-border bg-surface-2 px-xs py-[2px] text-[11px] text-muted"
            >
              <span className="max-w-[16rem] truncate">{item.text}</span>
              <span className="text-accent">{COPY.queueQueued}</span>
              <button type="button" onClick={() => onDequeue(item.id)} aria-label={COPY.queueCancel} className="text-muted hover:text-red">
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {gitGateActive ? (
        <div className="mb-xs rounded-xl border border-amber/40 bg-amber/[0.08] p-sm">
          <p className="text-[13px] font-medium text-fg">{COPY.gitGateTitle}</p>
          <p className="mt-[2px] text-[12px] text-muted">{COPY.gitGateBody}</p>
          <button
            type="button"
            onClick={() => void handleGitInit()}
            disabled={gitInitLoading}
            className="mt-xs rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[12px] font-medium hover:bg-surface disabled:opacity-50"
          >
            {gitInitLoading ? COPY.gitGateCtaLoading : COPY.gitGateCta}
          </button>
        </div>
      ) : null}

      {sendError !== null ? (
        <p role="alert" className="mb-xs text-[12px] text-red">
          {sendError}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-2 p-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        <textarea
          value={composer.text}
          onChange={(e) => updateComposer({ text: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full resize-none bg-transparent text-[13px] text-fg placeholder:text-muted focus:outline-none disabled:opacity-60"
        />

        <div className="mt-xs flex flex-wrap items-center justify-between gap-xs">
          <div className="flex flex-wrap items-center gap-xs">
            <PillGroup
              label="Provider"
              value={composer.provider}
              options={PROVIDERS}
              labels={{ claude: 'Claude', codex: 'Codex', kimi: 'Kimi' }}
              disabled={providerLocked}
              title={providerLocked ? COPY.lockProvider : undefined}
              onChange={(v) => updateComposer({ provider: v })}
            />
            <PillGroup
              label={COPY.accessGroup}
              value={composer.accessLevel}
              options={ACCESS_LEVELS}
              labels={ACCESS_LABEL}
              disabled={isRunning}
              onChange={(v) => updateComposer({ accessLevel: v })}
            />
            <PillGroup
              label={COPY.executionGroup}
              value={composer.executionMode}
              options={EXECUTION_MODES}
              labels={EXECUTION_LABEL}
              disabled={executionLocked}
              onChange={(v) => updateComposer({ executionMode: v })}
            />
          </div>

          {isRunning || isStopping ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-red px-md py-xs text-[12px] font-medium text-white"
            >
              {COPY.sendStop}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || composer.text.trim() === ''}
              className="rounded-md bg-accent px-md py-xs text-[12px] font-medium text-white disabled:opacity-50"
            >
              {COPY.send}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PillGroup<T extends string>({
  label,
  value,
  options,
  labels,
  disabled,
  title,
  onChange,
}: Readonly<{
  label: string
  value: T
  options: T[]
  labels: Record<T, string>
  disabled?: boolean
  title?: string
  onChange: (value: T) => void
}>): ReactElement {
  return (
    <div className="flex items-center gap-[2px] rounded-md border border-border bg-surface p-[2px]" title={title}>
      <span className="px-xs text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`rounded-md px-xs py-[2px] text-[11px] disabled:opacity-60 ${
            value === opt ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}
