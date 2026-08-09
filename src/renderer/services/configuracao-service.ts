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
  voice: { openai: boolean; groq: boolean }
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

export type VoiceKeyName = 'openai' | 'groq'

export interface SaveVoiceKeysResult {
  saved?: boolean
  voice?: Record<VoiceKeyName, boolean>
  message?: string
  error?: { code: string; message: string; details?: Partial<Record<VoiceKeyName, string>> }
}

export interface ApiError {
  error?: { code: string; message: string }
}

// ── VCS (F24) ────────────────────────────────────────────────────────────────

export type VcsOauthKind = 'gitlab' | 'bitbucket' | 'azure'
export type VcsProviderKind = 'github' | VcsOauthKind
export type VcsOauthStatus = 'disconnected' | 'pending' | 'connected' | 'needs-reauth' | 'needs-client-id'

export interface VcsProviderStatus {
  kind: VcsProviderKind
  auth: 'pat' | 'oauth'
  status: string
  tokenPresent: boolean
}

export interface VcsStatusResult {
  providers?: VcsProviderStatus[]
  error?: { code: string; message: string }
}

export interface VcsOauthStartResult {
  authorizeUrl?: string
  status?: 'needs-client-id'
  error?: { code: string; message: string }
}

export interface VcsOauthMutationResult {
  status?: VcsOauthStatus
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

  saveVoiceKeys: (fields: Partial<Record<VoiceKeyName, string>>): Promise<SaveVoiceKeysResult> =>
    apiRequest('POST', '/api/config/voice/keys/save', fields),

  testGlm: (): Promise<ProviderTestResult> => apiRequest('POST', '/api/config/glm/test'),

  testGrok: (): Promise<ProviderTestResult> => apiRequest('POST', '/api/config/grok/test'),

  vcsStatus: (): Promise<VcsStatusResult> => apiRequest('GET', '/api/config/vcs/status'),

  vcsOauthStart: (kind: VcsOauthKind): Promise<VcsOauthStartResult> =>
    apiRequest('POST', `/api/config/vcs/${kind}/oauth/start`),

  vcsOauthDisconnect: (kind: VcsOauthKind): Promise<VcsOauthMutationResult> =>
    apiRequest('POST', `/api/config/vcs/${kind}/oauth/disconnect`),

  vcsOauthSaveClientId: (kind: VcsOauthKind, clientId: string): Promise<VcsOauthMutationResult> =>
    apiRequest('PUT', `/api/config/vcs/${kind}/oauth/client`, { clientId }),
}
