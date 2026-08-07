import type {
  CatalogOrderItem,
  Subagent,
  SubagentInput,
  SubagentLinkState,
  SubagentPatch,
} from '../../services/db/repositories/subagents.js'
import { apiRequest, type ApiErrorBody } from './api-client'

export type { Subagent, SubagentInput, SubagentLinkState, SubagentPatch }
export type { ApiErrorBody }

export interface SubagentCounts {
  global: number
  linkedByProject: Record<string, number>
}

export const subagentsService = {
  list: (): Promise<{ subagents: Subagent[] } & ApiErrorBody> => apiRequest('GET', '/api/subagents'),

  create: (input: SubagentInput): Promise<{ subagent: Subagent } & ApiErrorBody> =>
    apiRequest('POST', '/api/subagents', input),

  update: (id: string, patch: SubagentPatch): Promise<{ subagent: Subagent } & ApiErrorBody> =>
    apiRequest('PUT', `/api/subagents/${encodeURIComponent(id)}`, patch),

  remove: (id: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/subagents/${encodeURIComponent(id)}`),

  counts: (): Promise<SubagentCounts & ApiErrorBody> => apiRequest('GET', '/api/subagents/counts'),

  listProjectLinks: (projectId: string): Promise<SubagentLinkState[]> =>
    apiRequest('GET', `/api/projects/${encodeURIComponent(projectId)}/subagents`),

  upsertLink: (
    projectId: string,
    subagentId: string,
    patch: { enabled?: boolean; sortOrder?: number }
  ): Promise<{ subagent: SubagentLinkState } & ApiErrorBody> =>
    apiRequest('PUT', `/api/projects/${encodeURIComponent(projectId)}/subagents/${encodeURIComponent(subagentId)}`, patch),

  unlink: (projectId: string, subagentId: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/projects/${encodeURIComponent(projectId)}/subagents/${encodeURIComponent(subagentId)}`),

  setCatalogOrder: (
    projectId: string,
    items: CatalogOrderItem[]
  ): Promise<{ subagents: SubagentLinkState[] } & ApiErrorBody> =>
    apiRequest('PUT', `/api/projects/${encodeURIComponent(projectId)}/catalog-order`, { kind: 'subagents', items }),
}
