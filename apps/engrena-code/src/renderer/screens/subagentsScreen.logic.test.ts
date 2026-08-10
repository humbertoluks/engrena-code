import { describe, expect, it } from 'vitest'
import { matchesFilters, matchesSearch } from './subagentsScreen.logic'
import type { Subagent } from '../services/subagents-service'

function makeSubagent(overrides: Partial<Subagent> = {}): Subagent {
  return {
    id: 'sub-1',
    name: 'Code Reviewer',
    description: 'Revisa diffs antes do commit',
    prompt: 'prompt',
    provider: 'claude',
    model: 'claude-opus',
    reasoningLevel: null,
    tools: null,
    category: 'qualidade',
    idleTimeoutMinutes: null,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('matchesSearch (SubagentsScreen)', () => {
  it('accepts everything when the query is blank', () => {
    expect(matchesSearch(makeSubagent(), '   ')).toBe(true)
  })

  it('matches name or description, case-insensitive and trims whitespace', () => {
    expect(matchesSearch(makeSubagent(), '  reviewer  ')).toBe(true)
    expect(matchesSearch(makeSubagent(), 'DIFFS')).toBe(true)
    expect(matchesSearch(makeSubagent(), 'inexistente')).toBe(false)
  })
})

describe('matchesFilters (SubagentsScreen)', () => {
  it('combines search, model and category filters', () => {
    const s = makeSubagent()
    expect(matchesFilters(s, '', '', '')).toBe(true)
    expect(matchesFilters(s, '', 'claude-opus', '')).toBe(true)
    expect(matchesFilters(s, '', 'gpt-5', '')).toBe(false)
    expect(matchesFilters(s, '', '', 'qualidade')).toBe(true)
    expect(matchesFilters(s, '', '', 'seguranca')).toBe(false)
    expect(matchesFilters(s, 'inexistente', '', '')).toBe(false)
  })
})
