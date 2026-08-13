// Uma sessão por turno vivo, keyed por `threadId` — dona de tudo que o turno registra em memória.
// Substitui os registries disjuntos de `turn-control.ts` (controller, marcas de cancelamento,
// closers de server) e o `stoppingDeadlines` local de `dispatch.ts`, que tinham lifecycles
// diferentes e nenhum dono: cada um era limpo num ponto do código, alguns nunca.
//
// Módulo neutro de propósito (só timers e callbacks, sem db/gate/servers): `dispatch.ts` e
// `pipeline-runner.ts` usam a mesma sessão, e pipeline é chamado *por* dispatch — estado em
// qualquer um dos dois viraria import circular.
//
// Fora daqui, de propósito:
// - lease do projeto (`project-execution.ts`) é keyed por `projectId`, não por thread; a sessão
//   guarda só o handle de liberação e o chama uma única vez no fim.
// - allowlist de "Permitir todos" (`permission-broker.ts`) é da *sessão da thread*, que atravessa
//   turnos; amarrá-la a esta sessão faria a tool voltar a pedir permissão no turno seguinte.

export interface TurnSession {
  readonly threadId: string
  readonly projectId: string
  readonly controller: AbortController
  /** `cancelThread` pediu parada neste turno. Morre com a sessão — nunca vira marca eterna. */
  cancelRequested: boolean
  /** Deadline de `stopping` já assentou o turno no banco: não aceita novo cancelamento. */
  settled: boolean
}

interface TurnSessionRecord {
  threadId: string
  projectId: string
  controller: AbortController
  cancelRequested: boolean
  settled: boolean
  /** permission / ask / delegation / memory servers do turno. */
  closers: Array<() => void>
  stoppingDeadline?: ReturnType<typeof setTimeout>
  releaseLease: () => void
  leaseReleased: boolean
}

const sessions = new Map<string, TurnSessionRecord>()

export interface StartTurnSessionInput {
  threadId: string
  projectId: string
  /** Chamado uma única vez no `endTurnSession` — o turno é dono de soltar a lease que o dispatch pegou. */
  releaseLease: () => void
  /** Injetável para teste; produção deixa a sessão criar o seu. */
  controller?: AbortController
}

function runClosers(record: TurnSessionRecord): void {
  if (record.closers.length === 0) return
  // Esvazia antes de rodar: `closeTurnServers` é chamado no cancel *e* de novo no `finally`.
  const pending = record.closers.splice(0, record.closers.length)
  for (const close of pending) {
    try {
      close()
    } catch {
      // best-effort — o processo/server pode já ter morrido
    }
  }
}

function clearDeadline(record: TurnSessionRecord): void {
  if (record.stoppingDeadline === undefined) return
  clearTimeout(record.stoppingDeadline)
  record.stoppingDeadline = undefined
}

export function startTurnSession(input: StartTurnSessionInput): TurnSession {
  const previous = sessions.get(input.threadId)
  if (previous) {
    // Registro velho da mesma thread (turno que não passou pelo `finally`): fecha o que ficou
    // aberto, mas nunca solta a lease — quem a detém agora é o turno que está começando.
    clearDeadline(previous)
    runClosers(previous)
  }

  const record: TurnSessionRecord = {
    threadId: input.threadId,
    projectId: input.projectId,
    controller: input.controller ?? new AbortController(),
    cancelRequested: false,
    settled: false,
    closers: [],
    releaseLease: input.releaseLease,
    leaseReleased: false,
  }
  sessions.set(input.threadId, record)
  return record
}

/** Sessão registrada para a thread, inclusive a já assentada pelo deadline. */
export function getTurnSession(threadId: string): TurnSession | undefined {
  return sessions.get(threadId)
}

/**
 * Sessão que ainda aceita cancelamento. Depois do deadline de `stopping` o turno já foi assentado
 * no banco: um novo Stop precisa cair no caminho de thread órfã, não abortar de novo.
 */
export function getCancellableTurnSession(threadId: string): TurnSession | undefined {
  const record = sessions.get(threadId)
  if (!record || record.settled) return undefined
  return record
}

/** Registra um fechador do turno (idempotente por execução: cada closer roda no máximo uma vez). */
export function addTurnCloser(threadId: string, close: () => void): void {
  sessions.get(threadId)?.closers.push(close)
}

/** Fecha os servers do turno. Chamado no cancel *antes* do abort e de novo no `finally`. */
export function closeTurnServers(threadId: string): void {
  const record = sessions.get(threadId)
  if (!record) return
  runClosers(record)
}

export function scheduleStoppingDeadline(threadId: string, ms: number, onDeadline: () => void): void {
  const record = sessions.get(threadId)
  if (!record) return
  clearDeadline(record)
  record.stoppingDeadline = setTimeout(() => {
    record.stoppingDeadline = undefined
    onDeadline()
  }, ms)
}

export function clearStoppingDeadline(threadId: string): void {
  const record = sessions.get(threadId)
  if (!record) return
  clearDeadline(record)
}

/** O deadline de `stopping` já escreveu o estado final — a sessão para de aceitar cancelamento. */
export function markTurnSettled(threadId: string): void {
  const record = sessions.get(threadId)
  if (!record) return
  record.settled = true
}

/**
 * Fim do turno: fecha closers, limpa o deadline, solta a lease (uma única vez) e descarta a
 * sessão. Ponto único de limpeza — nenhum chamador precisa lembrar de cada registry.
 */
export function endTurnSession(threadId: string): void {
  const record = sessions.get(threadId)
  if (!record) return
  sessions.delete(threadId)
  clearDeadline(record)
  runClosers(record)
  if (record.leaseReleased) return
  record.leaseReleased = true
  try {
    record.releaseLease()
  } catch {
    // liberar lease nunca pode derrubar o fim do turno
  }
}

/** Apenas para testes: descarta as sessões vivas entre specs (sem soltar lease). */
export function clearAllTurnSessionsForTesting(): void {
  for (const record of sessions.values()) clearDeadline(record)
  sessions.clear()
}
