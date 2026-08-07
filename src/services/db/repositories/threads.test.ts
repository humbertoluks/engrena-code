import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_threads_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread, deleteThread, getThread, recoverRunningThreads } = await import('./threads.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_threads_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('recoverRunningThreads', () => {
  it('moves running threads to error and returns them', () => {
    const project = createProject({ path: makeProjectDir('project-a') })
    const running = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'running' })

    const recovered = recoverRunningThreads()

    expect(recovered.map((t) => t.id)).toEqual([running.id])
    expect(getThread(running.id)?.state).toBe('error')
  })

  it('leaves non-running threads untouched', () => {
    const project = createProject({ path: makeProjectDir('project-b') })
    const idle = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })

    const recovered = recoverRunningThreads()

    expect(recovered).toEqual([])
    expect(getThread(idle.id)?.state).toBe('idle')
  })

  it('returns an empty list when there is nothing to recover', () => {
    expect(recoverRunningThreads()).toEqual([])
  })
})

describe('deleteThread', () => {
  it('removes the thread row and returns true', () => {
    const project = createProject({ path: makeProjectDir('project-c') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree', state: 'idle' })

    expect(deleteThread(thread.id)).toBe(true)
    expect(getThread(thread.id)).toBeNull()
  })

  it('returns false for an unknown thread id', () => {
    expect(deleteThread('thr_nao_existe')).toBe(false)
  })
})
