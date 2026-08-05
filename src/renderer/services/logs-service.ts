const BASE_URL = 'http://127.0.0.1:5174'

function sessionToken(): string {
  return localStorage.getItem('sessionToken') ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-engrenacode-session': sessionToken(),
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: headers(),
  })
  return res.json() as Promise<T>
}

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
    return get<LogsResponse | ApiError>(`/api/logs?${params.toString()}`)
  },
  PAGE_SIZE,
}
