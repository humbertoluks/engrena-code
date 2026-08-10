import { describe, expect, it, vi } from 'vitest'
import type { Rule } from '../db/repositories/rules.js'

const resolveForTurnMock = vi.fn<(projectId: string) => Rule[]>()

vi.mock('../db/repositories/rules.js', () => ({
  resolveForTurn: (projectId: string) => resolveForTurnMock(projectId),
}))

const { RuleRegistry } = await import('./rule-registry.js')

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_1',
    name: 'no-any',
    description: null,
    content: 'Nunca use `any` sem justificativa.',
    category: null,
    isGlobal: true,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('RuleRegistry.resolveForTurn', () => {
  it('delegates straight to the repository resolveForTurn with the given projectId', () => {
    const rules = [makeRule()]
    resolveForTurnMock.mockReturnValueOnce(rules)

    expect(RuleRegistry.resolveForTurn('proj_1')).toBe(rules)
    expect(resolveForTurnMock).toHaveBeenCalledWith('proj_1')
  })
})

describe('RuleRegistry.composeBlockForTurn', () => {
  it('composes the rules block from whatever resolveForTurn returns', () => {
    resolveForTurnMock.mockReturnValueOnce([makeRule({ name: 'no-any', content: 'Nunca use any.' })])

    const block = RuleRegistry.composeBlockForTurn('proj_1')

    expect(block).toContain('no-any')
    expect(block).toContain('Nunca use any.')
  })

  it('returns an empty string when the project has no active rules', () => {
    resolveForTurnMock.mockReturnValueOnce([])
    expect(RuleRegistry.composeBlockForTurn('proj_empty')).toBe('')
  })
})
