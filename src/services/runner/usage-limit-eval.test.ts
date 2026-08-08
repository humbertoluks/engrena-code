import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f25_usage_limit_eval_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createUsageEvent } = await import('../db/repositories/usage-events.js')
const { upsertUsageLimit } = await import('../db/repositories/usage-limits.js')
const { evaluateUsageLimits, assertUsageLimitNotExceeded, resolveMonthlyPeriod, UsageLimitExceededError } = await import(
  './usage-limit-eval.js'
)

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f25_usage_limit_eval_fixture_'))

function makeThread() {
  const dir = join(fixtureRoot, `project-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  const project = createProject({ path: dir })
  const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
  return { project, thread }
}

function spendUsd(threadId: string, projectId: string, costUsd: number | null) {
  createUsageEvent({
    turnId: `turn_${Math.random()}`,
    projectId,
    threadId,
    source: 'agent',
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    billingMode: 'subscription',
    inputTokens: 100,
    outputTokens: 100,
    costUsd,
    costSource: costUsd === null ? 'table' : 'sdk',
  })
}

beforeEach(() => {
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM usage_limits')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('resolveMonthlyPeriod', () => {
  it('resolves the civil month bounds — day 1 00:00:00 to now', () => {
    const now = new Date(2026, 7, 15, 10, 30, 0)
    const period = resolveMonthlyPeriod(now)
    expect(new Date(period.fromMs)).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
    expect(period.toMs).toBe(now.getTime())
  })
})

describe('evaluateUsageLimits', () => {
  it('returns level=none when no limit is configured', () => {
    const { project } = makeThread()
    const status = evaluateUsageLimits(project.id)
    expect(status).toMatchObject({ level: 'none', blocked: false, failOpen: false, items: [] })
  })

  it('eval_warn80_does_not_block — 80-99%, mode warn', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 100, mode: 'warn' })
    spendUsd(thread.id, project.id, 85)

    const status = evaluateUsageLimits(project.id)
    expect(status.level).toBe('warn80')
    expect(status.blocked).toBe(false)
  })

  it('eval_at100_block — >=100%, mode block', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 100, mode: 'block' })
    spendUsd(thread.id, project.id, 100)

    const status = evaluateUsageLimits(project.id)
    expect(status.level).toBe('at100')
    expect(status.blocked).toBe(true)
  })

  it('at100 with mode warn does not block', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 100, mode: 'warn' })
    spendUsd(thread.id, project.id, 150)

    const status = evaluateUsageLimits(project.id)
    expect(status.level).toBe('at100')
    expect(status.blocked).toBe(false)
  })

  it('eval_worst_of_global_and_project — global ok, project at100 block', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'global', projectId: null, limitUsd: 1000, mode: 'warn' })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'block' })
    spendUsd(thread.id, project.id, 10)

    const status = evaluateUsageLimits(project.id)
    expect(status.level).toBe('at100')
    expect(status.blocked).toBe(true)
    expect(status.items).toHaveLength(2)
  })

  it('sum_ignores_null_cost_usd — spend from priced events only', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 100, mode: 'warn' })
    spendUsd(thread.id, project.id, 50)
    spendUsd(thread.id, project.id, null)

    const status = evaluateUsageLimits(project.id)
    expect(status.items[0]?.spentUsd).toBe(50)
    expect(status.items[0]?.pct).toBe(50)
  })

  it('eval_fail_open_on_throw — aggregation failure never blocks', () => {
    const { project } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 100, mode: 'block' })

    // Força o throw real na agregação (sem mock de módulo ESM): renomeia a tabela, restaura no finally.
    getDb().exec('ALTER TABLE usage_events RENAME TO usage_events_tmp')
    try {
      const status = evaluateUsageLimits(project.id)
      expect(status).toMatchObject({ level: 'none', blocked: false, failOpen: true, items: [] })
    } finally {
      getDb().exec('ALTER TABLE usage_events_tmp RENAME TO usage_events')
    }
  })
})

describe('assertUsageLimitNotExceeded', () => {
  it('dispatch_block_returns_409 — throws UsageLimitExceededError when blocked', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'block' })
    spendUsd(thread.id, project.id, 10)

    expect(() => assertUsageLimitNotExceeded(project.id)).toThrow(UsageLimitExceededError)
  })

  it('dispatch_warn_allows_turn — same spend, mode warn does not throw', () => {
    const { project, thread } = makeThread()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'warn' })
    spendUsd(thread.id, project.id, 10)

    expect(() => assertUsageLimitNotExceeded(project.id)).not.toThrow()
  })
})
