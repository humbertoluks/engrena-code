import { apiRequest, type ApiErrorBody } from './api-client'

export type { ApiErrorBody }

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  path: string
  name: string
  createdAt: number
  updatedAt: number
}

export type VcsProviderKind = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'unknown' | null

export interface VcsStatus {
  hasGit: boolean
  hasHead: boolean
  branch: string | null
  detached: boolean
  ahead: number
  behind: number
  dirty: boolean
  /** Relative paths with uncommitted changes (from git porcelain). */
  dirtyFiles?: string[]
  kind?: VcsProviderKind
  changeRequestShort?: 'PR' | 'MR'
}

// ── API ──────────────────────────────────────────────────────────────────────

export interface CodeSearchHit {
  path: string
  startLine: number
  endLine: number
  snippet: string
  score: number
}

export const projectsService = {
  /** `#codebase`: trechos do projeto mais próximos do texto do composer. */
  codesearch: (projectId: string, query: string, limit = 3): Promise<{ hits: CodeSearchHit[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/codesearch?q=${encodeURIComponent(query)}&limit=${limit}`),

  list: (): Promise<{ projects: Project[] } & ApiErrorBody> => apiRequest('GET', '/api/projects'),

  create: (input: { path: string; name?: string }): Promise<{ project: Project } & ApiErrorBody> =>
    apiRequest('POST', '/api/projects', input),

  remove: (id: string): Promise<ApiErrorBody | undefined> => apiRequest('DELETE', `/api/projects/${id}`),

  gitInit: (id: string): Promise<{ branch: string; sha: string } & ApiErrorBody> =>
    apiRequest('POST', `/api/projects/${id}/git-init`),

  vcsStatus: (id: string): Promise<VcsStatus & ApiErrorBody> => apiRequest('GET', `/api/projects/${id}/vcs-status`),
}

export async function browseFolder(): Promise<string | null> {
  if (!window.electronAPI?.dialog) return null
  const result = await window.electronAPI.dialog.openFolder()
  return result.canceled ? null : result.path
}
