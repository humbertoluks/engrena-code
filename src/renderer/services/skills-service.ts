const BASE_URL = 'http://127.0.0.1:5174'

function sessionToken(): string {
  return localStorage.getItem('sessionToken') ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-engrenacode-session': sessionToken(),
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers: headers() })
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

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
  list: (): Promise<{ skills: Skill[] } & ApiError> => get('/api/skills'),

  create: (input: SkillCreateInput): Promise<SkillResult> => send('POST', '/api/skills', input),

  update: (id: string, patch: SkillUpdateInput): Promise<SkillResult> =>
    send('PUT', `/api/skills/${id}`, patch),

  remove: (id: string): Promise<DeleteResult> => send('DELETE', `/api/skills/${id}`),

  listForProject: (projectId: string): Promise<SkillLinkState[] & ApiError> =>
    get(`/api/projects/${projectId}/skills`),

  linkSkill: (
    projectId: string,
    skillId: string,
    patch: { enabled?: boolean; sortOrder?: number }
  ): Promise<LinkResult> => send('PUT', `/api/projects/${projectId}/skills/${skillId}`, patch),

  unlinkSkill: (projectId: string, skillId: string): Promise<UnlinkResult> =>
    send('DELETE', `/api/projects/${projectId}/skills/${skillId}`),
}
