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
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers: headers() })
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export type McpTransport = 'stdio' | 'http' | 'sse'
export type McpAuthMode = 'key' | 'oauth'
export type McpOauthStatus = 'disconnected' | 'pending' | 'connected' | 'needs-reauth' | 'needs-client-id'

export interface Mcp {
  id: string
  name: string
  description: string | null
  transport: McpTransport
  command: string | null
  args: string[]
  env: Record<string, string>
  url: string | null
  headers: Record<string, string>
  category: string | null
  enabled: boolean
  presetId: string | null
  authMode: McpAuthMode
  oauthStatus: McpOauthStatus | null
  oauthClientId: string | null
  createdAt: number
  updatedAt: number
}

export interface McpLinkState extends Mcp {
  linked: boolean
  enabledInProject: boolean
  sortOrder: number | null
  needsCredential: boolean
}

export interface McpPreset {
  id: string
  name: string
  description: string
  category: string
  transport: McpTransport
  authMode: McpAuthMode
  command?: string
  args?: string[]
  secretEnv?: Record<string, string>
  remoteUrl?: string
  experimental?: boolean
}

export interface McpCreateInput {
  name: string
  description?: string | null
  transport: McpTransport
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  url?: string | null
  headers?: Record<string, string>
  category?: string | null
  enabled?: boolean
}

export type McpUpdateInput = Partial<McpCreateInput>

export interface ApiError {
  error?: { code: string; message: string }
}

export type McpResult = { mcp: Mcp } & ApiError
export type InstallResult = { mcp: Mcp } & ApiError
export type DeleteResult = { deleted?: boolean } & ApiError
export type LinkResult = McpLinkState & ApiError
export type UnlinkResult = { unlinked?: boolean } & ApiError

// ── API ──────────────────────────────────────────────────────────────────────

export const mcpsService = {
  list: (): Promise<{ mcps: Mcp[] } & ApiError> => get('/api/mcps'),

  create: (input: McpCreateInput): Promise<McpResult> => send('POST', '/api/mcps', input),

  update: (id: string, patch: McpUpdateInput): Promise<McpResult> => send('PUT', `/api/mcps/${id}`, patch),

  remove: (id: string): Promise<DeleteResult> => send('DELETE', `/api/mcps/${id}`),

  catalog: (): Promise<{ presets: McpPreset[] } & ApiError> => get('/api/mcp-catalog'),

  installPreset: (presetId: string): Promise<InstallResult> => send('POST', `/api/mcp-catalog/${presetId}/install`),

  listSecretKeys: (): Promise<{ keys: string[] } & ApiError> => get('/api/mcp-secrets'),

  saveSecret: (key: string, value: string): Promise<{ saved?: boolean } & ApiError> =>
    send('PUT', `/api/mcp-secrets/${key}`, { value }),

  deleteSecret: (key: string): Promise<{ deleted?: boolean } & ApiError> => send('DELETE', `/api/mcp-secrets/${key}`),

  oauthStart: (id: string): Promise<{ authorizeUrl?: string; status?: 'needs-client-id' } & ApiError> =>
    send('POST', `/api/mcps/${id}/oauth/start`),

  oauthStatus: (id: string): Promise<{ status: McpOauthStatus } & ApiError> => get(`/api/mcps/${id}/oauth/status`),

  oauthDisconnect: (id: string): Promise<{ status?: McpOauthStatus } & ApiError> =>
    send('POST', `/api/mcps/${id}/oauth/disconnect`),

  oauthSaveClientId: (id: string, clientId: string): Promise<{ status?: McpOauthStatus } & ApiError> =>
    send('PUT', `/api/mcps/${id}/oauth/client`, { clientId }),

  oauthConvert: (id: string, toPresetId: string): Promise<McpResult> =>
    send('POST', `/api/mcps/${id}/oauth/convert`, { toPresetId }),

  listForProject: (projectId: string): Promise<McpLinkState[] & ApiError> => get(`/api/projects/${projectId}/mcps`),

  linkMcp: (projectId: string, mcpId: string, patch: { enabled?: boolean; sortOrder?: number }): Promise<LinkResult> =>
    send('PUT', `/api/projects/${projectId}/mcps/${mcpId}`, patch),

  unlinkMcp: (projectId: string, mcpId: string): Promise<UnlinkResult> =>
    send('DELETE', `/api/projects/${projectId}/mcps/${mcpId}`),
}
