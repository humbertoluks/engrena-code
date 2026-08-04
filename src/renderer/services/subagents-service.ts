import type {
  CatalogOrderItem,
  Subagent,
  SubagentInput,
  SubagentLinkState,
  SubagentPatch,
} from '../../services/db/repositories/subagents.js'

export type { Subagent, SubagentInput, SubagentLinkState, SubagentPatch }

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

export interface ApiErrorBody {
  error?: { code: string; message: string }
}

export interface SubagentCounts {
  global: number
  linkedByProject: Record<string, number>
}

export const subagentsService = {
  list: (): Promise<{ subagents: Subagent[] } & ApiErrorBody> => request('GET', '/api/subagents'),

  create: (input: SubagentInput): Promise<{ subagent: Subagent } & ApiErrorBody> =>
    request('POST', '/api/subagents', input),

  update: (id: string, patch: SubagentPatch): Promise<{ subagent: Subagent } & ApiErrorBody> =>
    request('PUT', `/api/subagents/${encodeURIComponent(id)}`, patch),

  remove: (id: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    request('DELETE', `/api/subagents/${encodeURIComponent(id)}`),

  counts: (): Promise<SubagentCounts & ApiErrorBody> => request('GET', '/api/subagents/counts'),

  listProjectLinks: (projectId: string): Promise<SubagentLinkState[]> =>
    request('GET', `/api/projects/${encodeURIComponent(projectId)}/subagents`),

  upsertLink: (
    projectId: string,
    subagentId: string,
    patch: { enabled?: boolean; sortOrder?: number }
  ): Promise<{ subagent: SubagentLinkState } & ApiErrorBody> =>
    request('PUT', `/api/projects/${encodeURIComponent(projectId)}/subagents/${encodeURIComponent(subagentId)}`, patch),

  unlink: (projectId: string, subagentId: string): Promise<{ deleted: boolean } & ApiErrorBody> =>
    request('DELETE', `/api/projects/${encodeURIComponent(projectId)}/subagents/${encodeURIComponent(subagentId)}`),

  setCatalogOrder: (
    projectId: string,
    items: CatalogOrderItem[]
  ): Promise<{ subagents: SubagentLinkState[] } & ApiErrorBody> =>
    request('PUT', `/api/projects/${encodeURIComponent(projectId)}/catalog-order`, { kind: 'subagents', items }),
}
