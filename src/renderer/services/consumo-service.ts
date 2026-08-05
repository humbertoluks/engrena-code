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

async function send<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method, headers: headers(), body: JSON.stringify(body) })
  return res.json() as Promise<T>
}

// ── Tipos de resposta (espelham consumo-handler.ts) ─────────────────────────

export type BillingMode = 'subscription' | 'api-key' | 'token-plan'
export type UsageSource = 'agent' | 'subagent'
export type CostSource = 'sdk' | 'table'

export interface BillingModeSummary {
  costUsd: number | null
  approximate: boolean
}

export interface SummaryResponse {
  byBillingMode: {
    subscription: BillingModeSummary
    apiKey: BillingModeSummary
    tokenPlan: BillingModeSummary
  }
  tokens: { input: number; output: number }
  cacheReadPercent: number | null
  threads: { active: number; total: number }
  partial: boolean
}

export interface ProjectUsageRow {
  projectId: string
  projectName: string
  costUsd: number | null
  costPartial: boolean
  totalTokens: number
  threadCount: number
  cacheReadPercent: number | null
  lastEventAt: number
}

export interface ProjectsResponse {
  projects: ProjectUsageRow[]
}

export interface ThreadUsageRow {
  threadId: string
  threadTitle: string | null
  providers: string[]
  models: string[]
  agentTokens: number
  subagentTokens: number
  agentCostUsd: number | null
  subagentCostUsd: number | null
  agentPricingComplete: boolean
  subagentPricingComplete: boolean
  lastEventAt: number
}

export interface ProjectDetailResponse {
  threads: ThreadUsageRow[]
}

export interface UsageEventRow {
  id: string
  createdAt: number
  turnId: string
  source: UsageSource
  subagentName: string | null
  provider: string
  model: string | null
  billingMode: BillingMode
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
  totalTokens: number
  costUsd: number | null
  costSource: CostSource
  costApproximate: boolean
}

export interface ThreadEventsResponse {
  events: UsageEventRow[]
  page: { limit: number; offset: number; hasMore: boolean }
}

export interface ModelPricingRow {
  id: string
  provider: string
  model: string
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number | null
  cacheWritePerMTok: number | null
  approximate: boolean
  source: string | null
  updatedAt: number
}

export interface ProviderModelPair {
  provider: string
  model: string
}

export interface PricingListResponse {
  pricing: ModelPricingRow[]
  unpricedModels: ProviderModelPair[]
}

export interface PricingMutationResponse {
  pricing: ModelPricingRow
  recalculatedEvents: number
}

export interface ApiError {
  error: { code: string; message: string }
}

export interface CreatePricingInput {
  provider: string
  model: string
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok?: number | null
  cacheWritePerMTok?: number | null
  approximate?: boolean
  source?: string | null
}

export type UpdatePricingInput = Partial<Omit<CreatePricingInput, 'provider' | 'model'>>

export type Period = '7d' | '30d' | 'all'

/** `'all'` → sem `from`/`to`; demais → janela UTC ISO até agora (spec F11 ui.md §Layout/tokens). */
export function periodToRange(period: Period): { from?: string; to?: string } {
  if (period === 'all') return {}
  const days = period === '7d' ? 7 : 30
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

function withPeriod(params: URLSearchParams, period: Period): void {
  const range = periodToRange(period)
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
}

export const THREAD_EVENTS_PAGE_SIZE = 100

export const consumoService = {
  getSummary: (period: Period): Promise<SummaryResponse | ApiError> => {
    const params = new URLSearchParams()
    withPeriod(params, period)
    return get(`/api/metrics/summary?${params.toString()}`)
  },

  getProjects: (period: Period): Promise<ProjectsResponse | ApiError> => {
    const params = new URLSearchParams()
    withPeriod(params, period)
    return get(`/api/metrics/projects?${params.toString()}`)
  },

  getProjectDetail: (projectId: string, period: Period): Promise<ProjectDetailResponse | ApiError> => {
    const params = new URLSearchParams()
    withPeriod(params, period)
    return get(`/api/metrics/projects/${encodeURIComponent(projectId)}?${params.toString()}`)
  },

  getThreadEvents: (threadId: string, period: Period, offset: number): Promise<ThreadEventsResponse | ApiError> => {
    const params = new URLSearchParams()
    withPeriod(params, period)
    params.set('limit', String(THREAD_EVENTS_PAGE_SIZE))
    params.set('offset', String(offset))
    return get(`/api/metrics/threads/${encodeURIComponent(threadId)}?${params.toString()}`)
  },

  listPricing: (): Promise<PricingListResponse | ApiError> => get('/api/pricing'),

  createPricing: (input: CreatePricingInput): Promise<PricingMutationResponse | ApiError> =>
    send('POST', '/api/pricing', input),

  updatePricing: (id: string, input: UpdatePricingInput): Promise<PricingMutationResponse | ApiError> =>
    send('PUT', `/api/pricing/${encodeURIComponent(id)}`, input),
}
