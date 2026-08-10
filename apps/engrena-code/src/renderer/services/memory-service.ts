import { apiRequest, type ApiErrorBody } from './api-client'

export interface MemoryStatus {
  enabled: boolean
  entryCount: number
  lastEntryAt: string | null
  sizeBytes: number
  corrupted: boolean
}

export interface MemoryJournal {
  content: string
  corrupted: boolean
}

export const memoryService = {
  getStatus: (projectId: string): Promise<MemoryStatus & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/memory/status`),

  setEnabled: (projectId: string, enabled: boolean): Promise<MemoryStatus & ApiErrorBody> =>
    apiRequest('PATCH', `/api/projects/${projectId}/memory/status`, { enabled }),

  getJournal: (projectId: string): Promise<MemoryJournal & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/memory/journal`),
}
