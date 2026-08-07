import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type ThreadProvider = 'claude' | 'codex' | 'kimi' | 'minimax'
export type ThreadAccessLevel = 'supervised' | 'auto-accept-edits' | 'full-access'
export type ThreadExecutionMode = 'main' | 'worktree'
export type ThreadState = 'running' | 'idle' | 'committed' | 'error' | 'stopping'

export interface Thread {
  id: string
  projectId: string
  provider: ThreadProvider
  model: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  worktreePath: string | null
  state: ThreadState
  title: string | null
  systemPrompt: string | null
  createdAt: number
  updatedAt: number
}

export class ThreadError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface ThreadRow {
  id: string
  project_id: string
  provider: string
  model: string | null
  access_level: string
  execution_mode: string
  worktree_path: string | null
  state: string
  title: string | null
  system_prompt: string | null
  created_at: number
  updated_at: number
}

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider as ThreadProvider,
    model: row.model,
    accessLevel: row.access_level as ThreadAccessLevel,
    executionMode: row.execution_mode as ThreadExecutionMode,
    worktreePath: row.worktree_path,
    state: row.state as ThreadState,
    title: row.title,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateThreadInput {
  projectId: string
  provider: ThreadProvider
  model?: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  worktreePath?: string | null
  state?: ThreadState
  title?: string | null
}

export function createThread(input: CreateThreadInput): Thread {
  const now = Date.now()
  const id = `thr_${randomUUID()}`

  getDb()
    .prepare(
      `INSERT INTO threads
        (id, project_id, provider, model, access_level, execution_mode, worktree_path, state, title, system_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      id,
      input.projectId,
      input.provider,
      input.model ?? null,
      input.accessLevel,
      input.executionMode,
      input.worktreePath ?? null,
      input.state ?? 'running',
      input.title ?? null,
      now,
      now
    )

  return getThread(id) as Thread
}

export function getThread(id: string): Thread | null {
  const row = getDb().prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow | undefined
  return row === undefined ? null : toThread(row)
}

export function listThreadsForProject(projectId: string): Thread[] {
  const rows = getDb()
    .prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as unknown as ThreadRow[]
  return rows.map(toThread)
}

export interface UpdateThreadInput {
  state?: ThreadState
  model?: string | null
  accessLevel?: ThreadAccessLevel
  worktreePath?: string | null
  title?: string | null
  systemPrompt?: string | null
}

export function updateThread(id: string, patch: UpdateThreadInput): Thread | null {
  const existing = getThread(id)
  if (existing === null) return null

  const next = {
    state: patch.state ?? existing.state,
    model: patch.model !== undefined ? patch.model : existing.model,
    accessLevel: patch.accessLevel ?? existing.accessLevel,
    worktreePath: patch.worktreePath !== undefined ? patch.worktreePath : existing.worktreePath,
    title: patch.title !== undefined ? patch.title : existing.title,
    systemPrompt: patch.systemPrompt !== undefined ? patch.systemPrompt : existing.systemPrompt,
  }

  getDb()
    .prepare(
      `UPDATE threads SET state = ?, model = ?, access_level = ?, worktree_path = ?, title = ?, system_prompt = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(next.state, next.model, next.accessLevel, next.worktreePath, next.title, next.systemPrompt, Date.now(), id)

  return getThread(id)
}

export function setThreadState(id: string, state: ThreadState): Thread | null {
  return updateThread(id, { state })
}

/** `messages`/`tool_calls` têm FK `ON DELETE CASCADE`; `diffs` não — chamador deve apagar via `deleteDiffsForThread` antes (spec F13 §6). */
export function deleteThread(id: string): boolean {
  const result = getDb().prepare('DELETE FROM threads WHERE id = ?').run(id)
  return Number(result.changes) > 0
}

/**
 * Reconciliação de boot (spec.md F08 §3.2): threads presas em `running` de uma execução
 * anterior interrompida viram `error`. Retorna as threads afetadas para o chamador gravar
 * `log_entries` `kind='task'` por thread.
 */
export function recoverRunningThreads(): Thread[] {
  const rows = getDb()
    .prepare(`UPDATE threads SET state = 'error', updated_at = ? WHERE state = 'running' RETURNING *`)
    .all(Date.now()) as unknown as ThreadRow[]

  return rows.map(toThread)
}
