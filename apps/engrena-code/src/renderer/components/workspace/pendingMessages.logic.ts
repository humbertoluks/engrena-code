/**
 * Bolhas otimistas do usuário no chat.
 *
 * O histórico só é re-buscado em `tool_call.start`/`state.change`; sem bolha local a mensagem
 * enviada fica invisível enquanto o agente pensa (turno de 52 s = 52 s de tela sem resposta,
 * e o usuário reenvia por engano). Cada envio entra aqui na hora e sai quando o `GET /history`
 * traz a mensagem persistida equivalente.
 */

export type PendingMessageStatus =
  /** POST em voo. */
  | 'sending'
  /** Backend aceitou; aguardando o histórico trazer a mensagem persistida. */
  | 'sent'
  /** Turno atual ocupado — sai da fila quando a thread ficar idle. */
  | 'queued'
  /** Resposta a um PermissionPrompt: resolve o PreToolUse, nunca vira mensagem no banco. */
  | 'permission'

export interface PendingImage {
  /** Id do anexo no composer — chave estável da miniatura. */
  id: string
  mimeType: string
  name?: string
  dataBase64: string
}

export interface PendingMessage {
  id: string
  text: string
  images: PendingImage[]
  status: PendingMessageStatus
  createdAt: number
}

interface ServerMessageLike {
  role: 'user' | 'assistant' | 'system'
  content: string | null
}

/**
 * Remove as bolhas otimistas já materializadas pelo servidor, casando por conteúdo com
 * contagem (o mesmo texto enviado duas vezes só descarta duas bolhas). `queued` e
 * `permission` nunca casam: a primeira ainda não foi despachada e a segunda não é mensagem.
 */
export function reconcilePendingMessages(
  pending: readonly PendingMessage[],
  serverMessages: readonly ServerMessageLike[]
): PendingMessage[] {
  const available = new Map<string, number>()
  for (const message of serverMessages) {
    if (message.role !== 'user') continue
    const text = (message.content ?? '').trim()
    available.set(text, (available.get(text) ?? 0) + 1)
  }

  const kept: PendingMessage[] = []
  for (const item of pending) {
    if (item.status !== 'sending' && item.status !== 'sent') {
      kept.push(item)
      continue
    }
    const text = item.text.trim()
    const remaining = available.get(text) ?? 0
    if (remaining > 0) {
      available.set(text, remaining - 1)
      continue
    }
    kept.push(item)
  }
  return kept
}

const STATUS_LABEL: Record<PendingMessageStatus, string> = {
  sending: 'Enviando…',
  sent: 'Executando…',
  queued: 'Na fila — aguarde o turno atual terminar',
  permission: 'Resposta enviada ao pedido de permissão',
}

export function pendingStatusLabel(status: PendingMessageStatus): string {
  return STATUS_LABEL[status]
}

/** `sending`/`queued` seguem em movimento — a UI anima o indicador só nesses casos. */
export function isPendingActive(status: PendingMessageStatus): boolean {
  return status !== 'permission'
}
