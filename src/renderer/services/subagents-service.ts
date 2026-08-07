import { apiRequest, type ApiErrorBody } from './api-client'

export type { ApiErrorBody }

// ── Types (espelham src/services/db/repositories/subagents — sem import Node) ─

export type SubagentProvider = 'claude' | 'codex' | 'kimi' | 'inherit'

export interface Subagent {
  id: string
  name: string
  description: string
  prompt: string
  provider: SubagentProvider
  model: string | null
  reasoningLevel: string | null
  tools: string[] | null
  category: string | null
  idleTimeoutMinutes: number | null
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SubagentLinkState extends Omit<Subagent, 'prompt'> {
  linked: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export type SubagentRunStatus = 'running' | 'completed' | 'cancelled' | 'error' | 'timeout'

export interface SubagentRun {
  childThreadId: string
  parentThreadId: string
  parentToolCallId: string | null
  subagentName: string
  provider: string
  model: string | null
  status: SubagentRunStatus
  text: string | null
  durationMs: number | null
  reasoningLevel: string | null
  actionCount: number
  createdAt: number
}

export interface SubagentInput {
  name: string
  description: string
  prompt: string
  provider: SubagentProvider
  model?: string | null
  reasoningLevel?: string | null
  tools?: string[] | null
  category?: string | null
  idleTimeoutMinutes?: number | null
  enabled?: boolean
}

export type SubagentPatch = Partial<SubagentInput>

export interface CatalogOrderItem {
  id: string
  enabled: boolean
  sortOrder: number
}

export interface SubagentCounts {
  global: number
  linkedByProject: Record<string, number>
}

// ── API ──────────────────────────────────────────────────────────────────────

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
