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
  /** `messages.client_id` — o id desta bolha, gerado no envio. `null` no que nasce no servidor. */
  clientId?: string | null
}

/**
 * Remove as bolhas otimistas já materializadas pelo servidor, casando pelo id que o envio
 * carregou (`PendingMessage.id` → `clientMessageId` → `Message.clientId`).
 *
 * Nunca por conteúdo: o servidor reescreve o prompt antes de persistir (prefixo de modo de chat,
 * blocos de anexo, expansão de slash), então o texto gravado costuma diferir do digitado e a bolha
 * ficava para sempre — mensagem duplicada na tela. No inverso, duas mensagens iguais com só uma
 * persistida limpavam a bolha errada.
 *
 * `queued` e `permission` nunca casam: a primeira ainda não foi despachada e a segunda não é
 * mensagem (resposta a card de permissão não entra no histórico).
 */
export function reconcilePendingMessages(
  pending: readonly PendingMessage[],
  serverMessages: readonly ServerMessageLike[]
): PendingMessage[] {
  const persisted = new Set<string>()
  for (const message of serverMessages) {
    if (message.role !== 'user') continue
    if (typeof message.clientId === 'string' && message.clientId !== '') persisted.add(message.clientId)
  }

  return pending.filter((item) => {
    if (item.status !== 'sending' && item.status !== 'sent') return true
    return !persisted.has(item.id)
  })
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

/**
 * Resposta a PermissionPrompt / ask_user_question não entra no histórico do servidor.
 * Nunca promover essas bolhas para `sent`: o rótulo vira "Executando…" e o reconcile
 * nunca as remove — o próximo card de permissão nascia sob um "Permitir / Executando…"
 * fantasma (como se o trabalho anterior ainda rodasse).
 */
export function dropPermissionDecisionPendings(
  pending: readonly PendingMessage[]
): PendingMessage[] {
  return pending.filter((p) => p.status !== 'permission')
}

/**
 * Limpa decisões de permissão (status `permission`) e resíduos já promovidos a `sent`
 * cujo texto ainda é uma decisão (Permitir/Negar/…). Usado ao chegar um novo
 * `permission.request` para a timeline não misturar grant antigo com pedido novo.
 */
export function dropStalePermissionDecisionPendings(
  pending: readonly PendingMessage[],
  isPermissionDecisionText: (text: string) => boolean
): PendingMessage[] {
  return pending.filter((p) => {
    if (p.status === 'permission') return false
    if (p.status === 'sent' && isPermissionDecisionText(p.text)) return false
    return true
  })
}
