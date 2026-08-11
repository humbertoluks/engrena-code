/**
 * Cache das sugestões de follow-up, por thread, chaveado pela mensagem que as gerou.
 *
 * Vive fora do handler HTTP porque quem começa a geração é o fim do turno (`dispatch.runTurn`),
 * ainda durante a coleta de diffs: quando a UI pede as sugestões, na maioria das vezes elas já
 * estão prontas. Sem isso o usuário lia a pergunta do agente, respondia, e só então as opções
 * apareciam — embaixo da mensagem errada.
 */

interface CacheEntry {
  messageId: string
  followups: string[]
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, { messageId: string; promise: Promise<string[]> }>()

export function getCachedFollowups(threadId: string, messageId: string): string[] | null {
  const entry = cache.get(threadId)
  return entry !== undefined && entry.messageId === messageId ? entry.followups : null
}

/**
 * Gera uma vez por mensagem: chamada concorrente (prefetch do turno + GET da UI) espera a mesma
 * promise em vez de abrir um segundo processo do provider.
 */
export async function resolveFollowups(
  threadId: string,
  messageId: string,
  generate: () => Promise<string[]>
): Promise<string[]> {
  const cached = getCachedFollowups(threadId, messageId)
  if (cached !== null) return cached

  const pending = inflight.get(threadId)
  if (pending !== undefined && pending.messageId === messageId) return pending.promise

  const promise = generate()
    .then((followups) => {
      cache.set(threadId, { messageId, followups })
      return followups
    })
    .catch(() => [])
    .finally(() => {
      const current = inflight.get(threadId)
      if (current !== undefined && current.messageId === messageId) inflight.delete(threadId)
    })

  inflight.set(threadId, { messageId, promise })
  return promise
}

export function clearFollowups(threadId: string): void {
  cache.delete(threadId)
  inflight.delete(threadId)
}

export function clearAllFollowupsForTesting(): void {
  cache.clear()
  inflight.clear()
}
