import { describe, expect, it } from 'vitest'
import { SEED_CATALOG_VERSION, SEED_SKILLS, SEED_SUBAGENTS } from './catalog.js'

const BANNED_MARKS = ['lioncode', 'lionclaw', 'lionlabs', 'lionsprite']

function collectAllStrings(): string[] {
  const strings: string[] = []
  for (const skill of SEED_SKILLS) strings.push(skill.name, skill.description, skill.content)
  for (const agent of SEED_SUBAGENTS) strings.push(agent.name, agent.description, agent.prompt)
  return strings
}

describe('seed catalog v1', () => {
  it('exports the v1 catalog version', () => {
    expect(SEED_CATALOG_VERSION).toBe('v1')
  })

  it('test_seed_skills_count_in_prd_range', () => {
    expect(SEED_SKILLS.length).toBeGreaterThanOrEqual(8)
    expect(SEED_SKILLS.length).toBeLessThanOrEqual(20)
    expect(SEED_SKILLS.length).toBe(12)
  })

  it('test_seed_subagents_count_in_prd_range', () => {
    expect(SEED_SUBAGENTS.length).toBeGreaterThanOrEqual(5)
    expect(SEED_SUBAGENTS.length).toBeLessThanOrEqual(12)
    expect(SEED_SUBAGENTS.length).toBe(8)
  })

  it('test_seed_names_unique_within_catalog', () => {
    const skillNames = SEED_SKILLS.map((s) => s.name)
    const subagentNames = SEED_SUBAGENTS.map((a) => a.name)
    expect(new Set(skillNames).size).toBe(skillNames.length)
    expect(new Set(subagentNames).size).toBe(subagentNames.length)
  })

  it('test_seed_brand_engrenacode_only', () => {
    const haystack = collectAllStrings().join('\n').toLowerCase()
    for (const banned of BANNED_MARKS) {
      expect(haystack).not.toContain(banned)
    }
    expect(haystack).toContain('engrenacode')
  })

  it('test_seed_skill_fields_valid', () => {
    for (const skill of SEED_SKILLS) {
      expect(skill.name.trim()).not.toBe('')
      expect(skill.description.trim()).not.toBe('')
      expect(skill.content.trim()).not.toBe('')
      expect(Buffer.byteLength(skill.content, 'utf-8')).toBeLessThanOrEqual(1_048_576)
      expect(skill.category).toBe('onboarding')
      expect(skill.enabled).toBe(true)
    }
  })

  it('test_seed_subagent_fields_valid', () => {
    for (const agent of SEED_SUBAGENTS) {
      expect(agent.provider).toBe('inherit')
      expect(agent.prompt.trim().length).toBeGreaterThan(0)
      expect(Buffer.byteLength(agent.prompt, 'utf-8')).toBeLessThanOrEqual(1_048_576)
      const idle = agent.idleTimeoutMinutes
      expect(idle === null || idle === undefined || (idle >= 1 && idle <= 480)).toBe(true)
      expect(agent.category).toBe('onboarding')
      expect(agent.enabled).toBe(true)
    }
  })
})
