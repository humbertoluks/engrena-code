import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_unlock_boot_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread } = await import('../db/repositories/threads.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { createUnlockServer } = await import('./unlock-handler.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_unlock_boot_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

let server: ReturnType<typeof createUnlockServer> | undefined

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterEach(() => {
  server?.close()
  server = undefined
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('createUnlockServer boot recovery', () => {
  it('moves orphaned running threads to error and records a task log_entries', () => {
    const project = createProject({ path: makeProjectDir('project-a') })
    const running = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'running',
    })

    server = createUnlockServer(0)

    expect(getThread(running.id)?.state).toBe('error')
    const entries = listLogEntries({ kind: 'task' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(running.id)
  })

  it('does nothing when there are no orphaned threads', () => {
    server = createUnlockServer(0)
    expect(listLogEntries({ kind: 'task' })).toEqual([])
  })
})
