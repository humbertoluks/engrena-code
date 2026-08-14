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
import { getThread, type ThreadAccessLevel } from '../db/repositories/threads.js'
import { permissionPolicyDecision } from './permission-policy.js'
import { applyTransition } from './turn-state.js'
import { emit } from './ws-hub.js'

/** Fail-closed: sem resposta do usuário, a tool é negada e o HTTP do hook não fica preso 10+ min. */
export const PERMISSION_TIMEOUT_MS = 2 * 60 * 1000

/** Resposta do usuário a um gate de pergunta (`ask_user_question` e checkpoint de pipeline). */
export interface GateAnswer {
  selectedOptions?: string[]
  freeText?: string | null
}

/** Fallback quando a continuação é abandonada sem motivo próprio (linha já fechada por outro caminho). */
const GATE_ABANDONED_MESSAGE = 'Gate encerrado sem resposta do usuário.'

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
 * **só** por resolução/expiração — estado da thread e existência de gate não podem divergir. O
 * mesmo vale para `waiting_user` e `openQuestionGate` (`ask_user_question`, F21).
 */

/**
 * O que a continuação entrega a quem está preso do outro lado — **discriminado por `kind`** porque
 * os dois lados esperam coisas diferentes e nenhum aceita o valor do outro:
 * - `permission` devolve um booleano ao hook `PreToolUse`, que só sabe allow/deny;
 * - `question` devolve a **resposta** do usuário ao `tools/call` do MCP, ou `null` + `message` para
 *   rejeitar (o MCP responde `isError: true` com esse texto, contrato legado de `ask_user_question`).
 *
 * A união (em vez de dois mapas paralelos, ou de um genérico `Gate<T>`) mantém **um** `closeGate`
 * com CAS/emit/restore único: quem sabe o tipo é a closure criada em `open*Gate`, onde o `kind` já
 * é conhecido, e `releaseContinuation` é o único ponto de narrowing — e ele erra fechado.
 */
type GateOutcome =
  | { kind: 'permission'; allow: boolean }
  | { kind: 'question'; answer: GateAnswer }
  | { kind: 'question'; answer: null; message: string }

/** Outcome usado quando não há decisão real a entregar: nega a permissão, rejeita a pergunta. */
const ABANDONED_OUTCOME: GateOutcome = { kind: 'permission', allow: false }

interface PermissionContinuation {
  kind: 'permission'
  threadId: string
  release: (outcome: Extract<GateOutcome, { kind: 'permission' }>) => void
  timeoutId: ReturnType<typeof setTimeout> | null
}

interface QuestionContinuation {
  kind: 'question'
  threadId: string
  release: (outcome: Extract<GateOutcome, { kind: 'question' }>) => void
  /** `null` quando a pergunta não tem prazo (default — ver `openQuestionGate`). */
  timeoutId: ReturnType<typeof setTimeout> | null
}

type GateContinuation = PermissionContinuation | QuestionContinuation

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
  if (entry.timeoutId !== null) clearTimeout(entry.timeoutId)
  return entry
}

/**
 * Único ponto onde o `kind` do outcome encontra o `kind` da continuação. Divergência (só possível
 * no caminho de abandono) erra fechado: nega a permissão, rejeita a pergunta.
 */
function releaseContinuation(gateId: string, outcome: GateOutcome): void {
  const entry = detachContinuation(gateId)
  if (entry === undefined) return
  if (entry.kind === 'permission') {
    entry.release(outcome.kind === 'permission' ? outcome : { kind: 'permission', allow: false })
    return
  }
  entry.release(
    outcome.kind === 'question' ? outcome : { kind: 'question', answer: null, message: GATE_ABANDONED_MESSAGE }
  )
}

/** Os dois estados que só existem enquanto há gate aberto — nenhum outro é tocado por este módulo. */
const GATED_STATES = new Set<string>(['waiting_permission', 'waiting_user'])

/**
 * Volta para `running` quando não sobra gate aberto na thread — de **qualquer** kind. Não faz nada
 * com outro gate ainda pendente (senão o card seguinte apareceria sobre "Executando…") nem com
 * thread já assentada em `stopping`/`cancelled`/`error`, cujo estado final é do chamador: o reducer
 * (`turn-state.ts`) só aceita `gates_closed` vindo de `waiting_permission`/`waiting_user`, e é o que
 * impede um gate fechado tarde de ressuscitar `running` por cima de um cancelamento em curso.
 */
function maybeRestoreRunning(threadId: string): void {
  if (countOpenThreadGates(threadId) > 0) return
  // Pré-checagem só para não logar "transição ilegal" no caminho rotineiro em que não havia gate
  // nenhum (upgrade de nível sem fila, fim de turno): quem decide de verdade é o reducer.
  const thread = getThread(threadId)
  if (thread === null || !GATED_STATES.has(thread.state)) return
  applyTransition(threadId, 'gates_closed')
}

/**
 * Exportada para `dispatch.ts`: no `tool-result` de `ask_user_question` o turno volta a rodar, mas
 * só se nenhum outro gate continuar aberto e a thread ainda estiver esperando.
 */
export function restoreRunningIfNoOpenGates(threadId: string): void {
  maybeRestoreRunning(threadId)
}

interface CloseOptions {
  /** `false` na expiração de fim de turno/cancel: quem assenta o estado final é o chamador. */
  restoreRunning?: boolean
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
  outcome: GateOutcome,
  reason: string,
  options: CloseOptions = {}
): ThreadGate | null {
  // `allow` continua sendo o resumo binário persistido/emitido: para pergunta, "houve resposta".
  const allow = outcome.kind === 'permission' ? outcome.allow : outcome.answer !== null
  const gate = closeThreadGate(gateId, state, { allow, reason })
  if (gate === null) {
    // Linha já fechada; se por algum motivo sobrou continuação (processo anterior), fail-closed.
    releaseContinuation(gateId, ABANDONED_OUTCOME)
    return null
  }

  options.beforeRelease?.(gate)
  releaseContinuation(gateId, outcome)

  emit(gate.threadId, {
    type: 'gate.resolved',
    threadId: gate.threadId,
    gateId: gate.id,
    kind: gate.kind,
    state,
    allow,
    reason,
  })
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
 * `waiting_permission` e anuncia (`gate.opened`).
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
      closeGate(gate.id, 'expired', { kind: 'permission', allow: false }, 'permission_timeout')
    }, timeoutMs)
    continuations.set(gate.id, {
      kind: 'permission',
      threadId: gate.threadId,
      release: (outcome) => resolve(outcome.allow),
      timeoutId,
    })
  })

  // Distinto de `waiting_user` (ask_user_question): aqui o PreToolUse está preso no broker.
  // Idempotente e rejeitado durante `stopping` pelo reducer — gate que abre no meio de um cancel
  // não tira a thread de `stopping`; quem o fecha é o próprio cancel (`expireOpenPermissionGates`).
  applyTransition(gate.threadId, 'gate_opened_permission')

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
  const closed = closeGate(gateId, 'resolved', { kind: 'permission', allow }, 'user_decision', {
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
    if (
      closeGate(gate.id, 'resolved', { kind: 'permission', allow: true }, 'access_level_upgrade', {
        restoreRunning: false,
      }) !== null
    ) {
      resolvedIds.push(gate.id)
    }
  }
  maybeRestoreRunning(threadId)
  return resolvedIds
}

/**
 * Expira (nega) todo gate aberto da thread — cancel, erro e fim de turno. Mesmo contrato do legado
 * "permission pendente no cancel → deny" (`_reversa_sdd/runner/requirements.md`): não restaura
 * `running`, porque quem assenta o estado final (cancelled/error/idle) é o chamador. O
 * `gate.resolved` sai sempre, e é por ele que o card some da UI.
 */
export function expireOpenPermissionGates(threadId: string, reason = 'turn_ended'): string[] {
  const expiredIds: string[] = []
  for (const gate of listOpenThreadGates(threadId, 'permission')) {
    if (
      closeGate(gate.id, 'expired', { kind: 'permission', allow: false }, reason, {
        restoreRunning: false,
      }) !== null
    ) {
      expiredIds.push(gate.id)
    }
  }
  return expiredIds
}

/**
 * Snapshot consultável dos gates de permissão abertos, por kind. O snapshot que a UI consome é o
 * unificado (`listOpenGates`); este fica para quem só se importa com permissão.
 */
export function listOpenPermissionGates(threadId: string): PermissionRequestInfo[] {
  return listOpenThreadGates(threadId, 'permission').map(toPermissionRequestInfo)
}

export function hasOpenPermissionGate(threadId: string): boolean {
  return countOpenThreadGates(threadId, 'permission') > 0
}

// ── Gates de pergunta (`ask_user_question`, checkpoint de pipeline) ──────────

/** Shape de wire do gate de pergunta. `question` é o payload como o MCP recebeu (prompt/opções). */
export interface QuestionGateInfo {
  gateId: string
  threadId: string
  question: unknown
  createdAt: number
  expiresAt: number | null
}

function toQuestionGateInfo(gate: ThreadGate): QuestionGateInfo {
  return {
    gateId: gate.id,
    threadId: gate.threadId,
    question: gate.payload,
    createdAt: gate.createdAt,
    expiresAt: gate.expiresAt,
  }
}

/**
 * Idempotente. Exportada porque `dispatch.ts` precisa **pré-armar** o estado no `tool-start` de
 * `ask_user_question`: o card já está na timeline (via `tool_call.start`) quando o `POST /ask` do
 * MCP — quem de fato abre o gate — ainda não chegou, e `POST /answer` responde
 * `409 thread_not_waiting` fora de `waiting_user`. Sem o pré-arme, um clique rápido perdia a corrida.
 */
export function markThreadWaitingUser(threadId: string): void {
  // Idempotente pelo reducer: `waiting_user --gate_opened_question--> waiting_user` é legal e
  // não gera UPDATE nem `state.change` repetido.
  applyTransition(threadId, 'gate_opened_question')
}

export interface OpenQuestionGateInput {
  threadId: string
  /** Pergunta como chegou do MCP (`prompt`/`options`/`multiSelect`) — vira o payload do gate. */
  question?: unknown
  /**
   * Sem prazo por padrão, ao contrário da permissão. A pergunta não segura nenhuma tool: o turno
   * fica parado esperando o usuário, e expirar sozinho quebraria tanto o `ask_user_question` real
   * (usuário demora mais que qualquer prazo curto) quanto o checkpoint de pipeline, que vive sob o
   * hard-cap de 2h do próprio pipeline. Cancel/fim de turno já rejeitam (ver
   * `expireOpenQuestionGates`). Testes passam um valor curto para exercitar o caminho.
   */
  timeoutMs?: number
}

export type OpenQuestionGateResult =
  | { ok: true; gate: QuestionGateInfo; answer: Promise<GateAnswer> }
  | { ok: false; code: 'gate_not_persisted' }

/**
 * Abre um gate de pergunta: persiste a linha, põe a thread em `waiting_user` e anuncia
 * (`gate.opened` — o mesmo evento da permissão, discriminado por `kind`).
 *
 * **Vários gates de pergunta na mesma thread coexistem** — é o ponto da migração. O `pending` antigo
 * (`ask-user-question.ts`, um por thread) era sobrescrito em silêncio: a segunda pergunta do mesmo
 * turno deixava o `POST /ask` da primeira preso para sempre.
 *
 * Fail-closed igual à permissão: sem linha persistida (thread apagada mid-turn, FK), devolve
 * `gate_not_persisted` e o chamador responde erro ao MCP em vez de pendurar o `tools/call`.
 */
export function openQuestionGate(input: OpenQuestionGateInput): OpenQuestionGateResult {
  const { timeoutMs } = input

  let gate: ThreadGate
  try {
    gate = createThreadGate({
      threadId: input.threadId,
      kind: 'question',
      payload: input.question ?? null,
      expiresAt: timeoutMs === undefined ? null : Date.now() + timeoutMs,
    })
  } catch {
    // Sem detalhe no erro: o payload da pergunta é texto do turno.
    return { ok: false, code: 'gate_not_persisted' }
  }

  const answer = new Promise<GateAnswer>((resolve, reject) => {
    const timeoutId =
      timeoutMs === undefined
        ? null
        : setTimeout(() => {
            closeGate(
              gate.id,
              'expired',
              { kind: 'question', answer: null, message: 'Tempo esgotado sem resposta do usuário.' },
              'question_timeout'
            )
          }, timeoutMs)
    continuations.set(gate.id, {
      kind: 'question',
      threadId: gate.threadId,
      release: (outcome) => {
        if (outcome.answer === null) reject(new Error(outcome.message))
        else resolve(outcome.answer)
      },
      timeoutId,
    })
  })

  // Distinto de `waiting_permission`: aqui nenhuma tool está presa no broker, só o turno.
  markThreadWaitingUser(gate.threadId)

  emit(gate.threadId, {
    type: 'gate.opened',
    threadId: gate.threadId,
    gateId: gate.id,
    kind: 'question',
    toolName: null,
    payload: gate.payload,
    createdAt: gate.createdAt,
    expiresAt: gate.expiresAt,
  })

  return { ok: true, gate: toQuestionGateInfo(gate), answer }
}

export type QuestionGateResolveResult = { ok: true } | { ok: false; code: GateResolveFailureCode }

/**
 * Resolve um gate de pergunta **da thread informada**, com a mesma proteção de vínculo de
 * `resolvePermissionGate`: sem match o gate não é consumido e continua pendente para a thread dona.
 */
export function resolveQuestionGate(
  threadId: string,
  gateId: string,
  answer: GateAnswer
): QuestionGateResolveResult {
  const candidate = getThreadGate(gateId)
  if (candidate === null || candidate.state !== 'open' || candidate.kind !== 'question') {
    return { ok: false, code: 'not_found' }
  }
  if (candidate.threadId !== threadId) return { ok: false, code: 'thread_mismatch' }

  const closed = closeGate(gateId, 'resolved', { kind: 'question', answer }, 'user_answer')
  // Perdeu a corrida entre o SELECT e o UPDATE: nada a consumir.
  if (closed === null) return { ok: false, code: 'not_found' }
  return { ok: true }
}

/**
 * Rejeita toda pergunta aberta da thread — cancel, erro e fim de turno. `message` chega ao agente
 * como texto do `tools/call` com `isError: true` (contrato legado de `rejectAskUserQuestion`), por
 * isso é PT-BR; `reason` é o código que fica persistido na linha. Não restaura `running`: quem
 * assenta o estado final (cancelled/error/idle) é o chamador.
 */
export function expireOpenQuestionGates(threadId: string, reason: string, message: string): string[] {
  const expiredIds: string[] = []
  for (const gate of listOpenThreadGates(threadId, 'question')) {
    if (
      closeGate(gate.id, 'expired', { kind: 'question', answer: null, message }, reason, {
        restoreRunning: false,
      }) !== null
    ) {
      expiredIds.push(gate.id)
    }
  }
  return expiredIds
}

/** Snapshot consultável das perguntas abertas, por kind (o unificado é `listOpenGates`). */
export function listOpenQuestionGates(threadId: string): QuestionGateInfo[] {
  return listOpenThreadGates(threadId, 'question').map(toQuestionGateInfo)
}

export function hasOpenQuestionGate(threadId: string): boolean {
  return countOpenThreadGates(threadId, 'question') > 0
}

/** Shape unificado de `GET /api/threads/:id/gate` — os dois kinds na ordem em que foram abertos. */
export interface OpenGateInfo {
  gateId: string
  threadId: string
  kind: ThreadGate['kind']
  /** `null` em pergunta. */
  toolName: string | null
  payload: unknown
  createdAt: number
  expiresAt: number | null
}

export function listOpenGates(threadId: string): OpenGateInfo[] {
  return listOpenThreadGates(threadId).map((gate) => ({
    gateId: gate.id,
    threadId: gate.threadId,
    kind: gate.kind,
    toolName: gate.toolName,
    payload: gate.payload,
    createdAt: gate.createdAt,
    expiresAt: gate.expiresAt,
  }))
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
    releaseContinuation(gateId, ABANDONED_OUTCOME)
  }
  deleteAllThreadGatesForTesting()
}
