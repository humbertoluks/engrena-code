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
import { ComposerImageAttachments, readFileAsBase64 } from './ComposerImageAttachments'
import { ComposerContextChips } from './ComposerContextChips'
import {
  droppedTextAsAttachment,
  makeFileAttachment,
  MAX_ATTACHMENT_CHARS,
  type ComposerAttachment,
} from './composerAttachments.logic'
import { DROP_PATH_MIME, imagesFromClipboard, readDroppedFiles } from './composerDrop.logic'
import {
  extractMentionQuery,
  insertMentionPath,
  validateComposerSlash,
  validateImageFile,
  type MentionQuery,
} from './composer.logic'
import {
  extractSlashTrigger,
  insertSavedPrompt,
  insertSlashCommand,
  slashMenuJustOpened,
  type SlashTrigger,
} from './commandTrigger'
import { deriveChatSurface, type ComposerPlaceholderKey } from './chatSurface.logic'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import { ComposerModePicker } from './ComposerModePicker'
import { EMPTY_MODE_CATALOG, type ChatModeFormDraft, type ModeCatalogOptions } from '../../hooks/promptLibrary.logic'
import type { ChatModeItem, SavedPromptItem } from '../../services/prompt-library-service'
import type { SlashCommandName } from '../../../services/runner/slash-commands.js'
import { VoiceMicButton } from './VoiceMicButton'
import { insertAtCursor } from './voiceInput.logic'
import { useVoiceInput } from '../../hooks/useVoiceInput'

const COPY = {
  placeholderNew: 'Descreva a task para o agente…  (Enter envia)',
  placeholderFollowUp: 'Responder nesta conversa…  (Enter envia, Shift+Enter quebra linha)',
  placeholderRunning: 'Agente trabalhando — Enter enfileira para o próximo turno',
  placeholderPermission: 'Permissão pendente — digite sim/não e Enter, ou escolha no card do chat',
  placeholderQuestion: 'Resposta pendente — digite no composer ou escolha no card do chat e Enviar',
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
  sendStop: 'Parar execução',
  errorSend: 'Falha ao enviar a mensagem.',
  limitBanner80: 'Você atingiu 80% do limite de consumo deste período.',
  limitBanner100: 'Você atingiu o limite de consumo deste período.',
  limitBlockedTurn: 'Limite de consumo atingido. Ajuste o limite em Consumo para continuar.',
  limitAdjustLink: 'Ajustar limite',
  queueHeader: (n: number) => `${n} na fila`,
  queueEdit: 'Editar',
  queueSave: 'Salvar',
  queueCancel: 'Cancelar',
  queuePromote: 'Priorizar (próxima)',
  queueRemove: 'Remover da fila',
  queuePausedHint: 'Fila parada — nenhum turno em andamento',
  queueRunNow: 'Executar agora',
  dropHint: 'Solte para anexar ao contexto',
  savePrompt: '+ prompt',
  savePromptTitle: 'Salvar o texto do composer como prompt reutilizável (aparece no menu /)',
  savePromptPlaceholder: 'Nome do prompt…',
  savePromptConfirm: 'Salvar',
  savePromptCancel: 'Cancelar',
  editPromptBadge: (name: string) => `editando /${name}`,
  editPromptTitle: 'O texto do composer vira o novo corpo deste prompt salvo',
  codebase: '#codebase',
  codebaseTitle: 'Buscar trechos do projeto para o pedido escrito no composer e anexar como contexto',
  codebaseBusy: 'Buscando…',
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

/** Copy do placeholder por chave — a escolha da chave é de `deriveChatSurface`. */
const PLACEHOLDER: Record<ComposerPlaceholderKey, string> = {
  new: COPY.placeholderNew,
  follow_up: COPY.placeholderFollowUp,
  running: COPY.placeholderRunning,
  permission: COPY.placeholderPermission,
  question: COPY.placeholderQuestion,
  stopping: COPY.placeholderStopping,
}

export interface TaskComposerProps {
  composer: ComposerDraft
  /** Anexos efetivos (explícitos + implícito do arquivo aberto). */
  attachments: readonly ComposerAttachment[]
  onAttach: (attachment: ComposerAttachment) => void
  onDetach: (id: string) => void
  attachError: string | null
  onAttachCodebase?: () => void
  codebaseBusy?: boolean
  /** Prompts salvos e modos de chat do projeto (F28 §3.4). */
  savedPrompts?: readonly SavedPromptItem[]
  chatModes?: readonly ChatModeItem[]
  libraryError?: string | null
  /** Skills/rules que o projeto resolve hoje — teto do filtro do modo (F28 §3.4). */
  modeCatalog?: ModeCatalogOptions
  onApplyChatMode?: (name: string | null) => void
  onSavePrompt?: (name: string) => Promise<boolean>
  onUpdateSavedPrompt?: (id: string, name: string, text: string) => Promise<boolean>
  onSaveChatMode?: (form: ChatModeFormDraft) => Promise<boolean>
  onUpdateChatMode?: (
    id: string,
    previousName: string,
    form: ChatModeFormDraft,
    options: { capturePreset: boolean }
  ) => Promise<boolean>
  onDeleteSavedPrompt?: (id: string) => void
  onDeleteChatMode?: (id: string, name: string) => void
  /** Relê prompts/modos/catálogo do projeto — chamado ao abrir o menu `/` e o picker de modo. */
  onRefreshLibrary?: () => void
  updateComposer: (patch: Partial<ComposerDraft>) => void
  onAccessLevelChange: (accessLevel: ThreadAccessLevel) => void
  composerCatalog: ComposerCatalog | null
  selectedThread: Thread | null
  projectId: string | null
  queue: QueueItem[]
  onDequeue: (id: string) => void
  onUpdateQueueItem: (id: string, text: string) => void
  onPromoteQueueItem: (id: string) => void
  /**
   * Despacha o topo da fila agora. Só aparece com a fila pausada (`surface.queuePaused`): depois
   * de um **Parar** nenhum turno vai drená-la sozinho, e sem este botão o item só saía quando
   * outra mensagem qualquer terminasse — passando na frente dele.
   */
  onRunQueue: () => void
  sendError: string | null
  configStatus: ConfigStatus | null
  vcsStatus: VcsStatus | null
  usageLimitStatus: UsageLimitStatusResponse | null
  onSend: () => void
  onCancel: () => void
  /**
   * Gate aberto da thread (`useThreadGate`): permissão faz o Enviar (não o Parar) resolver
   * sim/não, pergunta faz o Enviar responder em vez de enfileirar.
   */
  gate?: ThreadGate | null
  /** Bolha otimista do usuário ainda em voo (entra em `deriveChatSurface`). */
  pendingActive?: boolean
  onGitInit: () => Promise<unknown>
  hasProject: boolean
}

export function TaskComposer({
  composer,
  attachments,
  onAttach,
  onDetach,
  attachError,
  onAttachCodebase,
  codebaseBusy = false,
  savedPrompts = [],
  chatModes = [],
  modeCatalog = EMPTY_MODE_CATALOG,
  libraryError = null,
  onApplyChatMode,
  onSavePrompt,
  onUpdateSavedPrompt,
  onSaveChatMode,
  onUpdateChatMode,
  onDeleteSavedPrompt,
  onDeleteChatMode,
  onRefreshLibrary,
  updateComposer,
  onAccessLevelChange,
  composerCatalog,
  selectedThread,
  projectId,
  queue,
  onDequeue,
  onUpdateQueueItem,
  onPromoteQueueItem,
  onRunQueue,
  sendError,
  configStatus,
  vcsStatus,
  usageLimitStatus,
  onSend,
  onCancel,
  gate = null,
  pendingActive = false,
  onGitInit,
  hasProject,
}: Readonly<TaskComposerProps>): ReactElement {
  const [gitInitLoading, setGitInitLoading] = useState(false)
  const [mention, setMention] = useState<MentionQuery | null>(null)
  const [slashTrigger, setSlashTrigger] = useState<SlashTrigger | null>(null)
  const [slashError, setSlashError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [promptNameDraft, setPromptNameDraft] = useState<string | null>(null)
  /** Prompt salvo aberto para edição pelo lápis do menu `/`; `null` = o campo salva um novo. */
  const [editingPrompt, setEditingPrompt] = useState<{ id: string; name: string } | null>(null)
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

  // Única derivação de estado do composer: Parar/Enviar, rótulo, placeholder e runtimeLocked
  // saem daqui (e a rota é a mesma de `routeComposerSend`, sem segunda cópia do predicado).
  const surface = deriveChatSurface({
    threadState: selectedThread?.state ?? null,
    gate,
    hasActivePending: pendingActive,
    queueLength: queue.length,
    hasSelectedThread: selectedThread !== null,
    hasSelectedProject: hasProject,
    draftText: composer.text,
  })
  const runtimeLocked = surface.runtimeLocked
  const providerLocked = selectedThread !== null
  const executionLocked = selectedThread !== null

  const providerHealth = configStatus?.providers[composer.provider]
  const providerUnavailable = providerHealth !== undefined && !providerHealth.available
  const providerUnavailableReason = providerHealth?.reason ?? COPY.providerUnavailableFallback
  const gitGateActive = hasProject && vcsStatus !== null && !vcsStatus.hasHead
  const usageLimitBlocked = usageLimitStatus?.blocked ?? false
  const usageLimitWarnLevel = usageLimitStatus && !usageLimitBlocked ? usageLimitStatus.level : 'none'

  const multimodal = composerCatalog?.providers[composer.provider]?.multimodal ?? false

  const placeholder = PLACEHOLDER[surface.placeholderKey]

  // Multiplex `/` × `@` (ui.md §A "comando vence"): só computa o gatilho de menção quando o
  // gatilho `/` (âncora de início) não está ativo.
  function syncTriggers(text: string, cursor: number): void {
    const slash = extractSlashTrigger(text, cursor)
    // Só na borda de abertura: o gatilho é recalculado a cada tecla enquanto o menu está aberto,
    // e recarregar a cada caractere digitado depois do `/` seria uma rajada de GETs.
    if (slashMenuJustOpened(slashTrigger, slash)) onRefreshLibrary?.()
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

  /** Prompt salvo entra como texto editável, com a primeira variável já selecionada. */
  function handleSelectSavedPrompt(prompt: SavedPromptItem): void {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart ?? composer.text.length
    const result = insertSavedPrompt(composer.text, prompt.body, cursor)
    updateComposer({ text: result.text })
    setSlashTrigger(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const range = result.selection
      if (range) textareaRef.current?.setSelectionRange(range.start, range.end)
      else textareaRef.current?.setSelectionRange(result.cursor, result.cursor)
    })
  }

  /**
   * Editar prompt salvo: o corpo dele vira o texto do composer (é o editor que já existe) e o
   * campo de nome passa a salvar por cima. Substituir o texto é aceitável porque o menu `/` só
   * está aberto quando o composer tem o gatilho digitado, não um rascunho longo.
   */
  function handleEditSavedPrompt(prompt: SavedPromptItem): void {
    if (prompt.id === null) return
    updateComposer({ text: prompt.body })
    setEditingPrompt({ id: prompt.id, name: prompt.name })
    setPromptNameDraft(prompt.name)
    setSlashTrigger(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function cancelPromptDraft(): void {
    setPromptNameDraft(null)
    setEditingPrompt(null)
  }

  async function handleSavePrompt(): Promise<void> {
    if (promptNameDraft === null) return
    const name = promptNameDraft.trim()
    if (name === '') return
    if (editingPrompt !== null) {
      if (onUpdateSavedPrompt === undefined) return
      if (await onUpdateSavedPrompt(editingPrompt.id, name, composer.text)) cancelPromptDraft()
      return
    }
    if (onSavePrompt === undefined) return
    if (await onSavePrompt(name)) cancelPromptDraft()
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

  const [dragActive, setDragActive] = useState(false)

  async function attachImageFiles(files: File[]): Promise<void> {
    const accepted: typeof composer.images = []
    for (const file of files) {
      const validation = validateImageFile(file)
      if (!validation.ok) {
        setImageError(validation.message)
        continue
      }
      accepted.push({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mimeType: file.type as (typeof composer.images)[number]['mimeType'],
        name: file.name,
        dataBase64: await readFileAsBase64(file),
        byteLength: file.size,
      })
    }
    if (accepted.length > 0) updateComposer({ images: [...composer.images, ...accepted] })
  }

  /** Solto da árvore do projeto: path relativo já confiável, vira anexo de arquivo. */
  function attachDroppedProjectPaths(data: DataTransfer): boolean {
    const raw = data.getData(DROP_PATH_MIME)
    if (!raw) return false
    for (const path of raw.split(String.fromCharCode(10)).map((p) => p.trim()).filter(Boolean)) {
      onAttach(makeFileAttachment(path))
    }
    return true
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>): Promise<void> {
    setDragActive(false)
    if (disabled) return
    event.preventDefault()
    if (attachDroppedProjectPaths(event.dataTransfer)) return

    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) return
    const { texts, images, unsupported } = await readDroppedFiles(files)
    for (const item of texts) onAttach(droppedTextAsAttachment(item.name, item.text.slice(0, MAX_ATTACHMENT_CHARS)))
    if (images.length > 0) await attachImageFiles(images)
    if (unsupported.length > 0) setImageError(`Não dá para anexar: ${unsupported.join(', ')}.`)
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): Promise<void> {
    if (disabled) return
    const images = imagesFromClipboard(event.clipboardData?.items ?? null)
    if (images.length === 0) return
    event.preventDefault()
    await attachImageFiles(images)
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
  // Em running/decisão o Enviar só exige texto; o `disabled` global (projeto/git/limite) vale no idle.
  const sendButtonDisabled = composer.text.trim() === '' || (surface.sendStartsTurn && disabled)

  return (
    <div className="mx-auto w-full max-w-5xl">
      {queue.length > 0 ? (
        <ComposerQueuePanel
          queue={queue}
          onDequeue={onDequeue}
          onUpdate={onUpdateQueueItem}
          onPromote={onPromoteQueueItem}
          paused={surface.queuePaused}
          onRunNow={onRunQueue}
        />
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

      {attachError !== null ? (
        <p role="alert" className="mb-xs text-[12px] text-amber">
          {attachError}
        </p>
      ) : null}

      {sendError !== null ? (
        <p role="alert" className="mb-xs text-[12px] text-red">
          {sendError}
        </p>
      ) : null}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: área de soltar do composer; o alvo é o
          retângulo inteiro (mesma escolha do chatDragAndDrop do VS Code) e o mesmo anexo já é
          alcançável pelo botão 📎 e pelo menu `@`. */}
      <div
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => void handleDrop(e)}
        className={`relative rounded-xl border bg-surface-2 p-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
          dragActive ? 'border-accent ring-2 ring-accent/25' : 'border-border'
        }`}
      >
        {dragActive ? (
          <p role="status" className="mb-xs text-[11.5px] text-accent">
            {COPY.dropHint}
          </p>
        ) : null}
        <ComposerContextChips
          attachments={attachments}
          images={composer.images}
          onRemoveAttachment={onDetach}
          onRemoveImage={(id) => updateComposer({ images: composer.images.filter((img) => img.id !== id) })}
        />

        <div className="relative">
          {slashTrigger !== null ? (
            <CommandMenu
              query={slashTrigger.query}
              onSelect={handleSelectSlashCommand}
              prompts={savedPrompts}
              onSelectPrompt={handleSelectSavedPrompt}
              onEditPrompt={onUpdateSavedPrompt ? handleEditSavedPrompt : undefined}
              onDeletePrompt={onDeleteSavedPrompt}
            />
          ) : mention !== null && projectId ? (
            <FileMentionMenu projectId={projectId} query={mention.query} onSelect={handleSelectMention} />
          ) : null}

          <textarea
            ref={textareaRef}
            value={composer.text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={(e) => void handlePaste(e)}
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

        {libraryError !== null ? (
          <p role="alert" className="mt-sm text-xs text-amber">
            {libraryError}
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
              disabled={disabled || surface.composerMode === 'stopping'}
              onChange={(v) => void onAccessLevelChange(v)}
            />
            {onApplyChatMode && onSaveChatMode && onUpdateChatMode && onDeleteChatMode ? (
              <ComposerModePicker
                modes={chatModes}
                catalog={modeCatalog}
                value={composer.chatMode}
                disabled={disabled}
                onOpen={onRefreshLibrary}
                onApply={onApplyChatMode}
                onSave={onSaveChatMode}
                onUpdate={onUpdateChatMode}
                onDelete={onDeleteChatMode}
              />
            ) : null}
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
              permissionDenied={voice.permissionDenied}
              errorMessage={voice.errorMessage}
              elapsedMs={voice.elapsedMs}
              disabled={disabled || runtimeLocked}
              onClick={voice.toggle}
            />
            {onAttachCodebase ? (
              <button
                type="button"
                onClick={onAttachCodebase}
                disabled={disabled || runtimeLocked || codebaseBusy}
                title={COPY.codebaseTitle}
                className="rounded-md border border-border bg-surface px-xs py-[3px] font-mono text-[11.5px] text-muted hover:bg-surface-2 disabled:opacity-40"
              >
                {codebaseBusy ? COPY.codebaseBusy : COPY.codebase}
              </button>
            ) : null}
            {onSavePrompt ? (
              promptNameDraft === null ? (
                <button
                  type="button"
                  onClick={() => setPromptNameDraft('')}
                  disabled={disabled || composer.text.trim() === ''}
                  title={COPY.savePromptTitle}
                  className="rounded-md border border-border bg-surface px-xs py-[3px] font-mono text-[11.5px] text-muted hover:bg-surface-2 disabled:opacity-40"
                >
                  {COPY.savePrompt}
                </button>
              ) : (
                <span className="flex items-center gap-xs">
                  <input
                    // biome-ignore lint/a11y/noAutofocus: campo nasce de um clique explícito no "+ prompt"
                    autoFocus
                    value={promptNameDraft}
                    onChange={(e) => setPromptNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleSavePrompt()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelPromptDraft()
                      }
                    }}
                    placeholder={COPY.savePromptPlaceholder}
                    aria-label={COPY.savePromptPlaceholder}
                    className="w-[150px] rounded-md border border-border bg-surface px-xs py-[3px] text-[11.5px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  {editingPrompt !== null ? (
                    <span title={COPY.editPromptTitle} className="font-mono text-[10.5px] text-accent">
                      {COPY.editPromptBadge(editingPrompt.name)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleSavePrompt()}
                    disabled={promptNameDraft.trim() === ''}
                    className="rounded-md bg-accent px-xs py-[3px] text-[11px] font-medium text-white disabled:opacity-50"
                  >
                    {COPY.savePromptConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPromptDraft}
                    className="rounded-md px-xs py-[3px] text-[11px] text-muted hover:text-fg"
                  >
                    {COPY.savePromptCancel}
                  </button>
                </span>
              )
            ) : null}
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

          <span className="relative z-[60] flex shrink-0 items-center gap-xs">
            {surface.showStop ? (
              <button
                type="button"
                onClick={onCancel}
                aria-label={COPY.sendStop}
                title={COPY.sendStop}
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-fg"
              >
                <span className="block h-[10px] w-[10px] rounded-[2px] bg-bg" aria-hidden="true" />
              </button>
            ) : null}
            {surface.showSend ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sendButtonDisabled}
                aria-label={surface.sendLabel}
                title={surface.sendLabel}
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-[14px] w-[14px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  )
}

function ComposerQueuePanel({
  queue,
  onDequeue,
  onUpdate,
  onPromote,
  paused,
  onRunNow,
}: Readonly<{
  queue: QueueItem[]
  onDequeue: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onPromote: (id: string) => void
  /** Nenhum turno vai drenar a fila (thread assentada) — ver `ChatSurface.queuePaused`. */
  paused: boolean
  onRunNow: () => void
}>): ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  function startEdit(item: QueueItem): void {
    setEditingId(item.id)
    setDraft(item.text)
    requestAnimationFrame(() => editInputRef.current?.focus())
  }

  function cancelEdit(): void {
    setEditingId(null)
    setDraft('')
  }

  function saveEdit(): void {
    if (editingId === null) return
    const trimmed = draft.trim()
    if (trimmed === '') return
    onUpdate(editingId, trimmed)
    cancelEdit()
  }

  return (
    <details open className="group/queue mb-sm overflow-hidden rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-sm px-md py-sm text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="-rotate-90 h-[12px] w-[12px] shrink-0 text-muted transition-transform group-open/queue:rotate-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{COPY.queueHeader(queue.length)}</span>
        {paused ? (
          <>
            <span className="text-amber">{COPY.queuePausedHint}</span>
            <button
              type="button"
              // Dentro do <summary>: sem isto o clique no botão também abre/fecha o painel.
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRunNow()
              }}
              className="ml-auto rounded-md border border-border px-sm py-[3px] text-[11px] font-medium text-fg transition-colors hover:bg-surface-2"
            >
              {COPY.queueRunNow}
            </button>
          </>
        ) : null}
      </summary>
      <ul className="border-t border-border px-xs py-xs">
        {queue.map((item, index) => {
          const editing = editingId === item.id
          return (
            <li
              key={item.id}
              className="group/item flex items-center gap-sm rounded-md px-sm py-[7px] hover:bg-surface-2"
            >
              <span
                className="h-[10px] w-[10px] shrink-0 rounded-full border border-muted/70"
                aria-hidden="true"
              />
              {editing ? (
                <div className="flex min-w-0 flex-1 items-center gap-xs">
                  <input
                    ref={editInputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveEdit()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEdit()
                      }
                    }}
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-sm py-[4px] text-[13px] text-fg focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={draft.trim() === ''}
                    className="rounded-md bg-accent px-sm py-[3px] text-[11px] font-medium text-white disabled:opacity-50"
                  >
                    {COPY.queueSave}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-md px-sm py-[3px] text-[11px] text-muted hover:text-fg"
                  >
                    {COPY.queueCancel}
                  </button>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-fg">{item.text}</span>
                  <div className="flex shrink-0 items-center gap-[2px] opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100">
                    <QueueIconButton label={COPY.queueEdit} onClick={() => startEdit(item)}>
                      <PencilIcon />
                    </QueueIconButton>
                    {index > 0 ? (
                      <QueueIconButton label={COPY.queuePromote} onClick={() => onPromote(item.id)}>
                        <ArrowUpIcon />
                      </QueueIconButton>
                    ) : null}
                    <QueueIconButton label={COPY.queueRemove} onClick={() => onDequeue(item.id)} danger>
                      <TrashIcon />
                    </QueueIconButton>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function QueueIconButton({
  label,
  onClick,
  children,
  danger,
}: Readonly<{
  label: string
  onClick: () => void
  children: ReactElement
  danger?: boolean
}>): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted hover:bg-surface ${
        danger ? 'hover:text-red' : 'hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function PencilIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowUpIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 5h9M6.5 5V3.5h3V5M5.5 5v7.5h5V5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
