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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

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
}

export interface ApiErrorBody {
  error?: { code: string; message: string }
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
  list: (): Promise<{ rules: Rule[] } & ApiErrorBody> => request('GET', '/api/rules'),

  create: (input: CreateRuleInput): Promise<{ rule: Rule } & ApiErrorBody> =>
    request('POST', '/api/rules', input),

  update: (id: string, patch: UpdateRuleInput): Promise<{ rule: Rule } & ApiErrorBody> =>
    request('PUT', `/api/rules/${id}`, patch),

  remove: (id: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    request('DELETE', `/api/rules/${id}`),

  counts: (): Promise<RuleCounts & ApiErrorBody> => request('GET', '/api/rules/counts'),

  listForProject: (projectId: string): Promise<{ rules: RuleLinkState[] } & ApiErrorBody> =>
    request('GET', `/api/projects/${projectId}/rules`),

  setProjectLink: (
    projectId: string,
    ruleId: string,
    input: { enabled?: boolean; sortOrder?: number }
  ): Promise<{ rule: RuleLinkState } & ApiErrorBody> =>
    request('PUT', `/api/projects/${projectId}/rules/${ruleId}`, input),

  unlinkFromProject: (projectId: string, ruleId: string): Promise<{ unlinked: boolean } & ApiErrorBody> =>
    request('DELETE', `/api/projects/${projectId}/rules/${ruleId}`),
}
