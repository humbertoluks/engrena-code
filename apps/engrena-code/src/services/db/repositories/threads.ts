import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type ThreadProvider = 'claude' | 'codex' | 'kimi' | 'minimax' | 'glm' | 'grok'
export type ThreadAccessLevel = 'supervised' | 'auto-accept-edits' | 'full-access'
export type ThreadExecutionMode = 'main' | 'worktree'
export type ThreadState =
  | 'running'
  | 'idle'
  | 'committed'
  | 'error'
  | 'stopping'
  | 'waiting_user'
  | 'waiting_permission'
  | 'cancelled'

export interface Thread {
  id: string
  projectId: string
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  worktreePath: string | null
  state: ThreadState
  title: string | null
  systemPrompt: string | null
  /** Session ID do Claude Code CLI (`--resume` no follow-up). Null para providers sem persistência de sessão. */
  cliSessionId: string | null
  /** Nome do modo de chat aplicado (F28 §3.4); null quando a thread roda sem modo. */
  chatMode: string | null
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
  reasoning_level: string | null
  access_level: string
  execution_mode: string
  worktree_path: string | null
  state: string
  title: string | null
  system_prompt: string | null
  cli_session_id: string | null
  chat_mode: string | null
  created_at: number
  updated_at: number
}

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider as ThreadProvider,
    model: row.model,
    reasoningLevel: row.reasoning_level,
    accessLevel: row.access_level as ThreadAccessLevel,
    executionMode: row.execution_mode as ThreadExecutionMode,
    worktreePath: row.worktree_path,
    state: row.state as ThreadState,
    title: row.title,
    systemPrompt: row.system_prompt,
    cliSessionId: row.cli_session_id ?? null,
    chatMode: row.chat_mode ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateThreadInput {
  projectId: string
  provider: ThreadProvider
  model?: string | null
  reasoningLevel?: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  worktreePath?: string | null
  state?: ThreadState
  title?: string | null
  chatMode?: string | null
}

export function createThread(input: CreateThreadInput): Thread {
  const now = Date.now()
  const id = `thr_${randomUUID()}`

  getDb()
    .prepare(
      `INSERT INTO threads
        (id, project_id, provider, model, reasoning_level, access_level, execution_mode, worktree_path, state, title, system_prompt, chat_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    )
    .run(
      id,
      input.projectId,
      input.provider,
      input.model ?? null,
      input.reasoningLevel ?? null,
      input.accessLevel,
      input.executionMode,
      input.worktreePath ?? null,
      input.state ?? 'running',
      input.title ?? null,
      input.chatMode ?? null,
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

/**
 * Busca por título ou por conteúdo de mensagem da thread (equivalente à busca de sessões do chat
 * do VS Code). O termo é escapado com `#` para `%` e `_` digitados não virarem curinga.
 */
export function searchThreadsForProject(projectId: string, query: string): Thread[] {
  const term = query.trim()
  if (term === '') return listThreadsForProject(projectId)
  const like = `%${term.replace(/[#%_]/g, (c) => `#${c}`)}%`
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT t.* FROM threads t
       LEFT JOIN messages m ON m.thread_id = t.id
       WHERE t.project_id = ?
         AND (t.title LIKE ? ESCAPE '#' OR m.content LIKE ? ESCAPE '#')
       ORDER BY t.created_at DESC`
    )
    .all(projectId, like, like) as unknown as ThreadRow[]
  return rows.map(toThread)
}

export interface UpdateThreadInput {
  state?: ThreadState
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: ThreadAccessLevel
  worktreePath?: string | null
  title?: string | null
  systemPrompt?: string | null
  cliSessionId?: string | null
  chatMode?: string | null
}

export function updateThread(id: string, patch: UpdateThreadInput): Thread | null {
  const existing = getThread(id)
  if (existing === null) return null

  const next = {
    state: patch.state ?? existing.state,
    model: patch.model !== undefined ? patch.model : existing.model,
    reasoningLevel: patch.reasoningLevel !== undefined ? patch.reasoningLevel : existing.reasoningLevel,
    accessLevel: patch.accessLevel ?? existing.accessLevel,
    worktreePath: patch.worktreePath !== undefined ? patch.worktreePath : existing.worktreePath,
    title: patch.title !== undefined ? patch.title : existing.title,
    systemPrompt: patch.systemPrompt !== undefined ? patch.systemPrompt : existing.systemPrompt,
    cliSessionId: patch.cliSessionId !== undefined ? patch.cliSessionId : existing.cliSessionId,
    chatMode: patch.chatMode !== undefined ? patch.chatMode : existing.chatMode,
  }

  getDb()
    .prepare(
      `UPDATE threads SET state = ?, model = ?, reasoning_level = ?, access_level = ?, worktree_path = ?, title = ?, system_prompt = ?, cli_session_id = ?, chat_mode = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.state,
      next.model,
      next.reasoningLevel,
      next.accessLevel,
      next.worktreePath,
      next.title,
      next.systemPrompt,
      next.cliSessionId,
      next.chatMode,
      Date.now(),
      id
    )

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
 * Reconciliação de boot (spec.md F08 §3.2; estendido F21 §3.2): threads presas em `running`,
 * `waiting_user`, `waiting_permission` ou `stopping` de uma execução anterior interrompida viram
 * `error`. O resolver em memória de uma pergunta pendente (F21) ou do PermissionBroker não sobrevive
 * a um restart — a thread nunca seria respondida.
 *
 * `stopping` entra na lista porque é estado transitório do cancelamento: quem o abandona é o
 * `finally` do turno, que morre junto com o processo. Sem reconciliar, uma thread que estava sendo
 * cancelada no crash fica presa em `stopping` para sempre — sem turno vivo para pará-la e sem
 * caminho de volta para `idle`.
 *
 * `error` (e não `cancelled`) por dois motivos: crash não é cancelamento — o usuário não pediu nada,
 * e herdar `cancelled` mentiria sobre a intenção; e `error` é o que alimenta a métrica `errors` e a
 * classificação do inbox "Precisa da sua atenção" (`dashboard.ts`), de onde uma thread quebrada
 * desapareceria se virasse `cancelled`.
 *
 * Retorna as threads afetadas para o chamador gravar `log_entries` `kind='task'` por thread.
 */
export function recoverRunningThreads(): Thread[] {
  const rows = getDb()
    .prepare(
      `UPDATE threads SET state = 'error', updated_at = ?
       WHERE state IN ('running', 'waiting_user', 'waiting_permission', 'stopping')
       RETURNING *`
    )
    .all(Date.now()) as unknown as ThreadRow[]

  return rows.map(toThread)
}
