import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type LogKind = 'task' | 'tool' | 'git'

export interface LogEntry {
  id: string
  threadId: string
  projectId: string
  kind: LogKind
  event: string
  createdAt: number
}

interface LogEntryRow {
  id: string
  thread_id: string
  project_id: string
  kind: string
  event: string
  created_at: number
}

function toLogEntry(row: LogEntryRow): LogEntry {
  return {
    id: row.id,
    threadId: row.thread_id,
    projectId: row.project_id,
    kind: row.kind as LogKind,
    event: row.event,
    createdAt: row.created_at,
  }
}

export interface CreateLogEntryInput {
  threadId: string
  kind: LogKind
  event: string
}

export function createLogEntry(input: CreateLogEntryInput): LogEntry {
  const id = `log_${randomUUID()}`
  const now = Date.now()

  getDb()
    .prepare(`INSERT INTO log_entries (id, thread_id, kind, event, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, input.threadId, input.kind, input.event, now)

  return getLogEntry(id) as LogEntry
}

const SELECT_WITH_PROJECT = `SELECT log_entries.*, threads.project_id AS project_id
   FROM log_entries JOIN threads ON threads.id = log_entries.thread_id`

export function getLogEntry(id: string): LogEntry | null {
  const row = getDb()
    .prepare(`${SELECT_WITH_PROJECT} WHERE log_entries.id = ?`)
    .get(id) as LogEntryRow | undefined
  return row === undefined ? null : toLogEntry(row)
}

export interface ListLogEntriesFilter {
  kind?: LogKind
  limit?: number
  offset?: number
}

/** Ordenado created_at DESC (mais recente primeiro — spec.md §3.2). `limit`/`offset` opcionais para paginação incremental. */
export function listLogEntries(filter?: ListLogEntriesFilter): LogEntry[] {
  const limit = filter?.limit ?? -1
  const offset = filter?.offset ?? 0

  const rows = filter?.kind
    ? (getDb()
        .prepare(
          `${SELECT_WITH_PROJECT} WHERE kind = @kind ORDER BY created_at DESC, log_entries.rowid DESC LIMIT @limit OFFSET @offset`
        )
        .all({ kind: filter.kind, limit, offset }) as unknown as LogEntryRow[])
    : (getDb()
        .prepare(`${SELECT_WITH_PROJECT} ORDER BY created_at DESC, log_entries.rowid DESC LIMIT @limit OFFSET @offset`)
        .all({ limit, offset }) as unknown as LogEntryRow[])

  return rows.map(toLogEntry)
}
