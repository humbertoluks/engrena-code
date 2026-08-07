import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createProject } = await import('../db/repositories/projects.js')
const { getThread } = await import('../db/repositories/threads.js')
const { setRunCliTurnForTesting, resetRunCliTurnForTesting } = await import('../runner/dispatch.js')
const { clearAllLeases } = await import('../runner/project-execution.js')
const { handleThreadsRequest } = await import('./threads-handler.js')
const { createSubagentsRepository } = await import('../db/repositories/subagents.js')

function initGitRepo(path: string): void {
  execFileSync('git', ['init'], { cwd: path })
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '--allow-empty', '-m', 'init'],
    { cwd: path }
  )
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_fixture_'))
  initGitRepo(dir)
  return dir
}

interface FakeResult {
  status: number
  body: unknown
}

function fakeReq(method: string, url: string, body?: unknown, session?: string): IncomingMessage {
  const raw = body !== undefined ? JSON.stringify(body) : ''
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const req = {
    method,
    url,
    headers: session !== undefined ? { 'x-engrenacode-session': session } : {},
    on(event: string, cb: (...args: unknown[]) => void) {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const dataCb of listeners['data'] ?? []) dataCb(raw)
          for (const endCb of listeners['end'] ?? []) endCb()
        })
      }
      return req
    },
  }
  return req as unknown as IncomingMessage
}

function fakeRes(): ServerResponse & { result: () => Promise<FakeResult> } {
  let resolveDone: (r: FakeResult) => void
  const done = new Promise<FakeResult>((resolve) => {
    resolveDone = resolve
  })
  let status = 0
  const res = {
    headersSent: false,
    writeHead(code: number) {
      status = code
      res.headersSent = true
      return res
    },
    end(chunk?: string) {
      resolveDone({ status, body: chunk ? JSON.parse(chunk) : undefined })
    },
    result: () => done,
  }
  return res as unknown as ServerResponse & { result: () => Promise<FakeResult> }
}

let session: string

beforeEach(() => {
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  clearAllLeases()
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  session = vaultService.getSessionToken() as string
})

afterEach(() => {
  resetRunCliTurnForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
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
    }, 10)
  })
}

describe('handleThreadsRequest', () => {
  it('dispatches a new thread with a stream path (201)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const parsed = body as { thread: { id: string; state: string }; stream: { ws: string } }
    expect(parsed.thread.state).toBe('running')
    expect(parsed.stream.ws).toBe(`/?threadId=${parsed.thread.id}`)

    await waitFor(() => getThread(parsed.thread.id)?.state === 'idle')
    rmSync(dir, { recursive: true, force: true })
  })

  it('lists threads for a project (GET)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('GET', `/api/projects/${project.id}/threads`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { threads: Array<{ id: string }> }).threads.some((t) => t.id === created.thread.id)).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects invalid provider with 400 validation_error', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'gpt4', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns 409 thread_busy on a second dispatch while the project is leased', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(() => new Promise(() => {}))

    const req1 = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'primeira', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    await handleThreadsRequest(req1, fakeRes())

    const req2 = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'segunda', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res2 = fakeRes()
    await handleThreadsRequest(req2, res2)
    const { status, body } = await res2.result()
    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('thread_busy')

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a follow-up body carrying provider with 400', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/messages`,
      { prompt: 'de novo', provider: 'codex' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a follow-up body carrying executionMode with 400 (execution mode locked after first send)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/messages`,
      { prompt: 'de novo', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns history and diffs for a thread', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'resposta final' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }

    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
    const historyRes = fakeRes()
    await handleThreadsRequest(historyReq, historyRes)
    const historyBody = (await historyRes.result()).body as { messages: unknown[]; subagentRuns: unknown[] }
    expect(historyBody.messages.length).toBeGreaterThanOrEqual(1)
    expect(historyBody.subagentRuns).toEqual([])

    const diffsReq = fakeReq('GET', `/api/threads/${created.thread.id}/diffs`, undefined, session)
    const diffsRes = fakeRes()
    await handleThreadsRequest(diffsReq, diffsRes)
    const diffsBody = (await diffsRes.result()).body as { diffs: unknown[] }
    expect(Array.isArray(diffsBody.diffs)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('history includes subagentRuns ordered by created_at ASC (F15)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const subagentsRepo = createSubagentsRepository(getDb())
    const subagent = subagentsRepo.create({
      name: 'revisor',
      description: 'revisa',
      prompt: 'revise com cuidado',
      provider: 'claude',
    })
    subagentsRepo.createRun({
      childThreadId: 'child-1',
      parentThreadId: created.thread.id,
      subagentName: subagent.name,
      provider: 'claude',
      status: 'completed',
    })

    const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
    const historyRes = fakeRes()
    await handleThreadsRequest(historyReq, historyRes)
    const historyBody = (await historyRes.result()).body as {
      subagentRuns: Array<{ childThreadId: string; subagentName: string; status: string }>
    }
    expect(historyBody.subagentRuns).toHaveLength(1)
    expect(historyBody.subagentRuns[0]?.childThreadId).toBe('child-1')
    expect(historyBody.subagentRuns[0]?.subagentName).toBe('revisor')
    expect(historyBody.subagentRuns[0]?.status).toBe('completed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('cancel returns false when there is no active turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('POST', `/api/threads/${created.thread.id}/cancel`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { cancelled: boolean }).cancelled).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('permission endpoint accepts an allow decision (200)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/permission`,
      { requestId: 'perm_1', allow: true },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { resolved: boolean }).resolved).toBe(true)

    await waitFor(() => getThread(created.thread.id)?.state === 'idle')
    rmSync(dir, { recursive: true, force: true })
  })

  it('accepts a pending diff via POST /api/threads/:id/accept and moves the thread to committed', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async (input) => {
      writeFileSync(join(input.cwd, 'gerado.txt'), 'conteudo\n')
      return { text: 'ok' }
    })

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'crie um arquivo', provider: 'claude', accessLevel: 'full-access', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('POST', `/api/threads/${created.thread.id}/accept`, {}, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { applied: boolean; acceptedIds: string[] }).acceptedIds).toHaveLength(1)
    expect(getThread(created.thread.id)?.state).toBe('committed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects accept body with both ids and paths (400 validation_error)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/accept`,
      { ids: ['diff_x'], paths: ['a.txt'] },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')

    rmSync(dir, { recursive: true, force: true })
  })

  it('dispatches a worktree thread: 201 with worktreePath set, cwd isolated from project.path', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const parsed = body as { thread: { id: string; worktreePath: string | null } }
    expect(parsed.thread.worktreePath).toBeTruthy()
    expect(parsed.thread.worktreePath).not.toBe(dir)

    await waitFor(() => getThread(parsed.thread.id)?.state === 'idle')
    rmSync(dir, { recursive: true, force: true })
    rmSync(parsed.thread.worktreePath as string, { recursive: true, force: true })
  })

  it('returns 400 worktree_git_required for a worktree dispatch when the project has no git HEAD', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_nogit_'))
    const project = createProject({ path: dir })

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string; message: string } }).error.code).toBe('worktree_git_required')
    expect((body as { error: { message: string } }).error.message).toBe('Inicialize o Git antes de usar Worktree.')

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id removes a main-mode thread (worktreeCleanup=none)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('DELETE', `/api/threads/${created.thread.id}`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({ deleted: true, worktreeCleanup: 'none', warning: null })
    expect(getThread(created.thread.id)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id removes a clean worktree and its branch (worktreeCleanup=removed)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string; worktreePath: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('DELETE', `/api/threads/${created.thread.id}`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({ deleted: true, worktreeCleanup: 'removed', warning: null })
    expect(getThread(created.thread.id)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id returns 404 thread_not_found for an unknown id', async () => {
    const req = fakeReq('DELETE', '/api/threads/thr_nao_existe', undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(404)
    expect((body as { error: { code: string } }).error.code).toBe('thread_not_found')
  })
})
