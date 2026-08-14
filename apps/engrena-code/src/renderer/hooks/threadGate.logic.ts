/**
 * Regra pura do ThreadGate no renderer — "algo espera decisão humana" tem **um** dono.
 *
 * Antes havia duas representações paralelas do mesmo fato: `permissionQueue` (alimentada por
 * `permission.request`) e `pendingQuestion`, **derivada de `toolCalls`** — ou seja, de um refetch de
 * histórico que pode ser abortado ou coalescido. O card aparecia e sumia fora de sincronia com o
 * estado real. Agora o fato vem do dono (`services/runner/gate.ts`, persistido em `thread_gates`)
 * por dois caminhos que produzem exatamente o mesmo shape: o snapshot `GET /gate` e o evento
 * `gate.opened`.
 */

import type { StreamEvent } from '../services/ws-client'

export type ThreadGateKind = 'permission' | 'question'

/** Espelho do `OpenGateInfo` do main (`runner/gate.ts`) — o mesmo shape nos dois caminhos. */
export interface ThreadGate {
  gateId: string
  threadId: string
  kind: ThreadGateKind
  /** `null` em pergunta — só permissão tem tool. */
  toolName: string | null
  payload: unknown
  createdAt: number
  expiresAt: number | null
}

type GateOpenedEvent = Extract<StreamEvent, { type: 'gate.opened' }>

/**
 * `gate.opened` → `ThreadGate`. Tipado contra o union do wire: se o main mudar o evento, isto
 * quebra na compilação em vez de virar `undefined` em tela.
 */
export function gateFromOpenedEvent(event: GateOpenedEvent): ThreadGate {
  return {
    gateId: event.gateId,
    threadId: event.threadId,
    kind: event.kind,
    toolName: event.toolName,
    payload: event.payload,
    createdAt: event.createdAt,
    expiresAt: event.expiresAt,
  }
}

/** Idempotente: o mesmo gate pode chegar pelo snapshot e pelo evento (replay do reconnect). */
export function upsertGate(gates: ThreadGate[], gate: ThreadGate): ThreadGate[] {
  if (gates.some((g) => g.gateId === gate.gateId)) return gates
  return [...gates, gate]
}

export function removeGate(gates: ThreadGate[], gateId: string): ThreadGate[] {
  const next = gates.filter((g) => g.gateId !== gateId)
  return next.length === gates.length ? gates : next
}

/**
 * O gate que a UI mostra: o **mais antigo** aberto (FIFO, ordem de `createdAt` do snapshot). Os
 * demais viram "+N na fila" no card. É a mesma ordem que a permissão já usava, e agora vale também
 * para pergunta — a antiga heurística "responde a mais recente" existia só porque o card era
 * inferido de `toolCalls`; com `gateId` no card, o que está em tela é exatamente o que se resolve.
 */
export function activeGate(gates: ThreadGate[]): ThreadGate | null {
  return gates[0] ?? null
}

/** Payload de `ask_user_question` / checkpoint de pipeline, normalizado para o card. */
export interface GateQuestion {
  prompt: string
  options: string[]
  multiSelect: boolean
}

/**
 * `payload` é `unknown` de propósito (vem do MCP). Checkpoint de pipeline abre gate sem payload:
 * prompt vazio e nenhuma opção — o card ainda aparece, só sem chips.
 */
export function questionFromGate(gate: ThreadGate | null): GateQuestion | null {
  if (gate === null || gate.kind !== 'question') return null
  const payload = (gate.payload ?? {}) as { prompt?: unknown; options?: unknown; multiSelect?: unknown }
  return {
    prompt: typeof payload.prompt === 'string' ? payload.prompt : '',
    options: Array.isArray(payload.options)
      ? payload.options.filter((o): o is string => typeof o === 'string')
      : [],
    multiSelect: payload.multiSelect === true,
  }
}

export interface GatePermission {
  toolName: string
  params: unknown
}

/** `unknown` no lugar do nome real era o bug do card ("Permitir a ferramenta unknown?"). */
export function permissionFromGate(gate: ThreadGate | null): GatePermission | null {
  if (gate === null || gate.kind !== 'permission') return null
  return { toolName: gate.toolName ?? 'unknown', params: gate.payload }
}

/** Corpo de `POST /api/threads/:id/gate/:gateId/resolve`, discriminado por `kind` como no servidor. */
export type GateResolveBody =
  | { kind: 'permission'; allow: boolean; always?: boolean; scope?: 'thread' | 'project' }
  | { kind: 'question'; selectedOptions?: string[]; freeText?: string | null }

export const GATE_ERROR_COPY = {
  generic: 'Não foi possível enviar a decisão. Tente novamente.',
  gone: 'Este pedido não está mais pendente.',
  otherThread: 'Este pedido pertence a outra conversa e continua pendente lá.',
} as const

/**
 * Os 409 de `/gate/:gateId/resolve` significam "o gate já foi embora" ou "é de outra thread": os
 * dois são definitivos e não podem cair no `generic`, cujo "Tente novamente" manda o usuário repetir
 * algo que nunca vai funcionar.
 */
export function gateErrorMessage(code: string | undefined, serverMessage?: string): string {
  if (code === 'gate_not_found') return GATE_ERROR_COPY.gone
  if (code === 'gate_thread_mismatch') return GATE_ERROR_COPY.otherThread
  return serverMessage !== undefined && serverMessage !== '' ? serverMessage : GATE_ERROR_COPY.generic
}
