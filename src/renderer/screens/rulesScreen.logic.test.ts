import { describe, expect, it } from 'vitest'
import { matchesFilters } from './rulesScreen.logic'
import type { Rule } from '../services/rules-service'

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1',
    name: 'Conventional Commits',
    description: 'Padroniza mensagens de commit',
    content: 'conteudo',
    category: 'git',
    isGlobal: true,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('matchesFilters (RulesScreen)', () => {
  it('accepts everything when search is empty and category is null', () => {
    expect(matchesFilters(makeRule(), '', null)).toBe(true)
  })

  it('rejects when the category does not match', () => {
    expect(matchesFilters(makeRule({ category: 'git' }), '', 'testes')).toBe(false)
  })

  it('matches search against name or description, case-insensitive and trims whitespace', () => {
    expect(matchesFilters(makeRule(), '  commits  ', null)).toBe(true)
    expect(matchesFilters(makeRule(), 'PADRONIZA', null)).toBe(true)
    expect(matchesFilters(makeRule(), 'inexistente', null)).toBe(false)
  })

  it('tolerates a null description without throwing', () => {
    expect(matchesFilters(makeRule({ description: null }), 'commits', null)).toBe(true)
    expect(matchesFilters(makeRule({ description: null }), 'nada', null)).toBe(false)
  })
})
