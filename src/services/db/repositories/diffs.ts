import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type DiffStatus = 'pending' | 'accepted' | 'rejected' | 'conflict'

export interface DiffHunk {
  header: string
  lines: string[]
}

/** Candidato de conflito de merge paralelo (spec F18 §6) — um por filho que tocou o mesmo path. */
export interface DiffConflictCandidate {
  childThreadId: string
  subagentName: string
  hunks: DiffHunk[]
  additions: number
  deletions: number
  /**
   * Worktree do filho onde o arquivo vencedor será lido no momento de `resolve-conflict` — o
   * cleanup pós-batch (F13 `removeWorktreeIfSafe`) retém worktrees com alterações locais, então
   * este path continua válido até o usuário resolver o conflito.
   */
  worktreePath: string
}

export interface Diff {
  id: string
  threadId: string
  file: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
  provider: string
  status: DiffStatus
  worktreePath: string | null
  /** Preenchido só quando `status === 'conflict'` (spec F18 §6). */
  conflictCandidates: DiffConflictCandidate[] | null
  createdAt: number
}

interface DiffRow {
  id: string
  thread_id: string
  file: string
  additions: number
  deletions: number
  hunks_json: string
  provider: string
  status: string
  worktree_path: string | null
  conflict_candidates_json: string | null
  created_at: number
}

function toDiff(row: DiffRow): Diff {
  return {
    id: row.id,
    threadId: row.thread_id,
    file: row.file,
    additions: row.additions,
    deletions: row.deletions,
    hunks: JSON.parse(row.hunks_json) as DiffHunk[],
    provider: row.provider,
    status: row.status as DiffStatus,
    worktreePath: row.worktree_path,
    conflictCandidates:
      row.conflict_candidates_json !== null
        ? (JSON.parse(row.conflict_candidates_json) as DiffConflictCandidate[])
        : null,
    createdAt: row.created_at,
  }
}

export interface CreateDiffInput {
  threadId: string
  file: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
  provider: string
  worktreePath?: string | null
  status?: DiffStatus
  conflictCandidates?: DiffConflictCandidate[] | null
}

export function createDiff(input: CreateDiffInput): Diff {
  const id = `diff_${randomUUID()}`
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO diffs (id, thread_id, file, additions, deletions, hunks_json, provider, status, worktree_path, conflict_candidates_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.threadId,
      input.file,
      input.additions,
      input.deletions,
      JSON.stringify(input.hunks),
      input.provider,
      input.status ?? 'pending',
      input.worktreePath ?? null,
      input.conflictCandidates ? JSON.stringify(input.conflictCandidates) : null,
      now
    )

  return getDiff(id) as Diff
}

export function getDiff(id: string): Diff | null {
  const row = getDb().prepare('SELECT * FROM diffs WHERE id = ?').get(id) as DiffRow | undefined
  return row === undefined ? null : toDiff(row)
}

export function listDiffsForThread(threadId: string): Diff[] {
  const rows = getDb()
    .prepare('SELECT * FROM diffs WHERE thread_id = ? ORDER BY created_at ASC')
    .all(threadId) as unknown as DiffRow[]
  return rows.map(toDiff)
}

export function listPendingForThread(threadId: string): Diff[] {
  return listDiffsForThread(threadId).filter((d) => d.status === 'pending')
}

export function listDiffsByIds(threadId: string, ids: string[]): Diff[] {
  const all = listDiffsForThread(threadId)
  return all.filter((d) => ids.includes(d.id))
}

export function listDiffsByPaths(threadId: string, paths: string[]): Diff[] {
  const all = listDiffsForThread(threadId)
  return all.filter((d) => paths.includes(d.file))
}

export function setDiffStatus(id: string, status: DiffStatus): Diff | null {
  const result = getDb().prepare('UPDATE diffs SET status = ? WHERE id = ?').run(status, id)
  if (Number(result.changes) === 0) return null
  return getDiff(id)
}

export interface PromoteDiffInput {
  hunks: DiffHunk[]
  additions: number
  deletions: number
  worktreePath?: string | null
}

/** Promove um diff `conflict` para `pending` com o conteúdo do candidato vencedor (spec F18 §5.2). */
export function promoteDiffFromConflict(id: string, input: PromoteDiffInput): Diff | null {
  const result = getDb()
    .prepare(
      `UPDATE diffs SET status = 'pending', hunks_json = ?, additions = ?, deletions = ?, worktree_path = ?, conflict_candidates_json = NULL WHERE id = ?`
    )
    .run(JSON.stringify(input.hunks), input.additions, input.deletions, input.worktreePath ?? null, id)
  if (Number(result.changes) === 0) return null
  return getDiff(id)
}

export function countPendingForThread(threadId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as c FROM diffs WHERE thread_id = ? AND status = 'pending'")
    .get(threadId) as { c: number }
  return row.c
}

/** `diffs.thread_id` não tem FK CASCADE (migration 002) — apagar explicitamente antes de `deleteThread` (spec F13 §6). */
export function deleteDiffsForThread(threadId: string): void {
  getDb().prepare('DELETE FROM diffs WHERE thread_id = ?').run(threadId)
}

/** Total de diffs pending em todas as threads. Usado pelo card "Diffs pendentes" do Dashboard (F04). */
export function countAllPending(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as c FROM diffs WHERE status = 'pending'")
    .get() as { c: number }
  return row.c
}
