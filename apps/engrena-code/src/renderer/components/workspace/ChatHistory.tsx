import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { Message, ThreadState, ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'
import { SubagentTimelineBlock } from '../subagents/SubagentTimelineBlock'
import {
  anyToolRunning,
  correlateSubagentRuns,
  formatClock,
  formatDurationSeconds,
  formatToolPayload,
  groupTimelineItems,
  shouldCollapseUserMessage,
  thinkingStartMs,
  toolSummary,
  turnDurationForAssistant,
} from './chatHistory.logic'
import { AskUserQuestionCard } from './AskUserQuestionCard'
import type { PendingAskUserQuestion } from './askUserQuestion.logic'
import { ChatMarkdown } from './ChatMarkdown'
import { isPendingActive, pendingStatusLabel, type PendingMessage } from './pendingMessages.logic'

const COPY = {
  loading: 'Carregando histórico…',
  error: 'Falha ao carregar o histórico da thread.',
  emptyThread: 'Sem mensagens ainda. O histórico aparece conforme o agente executa.',
  emptyNoThread: 'Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral.',
  thinking: (elapsed: string) => `Pensando… ${elapsed}`,
  thought: (elapsed: string) => `Pensou por ${elapsed}`,
  workLog: (n: number) => `Work log (${n})`,
  workLogWorking: 'trabalhando…',
  toolCompleted: 'concluído',
  toolCancelled: 'cancelado',
  toolInterrupted: 'interrompida',
  toolError: 'erro',
  toolRunning: 'trabalhando…',
} as const

interface ImageBlock {
  type: 'image'
  mimeType: string
  name?: string
  dataBase64: string
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

function ThinkingTimer({ startMs }: Readonly<{ startMs: number }>): ReactElement {
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
      <span className="text-shimmer">{COPY.thinking(formatDurationSeconds(elapsedMs))}</span>
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

function ToolCallRow({
  tool,
  open,
  onToggle,
}: Readonly<{ tool: ToolCall; open: boolean; onToggle: (open: boolean) => void }>): ReactElement {
  const params = formatToolPayload(tool.params, 2000)
  const result = formatToolPayload(tool.result, 6000)
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

function AssistantMessage({
  message,
  turnDurationMs,
}: Readonly<{ message: Message; turnDurationMs: number | null }>): ReactElement {
  const clock = formatClock(message.createdAt)
  const showDuration = turnDurationMs != null && turnDurationMs > 0
  const text = message.content ?? ''
  return (
    <div className="mb-md pr-[48px]">
      {text ? <ChatMarkdown content={text} /> : null}
      {clock || showDuration ? (
        <div className="mt-[3px] flex items-center gap-sm text-[11px] text-muted">
          {clock ? <span>{clock}</span> : null}
          {showDuration ? <span>{COPY.thought(formatDurationSeconds(turnDurationMs))}</span> : null}
        </div>
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
  loading: boolean
  error: string | null
  streamingText: string
  hasThread: boolean
  threadState?: ThreadState | null
  pendingQuestion?: PendingAskUserQuestion | null
  onAnswerQuestion?: (input: { selectedOptions: string[]; freeText: string | null }) => void
  answerBusy?: boolean
  answerError?: string | null
}

export function ChatHistory({
  messages,
  pendingMessages = [],
  threadId = null,
  toolCalls,
  subagentRuns,
  onOpenSubagentRun,
  loading,
  error,
  streamingText,
  hasThread,
  threadState = null,
  pendingQuestion = null,
  onAnswerQuestion,
  answerBusy = false,
  answerError = null,
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
    messages.length > 0 || streamingText !== '' || toolCalls.length > 0 || pendingMessages.length > 0

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
    return <p className="p-md text-[13px] text-muted">{COPY.emptyNoThread}</p>
  }

  if (!hasContent) {
    return <p className="p-md text-[13px] text-muted">{COPY.emptyThread}</p>
  }

  // `queued` só roda depois do turno atual — fica no rodapé, abaixo do streaming e do "Pensando…".
  const dispatched = pendingMessages.filter((p) => p.status !== 'queued')
  const queued = pendingMessages.filter((p) => p.status === 'queued')

  const runByToolCallId = correlateSubagentRuns(toolCalls, subagentRuns)
  const groups = groupTimelineItems(messages, toolCalls, runByToolCallId)

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const showThinking =
    threadState === 'running' &&
    streamingText === '' &&
    !pendingQuestion &&
    (anyToolRunning(toolCalls) || lastAssistant === undefined || messages.at(-1)?.role === 'user')

  const thinkStart = thinkingStartMs(messages, Date.now())

  return (
    <div className="flex flex-col p-md">
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
            <div key={group.key} className="mb-sm w-full max-w-[42rem] self-start">
              <SubagentTimelineBlock run={group.run} onOpen={onOpenSubagentRun} />
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

      {pendingQuestion && onAnswerQuestion ? (
        <AskUserQuestionCard
          key={pendingQuestion.toolCallId}
          prompt={pendingQuestion.prompt}
          options={pendingQuestion.options}
          multiSelect={pendingQuestion.multiSelect}
          busy={answerBusy}
          error={answerError}
          onAnswer={onAnswerQuestion}
        />
      ) : null}

      {streamingText !== '' ? (
        <div className="mb-md pr-[48px]">
          <ChatMarkdown content={streamingText} />
        </div>
      ) : null}

      {showThinking ? <ThinkingTimer startMs={thinkStart} /> : null}

      {queued.map((pending) => (
        <PendingUserMessage key={pending.id} pending={pending} />
      ))}
    </div>
  )
}
