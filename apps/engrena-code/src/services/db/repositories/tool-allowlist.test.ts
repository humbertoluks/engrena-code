import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_allowlist_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const {
  allowToolForProject,
  isToolAllowedForProject,
  listAllowedToolsForProject,
  revokeToolForProject,
} = await import('./tool-allowlist.js')

function seedProject(): string {
  return createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_allowlist_proj_')) }).id
}

beforeEach(() => {
  getDb().exec('DELETE FROM tool_allowlist')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => closeDb())

describe('tool allowlist por projeto', () => {
  it('grava e consulta a ferramenta liberada', () => {
    const projectId = seedProject()
    expect(isToolAllowedForProject(projectId, 'Bash')).toBe(false)
    allowToolForProject(projectId, 'Bash')
    expect(isToolAllowedForProject(projectId, 'Bash')).toBe(true)
  })

  it('liberar duas vezes não duplica', () => {
    const projectId = seedProject()
    allowToolForProject(projectId, 'Write')
    allowToolForProject(projectId, 'Write')
    expect(listAllowedToolsForProject(projectId)).toHaveLength(1)
  })

  it('não vaza entre projetos', () => {
    const a = seedProject()
    const b = seedProject()
    allowToolForProject(a, 'Bash')
    expect(isToolAllowedForProject(b, 'Bash')).toBe(false)
  })

  it('revoga', () => {
    const projectId = seedProject()
    allowToolForProject(projectId, 'Edit')
    expect(revokeToolForProject(projectId, 'Edit')).toBe(true)
    expect(isToolAllowedForProject(projectId, 'Edit')).toBe(false)
    expect(revokeToolForProject(projectId, 'Edit')).toBe(false)
  })

  it('some junto com o projeto (cascade)', () => {
    const projectId = seedProject()
    allowToolForProject(projectId, 'Bash')
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(projectId)
    expect(listAllowedToolsForProject(projectId)).toHaveLength(0)
  })
})
