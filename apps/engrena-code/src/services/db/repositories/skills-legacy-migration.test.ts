import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const userDataDir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_a01_legacy_migration_'))
process.env.ENGRENACODE_USER_DATA = userDataDir

const LEGACY_SKILL = {
  id: 'skill-legacy-1',
  name: 'legacy-skill',
  description: 'Skill do skills.json legado.',
  content: '# legado',
  category: 'legado',
  enabled: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

const LEGACY_LINK = {
  projectId: 'proj-legacy',
  skillId: 'skill-legacy-1',
  enabled: true,
  sortOrder: 0,
  createdAt: 1700000000000,
}

const legacyPath = join(userDataDir, 'skills.json')
writeFileSync(legacyPath, JSON.stringify({ skills: [LEGACY_SKILL], projectSkills: [LEGACY_LINK] }), 'utf-8')

const { closeDb } = await import('../client.js')
const { listSkills, listProjectSkills } = await import('./skills.js')

afterAll(() => {
  closeDb()
  rmSync(userDataDir, { recursive: true, force: true })
})

describe('skills legacy JSON migration (A01)', () => {
  it('imports skills.json into the skills/project_skills tables on first access and renames the legacy file', () => {
    const skills = listSkills()
    expect(skills).toHaveLength(1)
    expect(skills[0]).toMatchObject({
      id: 'skill-legacy-1',
      name: 'legacy-skill',
      description: 'Skill do skills.json legado.',
      category: 'legado',
      enabled: true,
    })

    const links = listProjectSkills('proj-legacy')
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ name: 'legacy-skill', linked: true, enabledInProject: true, sortOrder: 0 })

    expect(existsSync(legacyPath)).toBe(false)
    expect(existsSync(`${legacyPath}.migrated`)).toBe(true)
  })
})
