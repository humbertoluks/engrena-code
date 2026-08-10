import { describe, expect, it } from 'vitest'
import { matchesFilters } from './skillsScreen.logic'
import type { Skill } from '../services/skills-service'

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Revisão de PR',
    description: 'Faz review de pull requests',
    content: 'conteudo',
    category: 'qualidade',
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('matchesFilters (SkillsScreen)', () => {
  it('accepts everything when search is empty and category is null', () => {
    expect(matchesFilters(makeSkill(), '', null)).toBe(true)
  })

  it('rejects when the category does not match', () => {
    expect(matchesFilters(makeSkill({ category: 'qualidade' }), '', 'seguranca')).toBe(false)
  })

  it('matches search against name or description, case-insensitive', () => {
    expect(matchesFilters(makeSkill(), 'revisão', null)).toBe(true)
    expect(matchesFilters(makeSkill(), 'PULL REQUESTS', null)).toBe(true)
    expect(matchesFilters(makeSkill(), 'inexistente', null)).toBe(false)
  })

  it('treats a null category on the skill as an empty string bucket', () => {
    expect(matchesFilters(makeSkill({ category: null }), '', '')).toBe(true)
  })
})
