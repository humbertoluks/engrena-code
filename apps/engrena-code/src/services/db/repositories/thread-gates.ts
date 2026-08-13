import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

/**
 * Gate = fato declarativo "esta thread está esperando uma decisão humana". Persistido porque a
 * continuação em memória (o `resolve` que destrava o socket HTTP do hook) morre com o processo:
 * sem a linha, um crash deixava a thread órfã e o boot a empurrava para `error` sem motivo legível.
 *
 * `kind` já contempla `'question'` (ask_user_question); esta fatia só usa `'permission'`.
 */
export type ThreadGateKind = 'permission' | 'question'
export type ThreadGateState = 'open' | 'resolved' | 'expired'

export interface ThreadGate {
  id: string
  threadId: string
  kind: ThreadGateKind
  /** Só para `kind='permission'`; `null` em question. */
  toolName: string | null
  /** `tool_input` do PreToolUse — pode conter comando/credencial, nunca vai para log. */
  payload: unknown
  state: ThreadGateState
  resolution: unknown
  createdAt: number
  expiresAt: number | null
  resolvedAt: number | null
}

interface ThreadGateRow {
  id: string
  thread_id: string
  kind: string
  tool_name: string | null
  payload_json: string
  state: string
  resolution_json: string | null
  created_at: number
  expires_at: number | null
  resolved_at: number | null
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toThreadGate(row: ThreadGateRow): ThreadGate {
  return {
    id: row.id,
    threadId: row.thread_id,
    kind: row.kind as ThreadGateKind,
    toolName: row.tool_name,
    payload: parseJson(row.payload_json),
    state: row.state as ThreadGateState,
    resolution: parseJson(row.resolution_json),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
  }
}

export interface CreateThreadGateInput {
  threadId: string
  kind: ThreadGateKind
  toolName?: string | null
  payload?: unknown
  expiresAt?: number | null
}

/**
 * Lança se a thread não existe (FK). O chamador de permissão trata como fail-closed: sem gate
 * persistido, a tool é negada em vez de liberada por omissão.
 */
export function createThreadGate(input: CreateThreadGateInput): ThreadGate {
  const now = Date.now()
  const id = `gate_${randomUUID()}`

  getDb()
    .prepare(
      `INSERT INTO thread_gates
        (id, thread_id, kind, tool_name, payload_json, state, resolution_json, created_at, expires_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'open', NULL, ?, ?, NULL)`
    )
    .run(
      id,
      input.threadId,
      input.kind,
      input.toolName ?? null,
      JSON.stringify(input.payload ?? null),
      now,
      input.expiresAt ?? null
    )

  return getThreadGate(id) as ThreadGate
}

export function getThreadGate(id: string): ThreadGate | null {
  const row = getDb().prepare('SELECT * FROM thread_gates WHERE id = ?').get(id) as ThreadGateRow | undefined
  return row === undefined ? null : toThreadGate(row)
}

/** Ordenado por `created_at` para a UI remontar a fila na ordem em que o CLI pediu. */
export function listOpenThreadGates(threadId: string, kind?: ThreadGateKind): ThreadGate[] {
  const rows =
    kind === undefined
      ? (getDb()
          .prepare("SELECT * FROM thread_gates WHERE thread_id = ? AND state = 'open' ORDER BY created_at ASC")
          .all(threadId) as unknown as ThreadGateRow[])
      : (getDb()
          .prepare(
            "SELECT * FROM thread_gates WHERE thread_id = ? AND state = 'open' AND kind = ? ORDER BY created_at ASC"
          )
          .all(threadId, kind) as unknown as ThreadGateRow[])
  return rows.map(toThreadGate)
}

/** Todos os gates ainda abertos, de qualquer thread — usado só na varredura de boot. */
export function listAllOpenThreadGates(): ThreadGate[] {
  const rows = getDb()
    .prepare("SELECT * FROM thread_gates WHERE state = 'open' ORDER BY created_at ASC")
    .all() as unknown as ThreadGateRow[]
  return rows.map(toThreadGate)
}

export function countOpenThreadGates(threadId: string, kind?: ThreadGateKind): number {
  const row =
    kind === undefined
      ? (getDb()
          .prepare("SELECT COUNT(*) AS n FROM thread_gates WHERE thread_id = ? AND state = 'open'")
          .get(threadId) as { n: number } | undefined)
      : (getDb()
          .prepare("SELECT COUNT(*) AS n FROM thread_gates WHERE thread_id = ? AND state = 'open' AND kind = ?")
          .get(threadId, kind) as { n: number } | undefined)
  return Number(row?.n ?? 0)
}

/**
 * Compare-and-swap: só fecha se a linha ainda estiver `open`, e devolve `null` caso contrário.
 * É o que torna a resolução idempotente — timeout e clique do usuário podem correr juntos e apenas
 * um dos dois consome o gate (o outro vira no-op em vez de responder duas vezes ao hook).
 */
export function closeThreadGate(
  id: string,
  state: Exclude<ThreadGateState, 'open'>,
  resolution?: unknown
): ThreadGate | null {
  const rows = getDb()
    .prepare(
      `UPDATE thread_gates SET state = ?, resolution_json = ?, resolved_at = ?
       WHERE id = ? AND state = 'open'
       RETURNING *`
    )
    .all(state, JSON.stringify(resolution ?? null), Date.now(), id) as unknown as ThreadGateRow[]
  return rows.length === 0 ? null : toThreadGate(rows[0])
}

/** Apenas para testes: zera a tabela entre specs. */
export function deleteAllThreadGatesForTesting(): void {
  getDb().exec('DELETE FROM thread_gates')
}
