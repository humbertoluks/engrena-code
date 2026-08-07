import type { ReactElement } from 'react'
import type { Message, ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../../services/db/repositories/subagents.js'
import { SubagentTimelineBlock } from '../subagents/SubagentTimelineBlock'

const COPY = {
  loading: 'Carregando histórico…',
  error: 'Falha ao carregar o histórico da thread.',
  emptyThread: 'Sem mensagens ainda. O histórico aparece conforme o agente executa.',
  emptyNoThread: 'Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral.',
  toolCompleted: 'concluído',
  toolCancelled: 'cancelado',
  toolInterrupted: 'interrompida',
  toolError: 'erro',
  toolRunning: 'trabalhando…',
} as const

const TOOL_STATUS_LABEL: Record<ToolCall['status'], string> = {
  completed: COPY.toolCompleted,
  cancelled: COPY.toolCancelled,
  interrupted: COPY.toolInterrupted,
  error: COPY.toolError,
  running: COPY.toolRunning,
}

const ROLE_LABEL: Record<Message['role'], string> = {
  user: 'Você',
  assistant: 'Agente',
  system: 'Sistema',
}

/** Fonte: `src/services/runner/subagent-registry.ts` (CALL_SUBAGENT_TOOL_NAME) — não importável no renderer (módulo server-only). */
const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

/**
 * Casa cada tool call `call_subagent` do pai com o `subagent_runs` correspondente (spec F15 §3.2):
 * primeiro por `parentToolCallId` (quando delegate.ts conseguiu correlacionar); o que sobrar casa
 * por ordem (FIFO — delegações no mesmo turno são serializadas, então a ordem é estável).
 */
function correlateSubagentRuns(toolCalls: ToolCall[], runs: SubagentRun[]): Map<string, SubagentRun> {
  const byToolCallId = new Map<string, SubagentRun>()
  const unmatchedRuns: SubagentRun[] = []
  for (const run of runs) {
    if (run.parentToolCallId) byToolCallId.set(run.parentToolCallId, run)
    else unmatchedRuns.push(run)
  }

  const unmatchedToolCalls = toolCalls.filter((t) => t.name === CALL_SUBAGENT_TOOL_NAME && !byToolCallId.has(t.id))
  for (let i = 0; i < unmatchedToolCalls.length && i < unmatchedRuns.length; i++) {
    byToolCallId.set(unmatchedToolCalls[i].id, unmatchedRuns[i])
  }
  return byToolCallId
}

export interface ChatHistoryProps {
  messages: Message[]
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  onOpenSubagentRun: (run: SubagentRun) => void
  loading: boolean
  error: string | null
  streamingText: string
  hasThread: boolean
}

export function ChatHistory({
  messages,
  toolCalls,
  subagentRuns,
  onOpenSubagentRun,
  loading,
  error,
  streamingText,
  hasThread,
}: Readonly<ChatHistoryProps>): ReactElement {
  if (loading) {
    return <p className="p-md text-[13px] text-muted">{COPY.loading}</p>
  }

  if (error !== null) {
    return (
      <p role="alert" className="p-md text-[13px] text-red">
        {error}
      </p>
    )
  }

  if (!hasThread) {
    return <p className="p-md text-[13px] text-muted">{COPY.emptyNoThread}</p>
  }

  if (messages.length === 0 && streamingText === '' && toolCalls.length === 0) {
    return <p className="p-md text-[13px] text-muted">{COPY.emptyThread}</p>
  }

  const runByToolCallId = correlateSubagentRuns(toolCalls, subagentRuns)

  return (
    <div className="flex flex-col gap-sm p-md">
      {messages.map((message) => (
        <div key={message.id} className={message.role === 'user' ? 'self-end text-right' : 'self-start'}>
          <p className="mb-[2px] text-[10px] uppercase tracking-wide text-muted">{ROLE_LABEL[message.role]}</p>
          <div
            className={`inline-block max-w-[42rem] whitespace-pre-wrap rounded-lg px-sm py-xs text-[13px] ${
              message.role === 'user' ? 'bg-accent/15 text-fg' : 'bg-surface-2 text-fg'
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}

      {toolCalls.map((tool) => {
        const run = runByToolCallId.get(tool.id)
        if (run) {
          return (
            <div key={tool.id} className="self-start w-full max-w-[42rem]">
              <SubagentTimelineBlock run={run} onOpen={onOpenSubagentRun} />
            </div>
          )
        }
        return (
          <div key={tool.id} className="self-start rounded-lg border border-border bg-surface-2 px-sm py-xs text-[12px] text-muted">
            <span className="font-mono">{tool.name}</span> — {TOOL_STATUS_LABEL[tool.status]}
          </div>
        )
      })}

      {streamingText !== '' ? (
        <div className="self-start">
          <p className="mb-[2px] text-[10px] uppercase tracking-wide text-muted">{ROLE_LABEL.assistant}</p>
          <div className="inline-block max-w-[42rem] whitespace-pre-wrap rounded-lg bg-surface-2 px-sm py-xs text-[13px] text-fg">
            {streamingText}
          </div>
        </div>
      ) : null}
    </div>
  )
}
