import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { threadsService, type FeedbackVote, type Message, type ThreadState, type ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'
import { SubagentTimelineBlock } from '../subagents/SubagentTimelineBlock'
import type { ChildToolActivity } from './graph/executionGraph.logic'
import {
  anyToolRunning,
  correlateSubagentRuns,
  currentActivity,
  formatClock,
  formatDurationSeconds,
  formatToolPayload,
  groupTimelineItems,
  shouldCollapseUserMessage,
  toolSummary,
  turnDurationForAssistant,
} from './chatHistory.logic'
import { AskUserQuestionCard } from './AskUserQuestionCard'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import { PermissionPrompt } from './PermissionPrompt'
import type { PermissionDecisionKind } from './permissionComposer.logic'
import { ChatMarkdown } from './ChatMarkdown'
import { isPendingActive, pendingStatusLabel, type PendingMessage } from './pendingMessages.logic'
import { deriveChatSurface } from './chatSurface.logic'
import { EmptyChatIcon } from './sidebarIcons'

const COPY = {
  loading: 'Carregando histórico…',
  error: 'Falha ao carregar o histórico da thread.',
  emptyThread: 'Sem mensagens ainda. O histórico aparece conforme o agente executa.',
  emptyNoThread: 'Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral.',
  activity: (label: string, elapsed: string) => `${label}… ${elapsed}`,
  thought: (elapsed: string) => `Pensou por ${elapsed}`,
  workLog: (n: number) => `Work log (${n})`,
  workLogWorking: 'trabalhando…',
  toolCompleted: 'concluído',
  toolCancelled: 'cancelado',
  toolInterrupted: 'interrompida',
  toolError: 'erro',
  toolRunning: 'trabalhando…',
  voteUp: 'Resposta útil',
  voteDown: 'Resposta ruim',
  followupsLabel: 'Sugestões de próximo passo',
  decisionLabel: 'Respostas para a pergunta do agente',
  followupsLoading: 'Sugerindo próximos passos…',
  loadOlder: 'Carregar mensagens anteriores',
  loadOlderBusy: 'Carregando…',
  loadOlderFailed: 'Não deu para carregar. Tentar de novo.',
  historyStart: 'Início da conversa',
  resultLoading: 'Carregando resultado…',
  resultFailed: 'Resultado completo indisponível.',
  interruptedSeparator: 'Turno interrompido quando o app fechou',
} as const

interface ImageBlock {
  type: 'image'
  mimeType: string
  name?: string
  dataBase64: string
}

interface ContextBlock {
  type: 'context'
  kind: 'file' | 'selection'
  path: string
  label: string
}

interface DecisionBlock {
  type: 'decision'
  question: string
  options: string[]
}

function decisionOf(blocks: unknown[] | null): DecisionBlock | null {
  const found = (blocks ?? []).find(
    (block): block is DecisionBlock =>
      typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'decision'
  )
  return found ?? null
}

function isContextBlock(block: unknown): block is ContextBlock {
  return typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'context'
}

/** Chips do contexto que foi junto na mensagem — o mesmo rótulo que estava no composer. */
function MessageContextChips({ blocks }: Readonly<{ blocks: unknown[] | null }>): ReactElement | null {
  const contexts = (blocks ?? []).filter(isContextBlock)
  if (contexts.length === 0) return null
  return (
    <div className="mb-xs flex flex-wrap justify-end gap-xs">
      {contexts.map((ctx) => (
        <span
          key={`${ctx.kind}-${ctx.label}`}
          title={ctx.path}
          className="inline-flex max-w-[14rem] items-center gap-[4px] rounded-md border border-border px-xs py-px text-[10.5px] text-muted"
        >
          <span aria-hidden="true">{ctx.kind === 'selection' ? '✂' : '📄'}</span>
          <span className="min-w-0 truncate font-mono">{ctx.label}</span>
        </span>
      ))}
    </div>
  )
}

function isImageBlock(block: unknown): block is ImageBlock {
  return typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'image'
}

function MessageImageThumbs({ blocks }: Readonly<{ blocks: unknown[] | null }>): ReactElement | null {
  const images = (blocks ?? []).filter(isImageBlock)
  if (images.length === 0) return null
  return (
    <div className="mb-xs flex flex-wrap justify-end gap-xs">
      {images.map((img, i) => (
        <img
          key={`${img.name ?? 'imagem'}-${i}`}
          src={`data:${img.mimeType};base64,${img.dataBase64}`}
          alt="Imagem anexada"
          className="max-h-[120px] max-w-[200px] rounded-lg border border-border"
        />
      ))}
    </div>
  )
}

/**
 * Linha shimmer do que o agente está fazendo agora ("Pensando…", "Lendo…", "Buscando…") com
 * cronômetro da atividade. Fica sempre abaixo do último texto — o work log mostra a tool, mas
 * o usuário precisa de sinal de vida também quando a resposta já começou a aparecer.
 */
function ActivityIndicator({ label, startMs }: Readonly<{ label: string; startMs: number }>): ReactElement {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startMs)

  useEffect(() => {
    setElapsedMs(Date.now() - startMs)
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startMs)
    }, 1000)
    return () => window.clearInterval(id)
  }, [startMs])

  return (
    <div className="mb-md mt-[2px] flex items-center gap-[6px] text-[11px] text-muted" aria-live="polite">
      <span
        className="h-[6px] w-[6px] flex-none animate-pulse rounded-full bg-accent"
        aria-hidden="true"
      />
      <span className="text-shimmer">{COPY.activity(label, formatDurationSeconds(elapsedMs))}</span>
    </div>
  )
}

const TOOL_STATUS_LABEL: Record<ToolCall['status'], string> = {
  completed: COPY.toolCompleted,
  cancelled: COPY.toolCancelled,
  interrupted: COPY.toolInterrupted,
  error: COPY.toolError,
  running: COPY.toolRunning,
}

function ToolStatusMark({ status }: Readonly<{ status: ToolCall['status'] }>): ReactElement {
  if (status === 'running') {
    return <span className="ml-auto h-[6px] w-[6px] flex-none animate-pulse rounded-full bg-accent" aria-hidden="true" />
  }
  if (status === 'completed') {
    return (
      <span className="ml-auto flex-none text-[10px] text-green" aria-label={TOOL_STATUS_LABEL.completed}>
        ✓
      </span>
    )
  }
  return <span className="ml-auto flex-none text-[10px] text-red/80">{TOOL_STATUS_LABEL[status]}</span>
}

/**
 * Resultado da tool no work log (F33).
 *
 * A listagem traz preview de 2 KB; o corpo integral só é buscado quando o usuário expande. Antes de
 * F33 o histórico carregava até 64 KB por tool call para exibir as primeiras linhas de cada uma —
 * metade do custo que a paginação existe para cortar.
 *
 * Falhar em buscar o corpo **não** apaga o preview: o que já estava legível continua na tela.
 */
function useToolResultBody(tool: ToolCall, open: boolean): { text: string; notice: string | null } {
  const [full, setFull] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const truncated = tool.resultTruncated === true

  useEffect(() => {
    if (!open || !truncated || full !== null || state !== 'idle') return
    setState('loading')
    let cancelled = false
    void threadsService
      .toolCallResult(tool.id)
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setState('failed')
          return
        }
        setFull(formatToolPayload(res.result, 6000))
        setState('idle')
      })
      .catch(() => {
        if (!cancelled) setState('failed')
      })
    return () => {
      cancelled = true
    }
  }, [open, truncated, full, state, tool.id])

  // `result` ainda chega pelo stream; `resultPreview` é o caminho do histórico paginado.
  const preview = tool.resultPreview ?? formatToolPayload(tool.result, 6000)
  if (full !== null) return { text: full, notice: null }
  if (state === 'loading') return { text: preview ?? '', notice: COPY.resultLoading }
  if (state === 'failed') return { text: preview ?? '', notice: COPY.resultFailed }
  return { text: preview ?? '', notice: null }
}

function ToolCallRow({
  tool,
  open,
  onToggle,
}: Readonly<{ tool: ToolCall; open: boolean; onToggle: (open: boolean) => void }>): ReactElement {
  const params = formatToolPayload(tool.params, 2000)
  const body = useToolResultBody(tool, open)
  const result = body.text
  const hasDetail = Boolean(params || result)

  return (
    <details open={open} onToggle={(event) => onToggle(event.currentTarget.open)} className="group/tool">
      <summary className="flex cursor-pointer list-none items-center gap-[7px] rounded-sm px-[6px] py-[3px] text-[12px] text-muted transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[12px] ${tool.status === 'running' ? 'text-shimmer' : 'text-muted'}`}
        >
          {toolSummary(tool)}
        </span>
        <ToolStatusMark status={tool.status} />
      </summary>
      {hasDetail ? (
        <div className="mb-xs ml-[8px] mt-[2px] overflow-hidden rounded-md border border-border bg-surface-2">
          {params ? (
            <pre className="m-0 max-h-[200px] overflow-auto whitespace-pre-wrap px-md py-sm font-mono text-[11px] leading-relaxed text-muted">
              {params}
            </pre>
          ) : null}
          {result ? (
            <pre className="m-0 max-h-[280px] overflow-auto whitespace-pre-wrap border-t border-border px-md py-sm font-mono text-[11px] leading-relaxed text-muted">
              {result}
            </pre>
          ) : null}
          {body.notice !== null ? (
            <p role="status" className="m-0 border-t border-border px-md py-[3px] text-[11px] text-muted">
              {body.notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </details>
  )
}

function WorkLog({
  tools,
  open,
  onToggle,
  openTools,
  onToggleTool,
}: Readonly<{
  tools: ToolCall[]
  open: boolean
  onToggle: (open: boolean) => void
  openTools: Record<string, boolean>
  onToggleTool: (toolId: string, open: boolean) => void
}>): ReactElement {
  const running = anyToolRunning(tools)
  return (
    <details
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="group/worklog my-sm overflow-hidden rounded-lg border border-border bg-surface-2/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-sm px-md py-[6px] text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="rounded-md bg-accent px-sm py-px text-[10px] font-bold uppercase tracking-[0.09em] text-white">
          {COPY.workLog(tools.length)}
        </span>
        {running ? (
          <span className="ml-auto inline-flex items-center gap-[5px] text-[10px] font-semibold normal-case tracking-normal text-accent">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {COPY.workLogWorking}
          </span>
        ) : null}
      </summary>
      <div className="px-[6px] pb-[5px] pt-[2px]">
        {tools.map((tool) => (
          <ToolCallRow
            key={tool.id}
            tool={tool}
            open={openTools[tool.id] === true}
            onToggle={(next) => onToggleTool(tool.id, next)}
          />
        ))}
      </div>
    </details>
  )
}

function UserMessage({ message }: Readonly<{ message: Message }>): ReactElement {
  const clock = formatClock(message.createdAt)
  const text = message.content ?? ''
  const lineBasedCollapse = shouldCollapseUserMessage(text)
  const [expanded, setExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(lineBasedCollapse)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setExpanded(false)
    setHasOverflow(shouldCollapseUserMessage(text))
  }, [text])

  const collapsed = !expanded
  useLayoutEffect(() => {
    if (!collapsed) return
    const el = contentRef.current
    if (!el) return
    setHasOverflow(el.scrollHeight > el.clientHeight + 1 || shouldCollapseUserMessage(text))
  }, [text, collapsed])

  const collapsible = lineBasedCollapse || hasOverflow
  const showFade = collapsible && collapsed

  const toggle = (): void => {
    if (!collapsible) return
    setExpanded((prev) => !prev)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!collapsible) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return (
    <div className="mb-md flex flex-col items-end">
      <MessageContextChips blocks={message.blocks} />
      <MessageImageThumbs blocks={message.blocks} />
      <div
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        onClick={collapsible ? toggle : undefined}
        onKeyDown={collapsible ? onKeyDown : undefined}
        className={[
          'relative max-w-[85%] rounded-lg border border-border bg-surface-2 px-md py-sm',
          collapsible ? 'cursor-pointer' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          ref={contentRef}
          className={[
            'whitespace-pre-wrap text-sm leading-relaxed text-fg',
            collapsed ? 'line-clamp-3 overflow-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {text}
        </div>
        {showFade ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.35em] rounded-b-lg bg-gradient-to-t from-surface-2 to-transparent"
          />
        ) : null}
      </div>
      {clock ? <span className="mt-[3px] text-[11px] text-muted">{clock}</span> : null}
    </div>
  )
}

/**
 * Bolha do usuário enviada nesta sessão e ainda não confirmada pelo histórico. Mesma forma da
 * bolha real (nenhum salto quando o servidor confirma) com rótulo de estado embaixo.
 */
function PendingUserMessage({ pending }: Readonly<{ pending: PendingMessage }>): ReactElement {
  const active = isPendingActive(pending.status)
  return (
    <div className="mb-md flex flex-col items-end">
      {pending.images.length > 0 ? (
        <div className="mb-xs flex flex-wrap justify-end gap-xs">
          {pending.images.map((img) => (
            <img
              key={img.id}
              src={`data:${img.mimeType};base64,${img.dataBase64}`}
              alt="Imagem anexada"
              className="max-h-[120px] max-w-[200px] rounded-lg border border-border opacity-70"
            />
          ))}
        </div>
      ) : null}
      <div className="max-w-[85%] rounded-lg border border-dashed border-border bg-surface-2/60 px-md py-sm">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg/80">{pending.text}</div>
      </div>
      <div className="mt-[3px] flex items-center gap-[5px] text-[11px] text-muted" aria-live="polite">
        {active ? (
          <span className="h-[5px] w-[5px] flex-none animate-pulse rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        <span>{pendingStatusLabel(pending.status)}</span>
      </div>
    </div>
  )
}

function VoteButtons({
  vote,
  onVote,
}: Readonly<{ vote: FeedbackVote | undefined; onVote: (vote: FeedbackVote) => void }>): ReactElement {
  return (
    <span className="flex items-center gap-[2px]">
      <button
        type="button"
        onClick={() => onVote('up')}
        aria-label={COPY.voteUp}
        aria-pressed={vote === 'up'}
        title={COPY.voteUp}
        className={`rounded-sm px-[3px] text-[11px] ${vote === 'up' ? 'text-green' : 'text-muted hover:text-fg'}`}
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => onVote('down')}
        aria-label={COPY.voteDown}
        aria-pressed={vote === 'down'}
        title={COPY.voteDown}
        className={`rounded-sm px-[3px] text-[11px] ${vote === 'down' ? 'text-red' : 'text-muted hover:text-fg'}`}
      >
        👎
      </button>
    </span>
  )
}

function AssistantMessage({
  message,
  turnDurationMs,
  vote,
  onVote,
  decisionEnabled = false,
  onDecide,
}: Readonly<{
  message: Message
  turnDurationMs: number | null
  vote: FeedbackVote | undefined
  onVote?: (messageId: string, vote: FeedbackVote) => void
  /** Só a última resposta, com a thread parada, ainda espera decisão. */
  decisionEnabled?: boolean
  onDecide?: (text: string) => void
}>): ReactElement {
  const clock = formatClock(message.createdAt)
  const showDuration = turnDurationMs != null && turnDurationMs > 0
  const text = message.content ?? ''
  const decision = decisionEnabled ? decisionOf(message.blocks) : null
  return (
    <div className="mb-md pr-[48px]">
      {text ? <ChatMarkdown content={text} /> : null}
      <div className="mt-[3px] flex items-center gap-sm text-[11px] text-muted">
        {clock ? <span>{clock}</span> : null}
        {showDuration ? <span>{COPY.thought(formatDurationSeconds(turnDurationMs))}</span> : null}
        {onVote ? <VoteButtons vote={vote} onVote={(next) => onVote(message.id, next)} /> : null}
      </div>
      {decision !== null && onDecide ? (
        <ul aria-label={COPY.decisionLabel} className="mt-xs flex list-none flex-wrap gap-xs p-0">
          {decision.options.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => onDecide(option)}
                className="rounded-full border border-accent/60 bg-accent/10 px-sm py-[3px] text-[12px] text-fg transition-colors hover:bg-accent/20"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export interface ChatHistoryProps {
  messages: Message[]
  /** Bolhas otimistas (enviando/executando/fila) que ainda não estão no histórico persistido. */
  pendingMessages?: PendingMessage[]
  /** Trocar de thread zera o que estava expandido; refetch da mesma thread preserva. */
  threadId?: string | null
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  onOpenSubagentRun: (run: SubagentRun) => void
  /** Atividade ao vivo dos filhos por `childThreadId` (F29) — mesma fonte que alimenta o grafo. */
  childTools?: Record<string, ChildToolActivity>
  loading: boolean
  error: string | null
  streamingText: string
  hasThread: boolean
  threadState?: ThreadState | null
  /** Paginação do histórico (F33). */
  historyHasMore?: boolean
  historyPageLoading?: boolean
  historyPageError?: string | null
  onLoadOlder?: () => void
  /**
   * Gate aberto da thread (`useThreadGate`) — permissão **ou** pergunta, card inline na timeline.
   * Fonte única: nada aqui é inferido de `toolCalls`, que chega por refetch abortável.
   */
  gate?: ThreadGate | null
  /** Gates além do exibido — vira "+N na fila" no card de permissão. */
  gateQueuedCount?: number
  /** Clique num chip de permissão: concede/nega na hora, sem passar pelo composer. */
  onPermissionResolve?: (kind: PermissionDecisionKind) => void
  /** Clique numa opção do ask_user_question: preenche o composer (envio via Enviar). */
  onPickAskOption?: (option: string) => void
  gateBusy?: boolean
  gateError?: string | null
  /** Voto por id de mensagem (👍/👎), vindo do histórico persistido. */
  feedback?: Record<string, FeedbackVote>
  onVote?: (messageId: string, vote: FeedbackVote) => void
  /** Sugestões geradas ao fim do turno; clicar preenche o composer (não envia). */
  followups?: string[]
  /** Mensagem que gerou as sugestões — chegando tarde, elas não colam sob uma resposta mais nova. */
  followupsMessageId?: string | null
  followupsPending?: boolean
  onPickFollowup?: (text: string) => void
  /** Clique numa opção de decisão: preenche o composer (envio via Enviar). */
  onDecide?: (text: string) => void
}

export function ChatHistory({
  messages,
  pendingMessages = [],
  threadId = null,
  toolCalls,
  subagentRuns,
  onOpenSubagentRun,
  childTools = {},
  loading,
  error,
  streamingText,
  hasThread,
  threadState = null,
  historyHasMore = false,
  historyPageLoading = false,
  historyPageError = null,
  onLoadOlder,
  gate = null,
  gateQueuedCount = 0,
  onPermissionResolve,
  onPickAskOption,
  gateBusy = false,
  gateError = null,
  feedback = {},
  onVote,
  followups = [],
  followupsMessageId = null,
  followupsPending = false,
  onPickFollowup,
  onDecide,
}: Readonly<ChatHistoryProps>): ReactElement {
  // Estado de expansão vive aqui (e não no DOM do <details>): o refetch do turno reconstrói a
  // lista e qualquer remontagem fecharia o Work log aberto no meio da leitura.
  const [openWorkLogs, setOpenWorkLogs] = useState<Record<string, boolean>>({})
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({})
  // biome-ignore lint/correctness/useExhaustiveDependencies: threadId é o gatilho do reset, não um valor lido no efeito.
  useEffect(() => {
    setOpenWorkLogs({})
    setOpenTools({})
  }, [threadId])

  const toggleWorkLog = (key: string, open: boolean): void => {
    setOpenWorkLogs((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }))
  }
  const toggleTool = (toolId: string, open: boolean): void => {
    setOpenTools((prev) => (prev[toolId] === open ? prev : { ...prev, [toolId]: open }))
  }

  const hasContent =
    messages.length > 0 ||
    streamingText !== '' ||
    toolCalls.length > 0 ||
    pendingMessages.length > 0 ||
    gate !== null

  // Loading/erro só tomam a tela quando não há nada para preservar. Com conversa em tela o
  // refetch é silencioso — trocar a árvore por "Carregando…" jogaria o scroll para o topo.
  if (loading && !hasContent) {
    return <p className="p-md text-[13px] text-muted">{COPY.loading}</p>
  }

  if (error !== null && !hasContent) {
    return (
      <p role="alert" className="p-md text-[13px] text-red">
        {error}
      </p>
    )
  }

  if (!hasThread && !hasContent) {
    return <EmptyChatState message={COPY.emptyNoThread} />
  }

  if (!hasContent) {
    return <EmptyChatState message={COPY.emptyThread} />
  }

  // `queued` só roda depois do turno atual — fica no rodapé, abaixo do streaming e do "Pensando…".
  const dispatched = pendingMessages.filter((p) => p.status !== 'queued')
  const queued = pendingMessages.filter((p) => p.status === 'queued')

  const runByToolCallId = correlateSubagentRuns(toolCalls, subagentRuns)
  const groups = groupTimelineItems(messages, toolCalls, runByToolCallId)

  // Mesma derivação do composer (`deriveChatSurface`), não uma segunda cópia do predicado:
  // indicador de atividade visível o turno inteiro, e nada de chips com a thread ocupada ou
  // com resposta em voo — o usuário via "próximo passo" em cima de "Executando…" e clicava
  // achando que era a permissão. `queueLength`/`draftText` não afetam nada aqui: a fila mora no
  // painel do composer e o rascunho é dele.
  const surface = deriveChatSurface({
    threadState,
    gate,
    hasActivePending: pendingMessages.some((p) => isPendingActive(p.status)),
    queueLength: 0,
    hasSelectedThread: hasThread,
    hasSelectedProject: true,
    draftText: '',
  })
  const showActivity = surface.showActivity
  const suggestionsAllowed = surface.showFollowups
  // Sugestão nasce de uma resposta específica: se outra chegou no meio, a lista velha não vale.
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null
  const followupsAnchored = followupsMessageId !== null && followupsMessageId === lastAssistantId
  // Restam só condições de disponibilidade de dado — não de estado da thread.
  const showFollowups =
    suggestionsAllowed && followups.length > 0 && onPickFollowup !== undefined && followupsAnchored
  const activity = currentActivity(messages, toolCalls, Date.now(), pendingMessages)

  return (
    <div className="flex flex-col p-md">
      <HistoryTop
        hasMore={historyHasMore}
        loading={historyPageLoading}
        error={historyPageError}
        onLoadOlder={onLoadOlder}
      />

      {groups.map((group) => {
        if (group.kind === 'message') {
          if (group.message.role === 'user') {
            return <UserMessage key={group.message.id} message={group.message} />
          }
          if (group.message.role === 'assistant') {
            return (
              <AssistantMessage
                key={group.message.id}
                message={group.message}
                turnDurationMs={turnDurationForAssistant(messages, group.message)}
                vote={feedback[group.message.id]}
                onVote={onVote}
                decisionEnabled={group.message.id === lastAssistantId && suggestionsAllowed}
                onDecide={onDecide}
              />
            )
          }
          return (
            <div key={group.message.id} className="mb-md text-sm text-muted">
              {group.message.content}
            </div>
          )
        }

        if (group.kind === 'subagent') {
          return (
            // Um bloco por filho: `tasks[]` (batch paralelo F18) sai de uma chamada só e rende N runs.
            <div key={group.key} className="mb-sm flex w-full max-w-[42rem] flex-col gap-xs self-start">
              {group.runs.map((run) => (
                <SubagentTimelineBlock
                  key={run.childThreadId}
                  run={run}
                  onOpen={onOpenSubagentRun}
                  activity={childTools[run.childThreadId] ?? null}
                />
              ))}
            </div>
          )
        }

        return (
          <WorkLog
            key={group.key}
            tools={group.tools}
            open={openWorkLogs[group.key] === true}
            onToggle={(next) => toggleWorkLog(group.key, next)}
            openTools={openTools}
            onToggleTool={toggleTool}
          />
        )
      })}

      {dispatched.map((pending) => (
        <PendingUserMessage key={pending.id} pending={pending} />
      ))}

      {gate !== null && gate.kind === 'question' && onPickAskOption ? (
        <AskUserQuestionCard
          key={gate.gateId}
          gate={gate}
          busy={gateBusy}
          error={gateError}
          onPickOption={onPickAskOption}
        />
      ) : null}

      {streamingText !== '' ? (
        <div className="mb-md pr-[48px]">
          <ChatMarkdown content={streamingText} streaming />
        </div>
      ) : null}

      {showActivity ? <ActivityIndicator label={activity.label} startMs={activity.startMs} /> : null}

      {gate !== null && gate.kind === 'permission' && onPermissionResolve ? (
        <PermissionPrompt
          key={gate.gateId}
          gate={gate}
          queuedCount={gateQueuedCount}
          busy={gateBusy}
          error={gateError}
          onResolve={onPermissionResolve}
        />
      ) : null}

      {/* Texto, não pílulas vazias: o esqueleto anterior tinha a forma dos chips e era lido como
          botão quebrado — o usuário via três retângulos sem rótulo e achava que era defeito. */}
      {followupsPending && !showFollowups && suggestionsAllowed ? (
        <p role="status" className="mb-md text-[11.5px] text-muted">
          <span className="animate-pulse">{COPY.followupsLoading}</span>
        </p>
      ) : null}

      {showFollowups ? (
        <ul aria-label={COPY.followupsLabel} className="mb-md flex list-none flex-wrap gap-xs p-0">
          {followups.map((text) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => onPickFollowup?.(text)}
                className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[12px] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {threadState === 'interrupted' ? <InterruptedSeparator /> : null}

      {queued.map((pending) => (
        <PendingUserMessage key={pending.id} pending={pending} />
      ))}
    </div>
  )
}

/**
 * Topo da timeline: o que existe antes da janela carregada (F33).
 *
 * Botão explícito, não scroll infinito: carregar sozinho ao encostar no topo faz a leitura andar
 * debaixo do dedo do usuário e torna impossível parar no começo de um trecho. Sem mais páginas,
 * o botão sai e entra o marcador de início — a ausência dos dois seria indistinguível de "ainda
 * não sei", que é pior que qualquer das duas respostas.
 */
function HistoryTop({
  hasMore,
  loading,
  error,
  onLoadOlder,
}: Readonly<{
  hasMore: boolean
  loading: boolean
  error: string | null
  onLoadOlder?: () => void
}>): ReactElement | null {
  if (!hasMore) {
    return (
      <p className="mb-md flex items-center gap-sm text-[11.5px] text-muted">
        <span aria-hidden className="h-px flex-1 bg-border" />
        {COPY.historyStart}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </p>
    )
  }
  return (
    <div className="mb-md flex flex-col items-center gap-[4px]">
      <button
        type="button"
        onClick={onLoadOlder}
        disabled={loading}
        className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[12px] text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-60"
      >
        {loading ? COPY.loadOlderBusy : COPY.loadOlder}
      </button>
      {/* A janela já lida permanece na tela: falhar em buscar o passado não apaga o presente. */}
      {error !== null ? (
        <p role="status" className="text-[11.5px] text-amber">
          {COPY.loadOlderFailed}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Fecho de uma conversa que o app cortou (F35).
 *
 * Não é tarja de erro e não usa o token de falha: nada deu errado, o turno foi interrompido. Sem
 * ela a thread simplesmente para no meio e o usuário fica sem saber se a resposta se perdeu ou se
 * o agente desistiu — que é o buraco que sobrava mesmo depois de o estado deixar de mentir.
 */
function InterruptedSeparator(): ReactElement {
  return (
    <p role="status" className="mb-md flex items-center gap-sm text-[11.5px] text-muted">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {COPY.interruptedSeparator}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </p>
  )
}

/** Empty thread / no-thread — centered icon + copy (legacy chat empty state). */
function EmptyChatState({ message }: Readonly<{ message: string }>): ReactElement {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-md px-lg py-xl text-center">
      <span className="text-muted">
        <EmptyChatIcon />
      </span>
      <p className="max-w-[22rem] text-[13px] leading-relaxed text-muted">{message}</p>
    </div>
  )
}
