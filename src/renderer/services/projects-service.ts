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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  path: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface ApiErrorBody {
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export interface VcsStatus {
  hasGit: boolean
  hasHead: boolean
  branch: string | null
  detached: boolean
  ahead: number
  behind: number
  dirty: boolean
}

// ── API ──────────────────────────────────────────────────────────────────────

export const projectsService = {
  list: (): Promise<{ projects: Project[] } & ApiErrorBody> => request('GET', '/api/projects'),

  create: (input: { path: string; name?: string }): Promise<{ project: Project } & ApiErrorBody> =>
    request('POST', '/api/projects', input),

  remove: (id: string): Promise<ApiErrorBody | undefined> => request('DELETE', `/api/projects/${id}`),

  gitInit: (id: string): Promise<{ branch: string; sha: string } & ApiErrorBody> =>
    request('POST', `/api/projects/${id}/git-init`),

  vcsStatus: (id: string): Promise<VcsStatus & ApiErrorBody> => request('GET', `/api/projects/${id}/vcs-status`),
}

export async function browseFolder(): Promise<string | null> {
  if (!window.electronAPI?.dialog) return null
  const result = await window.electronAPI.dialog.openFolder()
  return result.canceled ? null : result.path
}
