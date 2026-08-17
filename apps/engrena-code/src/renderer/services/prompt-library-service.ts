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
  /** Skills/rules do projeto que o modo deixa ativas no turno; `null` = não filtra (F28 §3.4). */
  skills: string[] | null
  rules: string[] | null
  source: 'db' | 'file'
  file: string | null
}

export interface SavedPromptInput {
  name: string
  description?: string
  body: string
}

/** Patch do PUT: campo ausente fica como está no banco (o handler não sobrescreve com null). */
export type SavedPromptPatchInput = Partial<SavedPromptInput>

export interface ChatModeInput {
  name: string
  description?: string
  provider?: string | null
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: string | null
  executionMode?: string | null
  instructions?: string
  skills?: string[] | null
  rules?: string[] | null
}

export type ChatModePatchInput = Partial<ChatModeInput>

export const promptLibraryService = {
  listPrompts: (projectId: string): Promise<{ prompts: SavedPromptItem[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/prompts`),

  createPrompt: (
    projectId: string,
    input: SavedPromptInput
  ): Promise<{ prompt?: SavedPromptItem } & ApiErrorBody> =>
    apiRequest('POST', `/api/projects/${projectId}/prompts`, input),

  updatePrompt: (
    id: string,
    patch: SavedPromptPatchInput
  ): Promise<{ prompt?: SavedPromptItem } & ApiErrorBody> => apiRequest('PUT', `/api/prompts/${id}`, patch),

  deletePrompt: (id: string): Promise<{ deleted?: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/prompts/${id}`),

  listModes: (projectId: string): Promise<{ modes: ChatModeItem[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/modes`),

  createMode: (projectId: string, input: ChatModeInput): Promise<{ mode?: ChatModeItem } & ApiErrorBody> =>
    apiRequest('POST', `/api/projects/${projectId}/modes`, input),

  updateMode: (id: string, patch: ChatModePatchInput): Promise<{ mode?: ChatModeItem } & ApiErrorBody> =>
    apiRequest('PUT', `/api/modes/${id}`, patch),

  deleteMode: (id: string): Promise<{ deleted?: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/modes/${id}`),
}
