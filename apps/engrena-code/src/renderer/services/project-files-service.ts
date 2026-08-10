import { apiRequest, type ApiErrorBody } from './api-client'

export type { ApiErrorBody }

export interface ProjectFile {
  path: string
}

export interface ProjectFilesListResponse {
  files: ProjectFile[]
  truncated?: boolean
  total?: number
}

export interface ProjectFileReadResponse {
  path: string
  content: string
  size: number
}

export const projectFilesService = {
  search: (
    projectId: string,
    q: string,
    limit = 50,
  ): Promise<ProjectFilesListResponse & ApiErrorBody> => {
    const params = new URLSearchParams()
    if (q.trim() !== '') params.set('q', q.trim())
    params.set('limit', String(limit))
    return apiRequest('GET', `/api/projects/${projectId}/files?${params.toString()}`)
  },

  listForExplorer: (
    projectId: string,
    limit = 5000,
  ): Promise<ProjectFilesListResponse & ApiErrorBody> => {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    return apiRequest('GET', `/api/projects/${projectId}/files?${params.toString()}`)
  },

  read: (projectId: string, path: string): Promise<ProjectFileReadResponse & ApiErrorBody> => {
    const params = new URLSearchParams()
    params.set('path', path)
    return apiRequest('GET', `/api/projects/${projectId}/file?${params.toString()}`)
  },
}
