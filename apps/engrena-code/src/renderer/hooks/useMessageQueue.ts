import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComposerAttachment } from '../components/workspace/composerAttachments.logic'
import {
  appendItem,
  dispatchQueueHead,
  loadQueue,
  makeQueueItemId,
  normalizeQueueText,
  promoteItem,
  removeItem,
  saveQueue,
  updateItemText,
  type ComposerImage,
  type QueueItem,
} from './messageQueue.logic'

/** Assinatura do envio real (`sendFollowUp`): `false` = não rodou, o item volta para a fila. */
export type QueueFollowUp = (
  text: string,
  images: ComposerImage[],
  model: string | null,
  reasoningLevel: string | null,
  attachments: ComposerAttachment[]
) => Promise<boolean>

export interface MessageQueueApi {
  queue: QueueItem[]
  enqueue: (
    text: string,
    images: ComposerImage[],
    model: string | null,
    reasoningLevel: string | null,
    attachments?: ComposerAttachment[]
  ) => void
  dequeue: (id: string) => void
  updateQueueItem: (id: string, text: string) => void
  /** Move o item para a frente, para rodar assim que o turno acabar. */
  promoteQueueItem: (id: string) => void
  /** Turno assentou: despacha o topo da fila, se houver. */
  processQueueIfIdle: () => void
}

/**
 * Fila de mensagens do composer: o que o usuário mandou enquanto o turno ainda rodava.
 *
 * Persiste em `localStorage` por `queueKey` (thread, ou projeto antes da thread existir) — toda
 * mutação grava, senão a fila some no reload. Trocar de thread/projeto rehidrata a fila da chave
 * nova.
 */
export function useMessageQueue(input: {
  queueKey: string
  /** `selectedThreadId !== null`: sem thread não há para onde despachar. */
  canDispatch: boolean
  followUp: QueueFollowUp
}): MessageQueueApi {
  const { queueKey, canDispatch, followUp } = input
  const [queue, setQueue] = useState<QueueItem[]>([])

  // A fila é lida pelo handler de WS, que roda com o closure do render em que a conexão subiu —
  // o ref mantém o valor corrente sem reconectar o stream a cada mudança de fila.
  const queueRef = useRef<QueueItem[]>([])
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    const restored = loadQueue(queueKey)
    queueRef.current = restored
    setQueue(restored)
  }, [queueKey])

  // Mesma razão do `queueRef`: o handler de WS chamaria uma versão antiga de `sendFollowUp`
  // (com `composer.accessLevel` congelado no render da conexão).
  const followUpRef = useRef(followUp)
  useEffect(() => {
    followUpRef.current = followUp
  }, [followUp])

  const enqueue = useCallback(
    (
      text: string,
      images: ComposerImage[],
      model: string | null,
      reasoningLevel: string | null,
      attachments: ComposerAttachment[] = []
    ) => {
      setQueue((prev) => {
        const next = appendItem(prev, {
          id: makeQueueItemId(),
          text,
          images,
          attachments,
          model,
          reasoningLevel,
        })
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  const dequeue = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const next = removeItem(prev, id)
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  const updateQueueItem = useCallback(
    (id: string, text: string) => {
      const trimmed = normalizeQueueText(text)
      if (trimmed === null) return
      setQueue((prev) => {
        const next = updateItemText(prev, id, trimmed)
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  const promoteQueueItem = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const next = promoteItem(prev, id)
        if (next === prev) return prev
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  // O despacho da fila roda fora do updater do `setQueue`: updater com efeito colateral é
  // chamado duas vezes sob StrictMode e mandava o mesmo follow-up em dobro.
  function processQueueIfIdle(): void {
    dispatchQueueHead({
      read: () => queueRef.current,
      commit: (next) => {
        queueRef.current = next
        setQueue(next)
        saveQueue(queueKey, next)
      },
      canDispatch,
      send: (item) =>
        followUpRef.current(item.text, item.images, item.model, item.reasoningLevel, item.attachments ?? []),
    })
  }

  return { queue, enqueue, dequeue, updateQueueItem, promoteQueueItem, processQueueIfIdle }
}
