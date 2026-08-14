import type { ComposerAttachment } from '../components/workspace/composerAttachments.logic'

/**
 * Chave de persistência da fila (por thread; por projeto enquanto a thread não existe).
 * Prefixo e formato serializado são contrato com a fila real do usuário — mudar qualquer um
 * apaga mensagens já enfileiradas no próximo reload.
 */
export const QUEUE_STORAGE_PREFIX = 'engrenacode.message-queue.v1.'

export interface ComposerImage {
  id: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  name: string
  dataBase64: string
  byteLength: number
}

export interface QueueItem {
  id: string
  text: string
  images: ComposerImage[]
  /** Contexto anexado quando a mensagem entrou na fila — sem isto o turno enfileirado perde os chips. */
  attachments?: ComposerAttachment[]
  model: string | null
  reasoningLevel: string | null
}

// ── Transformações puras da lista ────────────────────────────────────────────
// Nenhuma delas toca `localStorage` nem React: a persistência é do chamador, que a faz na
// mesma passada em que espelha ref + estado (ver `useMessageQueue`).

export function makeQueueItemId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function appendItem(queue: readonly QueueItem[], item: QueueItem): QueueItem[] {
  return [...queue, item]
}

export function removeItem(queue: readonly QueueItem[], id: string): QueueItem[] {
  return queue.filter((q) => q.id !== id)
}

/**
 * `null` = texto vazio depois do `trim()`. O chamador ignora a edição em vez de gravar item
 * vazio na fila (que ficaria impossível de distinguir de um item legítimo em branco).
 */
export function normalizeQueueText(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : trimmed
}

export function updateItemText(
  queue: readonly QueueItem[],
  id: string,
  trimmedText: string
): QueueItem[] {
  return queue.map((q) => (q.id === id ? { ...q, text: trimmedText } : q))
}

/**
 * Move o item para a frente, para rodar assim que o turno acabar. No-op — devolve a **mesma
 * referência** — quando o item já é o primeiro ou não existe na fila.
 */
export function promoteItem(queue: QueueItem[], id: string): QueueItem[] {
  const idx = queue.findIndex((q) => q.id === id)
  if (idx <= 0) return queue
  const item = queue[idx]
  if (!item) return queue
  return [item, ...queue.slice(0, idx), ...queue.slice(idx + 1)]
}

/** Split do despacho: o topo sai da fila **antes** do POST. */
export function splitHead(queue: readonly QueueItem[]): { head: QueueItem | null; rest: QueueItem[] } {
  const [head, ...rest] = queue
  return { head: head ?? null, rest }
}

/**
 * Envio falhou: o item volta para a **frente** da fila corrente (que pode ter crescido enquanto
 * o POST voava); sem isto a mensagem enfileirada some sem nunca ter rodado.
 */
export function restoreHead(head: QueueItem, queue: readonly QueueItem[]): QueueItem[] {
  return [head, ...queue]
}

// ── Despacho ─────────────────────────────────────────────────────────────────

/** Envio real de um item da fila. `false` = não rodou (ex.: outra thread pegou a lease). */
export type QueueSend = (item: QueueItem) => Promise<boolean>

export interface QueueDispatchPort {
  /** Fila corrente — no hook é o `queueRef`, não o estado do render. */
  read: () => QueueItem[]
  /** Espelha ref + estado + `saveQueue` numa passada só: toda mutação persiste. */
  commit: (next: QueueItem[]) => void
  /** Sem thread selecionada não há para onde despachar. */
  canDispatch: boolean
  send: QueueSend
}

/**
 * Despacha o topo da fila. Roda **fora** de qualquer updater do `setQueue`: updater com efeito
 * colateral é chamado duas vezes sob StrictMode e mandava o mesmo follow-up em dobro.
 *
 * O item sai da fila antes do POST (evita despacho duplo se outro `state.change` chegar no meio);
 * se o envio devolver `false` ele volta para a frente da fila corrente.
 */
export function dispatchQueueHead(port: QueueDispatchPort): void {
  const { head, rest } = splitHead(port.read())
  if (!head || !port.canDispatch) return
  port.commit(rest)
  void port.send(head).then((ok) => {
    if (ok) return
    port.commit(restoreHead(head, port.read()))
  })
}

// ── Serialização (única parte que fala com `localStorage`) ───────────────────

export function loadQueue(threadKey: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_PREFIX + threadKey)
    if (!raw) return []
    return JSON.parse(raw) as QueueItem[]
  } catch {
    return []
  }
}

export function saveQueue(threadKey: string, queue: QueueItem[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_STORAGE_PREFIX + threadKey)
    else localStorage.setItem(QUEUE_STORAGE_PREFIX + threadKey, JSON.stringify(queue))
  } catch {
    // localStorage indisponível — fila só em memória nesta sessão
  }
}
