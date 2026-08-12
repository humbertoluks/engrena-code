import type { Message, ToolCall } from '../db/repositories/messages.js'
import type { Thread } from '../db/repositories/threads.js'

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

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 19)
}

const ROLE_TITLE: Record<Message['role'], string> = {
  user: 'Você',
  assistant: 'Agente',
  system: 'Sistema',
}

export function exportThreadAsMarkdown({ thread, messages, toolCalls }: ThreadExportInput): string {
  const lines: string[] = [
    `# ${thread.title ?? 'Conversa sem título'}`,
    '',
    `- Thread: \`${thread.id}\``,
    `- Provider: ${thread.provider}${thread.model ? ` (${thread.model})` : ''}`,
    `- Criada em: ${formatTimestamp(thread.createdAt)}`,
    `- Mensagens: ${messages.length} · Tool calls: ${toolCalls.length}`,
    '',
  ]

  for (const message of messages) {
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

  if (toolCalls.length > 0) {
    lines.push('## Work log', '')
    for (const tool of toolCalls) {
      lines.push(`- \`${tool.name}\` — ${tool.status}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function exportThreadAsJson({ thread, messages, toolCalls }: ThreadExportInput): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      thread,
      messages,
      toolCalls,
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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const shortId = thread.id.replace('thr_', '').slice(0, 8)
  return `${base || 'conversa'}-${shortId}.${format}`
}
