import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f26_pty_registry_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { ptySessionRegistry, setPtySpawnForTesting, resetPtySpawnForTesting } = await import(
  './pty-session-registry.js'
)

function makeProjectFixture(): { projectId: string; projectPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f26_pty_registry_fixture_'))
  const project = createProject({ path: dir })
  return { projectId: project.id, projectPath: project.path }
}

beforeEach(() => {
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  ptySessionRegistry.clearAllForTesting()
})

afterEach(() => {
  resetPtySpawnForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error('timeout'))
      }
    }, 20)
  })
}

describe('create — validation (no process spawned)', () => {
  it('test_create_session_project_not_found', () => {
    let spawnCalled = false
    setPtySpawnForTesting((() => {
      spawnCalled = true
      throw new Error('should not spawn')
    }) as never)

    const result = ptySessionRegistry.create({ projectId: 'nao-existe', threadId: null, cols: 80, rows: 24 })
    expect(result).toEqual({ error: { code: 'project_not_found', message: expect.any(String) } })
    expect(spawnCalled).toBe(false)
  })

  it('rejects a threadId that does not belong to the project (thread_not_found)', () => {
    const { projectId } = makeProjectFixture()
    const other = makeProjectFixture()
    const foreignThread = createThread({
      projectId: other.projectId,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    let spawnCalled = false
    setPtySpawnForTesting((() => {
      spawnCalled = true
      throw new Error('should not spawn')
    }) as never)

    const result = ptySessionRegistry.create({ projectId, threadId: foreignThread.id, cols: 80, rows: 24 })
    expect(result).toEqual({ error: { code: 'thread_not_found', message: expect.any(String) } })
    expect(spawnCalled).toBe(false)
  })

  it('test_create_session_shell_not_found', () => {
    const { projectId } = makeProjectFixture()
    let spawnCalled = false
    setPtySpawnForTesting((() => {
      spawnCalled = true
      throw new Error('should not spawn')
    }) as never)

    const originalComspec = process.env.COMSPEC
    const originalSystemRoot = process.env.SystemRoot
    delete process.env.COMSPEC
    process.env.SystemRoot = 'C:\\engrenacode-nao-existe'

    try {
      const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
      expect(result).toEqual({ error: { code: 'shell_not_found', message: expect.any(String) } })
      expect(spawnCalled).toBe(false)
    } finally {
      if (originalComspec !== undefined) process.env.COMSPEC = originalComspec
      if (originalSystemRoot !== undefined) process.env.SystemRoot = originalSystemRoot
    }
  })

  it('test_create_session_uses_resolved_cwd — worktree thread resolves to worktreePath, not project.path', () => {
    const { projectId, projectPath } = makeProjectFixture()
    const worktreeDir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f26_pty_worktree_'))
    const thread = createThread({
      projectId,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'worktree',
      worktreePath: worktreeDir,
    })

    let capturedCwd: string | undefined
    setPtySpawnForTesting(((file: string, args: string[], opts: { cwd?: string }) => {
      capturedCwd = opts.cwd
      return {
        onData: () => ({ dispose: () => {} }),
        onExit: () => ({ dispose: () => {} }),
        write: () => {},
        resize: () => {},
        kill: () => {},
      }
    }) as never)

    const result = ptySessionRegistry.create({ projectId, threadId: thread.id, cols: 80, rows: 24 })
    expect('sessionId' in result).toBe(true)
    expect(capturedCwd).toBe(worktreeDir)
    expect(capturedCwd).not.toBe(projectPath)
    rmSync(worktreeDir, { recursive: true, force: true })
  })

  it('test_create_session_restricts_spawn_env — provider secrets on process.env never reach the shell (R06)', () => {
    const { projectId } = makeProjectFixture()
    const originalKey = process.env.ANTHROPIC_API_KEY_TEST_FIXTURE
    process.env.ANTHROPIC_API_KEY_TEST_FIXTURE = 'sk-ant-secretvalue'

    let capturedEnv: NodeJS.ProcessEnv | undefined
    setPtySpawnForTesting(((_file: string, _args: string[], opts: { env?: NodeJS.ProcessEnv }) => {
      capturedEnv = opts.env
      return {
        onData: () => ({ dispose: () => {} }),
        onExit: () => ({ dispose: () => {} }),
        write: () => {},
        resize: () => {},
        kill: () => {},
      }
    }) as never)

    const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
    expect('sessionId' in result).toBe(true)
    expect(capturedEnv).not.toBe(process.env)
    expect(capturedEnv?.ANTHROPIC_API_KEY_TEST_FIXTURE).toBeUndefined()

    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY_TEST_FIXTURE
    else process.env.ANTHROPIC_API_KEY_TEST_FIXTURE = originalKey
  })
})

describe('real pty lifecycle (short-lived process)', () => {
  it('test_write_forwards_keystrokes — echoed output comes back through the data event', async () => {
    const { projectId } = makeProjectFixture()
    const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
    if (!('sessionId' in result)) throw new Error(`create failed: ${JSON.stringify(result)}`)

    let buffer = ''
    ptySessionRegistry.on('data', (e: { sessionId: string; chunk: string }) => {
      if (e.sessionId === result.sessionId) buffer += e.chunk
    })

    ptySessionRegistry.write(result.sessionId, 'echo engrenacode-f26-marker\r')
    await waitFor(() => buffer.includes('engrenacode-f26-marker'), 8000)
    expect(buffer).toContain('engrenacode-f26-marker')

    ptySessionRegistry.kill(result.sessionId)
  }, 15000)

  it('test_kill_terminates_process_and_emits_expected_exit', async () => {
    const { projectId } = makeProjectFixture()
    const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
    if (!('sessionId' in result)) throw new Error(`create failed: ${JSON.stringify(result)}`)

    let exitEvent: { sessionId: string; expected: boolean } | undefined
    ptySessionRegistry.on('exit', (e: { sessionId: string; expected: boolean }) => {
      if (e.sessionId === result.sessionId) exitEvent = e
    })

    const killResult = ptySessionRegistry.kill(result.sessionId)
    expect(killResult).toEqual({ ok: true })

    await waitFor(() => exitEvent !== undefined)
    expect(exitEvent?.expected).toBe(true)
  }, 15000)

  it('test_resize_updates_dimensions — no throw on a live session', () => {
    const { projectId } = makeProjectFixture()
    const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
    if (!('sessionId' in result)) throw new Error(`create failed: ${JSON.stringify(result)}`)

    expect(() => ptySessionRegistry.resize(result.sessionId, 120, 40)).not.toThrow()

    ptySessionRegistry.kill(result.sessionId)
  }, 15000)

  it('test_unexpected_exit_marks_not_expected — process dying without kill() reports expected:false', async () => {
    const { projectId } = makeProjectFixture()

    let triggerExit: ((e: { exitCode: number; signal?: number }) => void) | undefined
    setPtySpawnForTesting((() => ({
      onData: () => ({ dispose: () => {} }),
      onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => {
        triggerExit = cb
        return { dispose: () => {} }
      },
      write: () => {},
      resize: () => {},
      kill: () => {},
    })) as never)

    const result = ptySessionRegistry.create({ projectId, threadId: null, cols: 80, rows: 24 })
    if (!('sessionId' in result)) throw new Error(`create failed: ${JSON.stringify(result)}`)

    let exitEvent: { sessionId: string; expected: boolean } | undefined
    ptySessionRegistry.on('exit', (e: { sessionId: string; expected: boolean }) => {
      if (e.sessionId === result.sessionId) exitEvent = e
    })

    // Processo morre sozinho (crash externo) — nunca passa por ptySessionRegistry.kill().
    triggerExit?.({ exitCode: 1, signal: undefined })

    expect(exitEvent?.expected).toBe(false)
  })

  it('kill on an unknown sessionId returns session_not_found', () => {
    const result = ptySessionRegistry.kill('nao-existe')
    expect(result).toEqual({ error: { code: 'session_not_found', message: expect.any(String) } })
  })

  it('write on an unknown sessionId is a silent no-op', () => {
    expect(() => ptySessionRegistry.write('nao-existe', 'oi')).not.toThrow()
  })
})
