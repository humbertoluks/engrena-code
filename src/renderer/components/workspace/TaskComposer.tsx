import { useRef, useState } from 'react'
import type { ReactElement, KeyboardEvent } from 'react'
import type { ComposerDraft, QueueItem } from '../../hooks/usePrincipalWorkspace'
import type { ComposerCatalog, Thread, ThreadAccessLevel, ThreadExecutionMode } from '../../services/threads-service'
import type { ConfigStatus } from '../../services/configuracao-service'
import type { VcsStatus } from '../../services/projects-service'
import type { UsageLimitStatusResponse } from '../../services/consumo-service'
import { ComposerModelControls } from './ComposerModelControls'
import { FileMentionMenu } from './FileMentionMenu'
import { CommandMenu } from './CommandMenu'
import { ComposerImageAttachments, ImageAttachmentThumbs } from './ComposerImageAttachments'
import { extractMentionQuery, insertMentionPath, validateComposerSlash, type MentionQuery } from './composer.logic'
import { extractSlashTrigger, insertSlashCommand, type SlashTrigger } from './commandTrigger'
import type { SlashCommandName } from '../../../services/runner/slash-commands.js'
import { VoiceMicButton } from './VoiceMicButton'
import { insertAtCursor } from './voiceInput.logic'
import { useVoiceInput } from '../../hooks/useVoiceInput'

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
  gitGateTitle: 'Inicialize o Git para conversar com o agente',
  gitGateBody: 'O EngrenaCode precisa de um commit inicial para proteger e acompanhar as alterações do agente.',
  gitGateCta: 'Inicializar Git',
  gitGateCtaLoading: 'Inicializando Git…',
  providerUnavailableTitle: 'Provider indisponível',
  providerUnavailableFallback: 'Provider indisponível para uso agora.',
  send: 'Enviar',
  sendStop: 'Parar execução',
  errorSend: 'Falha ao enviar a mensagem.',
  limitBanner80: 'Você atingiu 80% do limite de consumo deste período.',
  limitBanner100: 'Você atingiu o limite de consumo deste período.',
  limitBlockedTurn: 'Limite de consumo atingido. Ajuste o limite em Consumo para continuar.',
  limitAdjustLink: 'Ajustar limite',
  queueQueued: 'na fila',
  queueEdit: 'Editar',
  queueCancel: 'Cancelar',
} as const

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
  composerCatalog: ComposerCatalog | null
  selectedThread: Thread | null
  projectId: string | null
  queue: QueueItem[]
  onDequeue: (id: string) => void
  sendError: string | null
  configStatus: ConfigStatus | null
  vcsStatus: VcsStatus | null
  usageLimitStatus: UsageLimitStatusResponse | null
  onSend: () => void
  onCancel: () => void
  onGitInit: () => Promise<unknown>
  hasProject: boolean
}

export function TaskComposer({
  composer,
  updateComposer,
  composerCatalog,
  selectedThread,
  projectId,
  queue,
  onDequeue,
  sendError,
  configStatus,
  vcsStatus,
  usageLimitStatus,
  onSend,
  onCancel,
  onGitInit,
  hasProject,
}: Readonly<TaskComposerProps>): ReactElement {
  const [gitInitLoading, setGitInitLoading] = useState(false)
  const [mention, setMention] = useState<MentionQuery | null>(null)
  const [slashTrigger, setSlashTrigger] = useState<SlashTrigger | null>(null)
  const [slashError, setSlashError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleVoiceTranscript(text: string): void {
    const start = textareaRef.current?.selectionStart ?? composer.text.length
    const end = textareaRef.current?.selectionEnd ?? start
    const result = insertAtCursor(composer.text, start, end, text)
    updateComposer({ text: result.text })
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor)
    })
  }

  const voice = useVoiceInput({
    keyReady: configStatus ? configStatus.voice.openai || configStatus.voice.groq : null,
    onTranscript: handleVoiceTranscript,
  })

  const isRunning = selectedThread?.state === 'running'
  const isStopping = selectedThread?.state === 'stopping'
  // F21: thread pausada aguardando resposta do usuário também conta como ocupada — bloqueia
  // follow-up/troca de provider, mas o cancelamento manual (AC F21) continua disponível abaixo.
  const isWaitingUser = selectedThread?.state === 'waiting_user'
  const providerLocked = selectedThread !== null
  const executionLocked = selectedThread !== null
  const runtimeLocked = isRunning || isStopping || isWaitingUser || queue.length > 0

  const providerHealth = configStatus?.providers[composer.provider]
  const providerUnavailable = providerHealth !== undefined && !providerHealth.available
  const providerUnavailableReason = providerHealth?.reason ?? COPY.providerUnavailableFallback
  const gitGateActive = hasProject && vcsStatus !== null && !vcsStatus.hasHead
  const usageLimitBlocked = usageLimitStatus?.blocked ?? false
  const usageLimitWarnLevel = usageLimitStatus && !usageLimitBlocked ? usageLimitStatus.level : 'none'

  const multimodal = composerCatalog?.providers[composer.provider]?.multimodal ?? false

  const placeholder = isStopping
    ? COPY.placeholderStopping
    : isRunning || isWaitingUser
      ? COPY.placeholderRunning
      : selectedThread
        ? COPY.placeholderFollowUp
        : COPY.placeholderNew

  // Multiplex `/` × `@` (ui.md §A "comando vence"): só computa o gatilho de menção quando o
  // gatilho `/` (âncora de início) não está ativo.
  function syncTriggers(text: string, cursor: number): void {
    const slash = extractSlashTrigger(text, cursor)
    setSlashTrigger(slash)
    setMention(slash ? null : extractMentionQuery(text, cursor))
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    updateComposer({ text: e.target.value })
    syncTriggers(e.target.value, e.target.selectionStart ?? e.target.value.length)
    if (slashError !== null) setSlashError(null)
  }

  function handleSelectMention(path: string): void {
    if (!mention || !textareaRef.current) return
    const cursor = textareaRef.current.selectionStart ?? composer.text.length
    const result = insertMentionPath(composer.text, mention, path, cursor)
    updateComposer({ text: result.text })
    setMention(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor)
    })
  }

  function handleSelectSlashCommand(name: SlashCommandName): void {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart ?? composer.text.length
    const result = insertSlashCommand(composer.text, name, cursor)
    updateComposer({ text: result.text })
    setSlashTrigger(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor)
    })
  }

  /** Bloqueio pré-envio de slash inválido (spec F22 §5.2) — client nunca chega a chamar `onSend`. */
  function handleSend(): void {
    const validation = validateComposerSlash(composer.text)
    if (!validation.ok) {
      setSlashError(validation.message)
      return
    }
    setSlashError(null)
    onSend()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Escape' && (mention || slashTrigger)) {
      setMention(null)
      setSlashTrigger(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !mention && !slashTrigger) {
      e.preventDefault()
      handleSend()
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

  const disabled = !hasProject || (providerUnavailable && !providerLocked) || gitGateActive || usageLimitBlocked

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

      {providerUnavailable && !providerLocked && !gitGateActive ? (
        <div className="mb-xs rounded-xl border border-amber/40 bg-amber/[0.08] p-sm">
          <p className="text-[13px] font-medium text-fg">{COPY.providerUnavailableTitle}</p>
          <p className="mt-[2px] text-[12px] text-muted">{providerUnavailableReason}</p>
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

      {usageLimitBlocked ? (
        <div className="mb-xs rounded-xl border border-red/40 bg-red/[0.08] p-sm">
          <p role="alert" className="text-[13px] font-medium text-red">
            {COPY.limitBlockedTurn}
          </p>
          <a href="#consumo" className="mt-[2px] inline-block text-[12px] text-accent">
            {COPY.limitAdjustLink}
          </a>
        </div>
      ) : usageLimitWarnLevel === 'warn80' || usageLimitWarnLevel === 'at100' ? (
        <div className="mb-xs rounded-xl border border-amber/40 bg-amber/[0.08] p-sm">
          <p role="status" className="text-[13px] font-medium text-amber">
            {usageLimitWarnLevel === 'at100' ? COPY.limitBanner100 : COPY.limitBanner80}
          </p>
          <a href="#consumo" className="mt-[2px] inline-block text-[12px] text-accent">
            {COPY.limitAdjustLink}
          </a>
        </div>
      ) : null}

      {sendError !== null ? (
        <p role="alert" className="mb-xs text-[12px] text-red">
          {sendError}
        </p>
      ) : null}

      <div className="relative rounded-xl border border-border bg-surface-2 p-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        {composer.images.length > 0 ? (
          <div className="mb-xs">
            <ImageAttachmentThumbs
              images={composer.images}
              onRemove={(id) => updateComposer({ images: composer.images.filter((img) => img.id !== id) })}
            />
          </div>
        ) : null}

        <div className="relative">
          {slashTrigger !== null ? (
            <CommandMenu query={slashTrigger.query} onSelect={handleSelectSlashCommand} />
          ) : mention !== null && projectId ? (
            <FileMentionMenu projectId={projectId} query={mention.query} onSelect={handleSelectMention} />
          ) : null}

          <textarea
            ref={textareaRef}
            value={composer.text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => syncTriggers(composer.text, e.currentTarget.selectionStart ?? composer.text.length)}
            onClick={(e) => syncTriggers(composer.text, e.currentTarget.selectionStart ?? composer.text.length)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className="w-full resize-none bg-transparent text-[13px] text-fg placeholder:text-muted focus:outline-none disabled:opacity-60"
          />
        </div>

        {slashError !== null ? (
          <p role="alert" className="mt-sm text-xs text-red">
            {slashError}
          </p>
        ) : null}

        {imageError !== null ? (
          <p role="alert" className="mt-sm text-xs text-amber">
            {imageError}
          </p>
        ) : null}

        {voice.errorMessage !== null && voice.state === 'error' ? (
          <p role="alert" className="mt-sm text-xs text-red">
            {voice.errorMessage}
          </p>
        ) : voice.noticeMessage !== null ? (
          <p role="status" className="mt-sm text-xs text-amber">
            {voice.noticeMessage}
          </p>
        ) : null}

        <div className="mt-xs flex flex-wrap items-center justify-between gap-xs">
          <div className="flex flex-wrap items-center gap-xs">
            <ComposerModelControls
              catalog={composerCatalog}
              provider={composer.provider}
              model={composer.model}
              reasoningLevel={composer.reasoningLevel}
              lockProvider={providerLocked}
              disabled={disabled || runtimeLocked}
              onChangeProvider={(v) => {
                const entry = composerCatalog?.providers[v]
                updateComposer({ provider: v, model: entry?.defaultModel ?? null, reasoningLevel: entry?.defaultReasoningLevel ?? null })
              }}
              onChangeModel={(v) => updateComposer({ model: v })}
              onChangeReasoningLevel={(v) => updateComposer({ reasoningLevel: v })}
            />
            <div className="h-4 w-[1.5px] bg-border" />
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
            <div className="h-4 w-[1.5px] bg-border" />
            <VoiceMicButton
              state={voice.state}
              keyReady={voice.keyReady}
              errorMessage={voice.errorMessage}
              elapsedMs={voice.elapsedMs}
              disabled={disabled || runtimeLocked}
              onClick={voice.toggle}
            />
            <ComposerImageAttachments
              currentCount={composer.images.length}
              multimodal={multimodal}
              disabled={disabled || runtimeLocked}
              onAdd={(added) => {
                updateComposer({ images: [...composer.images, ...added] })
                setImageError(null)
              }}
              onError={setImageError}
            />
          </div>

          {isRunning || isStopping || isWaitingUser ? (
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
              onClick={handleSend}
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
