import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_skill_registry_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createSkill, linkSkill } = await import('../db/repositories/skills.js')
const { createSkillSnapshot, writeSkillSnapshotFile, LOAD_SKILL_TOOL_NAME } = await import('./skill-registry.js')

beforeEach(() => {
  getDb().exec('DELETE FROM project_skills')
  getDb().exec('DELETE FROM skills')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createSkillSnapshot', () => {
  it('lists only linked+enabled skills in the catalog and resolves content on demand', () => {
    const skill = createSkill({
      name: 'convencoes-de-commit',
      description: 'Use ao escrever commits.',
      content: '# Convenções\n\nUse Conventional Commits.',
    })
    createSkill({ name: 'nao-vinculada', description: 'd', content: '# fora' })
    linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })

    const snapshot = createSkillSnapshot('proj-1')

    expect(snapshot.catalog).toEqual([
      { name: 'convencoes-de-commit', description: 'Use ao escrever commits.' },
    ])
    expect(snapshot.loadSkill('convencoes-de-commit')).toBe('# Convenções\n\nUse Conventional Commits.')
    expect(snapshot.loadSkill('nao-vinculada')).toBeNull()
  })
})

describe('writeSkillSnapshotFile', () => {
  it('writes JSON skills map for the MCP load_skill tool', () => {
    const skill = createSkill({
      name: 'convencoes-de-commit',
      description: 'Use ao escrever commits.',
      content: '# Convenções\n\nUse Conventional Commits.',
    })
    linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })

    const path = writeSkillSnapshotFile(createSkillSnapshot('proj-1'))
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { skills: Record<string, string> }
    expect(parsed.skills['convencoes-de-commit']).toBe('# Convenções\n\nUse Conventional Commits.')
    expect(LOAD_SKILL_TOOL_NAME).toBe('mcp__engrenacode__load_skill')
  })
})
