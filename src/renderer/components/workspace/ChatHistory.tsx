import type { ReactElement } from 'react'
import type { Message, ToolCall } from '../../services/threads-service'

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

export interface ChatHistoryProps {
  messages: Message[]
  toolCalls: ToolCall[]
  loading: boolean
  error: string | null
  streamingText: string
  hasThread: boolean
}

export function ChatHistory({ messages, toolCalls, loading, error, streamingText, hasThread }: Readonly<ChatHistoryProps>): ReactElement {
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

      {toolCalls.map((tool) => (
        <div key={tool.id} className="self-start rounded-lg border border-border bg-surface-2 px-sm py-xs text-[12px] text-muted">
          <span className="font-mono">{tool.name}</span> — {TOOL_STATUS_LABEL[tool.status]}
        </div>
      ))}

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
