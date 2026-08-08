import type { SubagentRun, SubagentRunStatus } from '../../services/subagents-service'

export function formatRunDuration(createdAt: number, durationMs: number | null, now: number = Date.now()): string {
  const elapsed = durationMs ?? Math.max(0, now - createdAt)
  const totalSeconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function isActiveRunStatus(status: SubagentRunStatus): boolean {
  return status === 'running'
}

export interface BatchAggregate {
  batchId: string
  total: number
  done: number
  running: number
  failed: number
}

/**
 * Agrega o batch `parallelBatchId` mais recente entre os runs (spec F18 ui.md §A.2) — o mais recente
 * é o de `createdAt` mais alto entre os runs que pertencem a algum batch; `null` quando não há
 * nenhum run paralelo (path serial F15 puro).
 */
export function resolveLatestParallelBatch(runs: SubagentRun[]): BatchAggregate | null {
  const batched = runs.filter((r): r is SubagentRun & { parallelBatchId: string } => r.parallelBatchId !== null)
  if (batched.length === 0) return null

  const batchId = batched.reduce((latest, r) => (r.createdAt > latest.createdAt ? r : latest)).parallelBatchId
  const members = runs.filter((r) => r.parallelBatchId === batchId)

  return {
    batchId,
    total: members.length,
    done: members.filter((r) => r.status === 'completed').length,
    running: members.filter((r) => r.status === 'running').length,
    failed: members.filter((r) => r.status === 'error' || r.status === 'timeout' || r.status === 'cancelled').length,
  }
}
