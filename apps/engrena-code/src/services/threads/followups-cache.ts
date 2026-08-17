/**
 * Cache das sugestões de follow-up, por thread, chaveado pela mensagem que as gerou.
 *
 * Vive fora do handler HTTP porque quem começa a geração é o fim do turno (`dispatch.runTurn`),
 * ainda durante a coleta de diffs: quando a UI pede as sugestões, na maioria das vezes elas já
 * estão prontas. Sem isso o usuário lia a pergunta do agente, respondia, e só então as opções
 * apareciam — embaixo da mensagem errada.
 */

/**
 * Teto do cache. Sugestão é conveniência de UI, não dado: guardar mais que isso num processo longo
 * é ocupar memória com resposta que ninguém vai pedir de novo. O `DELETE` da thread já limpa a
 * entrada dela, mas nada limpava o acúmulo de threads que só foram abertas e deixadas de lado.
 */
export const MAX_CACHED_THREADS = 50

/** Sugestão velha não vale ser servida: o contexto do turno já mudou. */
export const FOLLOWUPS_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  messageId: string
  followups: string[]
  createdAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, { messageId: string; promise: Promise<string[]> }>()

export function getCachedFollowups(threadId: string, messageId: string): string[] | null {
  const entry = cache.get(threadId)
  if (entry === undefined || entry.messageId !== messageId) return null
  if (Date.now() - entry.createdAt > FOLLOWUPS_TTL_MS) {
    cache.delete(threadId)
    return null
  }
  return entry.followups
}

/**
 * Poda na escrita, que é o único momento em que o cache cresce. `Map` itera na ordem de inserção,
 * e cada gravação reinsere a thread, então a primeira chave é sempre a menos recentemente escrita.
 */
function evictOldestIfNeeded(): void {
  while (cache.size > MAX_CACHED_THREADS) {
    const oldest = cache.keys().next()
    if (oldest.done === true) return
    cache.delete(oldest.value)
  }
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
      cache.delete(threadId)
      cache.set(threadId, { messageId, followups, createdAt: Date.now() })
      evictOldestIfNeeded()
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
