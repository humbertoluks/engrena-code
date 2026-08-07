import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { gitBranchForceDelete, gitWorktreeAdd, gitWorktreeRemove, getVcsStatus, hasGitHead, isGitRepo } from './git-client.js'

export class WorktreeError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

export function resolveWorktreePath(projectId: string, threadId: string): string {
  return join(resolveUserData(), 'worktrees', projectId, threadId)
}

export function worktreeBranchName(threadId: string): string {
  return `engrenacode/${threadId}`
}

function lastErrorLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lines = message.trim().split('\n')
  return lines[lines.length - 1] ?? message
}

/**
 * Cria a worktree isolada sob `userData/worktrees/<projectId>/<threadId>` na branch
 * `engrenacode/<threadId>`, a partir do HEAD do repo principal (spec F13 §3.2/§6).
 * Lança `WorktreeError` tipado — o chamador (dispatch.ts) nunca deve degradar para `project.path`.
 */
export async function createWorktree(projectPath: string, projectId: string, threadId: string): Promise<string> {
  if (!(await isGitRepo(projectPath)) || !(await hasGitHead(projectPath))) {
    throw new WorktreeError('worktree_git_required', 'Inicialize o Git antes de usar Worktree.')
  }

  const worktreePath = resolveWorktreePath(projectId, threadId)
  const branch = worktreeBranchName(threadId)

  try {
    await gitWorktreeAdd(projectPath, worktreePath, branch)
  } catch (err) {
    throw new WorktreeError('worktree_create_failed', `Não foi possível criar o worktree: ${lastErrorLine(err)}.`)
  }

  return worktreePath
}

export type WorktreeCleanupResult = 'removed' | 'retained' | 'none'

export interface WorktreeCleanupOutcome {
  result: WorktreeCleanupResult
  warning: string | null
}

const RETAINED_WARNING = 'Worktree retido com alterações locais; remova manualmente quando seguro.'

/**
 * Remove worktree + branch quando a working tree está limpa (spec F13 §3.2 "seguro"); senão retém
 * e avisa. Nunca lança — falha parcial vira log + retenção, e nunca toca `project.path` (spec §3.3).
 */
export async function removeWorktreeIfSafe(
  projectPath: string,
  worktreePath: string | null,
  threadId: string
): Promise<WorktreeCleanupOutcome> {
  if (!worktreePath) return { result: 'none', warning: null }

  let dirty: boolean
  try {
    dirty = (await getVcsStatus(worktreePath)).dirty
  } catch {
    dirty = true
  }
  if (dirty) return { result: 'retained', warning: RETAINED_WARNING }

  try {
    await gitWorktreeRemove(projectPath, worktreePath)
    await gitBranchForceDelete(projectPath, worktreeBranchName(threadId))
    return { result: 'removed', warning: null }
  } catch (err) {
    console.error(`[worktree] cleanup falhou para "${worktreePath}" (thread ${threadId}):`, err)
    return { result: 'retained', warning: RETAINED_WARNING }
  }
}
