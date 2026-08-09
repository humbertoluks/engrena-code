import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_a01_skills_'))

const { getDb, closeDb } = await import('../client.js')
const { createSkill, linkSkill, resolveSkillsForProject, listProjectSkills, deleteSkill, SkillNameConflictError } =
  await import('./skills.js')

beforeEach(() => {
  getDb().exec('DELETE FROM project_skills')
  getDb().exec('DELETE FROM skills')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('skills repository (SQLite)', () => {
  it('rejects_duplicate_name', () => {
    createSkill({ name: 'convencoes-de-commit', description: 'desc', content: '# a' })
    expect(() => createSkill({ name: 'convencoes-de-commit', description: 'outra', content: '# b' })).toThrow(
      SkillNameConflictError
    )
  })

  it('rejects_content_over_1mib', () => {
    const bigContent = 'a'.repeat(1_048_577)
    expect(() => createSkill({ name: 'big', description: 'desc', content: bigContent })).toThrow()
  })

  it('description_long_does_not_block_save', () => {
    const longDescription = 'd'.repeat(500)
    const skill = createSkill({ name: 'skill-x', description: longDescription, content: '# ok' })
    expect(skill.description).toBe(longDescription)
  })

  it('resolve_excludes_unlinked', () => {
    createSkill({ name: 'skill-a', description: 'd', content: '# a' })
    const resolved = resolveSkillsForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_excludes_disabled_project', () => {
    const skill = createSkill({ name: 'skill-b', description: 'd', content: '# b' })
    linkSkill('proj-1', skill.id, { enabled: false, sortOrder: 0 })
    const resolved = resolveSkillsForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_excludes_disabled_global', () => {
    const skill = createSkill({ name: 'skill-c', description: 'd', content: '# c', enabled: false })
    linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    const resolved = resolveSkillsForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_includes_linked_enabled_skills', () => {
    const skill = createSkill({ name: 'skill-d', description: 'd', content: '# d' })
    linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    const resolved = resolveSkillsForProject('proj-1')
    expect(resolved.map((s) => s.name)).toEqual(['skill-d'])
  })

  it('cascades unlink on delete', () => {
    const skill = createSkill({ name: 'skill-e', description: 'd', content: '# e' })
    linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    deleteSkill(skill.id)
    const links = listProjectSkills('proj-1')
    expect(links).toHaveLength(0)
  })
})
