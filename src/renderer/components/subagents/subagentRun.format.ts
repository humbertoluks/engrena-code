import type { SubagentRunStatus } from '../../../services/db/repositories/subagents.js'

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
