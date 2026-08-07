import { apiRequest, type ApiErrorBody } from './api-client'

export type { ApiErrorBody }

export interface ProjectFile {
  path: string
}

export const projectFilesService = {
  search: (projectId: string, q: string, limit = 50): Promise<{ files: ProjectFile[] } & ApiErrorBody> => {
    const params = new URLSearchParams()
    if (q.trim() !== '') params.set('q', q.trim())
    params.set('limit', String(limit))
    return apiRequest('GET', `/api/projects/${projectId}/files?${params.toString()}`)
  },
}
