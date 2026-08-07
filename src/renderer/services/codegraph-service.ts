import { apiRequest } from './api-client'

export type CodegraphUiStatus = 'indexed' | 'indexing' | 'unsupported' | 'missing'

export interface CodegraphStatusResponse {
  status: CodegraphUiStatus
  indexedAt: number | null
  ageHours: number | null
  fileCount: number
  symbolCount: number
  root: string | null
  error?: { code: string; message: string }
}

export const codegraphService = {
  status(projectId: string): Promise<CodegraphStatusResponse> {
    return apiRequest<CodegraphStatusResponse>('GET', `/api/projects/${projectId}/codegraph/status`)
  },

  reindex(projectId: string): Promise<CodegraphStatusResponse> {
    return apiRequest<CodegraphStatusResponse>('POST', `/api/projects/${projectId}/codegraph/reindex`, {})
  },
}
