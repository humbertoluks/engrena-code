import { apiRequest } from './api-client'
import type { ApiErrorBody } from './api-client'

/** Prompts salvos e modos de chat do projeto (F28 §3.4). `source: 'file'` é somente leitura. */

export interface SavedPromptItem {
  id: string | null
  name: string
  description: string
  body: string
  source: 'db' | 'file'
  file: string | null
}

export interface ChatModeItem {
  id: string | null
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
  instructions: string
  source: 'db' | 'file'
  file: string | null
}

export interface SavedPromptInput {
  name: string
  description?: string
  body: string
}

export interface ChatModeInput {
  name: string
  description?: string
  provider?: string | null
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: string | null
  executionMode?: string | null
  instructions?: string
}

export const promptLibraryService = {
  listPrompts: (projectId: string): Promise<{ prompts: SavedPromptItem[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/prompts`),

  createPrompt: (
    projectId: string,
    input: SavedPromptInput
  ): Promise<{ prompt?: SavedPromptItem } & ApiErrorBody> =>
    apiRequest('POST', `/api/projects/${projectId}/prompts`, input),

  deletePrompt: (id: string): Promise<{ deleted?: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/prompts/${id}`),

  listModes: (projectId: string): Promise<{ modes: ChatModeItem[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/modes`),

  createMode: (projectId: string, input: ChatModeInput): Promise<{ mode?: ChatModeItem } & ApiErrorBody> =>
    apiRequest('POST', `/api/projects/${projectId}/modes`, input),

  deleteMode: (id: string): Promise<{ deleted?: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/modes/${id}`),
}
