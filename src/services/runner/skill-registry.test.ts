import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { skillsRepository } from '../db/repositories/skills'
import { createSkillSnapshot, writeSkillSnapshotFile, LOAD_SKILL_TOOL_NAME } from './skill-registry'

let tmpDir: string
let prevUserData: string | undefined

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'engrenacode-registry-'))
  prevUserData = process.env.ENGRENACODE_USER_DATA
  process.env.ENGRENACODE_USER_DATA = tmpDir
  skillsRepository._resetCache()
})

afterEach(() => {
  if (prevUserData === undefined) delete process.env.ENGRENACODE_USER_DATA
  else process.env.ENGRENACODE_USER_DATA = prevUserData
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('createSkillSnapshot', () => {
  it('lists only linked+enabled skills in the catalog and resolves content on demand', () => {
    const skill = skillsRepository.create({
      name: 'convencoes-de-commit',
      description: 'Use ao escrever commits.',
      content: '# Convenções\n\nUse Conventional Commits.',
    })
    skillsRepository.create({ name: 'nao-vinculada', description: 'd', content: '# fora' })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })

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
    const skill = skillsRepository.create({
      name: 'convencoes-de-commit',
      description: 'Use ao escrever commits.',
      content: '# Convenções\n\nUse Conventional Commits.',
    })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })

    const path = writeSkillSnapshotFile(createSkillSnapshot('proj-1'))
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { skills: Record<string, string> }
    expect(parsed.skills['convencoes-de-commit']).toBe('# Convenções\n\nUse Conventional Commits.')
    expect(LOAD_SKILL_TOOL_NAME).toBe('mcp__engrenacode__load_skill')
  })
})
