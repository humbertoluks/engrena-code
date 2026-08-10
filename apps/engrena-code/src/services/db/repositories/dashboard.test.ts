import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_dashboard_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const { createDiff } = await import('./diffs.js')
const { getDashboardMetrics, listDashboardInbox, listRecentActivity } = await import('./dashboard.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_dashboard_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function setUpdatedAt(threadId: string, ts: number): void {
  getDb().prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(ts, threadId)
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

describe('getDashboardMetrics', () => {
  it('counts projects, running threads, pending diffs and error threads across all projects', () => {
    const projectA = createProject({ path: makeProjectDir('project-a') })
    const projectB = createProject({ path: makeProjectDir('project-b') })

    const running = createThread({ projectId: projectA.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'running' })
    createThread({ projectId: projectB.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main', state: 'running' })
    createThread({ projectId: projectA.id, provider: 'kimi', accessLevel: 'supervised', executionMode: 'main', state: 'error' })
    createThread({ projectId: projectB.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })

    createDiff({ threadId: running.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude' })

    expect(getDashboardMetrics()).toEqual({ projects: 2, running: 2, pendingDiffs: 1, errors: 1 })
  })
})

describe('listDashboardInbox', () => {
  it('classifies a thread with pending diff as pendingDiff even when state=error', () => {
    const project = createProject({ path: makeProjectDir('project-overlap') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'error' })
    createDiff({ threadId: thread.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude' })

    const inbox = listDashboardInbox(20)

    expect(inbox).toHaveLength(1)
    expect(inbox[0].kind).toBe('pendingDiff')
    expect(inbox[0].threadId).toBe(thread.id)
  })

  it('sorts by kind tier (error > pendingDiff > running), tie-broken by updatedAt desc', () => {
    const project = createProject({ path: makeProjectDir('project-order') })

    const runningThread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'running' })
    const errorThread = createThread({ projectId: project.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main', state: 'error' })
    const diffThread = createThread({ projectId: project.id, provider: 'kimi', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })
    createDiff({ threadId: diffThread.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'kimi' })

    setUpdatedAt(runningThread.id, 3000)
    setUpdatedAt(errorThread.id, 1000)
    setUpdatedAt(diffThread.id, 2000)

    const inbox = listDashboardInbox(20)

    expect(inbox.map((item) => item.threadId)).toEqual([errorThread.id, diffThread.id, runningThread.id])
  })

  it('excludes idle and committed threads without a pending diff', () => {
    const project = createProject({ path: makeProjectDir('project-excluded') })
    createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })
    createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'committed' })

    expect(listDashboardInbox(20)).toHaveLength(0)
  })

  it('respects the limit', () => {
    const project = createProject({ path: makeProjectDir('project-limit') })
    for (let i = 0; i < 5; i += 1) {
      createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'running' })
    }

    expect(listDashboardInbox(3)).toHaveLength(3)
  })
})

describe('listRecentActivity', () => {
  it('orders threads by updatedAt desc across projects, including running', () => {
    const projectA = createProject({ path: makeProjectDir('project-recent-a') })
    const projectB = createProject({ path: makeProjectDir('project-recent-b') })

    const oldest = createThread({ projectId: projectA.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'committed' })
    const middle = createThread({ projectId: projectB.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main', state: 'running' })
    const newest = createThread({ projectId: projectA.id, provider: 'kimi', accessLevel: 'supervised', executionMode: 'main', state: 'error' })

    setUpdatedAt(oldest.id, 1000)
    setUpdatedAt(middle.id, 2000)
    setUpdatedAt(newest.id, 3000)

    const recent = listRecentActivity(10)

    expect(recent.map((item) => item.threadId)).toEqual([newest.id, middle.id, oldest.id])
    expect(recent[1].state).toBe('running')
  })

  it('respects the limit', () => {
    const project = createProject({ path: makeProjectDir('project-recent-limit') })
    for (let i = 0; i < 12; i += 1) {
      createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    }

    expect(listRecentActivity(10)).toHaveLength(10)
  })
})
