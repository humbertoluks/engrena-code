import { getDb } from '../client.js'
import type { ThreadProvider, ThreadState } from './threads.js'

export interface DashboardMetrics {
  projects: number
  running: number
  pendingDiffs: number
  errors: number
}

export type DashboardInboxKind = 'error' | 'pendingDiff' | 'running'

export interface DashboardInboxItem {
  kind: DashboardInboxKind
  threadId: string
  projectId: string
  projectName: string
  title: string | null
  provider: ThreadProvider
  updatedAt: number
}

export interface DashboardRecentItem {
  threadId: string
  projectId: string
  projectName: string
  title: string | null
  provider: ThreadProvider
  state: ThreadState
  updatedAt: number
}

interface InboxRow {
  thread_id: string
  project_id: string
  project_name: string
  title: string | null
  provider: string
  updated_at: number
  kind: string
}

interface RecentRow {
  id: string
  project_id: string
  project_name: string
  title: string | null
  provider: string
  state: string
  updated_at: number
}

/** Contadores agregados dos 4 metric cards do Dashboard (F04). */
export function getDashboardMetrics(): DashboardMetrics {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM projects) AS projects,
        (SELECT COUNT(*) FROM threads WHERE state = 'running') AS running,
        (SELECT COUNT(*) FROM diffs WHERE status = 'pending') AS pendingDiffs,
        (SELECT COUNT(*) FROM threads WHERE state = 'error') AS errors`
    )
    .get() as unknown as DashboardMetrics
  return row
}

/**
 * Itens elegíveis para a inbox "Precisa da sua atenção": um item por thread.
 * Precedência de classificação: pendingDiff (diff status='pending' na thread) > error (state='error') > running (state='running').
 * Threads idle/committed/stopping sem diff pendente ficam de fora.
 * Ordenação: tier fixo (error > pendingDiff > running), desempate por updated_at desc. Corte em `limit`.
 */
export function listDashboardInbox(limit: number): DashboardInboxItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM (
        SELECT t.id AS thread_id, t.project_id AS project_id, p.name AS project_name, t.title AS title,
          t.provider AS provider, t.updated_at AS updated_at,
          CASE
            WHEN EXISTS (SELECT 1 FROM diffs d WHERE d.thread_id = t.id AND d.status = 'pending') THEN 'pendingDiff'
            WHEN t.state = 'error' THEN 'error'
            WHEN t.state = 'running' THEN 'running'
          END AS kind
        FROM threads t
        JOIN projects p ON p.id = t.project_id
      ) WHERE kind IS NOT NULL
      ORDER BY CASE kind WHEN 'error' THEN 0 WHEN 'pendingDiff' THEN 1 WHEN 'running' THEN 2 END, updated_at DESC
      LIMIT ?`
    )
    .all(limit) as unknown as InboxRow[]

  return rows.map((row) => ({
    kind: row.kind as DashboardInboxKind,
    threadId: row.thread_id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    provider: row.provider as ThreadProvider,
    updatedAt: row.updated_at,
  }))
}

/** Últimas `limit` threads por updated_at, cross-project, qualquer state. Alimenta "Atividade recente". */
export function listRecentActivity(limit: number): DashboardRecentItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.id AS id, t.project_id AS project_id, p.name AS project_name, t.title AS title,
        t.provider AS provider, t.state AS state, t.updated_at AS updated_at
      FROM threads t
      JOIN projects p ON p.id = t.project_id
      ORDER BY t.updated_at DESC
      LIMIT ?`
    )
    .all(limit) as unknown as RecentRow[]

  return rows.map((row) => ({
    threadId: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    provider: row.provider as ThreadProvider,
    state: row.state as ThreadState,
    updatedAt: row.updated_at,
  }))
}
