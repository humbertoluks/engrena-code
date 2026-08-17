import type { Message, ToolCall, ToolCallStatus } from '../db/repositories/messages.js'
import type { Thread, ThreadState } from '../db/repositories/threads.js'

/**
 * Exportação de uma conversa (equivalente ao `chatImportExport.ts` do VS Code).
 *
 * Markdown é o formato de leitura/compartilhamento; JSON preserva o histórico cru para reimportar
 * ou auditar. Nenhum dos dois inclui segredo: só o que já está visível no chat.
 */

export interface ThreadExportInput {
  thread: Thread
  messages: readonly Message[]
  toolCalls: readonly ToolCall[]
}

/** Estados em que o turno já assentou (ou está a assentar): tool `running` no snapshot vira settlement. */
const SETTLED_THREAD_STATES = new Set<ThreadState>([
  'cancelled',
  'stopping',
  'error',
  'idle',
  'committed',
])

function settledStatusForThread(state: ThreadState): Extract<ToolCallStatus, 'cancelled' | 'interrupted'> {
  if (state === 'error') return 'interrupted'
  return 'cancelled'
}

/**
 * Normaliza o snapshot de exportação.
 * Em threads já assentadas (cancelled/stopping/error/idle/committed), tool calls ainda `running`
 * aparecem como cancelled/interrupted — o cancel pode assentar o DB um tick depois do state.change,
 * e o export mid-race não deve omitir o settlement.
 * Em running/waiting_* o snapshot mantém `running` (turno vivo).
 */
export function buildExportSnapshot(input: ThreadExportInput): ThreadExportInput {
  const { thread, messages, toolCalls } = input
  if (!SETTLED_THREAD_STATES.has(thread.state)) {
    return { thread, messages: [...messages], toolCalls: [...toolCalls] }
  }

  const status = settledStatusForThread(thread.state)
  const now = Date.now()
  return {
    thread,
    messages: [...messages],
    toolCalls: toolCalls.map((tc) =>
      tc.status === 'running'
        ? { ...tc, status, endedAt: tc.endedAt ?? now }
        : tc
    ),
  }
}

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 19)
}

const ROLE_TITLE: Record<Message['role'], string> = {
  user: 'Você',
  assistant: 'Agente',
  system: 'Sistema',
}

export function exportThreadAsMarkdown({ thread, messages, toolCalls }: ThreadExportInput): string {
  const snapshot = buildExportSnapshot({ thread, messages, toolCalls })
  const lines: string[] = [
    `# ${snapshot.thread.title ?? 'Conversa sem título'}`,
    '',
    `- Thread: \`${snapshot.thread.id}\``,
    `- Estado: ${snapshot.thread.state}`,
    `- Provider: ${snapshot.thread.provider}${snapshot.thread.model ? ` (${snapshot.thread.model})` : ''}`,
    `- Criada em: ${formatTimestamp(snapshot.thread.createdAt)}`,
    `- Mensagens: ${snapshot.messages.length} · Tool calls: ${snapshot.toolCalls.length}`,
    '',
  ]

  for (const message of snapshot.messages) {
    lines.push(`## ${ROLE_TITLE[message.role]} — ${formatTimestamp(message.createdAt)}`, '')
    lines.push(message.content ?? '_(sem texto)_', '')
    const attached = (message.blocks ?? []).filter(
      (block): block is { type: string; label?: string } =>
        typeof block === 'object' && block !== null && 'type' in block
    )
    const context = attached.filter((b) => b.type === 'context')
    if (context.length > 0) {
      lines.push(`Contexto anexado: ${context.map((c) => c.label ?? '').join(', ')}`, '')
    }
    const images = attached.filter((b) => b.type === 'image')
    if (images.length > 0) {
      lines.push(`Imagens anexadas: ${images.length}`, '')
    }
  }

  if (snapshot.toolCalls.length > 0) {
    lines.push('## Work log', '')
    for (const tool of snapshot.toolCalls) {
      lines.push(`- \`${tool.name}\` — ${tool.status}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function exportThreadAsJson({ thread, messages, toolCalls }: ThreadExportInput): string {
  const snapshot = buildExportSnapshot({ thread, messages, toolCalls })
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      thread: snapshot.thread,
      messages: snapshot.messages,
      toolCalls: snapshot.toolCalls,
    },
    null,
    2
  )
}

/** Nome de arquivo sugerido: título higienizado + id curto, sem caractere proibido no Windows. */
export function exportFileName(thread: Thread, format: 'md' | 'json'): string {
  const base = (thread.title ?? 'conversa')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const shortId = thread.id.replace('thr_', '').slice(0, 8)
  return `${base || 'conversa'}-${shortId}.${format}`
}
