import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { skillsRepository, SkillNameConflictError } from './skills'

let tmpDir: string
let prevUserData: string | undefined

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'engrenacode-skills-'))
  prevUserData = process.env.ENGRENACODE_USER_DATA
  process.env.ENGRENACODE_USER_DATA = tmpDir
  skillsRepository._resetCache()
})

afterEach(() => {
  if (prevUserData === undefined) delete process.env.ENGRENACODE_USER_DATA
  else process.env.ENGRENACODE_USER_DATA = prevUserData
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('skillsRepository', () => {
  it('rejects_duplicate_name', () => {
    skillsRepository.create({ name: 'convencoes-de-commit', description: 'desc', content: '# a' })
    expect(() =>
      skillsRepository.create({ name: 'convencoes-de-commit', description: 'outra', content: '# b' })
    ).toThrow(SkillNameConflictError)
  })

  it('rejects_content_over_1mib', () => {
    const bigContent = 'a'.repeat(1_048_577)
    expect(() =>
      skillsRepository.create({ name: 'big', description: 'desc', content: bigContent })
    ).toThrow()
  })

  it('description_long_does_not_block_save', () => {
    const longDescription = 'd'.repeat(500)
    const skill = skillsRepository.create({ name: 'skill-x', description: longDescription, content: '# ok' })
    expect(skill.description).toBe(longDescription)
  })

  it('resolve_excludes_unlinked', () => {
    skillsRepository.create({ name: 'skill-a', description: 'd', content: '# a' })
    const resolved = skillsRepository.resolveForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_excludes_disabled_project', () => {
    const skill = skillsRepository.create({ name: 'skill-b', description: 'd', content: '# b' })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: false, sortOrder: 0 })
    const resolved = skillsRepository.resolveForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_excludes_disabled_global', () => {
    const skill = skillsRepository.create({ name: 'skill-c', description: 'd', content: '# c', enabled: false })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    const resolved = skillsRepository.resolveForProject('proj-1')
    expect(resolved).toHaveLength(0)
  })

  it('resolve_includes_linked_enabled_skills', () => {
    const skill = skillsRepository.create({ name: 'skill-d', description: 'd', content: '# d' })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    const resolved = skillsRepository.resolveForProject('proj-1')
    expect(resolved.map((s) => s.name)).toEqual(['skill-d'])
  })

  it('cascades unlink on delete', () => {
    const skill = skillsRepository.create({ name: 'skill-e', description: 'd', content: '# e' })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })
    skillsRepository.remove(skill.id)
    const links = skillsRepository.listForProject('proj-1')
    expect(links).toHaveLength(0)
  })
})
