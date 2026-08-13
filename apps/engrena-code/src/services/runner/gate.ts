import {
  closeThreadGate,
  countOpenThreadGates,
  createThreadGate,
  deleteAllThreadGatesForTesting,
  getThreadGate,
  listAllOpenThreadGates,
  listOpenThreadGates,
  type ThreadGate,
} from '../db/repositories/thread-gates.js'
import { getThread, updateThread, type ThreadAccessLevel } from '../db/repositories/threads.js'
import { permissionPolicyDecision } from './permission-policy.js'
import { emit } from './ws-hub.js'

/** Fail-closed: sem resposta do usuário, a tool é negada e o HTTP do hook não fica preso 10+ min. */
export const PERMISSION_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Dono único do fato "há um gate aberto nesta thread".
 *
 * O split que este módulo existe para manter:
 * - **SQLite** (`thread_gates`) guarda o fato declarativo — existe gate, de que tipo, com que
 *   payload, desde quando. Sobrevive a crash/restart.
 * - **Memória** guarda só o que não dá para persistir: a continuação `resolve(allow)` que destrava
 *   o socket HTTP do hook `PreToolUse`, ainda aberto do outro lado. Keyed por `gateId`.
 *
 * `threads.state = 'waiting_permission'` é escrito **só** por `openPermissionGate` e abandonado
 * **só** por resolução/expiração — estado da thread e existência de gate não podem divergir.
 */
interface GateContinuation {
  threadId: string
  resolve: (allow: boolean) => void
  timeoutId: ReturnType<typeof setTimeout>
}

const continuations = new Map<string, GateContinuation>()

/** Shape de wire do gate de permissão — `requestId` é o `gateId`, mantido pelo contrato do renderer. */
export interface PermissionRequestInfo {
  requestId: string
  threadId: string
  toolName: string
  params: unknown
  createdAt?: number
}

function toPermissionRequestInfo(gate: ThreadGate): PermissionRequestInfo {
  return {
    requestId: gate.id,
    threadId: gate.threadId,
    toolName: gate.toolName ?? 'unknown',
    params: gate.payload,
    createdAt: gate.createdAt,
  }
}

/**
 * Vários gates abertos ao mesmo tempo na mesma thread são **suportados**, nunca sobrescritos:
 * cada um tem `gateId` próprio e uma continuação própria, e a thread só sai de
 * `waiting_permission` quando o último fecha. É o oposto do que `ask-user-question.ts` faz hoje
 * (um `pending` por thread, sobrescrito em silêncio, deixando o `POST /ask` anterior preso para
 * sempre) — e é obrigatório aqui porque o CLI dispara tool calls em paralelo (Write + Bash no mesmo
 * turno) e o upgrade de nível mid-turn precisa liberar só parte da fila.
 */
function detachContinuation(gateId: string): GateContinuation | undefined {
  const entry = continuations.get(gateId)
  if (entry === undefined) return undefined
  continuations.delete(gateId)
  clearTimeout(entry.timeoutId)
  return entry
}

/**
 * Volta para `running` quando não sobra gate aberto na thread. Não faz nada com outro gate ainda
 * pendente — senão o card seguinte apareceria sobre "Executando…".
 */
function maybeRestoreRunning(threadId: string): void {
  if (countOpenThreadGates(threadId) > 0) return
  const thread = getThread(threadId)
  if (thread?.state !== 'waiting_permission') return
  updateThread(threadId, { state: 'running' })
  emit(threadId, { type: 'state.change', threadId, state: 'running' })
}

interface CloseOptions {
  /** `false` na expiração de fim de turno/cancel: quem assenta o estado final é o chamador. */
  restoreRunning?: boolean
  /** `false` em cancel/fim de turno — o legado nunca emitiu `permission.resolved` nesses caminhos. */
  emitLegacyResolved?: boolean
  /** Roda com o gate já consumido e **antes** de destravar o hook (ver `onGranted`). */
  beforeRelease?: (gate: ThreadGate) => void
}

/**
 * Consome o gate (CAS no SQLite) e destrava a continuação. Só o primeiro chamador ganha: timeout e
 * clique do usuário podem correr juntos e o perdedor vira no-op em vez de responder duas vezes.
 */
function closeGate(
  gateId: string,
  state: 'resolved' | 'expired',
  allow: boolean,
  reason: string,
  options: CloseOptions = {}
): ThreadGate | null {
  const gate = closeThreadGate(gateId, state, { allow, reason })
  if (gate === null) {
    // Linha já fechada; se por algum motivo sobrou continuação (processo anterior), fail-closed.
    detachContinuation(gateId)?.resolve(false)
    return null
  }

  options.beforeRelease?.(gate)
  detachContinuation(gateId)?.resolve(allow)

  emit(gate.threadId, {
    type: 'gate.resolved',
    threadId: gate.threadId,
    gateId: gate.id,
    kind: gate.kind,
    state,
    allow,
    reason,
  })
  if (options.emitLegacyResolved !== false) {
    emit(gate.threadId, { type: 'permission.resolved', threadId: gate.threadId, requestId: gate.id, allow })
  }
  if (options.restoreRunning !== false) maybeRestoreRunning(gate.threadId)
  return gate
}

export interface OpenPermissionGateInput {
  threadId: string
  toolName: string
  params: unknown
  /** Override do fail-closed (testes usam ms curtos). Default: `PERMISSION_TIMEOUT_MS`. */
  timeoutMs?: number
}

export type OpenPermissionGateResult =
  | { ok: true; gate: PermissionRequestInfo; decision: Promise<boolean> }
  | { ok: false; code: 'gate_not_persisted' }

/**
 * Abre um gate de permissão: persiste a linha, arma o timeout fail-closed, põe a thread em
 * `waiting_permission` e anuncia (`gate.opened` novo + `permission.request` legado).
 *
 * A continuação é registrada **antes** de qualquer `emit` — um consumidor no mesmo processo que
 * resolvesse no próprio evento não pode achar o gate sem continuação.
 *
 * Fail-closed: se a linha não persiste (thread apagada mid-turn, FK, disco), devolve
 * `gate_not_persisted` e o chamador nega — nunca libera por omissão.
 */
export function openPermissionGate(input: OpenPermissionGateInput): OpenPermissionGateResult {
  const timeoutMs = input.timeoutMs ?? PERMISSION_TIMEOUT_MS

  let gate: ThreadGate
  try {
    gate = createThreadGate({
      threadId: input.threadId,
      kind: 'permission',
      toolName: input.toolName,
      payload: input.params,
      expiresAt: Date.now() + timeoutMs,
    })
  } catch {
    // Sem detalhe no erro: `params` pode conter comando/credencial.
    return { ok: false, code: 'gate_not_persisted' }
  }

  const decision = new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      closeGate(gate.id, 'expired', false, 'permission_timeout')
    }, timeoutMs)
    continuations.set(gate.id, { threadId: gate.threadId, resolve, timeoutId })
  })

  // Distinto de `waiting_user` (ask_user_question): aqui o PreToolUse está preso no broker.
  const thread = getThread(gate.threadId)
  if (thread !== null && thread.state !== 'waiting_permission') {
    updateThread(gate.threadId, { state: 'waiting_permission' })
    emit(gate.threadId, { type: 'state.change', threadId: gate.threadId, state: 'waiting_permission' })
  }

  const info = toPermissionRequestInfo(gate)
  emit(gate.threadId, {
    type: 'gate.opened',
    threadId: gate.threadId,
    gateId: gate.id,
    kind: 'permission',
    toolName: info.toolName,
    payload: info.params,
    createdAt: gate.createdAt,
    expiresAt: gate.expiresAt,
  })
  emit(gate.threadId, {
    type: 'permission.request',
    threadId: gate.threadId,
    requestId: info.requestId,
    toolName: info.toolName,
    params: info.params,
  })

  return { ok: true, gate: info, decision }
}

/** `not_found`: gateId inexistente ou já consumido. `thread_mismatch`: existe, mas é de outra thread. */
export type GateResolveFailureCode = 'not_found' | 'thread_mismatch'

export type GateResolveResult = { ok: true; toolName: string } | { ok: false; code: GateResolveFailureCode }

export interface ResolvePermissionGateOptions {
  /**
   * Efeito do "Permitir todos" (allowlist da thread/projeto, que vive no `permission-broker`).
   * Roda **depois** do consumo do gate e **antes** de destravar o hook, para o próximo tool call já
   * enxergar a allowlist. Injetado pelo chamador porque allowlist é assunto do broker, não do gate
   * — é o que evita ciclo de import entre os dois módulos.
   */
  onGranted?: (info: { threadId: string; toolName: string }) => void
}

/**
 * Resolve um gate **da thread informada**. `threadId` vem primeiro de propósito: o handler HTTP
 * recebe o id no path e o gateId no corpo, e trocar a ordem em silêncio deixaria um gateId de outra
 * thread resolver a permissão errada. Sem match o gate **não** é consumido — continua pendente para
 * a thread dona (R02).
 */
export function resolvePermissionGate(
  threadId: string,
  gateId: string,
  allow: boolean,
  options: ResolvePermissionGateOptions = {}
): GateResolveResult {
  const candidate = getThreadGate(gateId)
  if (candidate === null || candidate.state !== 'open' || candidate.kind !== 'permission') {
    return { ok: false, code: 'not_found' }
  }
  if (candidate.threadId !== threadId) return { ok: false, code: 'thread_mismatch' }

  const toolName = candidate.toolName ?? 'unknown'
  const closed = closeGate(gateId, 'resolved', allow, 'user_decision', {
    beforeRelease: (gate) => {
      if (allow) options.onGranted?.({ threadId: gate.threadId, toolName })
    },
  })
  // Perdeu a corrida para o timeout entre o SELECT e o UPDATE: nada a consumir.
  if (closed === null) return { ok: false, code: 'not_found' }
  return { ok: true, toolName }
}

/**
 * Libera gates abertos com allow (upgrade de nível mid-turn).
 * Com `accessLevel`, libera só o que o novo nível auto-aprova — `auto-accept-edits` solta a edição
 * de arquivo e mantém o modal do `Bash`, senão o upgrade viraria full-access disfarçado.
 * Retorna os `gateId` liberados.
 */
export function allowOpenPermissionGates(threadId: string, accessLevel?: ThreadAccessLevel): string[] {
  const resolvedIds: string[] = []
  for (const gate of listOpenThreadGates(threadId, 'permission')) {
    if (
      accessLevel !== undefined &&
      permissionPolicyDecision(accessLevel, gate.toolName ?? 'unknown') !== 'allow'
    ) {
      continue
    }
    if (closeGate(gate.id, 'resolved', true, 'access_level_upgrade', { restoreRunning: false }) !== null) {
      resolvedIds.push(gate.id)
    }
  }
  maybeRestoreRunning(threadId)
  return resolvedIds
}

/**
 * Expira (nega) todo gate aberto da thread — cancel, erro e fim de turno. Mesmo contrato do legado
 * "permission pendente no cancel → deny" (`_reversa_sdd/runner/requirements.md`): não restaura
 * `running`, porque quem assenta o estado final (cancelled/error/idle) é o chamador; e não emite o
 * `permission.resolved` legado, que nunca existiu nesse caminho. O `gate.resolved` novo sai sempre.
 */
export function expireOpenPermissionGates(threadId: string, reason = 'turn_ended'): string[] {
  const expiredIds: string[] = []
  for (const gate of listOpenThreadGates(threadId, 'permission')) {
    if (
      closeGate(gate.id, 'expired', false, reason, { restoreRunning: false, emitLegacyResolved: false }) !== null
    ) {
      expiredIds.push(gate.id)
    }
  }
  return expiredIds
}

/**
 * Snapshot consultável dos gates de permissão abertos (reconnect WS / `GET /permissions`).
 * Sem continuação nem handles — só o que a UI precisa para remontar o card.
 */
export function listOpenPermissionGates(threadId: string): PermissionRequestInfo[] {
  return listOpenThreadGates(threadId, 'permission').map(toPermissionRequestInfo)
}

export function hasOpenPermissionGate(threadId: string): boolean {
  return countOpenThreadGates(threadId, 'permission') > 0
}

/**
 * Boot: gate cuja continuação não existe neste processo é órfão — o socket do hook morreu com o
 * processo anterior e ninguém mais consegue respondê-lo. Expira a linha com motivo explícito em vez
 * de deixar um card eterno e irresolvível no reconnect.
 *
 * Não mexe em `threads.state`: quem assenta a thread interrompida é `recoverRunningThreads()`, que
 * roda na mesma reconciliação de boot. O filtro por continuação (em vez de "toda linha aberta")
 * é o que deixa esta varredura segura se o unlock rodar de novo com um turno vivo.
 */
export function expireOrphanGates(): ThreadGate[] {
  const expired: ThreadGate[] = []
  for (const gate of listAllOpenThreadGates()) {
    if (continuations.has(gate.id)) continue
    const closed = closeThreadGate(gate.id, 'expired', { allow: false, reason: 'app_restarted' })
    if (closed !== null) expired.push(closed)
  }
  return expired
}

/** Apenas para testes: nega continuações vivas, limpa timers e zera a tabela. */
export function clearAllGatesForTesting(): void {
  for (const gateId of [...continuations.keys()]) {
    detachContinuation(gateId)?.resolve(false)
  }
  deleteAllThreadGatesForTesting()
}
