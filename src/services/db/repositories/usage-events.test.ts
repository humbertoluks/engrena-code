import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_usage_events_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread, updateThread } = await import('./threads.js')
const {
  createUsageEvent,
  getSummary,
  listProjectUsage,
  getProjectThreadUsage,
  getThreadEvents,
  recalculateNullCosts,
  distinctUnpricedModels,
  calculateTableCost,
} = await import('./usage-events.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_usage_events_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeThread(overrides: { provider?: 'claude' | 'codex' | 'kimi' | 'minimax' } = {}) {
  const project = createProject({ path: makeProjectDir(`project-${Math.random()}`) })
  const thread = createThread({
    projectId: project.id,
    provider: overrides.provider ?? 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
  })
  return { project, thread }
}

beforeEach(() => {
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM model_pricing')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('createUsageEvent', () => {
  it('persists and computes total_tokens from the parts', () => {
    const { project, thread } = makeThread()
    const event = createUsageEvent({
      turnId: 'turn-1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'subscription',
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 5,
      cacheCreationTokens: 3,
      costUsd: 0.01,
      costSource: 'sdk',
    })

    expect(event.id).toMatch(/^usage_/)
    expect(event.totalTokens).toBe(128)
    expect(event.costSource).toBe('sdk')
    expect(event.costApproximate).toBe(false)
    expect(event.subagentName).toBeNull()
  })
})

describe('calculateTableCost', () => {
  it('applies uncached input + cache read/write rates + output rate, divided by 1e6', () => {
    const { costUsd } = calculateTableCost(
      { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheCreationTokens: 100_000 },
      { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75, approximate: false }
    )
    // uncached = 1_000_000 - 200_000 - 100_000 = 700_000
    // 700_000*3 + 200_000*0.3 + 100_000*3.75 + 500_000*15 = 2_100_000 + 60_000 + 375_000 + 7_500_000 = 10_035_000
    expect(costUsd).toBeCloseTo(10.035, 6)
  })

  it('falls back to inputPerMTok when cache rates are null', () => {
    const { costUsd } = calculateTableCost(
      { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000, cacheCreationTokens: 0 },
      { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: null, cacheWritePerMTok: null, approximate: false }
    )
    // uncached = 0; cacheRead uses inputPerMTok fallback: 1_000_000*2/1e6 = 2
    expect(costUsd).toBeCloseTo(2, 6)
  })
})

describe('recalculateNullCosts', () => {
  it('only updates rows with cost_usd IS NULL AND cost_source=table for the given provider/model', () => {
    const { project, thread } = makeThread()
    const sdkEvent = createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'subscription',
      inputTokens: 1000,
      outputTokens: 100,
      costUsd: 0.5,
      costSource: 'sdk',
    })
    const alreadyPriced = createUsageEvent({
      turnId: 't2',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'api-key',
      inputTokens: 1000,
      outputTokens: 100,
      costUsd: 0.2,
      costSource: 'table',
    })
    const unpriced = createUsageEvent({
      turnId: 't3',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'api-key',
      inputTokens: 1_000_000,
      outputTokens: 0,
      costUsd: null,
      costSource: 'table',
    })

    const updated = recalculateNullCosts('claude', 'claude-sonnet-4-6', {
      inputPerMTok: 3,
      outputPerMTok: 15,
      cacheReadPerMTok: null,
      cacheWritePerMTok: null,
      approximate: false,
    })

    expect(updated).toBe(1)

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    const byId = new Map(page.events.map((e) => [e.id, e]))
    expect(byId.get(sdkEvent.id)?.costUsd).toBe(0.5)
    expect(byId.get(alreadyPriced.id)?.costUsd).toBe(0.2)
    expect(byId.get(unpriced.id)?.costUsd).toBeCloseTo(3, 6)
  })
})

describe('distinctUnpricedModels', () => {
  it('returns provider/model pairs observed in usage_events without a matching model_pricing row', () => {
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'codex',
      model: 'gpt-5-codex',
      billingMode: 'api-key',
      inputTokens: 10,
      outputTokens: 5,
      costUsd: null,
      costSource: 'table',
    })

    expect(distinctUnpricedModels()).toEqual([{ provider: 'codex', model: 'gpt-5-codex' }])

    getDb()
      .prepare(
        `INSERT INTO model_pricing (id, provider, model, input_per_mtok, output_per_mtok, approximate, created_at, updated_at)
         VALUES ('price_codex_gpt-5-codex', 'codex', 'gpt-5-codex', 1, 2, 0, 0, 0)`
      )
      .run()

    expect(distinctUnpricedModels()).toEqual([])
  })
})

describe('getSummary', () => {
  it('splits cost by billing mode, computes cacheReadPercent and flags partial when any event lacks cost', () => {
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'subscription',
      inputTokens: 80,
      outputTokens: 20,
      cacheReadTokens: 20,
      costUsd: 1,
      costSource: 'sdk',
    })
    createUsageEvent({
      turnId: 't2',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'codex',
      model: 'gpt-5-codex',
      billingMode: 'api-key',
      inputTokens: 100,
      outputTokens: 0,
      costUsd: null,
      costSource: 'table',
    })

    const summary = getSummary()

    expect(summary.byBillingMode.subscription.costUsd).toBe(1)
    expect(summary.byBillingMode.apiKey.costUsd).toBeNull()
    expect(summary.byBillingMode.tokenPlan.costUsd).toBeNull()
    expect(summary.tokens.input).toBe(180)
    expect(summary.tokens.output).toBe(20)
    expect(summary.partial).toBe(true)
    expect(summary.threads.total).toBe(1)
  })

  it('counts a thread as active only when its state is running or stopping', () => {
    const { project, thread } = makeThread()
    updateThread(thread.id, { state: 'running' })
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 10,
      outputTokens: 5,
      costSource: 'table',
    })

    expect(getSummary().threads.active).toBe(1)

    updateThread(thread.id, { state: 'idle' })
    expect(getSummary().threads.active).toBe(0)
  })

  it('respects the fromMs/toMs period filter', () => {
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 999,
      outputTokens: 1,
      costSource: 'table',
    })

    expect(getSummary({ fromMs: Date.now() + 60_000 }).tokens.input).toBe(0)
    expect(getSummary({ toMs: Date.now() + 60_000 }).tokens.input).toBe(999)
  })
})

describe('listProjectUsage', () => {
  it('aggregates per project ordered by total tokens desc', () => {
    const a = makeThread()
    const b = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: a.project.id,
      threadId: a.thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 10,
      outputTokens: 10,
      costUsd: 0.1,
      costSource: 'sdk',
    })
    createUsageEvent({
      turnId: 't2',
      projectId: b.project.id,
      threadId: b.thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1000,
      outputTokens: 1000,
      costUsd: null,
      costSource: 'table',
    })

    const rows = listProjectUsage()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.projectId).toBe(b.project.id)
    expect(rows[0]?.costPartial).toBe(true)
    expect(rows[1]?.projectId).toBe(a.project.id)
    expect(rows[1]?.costUsd).toBe(0.1)
  })
})

describe('getProjectThreadUsage', () => {
  it('splits agent vs subagent tokens/cost and derives pricingComplete per side', () => {
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'subscription',
      inputTokens: 100,
      outputTokens: 10,
      costUsd: 1,
      costSource: 'sdk',
    })
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'subagent',
      subagentName: 'reviewer',
      provider: 'claude',
      model: 'claude-haiku-4-5',
      billingMode: 'subscription',
      inputTokens: 50,
      outputTokens: 5,
      costUsd: null,
      costSource: 'table',
    })

    const [detail] = getProjectThreadUsage(project.id)
    expect(detail?.agentTokens).toBe(110)
    expect(detail?.subagentTokens).toBe(55)
    expect(detail?.agentCostUsd).toBe(1)
    expect(detail?.agentPricingComplete).toBe(true)
    expect(detail?.subagentCostUsd).toBeNull()
    expect(detail?.subagentPricingComplete).toBe(false)
    expect(detail?.providers).toEqual(['claude'])
    expect(detail?.models.sort()).toEqual(['claude-haiku-4-5', 'claude-sonnet-4-6'])
  })
})

describe('getThreadEvents', () => {
  it('paginates newest-first and reports hasMore', () => {
    const { project, thread } = makeThread()
    for (let i = 0; i < 5; i++) {
      createUsageEvent({
        turnId: `t${i}`,
        projectId: project.id,
        threadId: thread.id,
        source: 'agent',
        provider: 'claude',
        billingMode: 'subscription',
        inputTokens: i,
        outputTokens: 0,
        costSource: 'table',
      })
    }

    const firstPage = getThreadEvents(thread.id, undefined, 2, 0)
    expect(firstPage.events).toHaveLength(2)
    expect(firstPage.page.hasMore).toBe(true)

    const lastPage = getThreadEvents(thread.id, undefined, 2, 4)
    expect(lastPage.events).toHaveLength(1)
    expect(lastPage.page.hasMore).toBe(false)
  })

  it('does not leak projectId/threadId in the DTO (already known by the caller)', () => {
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1,
      outputTokens: 1,
      costSource: 'table',
    })

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events[0]).not.toHaveProperty('projectId')
    expect(page.events[0]).not.toHaveProperty('threadId')
  })
})
