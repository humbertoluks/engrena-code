import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_log_entries_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject, deleteProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const { createLogEntry, listLogEntries } = await import('./log-entries.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_log_entries_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeThread() {
  const project = createProject({ path: makeProjectDir(`project-${Math.random()}`) })
  return createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
}

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('createLogEntry', () => {
  it('persists and returns the full record', () => {
    const thread = makeThread()
    const entry = createLogEntry({ threadId: thread.id, kind: 'git', event: 'Commit abc123 criado' })

    expect(entry.id).toMatch(/^log_/)
    expect(entry.threadId).toBe(thread.id)
    expect(entry.kind).toBe('git')
    expect(entry.event).toBe('Commit abc123 criado')
    expect(entry.createdAt).toBeGreaterThan(0)
  })
})

describe('listLogEntries', () => {
  it('returns all entries ordered by created_at DESC when no filter is given', () => {
    const thread = makeThread()
    const first = createLogEntry({ threadId: thread.id, kind: 'task', event: 'first' })
    const second = createLogEntry({ threadId: thread.id, kind: 'tool', event: 'second' })

    const entries = listLogEntries()

    expect(entries.map((e) => e.id)).toEqual([second.id, first.id])
  })

  it('filters by kind', () => {
    const thread = makeThread()
    createLogEntry({ threadId: thread.id, kind: 'task', event: 'a task' })
    const toolEntry = createLogEntry({ threadId: thread.id, kind: 'tool', event: 'a tool' })
    createLogEntry({ threadId: thread.id, kind: 'git', event: 'a git' })

    const entries = listLogEntries({ kind: 'tool' })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe(toolEntry.id)
  })

  it('paginates with limit/offset', () => {
    const thread = makeThread()
    for (let i = 0; i < 5; i++) {
      createLogEntry({ threadId: thread.id, kind: 'git', event: `event-${i}` })
    }

    const firstPage = listLogEntries({ limit: 2, offset: 0 })
    const secondPage = listLogEntries({ limit: 2, offset: 2 })

    expect(firstPage).toHaveLength(2)
    expect(secondPage).toHaveLength(2)
    expect(firstPage.map((e) => e.id)).not.toEqual(secondPage.map((e) => e.id))
  })

  it('returns empty list when there are no entries', () => {
    expect(listLogEntries()).toEqual([])
  })

  it('cascades delete when the parent project (and its threads) is removed', () => {
    const project = createProject({ path: makeProjectDir('project-cascade') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    createLogEntry({ threadId: thread.id, kind: 'git', event: 'to be cascaded' })

    deleteProject(project.id)

    expect(listLogEntries()).toEqual([])
  })
})
