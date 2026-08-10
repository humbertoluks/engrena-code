import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_pricing_'))

const { getDb, closeDb } = await import('../client.js')
const { createPricing, updatePricing, listPricing, findPricing, getPricingById, PricingError } = await import('./pricing.js')
const { createUsageEvent, getThreadEvents } = await import('./usage-events.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')

beforeEach(() => {
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM model_pricing')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createPricing', () => {
  it('persists and returns a deterministic id derived from provider/model', () => {
    const { pricing } = createPricing({ provider: 'anthropic', model: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 })
    expect(pricing.id).toBe('price_anthropic_claude-sonnet-4-6')
    expect(pricing.cacheReadPerMTok).toBeNull()
    expect(pricing.approximate).toBe(false)
  })

  it('rejects a duplicate provider/model pair with pricing_conflict', () => {
    createPricing({ provider: 'anthropic', model: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 })
    expect(() => createPricing({ provider: 'anthropic', model: 'claude-sonnet-4-6', inputPerMTok: 1, outputPerMTok: 1 })).toThrow(
      PricingError
    )
  })

  it('recalculates matching table+null usage_events on creation (spec F11 §6)', () => {
    const project = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_pricing_fixture_')) })
    const thread = createThread({ projectId: project.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main' })
    const event = createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'codex',
      model: 'gpt-5-codex',
      billingMode: 'api-key',
      inputTokens: 1_000_000,
      outputTokens: 0,
      costUsd: null,
      costSource: 'table',
    })

    const { recalculatedEvents } = createPricing({ provider: 'codex', model: 'gpt-5-codex', inputPerMTok: 3, outputPerMTok: 15 })

    expect(recalculatedEvents).toBe(1)
    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events.find((e) => e.id === event.id)?.costUsd).toBeCloseTo(3, 6)
  })
})

describe('updatePricing', () => {
  it('updates rates and re-runs recalculateNullCosts for the same provider/model', () => {
    const { pricing } = createPricing({ provider: 'anthropic', model: 'claude-haiku-4-5', inputPerMTok: 1, outputPerMTok: 5 })

    const { pricing: updated, recalculatedEvents } = updatePricing(pricing.id, { inputPerMTok: 2, approximate: true })

    expect(updated.inputPerMTok).toBe(2)
    expect(updated.outputPerMTok).toBe(5)
    expect(updated.approximate).toBe(true)
    expect(recalculatedEvents).toBe(0)
  })

  it('throws not_found for an unknown id', () => {
    expect(() => updatePricing('price_does_not_exist', { inputPerMTok: 1 })).toThrow(PricingError)
  })

  it('never touches an event with cost_source=sdk or an already-priced table event (congelamento)', () => {
    const project = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_pricing_fixture_')) })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    const sdkEvent = createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      billingMode: 'subscription',
      inputTokens: 100,
      outputTokens: 10,
      costUsd: 0.9,
      costSource: 'sdk',
    })

    const { pricing } = createPricing({ provider: 'claude', model: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 })
    updatePricing(pricing.id, { inputPerMTok: 99 })

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events.find((e) => e.id === sdkEvent.id)?.costUsd).toBe(0.9)
  })
})

describe('listPricing / findPricing / getPricingById', () => {
  it('lists ordered by provider/model and finds by natural key', () => {
    createPricing({ provider: 'codex', model: 'gpt-5-codex', inputPerMTok: 1, outputPerMTok: 2 })
    createPricing({ provider: 'anthropic', model: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 })

    const list = listPricing()
    expect(list.map((p) => p.provider)).toEqual(['anthropic', 'codex'])
    expect(findPricing('codex', 'gpt-5-codex')?.outputPerMTok).toBe(2)
    expect(findPricing('codex', null)).toBeNull()
    expect(getPricingById('does-not-exist')).toBeNull()
  })
})
