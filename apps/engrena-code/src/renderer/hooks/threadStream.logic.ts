/**
 * Regra pura da conexão de stream da thread — o que dá para decidir sem WebSocket nem React.
 *
 * O `emit` do hub (`services/runner/ws-hub.ts`) é **no-op quando não há subscriber**: o que passou
 * durante uma queda de socket não fica bufferizado em lugar nenhum. Reconectar, portanto, não pode
 * "replicar o que perdi" — a única recuperação correta é reler estado (`GET /history` + snapshot
 * `GET /gate`), que é idempotente porque entra por merge por id.
 *
 * Daí o desenho: o hook cuida do ciclo de vida do socket e este módulo cuida das decisões
 * (quanto esperar antes de tentar de novo, se ainda vale tentar, se o resync precisa reler o
 * histórico). Tudo aqui é determinístico com a fonte de aleatoriedade injetada.
 */

/** Primeiro passo do backoff. */
export const RECONNECT_BASE_DELAY_MS = 1_000
/** Teto do backoff: a partir daqui a espera não cresce mais. */
export const RECONNECT_MAX_DELAY_MS = 30_000

/**
 * Delay da tentativa `attempt` (1 = primeira retentativa depois da queda).
 *
 * Exponencial 1s → 2s → 4s … com teto de 30s e **equal jitter**: o resultado cai em
 * `[base/2, base]`. O jitter não é enfeite — sem ele, N janelas do app que caíram junto (servidor
 * local reiniciado, cofre trancado) voltam a bater na mesma porta no mesmo milissegundo, para
 * sempre. `random` é injetável para o teste não depender de `Math.random`.
 */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const safeAttempt = Math.max(1, Math.floor(attempt))
  // `2 ** grande` vira Infinity; `Math.min` com o teto resolve sem caso especial.
  const base = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (safeAttempt - 1), RECONNECT_MAX_DELAY_MS)
  const roll = Math.min(Math.max(random(), 0), 1)
  return Math.round(base / 2 + roll * (base / 2))
}

export interface ReconnectPlan {
  /** Número da tentativa que este plano agenda (o `attempt` novo). */
  attempt: number
  delayMs: number
}

/**
 * Decide a próxima retentativa. `null` = não tente mais.
 *
 * `abandoned` é a conexão que já foi descartada (unmount ou troca de thread): um socket órfão
 * reconectando escreveria eventos na timeline da thread errada, então a decisão de parar mora
 * aqui e não num `if` espalhado pelo hook.
 */
export function planReconnect(input: {
  previousAttempt: number
  abandoned: boolean
  random?: () => number
}): ReconnectPlan | null {
  if (input.abandoned) return null
  const attempt = Math.max(0, Math.floor(input.previousAttempt)) + 1
  return { attempt, delayMs: reconnectDelayMs(attempt, input.random ?? Math.random) }
}

/**
 * O resync precisa reler o histórico?
 *
 * Reconnect: **sempre**. A lacuna pode ser maior que o fetch em voo — um `GET /history` que
 * partiu antes da queda devolve o estado de antes dela, e o hub não vai reemitir o que passou.
 *
 * Primeiro open: só se não houver fetch em voo. A abertura da thread já dispara o `GET /history`
 * em primeiro plano, e o open do socket chega logo depois; sem esta checagem todo clique numa
 * thread rende um GET redundante (o `HistoryRefetchGate` coalesce, mas coalescer significa
 * exatamente "roda mais um depois"). Este é o consumidor de produção do getter `hasInflight`.
 */
export function shouldRefetchHistoryOnResync(input: {
  reconnect: boolean
  historyFetchInflight: boolean
}): boolean {
  if (input.reconnect) return true
  return !input.historyFetchInflight
}

/**
 * Filtro de thread do handler. O hub assina por thread, mas a conexão vive num efeito que pode
 * sobreviver a um frame de troca de thread; o evento da thread anterior não pode entrar na
 * timeline da atual.
 */
export function isEventForThread(event: { threadId: string }, threadId: string | null): boolean {
  return threadId !== null && event.threadId === threadId
}
