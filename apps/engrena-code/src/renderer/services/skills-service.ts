import { apiRequest } from './api-client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  category: string | null
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SkillLinkState extends Omit<Skill, 'content'> {
  linked: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export interface SkillCreateInput {
  name: string
  description: string
  content: string
  category?: string | null
  enabled?: boolean
}

export type SkillUpdateInput = Partial<SkillCreateInput>

export interface ApiError {
  error?: { code: string; message: string }
}

export type SkillResult = { skill: Skill } & ApiError
export type DeleteResult = { deleted?: boolean } & ApiError
export type LinkResult = SkillLinkState & ApiError
export type UnlinkResult = { unlinked?: boolean } & ApiError

// ── API ──────────────────────────────────────────────────────────────────────

export const skillsService = {
  list: (): Promise<{ skills: Skill[] } & ApiError> => apiRequest('GET', '/api/skills'),

  create: (input: SkillCreateInput): Promise<SkillResult> => apiRequest('POST', '/api/skills', input),

  update: (id: string, patch: SkillUpdateInput): Promise<SkillResult> =>
    apiRequest('PUT', `/api/skills/${id}`, patch),

  remove: (id: string): Promise<DeleteResult> => apiRequest('DELETE', `/api/skills/${id}`),

  listForProject: (projectId: string): Promise<SkillLinkState[] & ApiError> =>
    apiRequest('GET', `/api/projects/${projectId}/skills`),

  linkSkill: (
    projectId: string,
    skillId: string,
    patch: { enabled?: boolean; sortOrder?: number }
  ): Promise<LinkResult> => apiRequest('PUT', `/api/projects/${projectId}/skills/${skillId}`, patch),

  unlinkSkill: (projectId: string, skillId: string): Promise<UnlinkResult> =>
    apiRequest('DELETE', `/api/projects/${projectId}/skills/${skillId}`),
}
