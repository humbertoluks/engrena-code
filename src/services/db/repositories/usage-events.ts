import { randomUUID } from 'crypto'
import { getDb } from '../client.js'
import type { ThreadProvider } from './threads.js'

export type UsageSource = 'agent' | 'subagent'
export type BillingMode = 'subscription' | 'api-key' | 'token-plan'
export type CostSource = 'sdk' | 'table'

export interface UsageEvent {
  id: string
  turnId: string
  projectId: string
  threadId: string
  source: UsageSource
  subagentName: string | null
  provider: ThreadProvider
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
  createdAt: number
}

interface UsageEventRow {
  id: string
  turn_id: string
  project_id: string
  thread_id: string
  source: string
  subagent_name: string | null
  provider: string
  model: string | null
  billing_mode: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number | null
  cache_creation_tokens: number | null
  total_tokens: number
  cost_usd: number | null
  cost_source: string
  cost_approximate: number
  created_at: number
}

function toUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    turnId: row.turn_id,
    projectId: row.project_id,
    threadId: row.thread_id,
    source: row.source as UsageSource,
    subagentName: row.subagent_name,
    provider: row.provider as ThreadProvider,
    model: row.model,
    billingMode: row.billing_mode as BillingMode,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    costSource: row.cost_source as CostSource,
    costApproximate: row.cost_approximate === 1,
    createdAt: row.created_at,
  }
}

// ── Escrita ──────────────────────────────────────────────────────────────

export interface CreateUsageEventInput {
  turnId: string
  projectId: string
  threadId: string
  source: UsageSource
  subagentName?: string | null
  provider: ThreadProvider
  model?: string | null
  billingMode: BillingMode
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number | null
  cacheCreationTokens?: number | null
  costUsd?: number | null
  costSource: CostSource
  costApproximate?: boolean
}

export function createUsageEvent(input: CreateUsageEventInput): UsageEvent {
  const id = `usage_${randomUUID()}`
  const now = Date.now()
  const cacheReadTokens = input.cacheReadTokens ?? null
  const cacheCreationTokens = input.cacheCreationTokens ?? null
  const totalTokens = input.inputTokens + input.outputTokens + (cacheReadTokens ?? 0) + (cacheCreationTokens ?? 0)

  getDb()
    .prepare(
      `INSERT INTO usage_events (
        id, turn_id, project_id, thread_id, source, subagent_name, provider, model, billing_mode,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, total_tokens,
        cost_usd, cost_source, cost_approximate, created_at
      ) VALUES (@id, @turnId, @projectId, @threadId, @source, @subagentName, @provider, @model, @billingMode,
        @inputTokens, @outputTokens, @cacheReadTokens, @cacheCreationTokens, @totalTokens,
        @costUsd, @costSource, @costApproximate, @createdAt)`
    )
    .run({
      id,
      turnId: input.turnId,
      projectId: input.projectId,
      threadId: input.threadId,
      source: input.source,
      subagentName: input.subagentName ?? null,
      provider: input.provider,
      model: input.model ?? null,
      billingMode: input.billingMode,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalTokens,
      costUsd: input.costUsd ?? null,
      costSource: input.costSource,
      costApproximate: input.costApproximate ? 1 : 0,
      createdAt: now,
    })

  return getUsageEvent(id) as UsageEvent
}

export function getUsageEvent(id: string): UsageEvent | null {
  const row = getDb().prepare(`SELECT * FROM usage_events WHERE id = ?`).get(id) as UsageEventRow | undefined
  return row === undefined ? null : toUsageEvent(row)
}

// ── Cálculo de custo por tabela (spec §6) ──────────────────────────────────

export interface PricingSnapshot {
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number | null
  cacheWritePerMTok: number | null
  approximate: boolean
}

export interface TableCostInput {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
}

/** `costUsd = (uncachedInput*input + cacheRead*(cacheRead??input) + cacheCreation*(cacheWrite??input) + output*output) / 1e6` (spec §6). */
export function calculateTableCost(usage: TableCostInput, pricing: PricingSnapshot): { costUsd: number } {
  const cacheReadTokens = usage.cacheReadTokens ?? 0
  const cacheCreationTokens = usage.cacheCreationTokens ?? 0
  const uncachedInput = Math.max(0, usage.inputTokens - cacheReadTokens - cacheCreationTokens)
  const cacheReadRate = pricing.cacheReadPerMTok ?? pricing.inputPerMTok
  const cacheWriteRate = pricing.cacheWritePerMTok ?? pricing.inputPerMTok

  const costUsd =
    (uncachedInput * pricing.inputPerMTok +
      cacheReadTokens * cacheReadRate +
      cacheCreationTokens * cacheWriteRate +
      usage.outputTokens * pricing.outputPerMTok) /
    1_000_000

  return { costUsd }
}

/** Congelamento (spec §6): só `cost_usd IS NULL AND cost_source='table'` é elegível. Retorna quantidade de linhas atualizadas. */
export function recalculateNullCosts(provider: string, model: string, pricing: PricingSnapshot): number {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
       FROM usage_events WHERE provider = @provider AND model = @model AND cost_usd IS NULL AND cost_source = 'table'`
    )
    .all({ provider, model }) as unknown as Array<{
    id: string
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number | null
    cache_creation_tokens: number | null
  }>

  if (rows.length === 0) return 0

  const update = db.prepare(
    `UPDATE usage_events SET cost_usd = @costUsd, cost_approximate = @costApproximate
     WHERE id = @id AND cost_usd IS NULL AND cost_source = 'table'`
  )

  db.exec('BEGIN')
  try {
    for (const row of rows) {
      const { costUsd } = calculateTableCost(
        {
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          cacheReadTokens: row.cache_read_tokens,
          cacheCreationTokens: row.cache_creation_tokens,
        },
        pricing
      )
      update.run({ id: row.id, costUsd, costApproximate: pricing.approximate ? 1 : 0 })
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return rows.length
}

export interface ProviderModelPair {
  provider: string
  model: string
}

/** Pares `(provider, model)` observados em `usage_events` sem linha correspondente em `model_pricing` — alimenta o banner de preço ausente. */
export function distinctUnpricedModels(): ProviderModelPair[] {
  return getDb()
    .prepare(
      `SELECT DISTINCT usage_events.provider AS provider, usage_events.model AS model
       FROM usage_events
       WHERE usage_events.model IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM model_pricing
           WHERE model_pricing.provider = usage_events.provider AND model_pricing.model = usage_events.model
         )`
    )
    .all() as unknown as ProviderModelPair[]
}

// ── Leitura agregada (§5 da spec) ──────────────────────────────────────────

export interface PeriodFilter {
  fromMs?: number
  toMs?: number
}

interface ResolvedPeriod {
  fromMs: number
  toMs: number
}

function resolvePeriod(filter?: PeriodFilter): ResolvedPeriod {
  return { fromMs: filter?.fromMs ?? 0, toMs: filter?.toMs ?? Number.MAX_SAFE_INTEGER }
}

export interface BillingModeSummary {
  costUsd: number | null
  approximate: boolean
}

export interface UsageSummary {
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

function getBillingModeSummary(mode: BillingMode, period: ResolvedPeriod): BillingModeSummary {
  const row = getDb()
    .prepare(
      `SELECT SUM(cost_usd) AS cost_sum, COUNT(cost_usd) AS cost_count, MAX(cost_approximate) AS approx
       FROM usage_events WHERE billing_mode = @mode AND created_at BETWEEN @fromMs AND @toMs`
    )
    .get({ mode, ...period }) as { cost_sum: number | null; cost_count: number; approx: number | null }

  return {
    costUsd: row.cost_count > 0 ? row.cost_sum : null,
    approximate: row.approx === 1,
  }
}

export function getSummary(filter?: PeriodFilter): UsageSummary {
  const period = resolvePeriod(filter)
  const db = getDb()

  const totals = db
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COUNT(DISTINCT thread_id) AS threads_total,
        SUM(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced_count
      FROM usage_events WHERE created_at BETWEEN @fromMs AND @toMs`
    )
    .get({ ...period }) as {
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    total_tokens: number
    threads_total: number
    unpriced_count: number
  }

  const activeRow = db
    .prepare(
      `SELECT COUNT(DISTINCT usage_events.thread_id) AS active
       FROM usage_events JOIN threads ON threads.id = usage_events.thread_id
       WHERE threads.state IN ('running','stopping') AND usage_events.created_at BETWEEN @fromMs AND @toMs`
    )
    .get({ ...period }) as { active: number }

  return {
    byBillingMode: {
      subscription: getBillingModeSummary('subscription', period),
      apiKey: getBillingModeSummary('api-key', period),
      tokenPlan: getBillingModeSummary('token-plan', period),
    },
    tokens: { input: totals.input_tokens, output: totals.output_tokens },
    cacheReadPercent: totals.total_tokens > 0 ? (totals.cache_read_tokens / totals.total_tokens) * 100 : null,
    threads: { active: activeRow.active, total: totals.threads_total },
    partial: totals.unpriced_count > 0,
  }
}

export interface ProjectUsageSummary {
  projectId: string
  projectName: string
  costUsd: number | null
  costPartial: boolean
  totalTokens: number
  threadCount: number
  cacheReadPercent: number | null
  lastEventAt: number
}

export function listProjectUsage(filter?: PeriodFilter): ProjectUsageSummary[] {
  const period = resolvePeriod(filter)
  const rows = getDb()
    .prepare(
      `SELECT
        usage_events.project_id AS project_id,
        projects.name AS project_name,
        SUM(usage_events.cost_usd) AS cost_sum,
        COUNT(usage_events.cost_usd) AS cost_count,
        SUM(CASE WHEN usage_events.cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced_count,
        SUM(usage_events.total_tokens) AS total_tokens,
        SUM(usage_events.cache_read_tokens) AS cache_read_tokens,
        COUNT(DISTINCT usage_events.thread_id) AS thread_count,
        MAX(usage_events.created_at) AS last_event_at
      FROM usage_events
      JOIN projects ON projects.id = usage_events.project_id
      WHERE usage_events.created_at BETWEEN @fromMs AND @toMs
      GROUP BY usage_events.project_id
      ORDER BY total_tokens DESC`
    )
    .all({ ...period }) as unknown as Array<{
    project_id: string
    project_name: string
    cost_sum: number | null
    cost_count: number
    unpriced_count: number
    total_tokens: number
    cache_read_tokens: number | null
    thread_count: number
    last_event_at: number
  }>

  return rows.map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    costUsd: row.cost_count > 0 ? row.cost_sum : null,
    costPartial: row.unpriced_count > 0,
    totalTokens: row.total_tokens,
    threadCount: row.thread_count,
    cacheReadPercent: row.total_tokens > 0 ? ((row.cache_read_tokens ?? 0) / row.total_tokens) * 100 : null,
    lastEventAt: row.last_event_at,
  }))
}

export interface ThreadUsageDetail {
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

export function getProjectThreadUsage(projectId: string, filter?: PeriodFilter): ThreadUsageDetail[] {
  const period = resolvePeriod(filter)
  const db = getDb()

  const rows = db
    .prepare(
      `SELECT
        usage_events.thread_id AS thread_id,
        threads.title AS thread_title,
        SUM(CASE WHEN source='agent' THEN total_tokens ELSE 0 END) AS agent_tokens,
        SUM(CASE WHEN source='subagent' THEN total_tokens ELSE 0 END) AS subagent_tokens,
        SUM(CASE WHEN source='agent' THEN cost_usd ELSE 0 END) AS agent_cost_sum,
        SUM(CASE WHEN source='agent' THEN 1 ELSE 0 END) AS agent_count,
        SUM(CASE WHEN source='agent' AND cost_usd IS NOT NULL THEN 1 ELSE 0 END) AS agent_priced_count,
        SUM(CASE WHEN source='subagent' THEN cost_usd ELSE 0 END) AS subagent_cost_sum,
        SUM(CASE WHEN source='subagent' THEN 1 ELSE 0 END) AS subagent_count,
        SUM(CASE WHEN source='subagent' AND cost_usd IS NOT NULL THEN 1 ELSE 0 END) AS subagent_priced_count,
        MAX(usage_events.created_at) AS last_event_at
      FROM usage_events
      JOIN threads ON threads.id = usage_events.thread_id
      WHERE usage_events.project_id = @projectId AND usage_events.created_at BETWEEN @fromMs AND @toMs
      GROUP BY usage_events.thread_id
      ORDER BY last_event_at DESC`
    )
    .all({ projectId, ...period }) as unknown as Array<{
    thread_id: string
    thread_title: string | null
    agent_tokens: number
    subagent_tokens: number
    agent_cost_sum: number | null
    agent_count: number
    agent_priced_count: number
    subagent_cost_sum: number | null
    subagent_count: number
    subagent_priced_count: number
    last_event_at: number
  }>

  const providerModelRows = db
    .prepare(
      `SELECT DISTINCT thread_id, provider, model FROM usage_events
       WHERE project_id = @projectId AND created_at BETWEEN @fromMs AND @toMs`
    )
    .all({ projectId, ...period }) as unknown as Array<{ thread_id: string; provider: string; model: string | null }>

  const providersByThread = new Map<string, Set<string>>()
  const modelsByThread = new Map<string, Set<string>>()
  for (const row of providerModelRows) {
    if (!providersByThread.has(row.thread_id)) providersByThread.set(row.thread_id, new Set())
    providersByThread.get(row.thread_id)?.add(row.provider)
    if (row.model) {
      if (!modelsByThread.has(row.thread_id)) modelsByThread.set(row.thread_id, new Set())
      modelsByThread.get(row.thread_id)?.add(row.model)
    }
  }

  return rows.map((row) => ({
    threadId: row.thread_id,
    threadTitle: row.thread_title,
    providers: Array.from(providersByThread.get(row.thread_id) ?? []),
    models: Array.from(modelsByThread.get(row.thread_id) ?? []),
    agentTokens: row.agent_tokens,
    subagentTokens: row.subagent_tokens,
    agentCostUsd: row.agent_priced_count > 0 ? row.agent_cost_sum : null,
    subagentCostUsd: row.subagent_priced_count > 0 ? row.subagent_cost_sum : null,
    agentPricingComplete: row.agent_count === row.agent_priced_count,
    subagentPricingComplete: row.subagent_count === row.subagent_priced_count,
    lastEventAt: row.last_event_at,
  }))
}

export interface UsageEventDto {
  id: string
  createdAt: number
  turnId: string
  source: UsageSource
  subagentName: string | null
  provider: ThreadProvider
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

export interface ThreadEventsPage {
  events: UsageEventDto[]
  page: { limit: number; offset: number; total: number; hasMore: boolean }
}

function toUsageEventDto(event: UsageEvent): UsageEventDto {
  const { projectId: _projectId, threadId: _threadId, ...dto } = event
  return dto
}

export function getThreadEvents(
  threadId: string,
  filter: PeriodFilter | undefined,
  limit: number,
  offset: number
): ThreadEventsPage {
  const period = resolvePeriod(filter)
  const db = getDb()

  const rows = db
    .prepare(
      `SELECT * FROM usage_events
       WHERE thread_id = @threadId AND created_at BETWEEN @fromMs AND @toMs
       ORDER BY created_at DESC, id DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ threadId, ...period, limit, offset }) as unknown as UsageEventRow[]

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total FROM usage_events WHERE thread_id = @threadId AND created_at BETWEEN @fromMs AND @toMs`
    )
    .get({ threadId, ...period }) as { total: number }

  return {
    events: rows.map(toUsageEvent).map(toUsageEventDto),
    page: { limit, offset, total: totalRow.total, hasMore: offset + rows.length < totalRow.total },
  }
}
