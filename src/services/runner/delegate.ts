import { randomUUID } from 'crypto'
import type { Subagent, SubagentRunStatus, SubagentsRepository } from '../db/repositories/subagents.js'

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 20
export const HARD_CAP_MS = 2 * 60 * 60 * 1000

/**
 * Relógio de um run efêmero. A tabela subagent_runs (spec §6) não persiste "última atividade" —
 * é estado de runtime, não precisa sobreviver a restart do processo.
 */
export class DelegatedRun {
  readonly childThreadId: string
  readonly createdAt: number
  private lastActivityAt: number
  private status: SubagentRunStatus = 'running'
  private readonly idleTimeoutMinutes: number | null

  constructor(params: { childThreadId: string; idleTimeoutMinutes: number | null; now?: number }) {
    this.childThreadId = params.childThreadId
    this.idleTimeoutMinutes = params.idleTimeoutMinutes
    this.createdAt = params.now ?? Date.now()
    this.lastActivityAt = this.createdAt
  }

  recordActivity(now: number = Date.now()): void {
    this.lastActivityAt = now
  }

  isIdleTimedOut(now: number = Date.now()): boolean {
    const minutes = this.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES
    return now - this.lastActivityAt >= minutes * 60_000
  }

  isHardCapped(now: number = Date.now()): boolean {
    return now - this.createdAt >= HARD_CAP_MS
  }

  isTimedOut(now: number = Date.now()): boolean {
    return this.status === 'running' && (this.isIdleTimedOut(now) || this.isHardCapped(now))
  }

  currentStatus(): SubagentRunStatus {
    return this.status
  }

  markStatus(status: SubagentRunStatus): void {
    this.status = status
  }
}

export interface StartDelegatedRunInput {
  parentThreadId: string
  parentToolCallId?: string | null
  subagent: Subagent
  now?: number
}

export function startDelegatedRun(repo: SubagentsRepository, input: StartDelegatedRunInput): DelegatedRun {
  const now = input.now ?? Date.now()
  const childThreadId = randomUUID()
  repo.createRun({
    childThreadId,
    parentThreadId: input.parentThreadId,
    parentToolCallId: input.parentToolCallId ?? null,
    subagentName: input.subagent.name,
    provider: input.subagent.provider,
    model: input.subagent.model,
    reasoningLevel: input.subagent.reasoningLevel,
    status: 'running',
  })
  return new DelegatedRun({ childThreadId, idleTimeoutMinutes: input.subagent.idleTimeoutMinutes, now })
}

/** Chamar periodicamente (watchdog) ou sob demanda; persiste + retorna true se o run virou timeout agora. */
export function checkIdleTimeout(repo: SubagentsRepository, run: DelegatedRun, now: number = Date.now()): boolean {
  if (!run.isTimedOut(now)) return false
  repo.updateRun(run.childThreadId, { status: 'timeout' })
  run.markStatus('timeout')
  return true
}

export interface CompleteRunResult {
  text: string | null
  actionCount?: number
  usageJson?: string | null
}

export function completeDelegatedRun(repo: SubagentsRepository, run: DelegatedRun, result: CompleteRunResult): void {
  repo.updateRun(run.childThreadId, {
    status: 'completed',
    text: result.text,
    actionCount: result.actionCount ?? 0,
    usageJson: result.usageJson ?? null,
  })
  run.markStatus('completed')
}

export function cancelDelegatedRun(repo: SubagentsRepository, run: DelegatedRun): void {
  repo.updateRun(run.childThreadId, { status: 'cancelled' })
  run.markStatus('cancelled')
}

export function failDelegatedRun(repo: SubagentsRepository, run: DelegatedRun, message: string): void {
  repo.updateRun(run.childThreadId, { status: 'error', text: message })
  run.markStatus('error')
}
