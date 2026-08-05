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

export type HealthDot = 'ok' | 'warn'
export type PromptDot = 'ok' | 'off'

export interface DashboardHealth {
  claude: HealthDot
  clis: HealthDot
  github: HealthDot
  prompt: PromptDot
  setupIncomplete: boolean
}

export interface DashboardMetrics {
  projects: number
  running: number
  pendingDiffs: number
  errors: number
}

export type DashboardInboxKind = 'setupIncomplete' | 'error' | 'pendingDiff' | 'running'

export interface DashboardInboxItem {
  kind: DashboardInboxKind
  threadId: string | null
  projectId: string | null
  projectName: string | null
  title: string | null
  provider: string | null
  updatedAt: number | null
}

export interface DashboardProject {
  id: string
  path: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface DashboardCatalog {
  skills: number
  rules: number
  subagents: number
}

export interface DashboardRecentItem {
  threadId: string
  projectId: string
  projectName: string
  title: string | null
  provider: string
  state: string
  updatedAt: number
}

export interface DashboardResponse {
  health: DashboardHealth
  metrics: DashboardMetrics
  inbox: DashboardInboxItem[]
  projects: DashboardProject[]
  catalog: DashboardCatalog
  recent: DashboardRecentItem[]
}

export interface ApiError {
  error: { code: string; message: string }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const dashboardService = {
  getDashboard: (): Promise<DashboardResponse | ApiError> =>
    get<DashboardResponse | ApiError>('/api/dashboard'),
}
