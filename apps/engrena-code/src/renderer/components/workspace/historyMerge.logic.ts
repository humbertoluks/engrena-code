/**
 * Incremental history merge + single-flight refetch gate.
 *
 * Stream events (tool_call.start/result, pipeline, subagent) used to fire a full
 * `setMessages(res.messages)` per event. That storm re-allocated every bubble and
 * remounted Work-log `<details>`. Merge by id keeps unchanged row references;
 * the gate ensures at most one in-flight GET /history per thread, with coalesce.
 */

export interface Identified {
  id: string
}

/** Item da timeline que carrega a ordem canônica da thread. */
export interface Sequenced extends Identified {
  seq: number
}

/** Stable JSON for deep-ish equality of blocks/params/result without key order games. */
function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null'
  } catch {
    return String(value)
  }
}

/**
 * Merge `next` onto `prev` by `id`. Unchanged rows keep the previous object
 * reference so React can skip remounts (Work log expansion, scroll anchors).
 * Returns `prev` when the list is referentially equivalent.
 */
export function mergeById<T extends Identified>(
  prev: readonly T[],
  next: readonly T[],
  same: (a: T, b: T) => boolean
): T[] {
  if (prev === next) return prev as T[]
  if (prev.length === 0) return next as T[]

  const prevById = new Map<string, T>()
  for (const row of prev) prevById.set(row.id, row)

  let changed = prev.length !== next.length
  const out: T[] = new Array(next.length)
  for (let i = 0; i < next.length; i++) {
    const item = next[i] as T
    const old = prevById.get(item.id)
    if (old && same(old, item)) {
      out[i] = old
      if (prev[i] !== old) changed = true
    } else {
      out[i] = item
      changed = true
    }
  }

  if (!changed) {
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== out[i]) {
        changed = true
        break
      }
    }
  }

  return changed ? out : (prev as T[])
}

export function sameMessageLike(
  a: {
    id: string
    threadId: string
    role: string
    content: string | null
    blocks: unknown
    seq: number
    createdAt: number
  },
  b: {
    id: string
    threadId: string
    role: string
    content: string | null
    blocks: unknown
    seq: number
    createdAt: number
  }
): boolean {
  return (
    a.id === b.id &&
    a.threadId === b.threadId &&
    a.role === b.role &&
    a.content === b.content &&
    a.seq === b.seq &&
    a.createdAt === b.createdAt &&
    stableJson(a.blocks) === stableJson(b.blocks)
  )
}

/**
 * Forma mínima de tool call para a comparação. `result` e o trio de preview são **opcionais**
 * porque F33 tirou o corpo da listagem: o histórico paginado manda `resultPreview`, e o corpo
 * integral só chega quando o work log expande.
 */
export interface ToolCallLike {
  id: string
  threadId: string
  messageId: string | null
  name: string
  params: unknown
  status: string
  result?: unknown
  resultPreview?: string | null
  resultTruncated?: boolean
  resultBytes?: number
  seq: number
  startedAt: number
  endedAt: number | null
}

export function sameToolCallLike(a: ToolCallLike, b: ToolCallLike): boolean {
  return (
    a.id === b.id &&
    a.threadId === b.threadId &&
    a.messageId === b.messageId &&
    a.name === b.name &&
    a.status === b.status &&
    a.seq === b.seq &&
    a.startedAt === b.startedAt &&
    a.endedAt === b.endedAt &&
    // O preview entra na comparação junto do corpo: sem ele, o resultado que chega truncado
    // pela listagem nunca sinalizaria mudança e a linha ficaria com o texto do turno anterior.
    a.resultTruncated === b.resultTruncated &&
    stableJson(a.params) === stableJson(b.params) &&
    stableJson(a.resultPreview) === stableJson(b.resultPreview) &&
    stableJson(a.result) === stableJson(b.result)
  )
}

export function sameSubagentRunLike(
  a: {
    childThreadId: string
    parentThreadId: string
    parentToolCallId: string | null
    subagentName: string
    provider: string
    model: string | null
    status: string
    text: string | null
    durationMs: number | null
    reasoningLevel: string | null
    actionCount: number
    parallelBatchId: string | null
    createdAt: number
  },
  b: {
    childThreadId: string
    parentThreadId: string
    parentToolCallId: string | null
    subagentName: string
    provider: string
    model: string | null
    status: string
    text: string | null
    durationMs: number | null
    reasoningLevel: string | null
    actionCount: number
    parallelBatchId: string | null
    createdAt: number
  }
): boolean {
  return (
    a.childThreadId === b.childThreadId &&
    a.parentThreadId === b.parentThreadId &&
    a.parentToolCallId === b.parentToolCallId &&
    a.subagentName === b.subagentName &&
    a.provider === b.provider &&
    a.model === b.model &&
    a.status === b.status &&
    a.text === b.text &&
    a.durationMs === b.durationMs &&
    a.reasoningLevel === b.reasoningLevel &&
    a.actionCount === b.actionCount &&
    a.parallelBatchId === b.parallelBatchId &&
    a.createdAt === b.createdAt
  )
}

/** Subagent runs use `childThreadId` as the stable row key in history. */
export function mergeSubagentRunsByChildId<T extends { childThreadId: string }>(
  prev: readonly T[],
  next: readonly T[],
  same: (a: T, b: T) => boolean
): T[] {
  if (prev === next) return prev as T[]
  if (prev.length === 0) return next as T[]

  const prevById = new Map<string, T>()
  for (const row of prev) prevById.set(row.childThreadId, row)

  let changed = prev.length !== next.length
  const out: T[] = new Array(next.length)
  for (let i = 0; i < next.length; i++) {
    const item = next[i] as T
    const old = prevById.get(item.childThreadId)
    if (old && same(old, item)) {
      out[i] = old
      if (prev[i] !== old) changed = true
    } else {
      out[i] = item
      changed = true
    }
  }

  if (!changed) {
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== out[i]) {
        changed = true
        break
      }
    }
  }

  return changed ? out : (prev as T[])
}

export type HistoryRefetchBegin =
  | { kind: 'run'; signal: AbortSignal }
  | { kind: 'coalesced' }

/**
 * At most one concurrent history fetch. Background requests while in-flight
 * mark a single follow-up; foreground (thread open) aborts and restarts.
 */
export class HistoryRefetchGate {
  private inflight: AbortController | null = null
  private coalesce = false

  begin(opts: { background: boolean }): HistoryRefetchBegin {
    if (opts.background && this.inflight) {
      this.coalesce = true
      return { kind: 'coalesced' }
    }
    this.inflight?.abort()
    this.inflight = new AbortController()
    this.coalesce = false
    return { kind: 'run', signal: this.inflight.signal }
  }

  /** Call when the fetch that owns `signal` settles. */
  finish(signal: AbortSignal): { coalesced: boolean } {
    if (this.inflight?.signal !== signal) {
      return { coalesced: false }
    }
    this.inflight = null
    const coalesced = this.coalesce
    this.coalesce = false
    return { coalesced }
  }

  cancel(): void {
    this.inflight?.abort()
    this.inflight = null
    this.coalesce = false
  }

  get hasInflight(): boolean {
    return this.inflight !== null
  }
}

export function isAbortError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name?: unknown }).name) : ''
  return name === 'AbortError'
}

/**
 * União de duas páginas da mesma thread, deduplicada por `id` e ordenada por `seq` (F33).
 *
 * `mergeById` **substitui** a lista pela que chegou — é o certo enquanto o histórico vem inteiro,
 * e é exatamente o errado com janela: o refetch da janela recente derrubaria as páginas antigas que
 * o usuário acabou de carregar. Aqui a lista só cresce, e a ordem vem de `seq`, que o servidor
 * atribui num contador único por thread.
 *
 * Mantém a referência do objeto já em memória quando ele não mudou, pelo mesmo motivo de
 * `mergeById`: Work log aberto não pode remontar.
 */
export function unionBySeq<T extends Sequenced>(
  prev: readonly T[],
  next: readonly T[],
  same: (a: T, b: T) => boolean
): T[] {
  if (next.length === 0) return prev as T[]
  if (prev.length === 0) return next as T[]

  const byId = new Map<string, T>()
  for (const row of prev) byId.set(row.id, row)
  let changed = false
  for (const row of next) {
    const old = byId.get(row.id)
    if (old === undefined) {
      byId.set(row.id, row)
      changed = true
      continue
    }
    if (!same(old, row)) {
      byId.set(row.id, row)
      changed = true
    }
  }
  if (!changed && byId.size === prev.length) return prev as T[]
  return [...byId.values()].sort((a, b) => a.seq - b.seq)
}
