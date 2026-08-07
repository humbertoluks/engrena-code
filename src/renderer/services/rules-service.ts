import { apiRequest, type ApiErrorBody } from './api-client'

export type { ApiErrorBody }

// ── Types ────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string
  name: string
  description: string | null
  content: string
  category: string | null
  isGlobal: boolean
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface RuleLinkState extends Omit<Rule, 'content'> {
  linked: boolean
  activeInProject: boolean
  suppressedHere: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
  contentBytes: number
}

export interface CreateRuleInput {
  name: string
  description?: string | null
  content: string
  category?: string | null
  isGlobal?: boolean
  enabled?: boolean
}

export type UpdateRuleInput = Partial<CreateRuleInput>

export interface RuleCounts {
  global: number
  activeByProject: Record<string, number>
}

// ── API ──────────────────────────────────────────────────────────────────────

export const rulesService = {
  list: (): Promise<{ rules: Rule[] } & ApiErrorBody> => apiRequest('GET', '/api/rules'),

  create: (input: CreateRuleInput): Promise<{ rule: Rule } & ApiErrorBody> =>
    apiRequest('POST', '/api/rules', input),

  update: (id: string, patch: UpdateRuleInput): Promise<{ rule: Rule } & ApiErrorBody> =>
    apiRequest('PUT', `/api/rules/${id}`, patch),

  remove: (id: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/rules/${id}`),

  counts: (): Promise<RuleCounts & ApiErrorBody> => apiRequest('GET', '/api/rules/counts'),

  listForProject: (projectId: string): Promise<{ rules: RuleLinkState[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/rules`),

  setProjectLink: (
    projectId: string,
    ruleId: string,
    input: { enabled?: boolean; sortOrder?: number }
  ): Promise<{ rule: RuleLinkState } & ApiErrorBody> =>
    apiRequest('PUT', `/api/projects/${projectId}/rules/${ruleId}`, input),

  unlinkFromProject: (projectId: string, ruleId: string): Promise<{ unlinked: boolean } & ApiErrorBody> =>
    apiRequest('DELETE', `/api/projects/${projectId}/rules/${ruleId}`),
}
