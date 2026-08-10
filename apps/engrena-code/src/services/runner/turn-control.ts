// Estado compartilhado de cancelamento entre `dispatch.ts` (turno normal) e `pipeline-runner.ts`
// (F22) — extraído pra módulo neutro porque pipeline-runner é chamado *por* dispatch.ts; se esse
// estado vivesse em dispatch.ts, pipeline-runner precisaria importar de volta (import circular).

const activeControllers = new Map<string, AbortController>()
const cancelledThreads = new Set<string>()

export function registerActiveController(threadId: string, controller: AbortController): void {
  activeControllers.set(threadId, controller)
}

export function unregisterActiveController(threadId: string): void {
  activeControllers.delete(threadId)
}

export function getActiveController(threadId: string): AbortController | undefined {
  return activeControllers.get(threadId)
}

export function markThreadCancelled(threadId: string): void {
  cancelledThreads.add(threadId)
}

/** Consome (remove) a marca de cancelamento — `true` se a thread tinha sido marcada. */
export function consumeThreadCancelled(threadId: string): boolean {
  return cancelledThreads.delete(threadId)
}
