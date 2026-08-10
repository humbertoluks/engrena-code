import { apiRequest } from './api-client'

// ── Response types ───────────────────────────────────────────────────────────

export type LogKind = 'task' | 'tool' | 'git'

export interface LogEntry {
  id: string
  threadId: string
  projectId: string
  kind: LogKind
  event: string
  createdAt: number
}

export interface LogsResponse {
  entries: LogEntry[]
}

export interface ApiError {
  error: { code: string; message: string }
}

// ── API ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100

export const logsService = {
  getLogs: (filter?: { kind?: LogKind; limit?: number; offset?: number }): Promise<LogsResponse | ApiError> => {
    const params = new URLSearchParams()
    if (filter?.kind) params.set('kind', filter.kind)
    params.set('limit', String(filter?.limit ?? PAGE_SIZE))
    params.set('offset', String(filter?.offset ?? 0))
    return apiRequest('GET', `/api/logs?${params.toString()}`)
  },
  PAGE_SIZE,
}
