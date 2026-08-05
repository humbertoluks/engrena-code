import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_diffs_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const { createDiff, countAllPending } = await import('./diffs.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_diffs_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('countAllPending', () => {
  it('sums pending diffs across different threads', () => {
    const projectA = createProject({ path: makeProjectDir('project-a') })
    const projectB = createProject({ path: makeProjectDir('project-b') })
    const threadA = createThread({ projectId: projectA.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    const threadB = createThread({ projectId: projectB.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main' })

    createDiff({ threadId: threadA.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude' })
    createDiff({ threadId: threadB.id, file: 'b.ts', additions: 2, deletions: 1, hunks: [], provider: 'codex' })

    expect(countAllPending()).toBe(2)
  })

  it('ignores accepted and rejected diffs', () => {
    const project = createProject({ path: makeProjectDir('project-c') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })

    createDiff({ threadId: thread.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude', status: 'accepted' })
    createDiff({ threadId: thread.id, file: 'b.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude', status: 'rejected' })

    expect(countAllPending()).toBe(0)
  })

  it('returns 0 with no diffs', () => {
    expect(countAllPending()).toBe(0)
  })
})
