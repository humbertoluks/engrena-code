import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f25_usage_limits_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { listUsageLimits, getGlobalUsageLimit, getProjectUsageLimit, upsertUsageLimit, clearUsageLimit } = await import('./usage-limits.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f25_usage_limits_fixture_'))

function makeProject() {
  const dir = join(fixtureRoot, `project-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  return createProject({ path: dir })
}

beforeEach(() => {
  getDb().exec('DELETE FROM usage_limits')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('upsertUsageLimit', () => {
  it('upsert_global_and_project — both listed, unique per project', () => {
    const project = makeProject()
    upsertUsageLimit({ scope: 'global', projectId: null, limitUsd: 100, mode: 'warn' })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 50, mode: 'block' })

    const limits = listUsageLimits()
    expect(limits).toHaveLength(2)
    expect(getGlobalUsageLimit()?.limitUsd).toBe(100)
    expect(getProjectUsageLimit(project.id)?.limitUsd).toBe(50)
  })

  it('is idempotent on the same scope (deterministic id)', () => {
    upsertUsageLimit({ scope: 'global', projectId: null, limitUsd: 100, mode: 'warn' })
    upsertUsageLimit({ scope: 'global', projectId: null, limitUsd: 200, mode: 'block' })

    const limits = listUsageLimits()
    expect(limits).toHaveLength(1)
    expect(getGlobalUsageLimit()).toMatchObject({ limitUsd: 200, mode: 'block' })
  })

  it('keeps global and project limits independent for different projects', () => {
    const projectA = makeProject()
    const projectB = makeProject()
    upsertUsageLimit({ scope: 'project', projectId: projectA.id, limitUsd: 10, mode: 'warn' })
    upsertUsageLimit({ scope: 'project', projectId: projectB.id, limitUsd: 20, mode: 'block' })

    expect(getProjectUsageLimit(projectA.id)?.limitUsd).toBe(10)
    expect(getProjectUsageLimit(projectB.id)?.limitUsd).toBe(20)
  })
})

describe('clearUsageLimit', () => {
  it('clear_limit_removes_row — limit absent afterwards', () => {
    const project = makeProject()
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 50, mode: 'warn' })
    clearUsageLimit('project', project.id)

    expect(getProjectUsageLimit(project.id)).toBeNull()
  })

  it('is a no-op when the limit does not exist', () => {
    expect(() => clearUsageLimit('global', null)).not.toThrow()
  })
})
