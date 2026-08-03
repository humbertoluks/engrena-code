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

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: headers(),
  })
  return res.json() as Promise<T>
}

// ── Response types ───────────────────────────────────────────────────────────

export interface CLIStatusData {
  installed: boolean
  loggedIn: boolean | null
  path?: string
}

export interface ConfigStatus {
  claude: { mode: 'subscription' | 'api-key'; subscriptionOk: boolean }
  clis: { claude: CLIStatusData; codex: CLIStatusData; kimi: CLIStatusData }
  prompt: { isDefault: boolean; isEmpty: boolean; currentText: string }
  github: { tokenPresent: boolean }
}

export interface ClaudeTestResult {
  success: boolean
  detail: string
  retryAfterSeconds?: number
}

export interface ClisTestResult {
  results: { claude: CLIStatusData; codex: CLIStatusData; kimi: CLIStatusData }
  summary: string
}

export interface PromptSaveResult {
  isDefault: boolean
  isEmpty: boolean
  currentText: string
  message: string
}

export interface GithubSaveResult {
  saved?: boolean
  message?: string
  error?: { code: string; message: string }
}

export interface ApiError {
  error?: { code: string; message: string }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const configuracaoService = {
  getStatus: (): Promise<ConfigStatus> =>
    get<ConfigStatus>('/api/config/status'),

  setClaudeMode: (mode: 'subscription' | 'api-key'): Promise<{ mode: string; subscriptionOk: boolean | null }> =>
    post('/api/config/claude/mode', { mode }),

  testClaude: (): Promise<ClaudeTestResult> =>
    post('/api/config/claude/test'),

  testClis: (): Promise<ClisTestResult> =>
    post('/api/config/clis/test'),

  savePrompt: (prompt: string | null): Promise<PromptSaveResult> =>
    post('/api/config/prompt/save', { prompt }),

  restorePrompt: (): Promise<PromptSaveResult> =>
    post('/api/config/prompt/restore'),

  saveGithubToken: (token: string): Promise<GithubSaveResult> =>
    post('/api/config/github/token', { token }),
}
