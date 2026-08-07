import { apiRequest } from './api-client'

// ── Response types ───────────────────────────────────────────────────────────

export interface CLIStatusData {
  installed: boolean
  loggedIn: boolean | null
  path?: string
}

export type ProviderKeyName = 'claude' | 'codex' | 'minimax' | 'glm' | 'grok'

export interface ProviderAvailability {
  available: boolean
  reason?: string
}

export interface ConfigStatus {
  claude: { mode: 'subscription' | 'api-key'; subscriptionOk: boolean }
  clis: { claude: CLIStatusData; codex: CLIStatusData; kimi: CLIStatusData }
  prompt: { isDefault: boolean; isEmpty: boolean; currentText: string }
  github: { tokenPresent: boolean }
  keys: Record<ProviderKeyName, boolean>
  providers: {
    claude: ProviderAvailability
    codex: ProviderAvailability
    kimi: ProviderAvailability
    minimax: ProviderAvailability
    glm: ProviderAvailability
    grok: ProviderAvailability
  }
}

export interface ProviderTestResult {
  success: boolean
  detail: string
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

export interface SaveKeysResult {
  saved?: boolean
  keys?: Record<ProviderKeyName, boolean>
  message?: string
  error?: { code: string; message: string; details?: Partial<Record<ProviderKeyName, string>> }
}

export interface ApiError {
  error?: { code: string; message: string }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const configuracaoService = {
  getStatus: (): Promise<ConfigStatus> => apiRequest('GET', '/api/config/status'),

  setClaudeMode: (mode: 'subscription' | 'api-key'): Promise<{ mode: string; subscriptionOk: boolean | null }> =>
    apiRequest('POST', '/api/config/claude/mode', { mode }),

  testClaude: (): Promise<ClaudeTestResult> => apiRequest('POST', '/api/config/claude/test'),

  testClis: (): Promise<ClisTestResult> => apiRequest('POST', '/api/config/clis/test'),

  savePrompt: (prompt: string | null): Promise<PromptSaveResult> =>
    apiRequest('POST', '/api/config/prompt/save', { prompt }),

  restorePrompt: (): Promise<PromptSaveResult> => apiRequest('POST', '/api/config/prompt/restore'),

  saveGithubToken: (token: string): Promise<GithubSaveResult> =>
    apiRequest('POST', '/api/config/github/token', { token }),

  saveProviderKeys: (fields: Partial<Record<ProviderKeyName, string>>): Promise<SaveKeysResult> =>
    apiRequest('POST', '/api/config/keys/save', fields),

  testGlm: (): Promise<ProviderTestResult> => apiRequest('POST', '/api/config/glm/test'),

  testGrok: (): Promise<ProviderTestResult> => apiRequest('POST', '/api/config/grok/test'),
}
