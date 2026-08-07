import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f17_apply_'))

const { getDb, closeDb } = await import('../db/client.js')
const { skillsRepository } = await import('../db/repositories/skills.js')
const { createSubagentsRepository } = await import('../db/repositories/subagents.js')
const { vaultService } = await import('../vault/vault-service.js')
const { SEED_SKILLS, SEED_SUBAGENTS } = await import('./catalog.js')
const { applySeedCatalog } = await import('./apply-catalog.js')

const subagentsRepo = createSubagentsRepository(getDb())
const WORKSPACE = 'f17-apply-ws'
const PASSWORD = 'f17-apply-pass-123'
const FLAG_KEY = 'seeds:catalog:v1'

beforeEach(() => {
  vaultService.unlock(WORKSPACE, PASSWORD)
  try {
    vaultService.deleteSecret(FLAG_KEY)
  } catch {
    // flag never set yet — fine
  }
  vaultService.lock()

  for (const skill of skillsRepository.list()) skillsRepository.remove(skill.id)
  getDb().exec('DELETE FROM project_subagents')
  getDb().exec('DELETE FROM subagents')

  vaultService.unlock(WORKSPACE, PASSWORD)
})

afterEach(() => {
  vaultService.lock()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('applySeedCatalog', () => {
  it('test_apply_inserts_skills_and_subagents_once', () => {
    const result = applySeedCatalog()
    expect(result.applied).toBe(true)
    expect(result.skillsInserted).toBe(SEED_SKILLS.length)
    expect(result.skillsSkipped).toBe(0)
    expect(result.skillsFailed).toBe(0)
    expect(result.subagentsInserted).toBe(SEED_SUBAGENTS.length)
    expect(result.subagentsSkipped).toBe(0)
    expect(result.subagentsFailed).toBe(0)
    expect(skillsRepository.list()).toHaveLength(SEED_SKILLS.length)
    expect(subagentsRepo.list()).toHaveLength(SEED_SUBAGENTS.length)
    expect(vaultService.getSecret(FLAG_KEY)).toBe('1')
  })

  it('test_apply_is_noop_when_flag_set', () => {
    applySeedCatalog()
    const second = applySeedCatalog()
    expect(second.applied).toBe(false)
    expect(second.skillsInserted).toBe(0)
    expect(second.subagentsInserted).toBe(0)
    expect(skillsRepository.list()).toHaveLength(SEED_SKILLS.length)
    expect(subagentsRepo.list()).toHaveLength(SEED_SUBAGENTS.length)
  })

  it('test_apply_skips_existing_skill_name', () => {
    const first = SEED_SKILLS[0]!
    skillsRepository.create({ name: first.name, description: 'pre-existente', content: '# conteúdo pré-existente' })

    const result = applySeedCatalog()

    expect(result.skillsSkipped).toBe(1)
    expect(result.skillsInserted).toBe(SEED_SKILLS.length - 1)
    const preserved = skillsRepository.list().find((s) => s.name === first.name)
    expect(preserved?.description).toBe('pre-existente')
  })

  it('test_apply_skips_existing_subagent_name', () => {
    const first = SEED_SUBAGENTS[0]!
    subagentsRepo.create({
      name: first.name,
      description: 'pre-existente',
      prompt: 'prompt pré-existente',
      provider: 'claude',
    })

    const result = applySeedCatalog()

    expect(result.subagentsSkipped).toBe(1)
    expect(result.subagentsInserted).toBe(SEED_SUBAGENTS.length - 1)
    const preserved = subagentsRepo.list().find((a) => a.name === first.name)
    expect(preserved?.provider).toBe('claude')
  })

  it('test_apply_partial_failure_continues', () => {
    const spy = vi.spyOn(skillsRepository, 'create').mockImplementationOnce(() => {
      throw new Error('disk full')
    })

    let result: ReturnType<typeof applySeedCatalog> | undefined
    expect(() => {
      result = applySeedCatalog()
    }).not.toThrow()

    expect(result?.skillsFailed).toBe(1)
    expect(result?.skillsInserted).toBe(SEED_SKILLS.length - 1)
    expect(vaultService.getSecret(FLAG_KEY)).toBe('1')

    spy.mockRestore()
  })

  it('test_apply_does_not_create_project_links', () => {
    applySeedCatalog()
    expect(skillsRepository.getCounts().linkedByProject).toEqual({})
    expect(subagentsRepo.getCounts().linkedByProject).toEqual({})
  })

  it('test_apply_requires_unlocked_vault_for_flag', () => {
    vaultService.lock()
    expect(() => applySeedCatalog()).toThrow()
  })
})
