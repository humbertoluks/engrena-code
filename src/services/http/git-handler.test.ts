import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  }
})

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_git_http_'))

const axios = (await import('axios')).default

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { acquireLease, clearAllLeases } = await import('../runner/project-execution.js')
const { handleGitRequest } = await import('./git-handler.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { createWorktree } = await import('../git/worktree.js')

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString()
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_git_http_fixture_'))
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(dir, ['init'])
  git(dir, ['add', '-A'])
  git(dir, ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-m', 'init'])
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
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  clearAllLeases()
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  vaultService.deleteSecret('github:token')
  session = vaultService.getSessionToken() as string
})

afterEach(() => {
  vi.mocked(axios.get).mockReset()
  vi.mocked(axios.post).mockReset()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('handleGitRequest', () => {
  it('commits staged changes for the thread project (200, sha)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    writeFileSync(join(dir, 'novo.txt'), 'x\n')

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-commit`, { subject: 'feat: novo arquivo' }, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(typeof (body as { sha: string }).sha).toBe('string')

    const entries = listLogEntries({ kind: 'git' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(thread.id)
    expect(entries[0]?.event).toContain('feat: novo arquivo')

    rmSync(dir, { recursive: true, force: true })
  })

  it('returns 400 validation_error when subject is missing', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-commit`, {}, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')

    rmSync(dir, { recursive: true, force: true })
  })

  it('returns 409 thread_busy when the project is already leased', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    acquireLease(project.id, 'agent', 'dispatch', thread.id)

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-commit`, { subject: 'x' }, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('thread_busy')

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('git-push without a configured remote fails with git_push_failed (no lease left held)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    vaultService.setSecret('github:token', 'ghp_faketoken')

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-push`, undefined, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(500)
    expect((body as { error: { code: string } }).error.code).toBe('git_push_failed')

    // lease must have been released even on failure — a second call should not 409
    const req2 = fakeReq('POST', `/api/threads/${thread.id}/git-push`, undefined, session)
    const res2 = fakeRes()
    await handleGitRequest(req2, res2)
    expect((await res2.result()).status).toBe(500)

    rmSync(dir, { recursive: true, force: true })
  })

  it('git-push without a github token returns 400 github_token_missing (F14)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-push`, undefined, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('github_token_missing')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects git-commit/push/pr with 409 thread_busy when thread.state is running (F14)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'running' })

    for (const path of ['git-commit', 'git-push', 'pr']) {
      const req = fakeReq('POST', `/api/threads/${thread.id}/${path}`, path === 'git-commit' ? { subject: 'x' } : {}, session)
      const res = fakeRes()
      await handleGitRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(409)
      expect((body as { error: { code: string } }).error.code).toBe('thread_busy')
    }

    rmSync(dir, { recursive: true, force: true })
  })

  it('pr without a configured GitHub token returns 400 github_token_missing', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })

    const req = fakeReq('POST', `/api/threads/${thread.id}/pr`, {}, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('github_token_missing')

    rmSync(dir, { recursive: true, force: true })
  })

  it('pr failure (no remote configured) is recorded as a git log_entries', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    vaultService.setSecret('github:token', 'ghp_faketoken')

    const req = fakeReq('POST', `/api/threads/${thread.id}/pr`, {}, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(500)
    expect((body as { error: { code: string } }).error.code).toBe('pr_no_remote')

    const entries = listLogEntries({ kind: 'git' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(thread.id)
    expect(entries[0]?.event).toContain('Falha ao abrir PR')

    rmSync(dir, { recursive: true, force: true })
  })

  it('pr sends editable title/body to GitHub (F14)', async () => {
    const dir = makeProjectDir()
    git(dir, ['remote', 'add', 'origin', 'https://github.com/engrena/repo.git'])
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    vaultService.setSecret('github:token', 'ghp_faketoken')

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { default_branch: 'main' } })
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { html_url: 'https://github.com/engrena/repo/pull/7', number: 7 } })

    const req = fakeReq('POST', `/api/threads/${thread.id}/pr`, { title: 'feat: filtro de logs', body: '## Summary\n- x\n' }, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { number: number }).number).toBe(7)

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'feat: filtro de logs', body: '## Summary\n- x\n' }),
      expect.anything()
    )

    rmSync(dir, { recursive: true, force: true })
  })

  it('pr falls back to "EngrenaCode: {thread.title|id}" when title is omitted (F14)', async () => {
    const dir = makeProjectDir()
    git(dir, ['remote', 'add', 'origin', 'https://github.com/engrena/repo.git'])
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main', state: 'idle' })
    vaultService.setSecret('github:token', 'ghp_faketoken')

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { default_branch: 'main' } })
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { html_url: 'https://github.com/engrena/repo/pull/8', number: 8 } })

    const req = fakeReq('POST', `/api/threads/${thread.id}/pr`, {}, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    expect((await res.result()).status).toBe(200)

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: `EngrenaCode: ${thread.title ?? thread.id}` }),
      expect.anything()
    )

    rmSync(dir, { recursive: true, force: true })
  })

  it('commits into the thread worktree, not project.path, when executionMode=worktree (F13)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const worktreePath = await createWorktree(dir, project.id, 'thr_wt_1')
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'worktree',
      worktreePath,
      state: 'idle',
    })
    writeFileSync(join(worktreePath, 'novo.txt'), 'x\n')

    const req = fakeReq('POST', `/api/threads/${thread.id}/git-commit`, { subject: 'feat: no worktree' }, session)
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(typeof (body as { sha: string }).sha).toBe('string')

    // o commit rodou no worktree — a working tree principal do projeto continua limpa
    const mainStatus = git(dir, ['status', '--porcelain']).trim()
    expect(mainStatus).toBe('')

    rmSync(dir, { recursive: true, force: true })
    rmSync(worktreePath, { recursive: true, force: true })
  })

  it('returns 423 vault_locked when the vault is locked', async () => {
    vaultService.lock()
    const req = fakeReq('POST', '/api/threads/thr_x/git-commit', { subject: 'x' })
    const res = fakeRes()
    await handleGitRequest(req, res)
    const { status } = await res.result()
    expect(status).toBe(423)
  })
})
