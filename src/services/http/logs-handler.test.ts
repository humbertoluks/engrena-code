import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_logs_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleLogsRequest } = await import('./logs-handler.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createLogEntry } = await import('../db/repositories/log-entries.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_logs_http_fixture_'))

interface FakeResult {
  status: number
  body: unknown
}

function fakeReq(method: string, url: string, session?: string): IncomingMessage {
  const req = {
    method,
    url,
    headers: session !== undefined ? { 'x-engrenacode-session': session } : {},
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'end') queueMicrotask(() => cb())
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
  }
  return Object.assign(res, { result: () => done }) as unknown as ServerResponse & { result: () => Promise<FakeResult> }
}

function unlockVault(): string {
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  return vaultService.getSessionToken() as string
}

beforeEach(() => {
  vaultService.lock()
  vi.restoreAllMocks()
  const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
  if (existsSync(vaultPath)) rmSync(vaultPath)
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

function makeThread() {
  const dir = join(fixtureRoot, `project-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  const project = createProject({ path: dir })
  return createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
}

describe('handleLogsRequest', () => {
  it('returns 401 without a valid session', () => {
    unlockVault()
    const req = fakeReq('GET', '/api/logs')
    const res = fakeRes()
    const handled = handleLogsRequest(req, res)
    expect(handled).toBe(true)
    return res.result().then(({ status, body }) => {
      expect(status).toBe(401)
      expect((body as { error: { code: string } }).error.code).toBe('unauthorized')
    })
  })

  it('returns 423 when the vault is locked', () => {
    const req = fakeReq('GET', '/api/logs', 'qualquer-token')
    const res = fakeRes()
    handleLogsRequest(req, res)
    return res.result().then(({ status, body }) => {
      expect(status).toBe(423)
      expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
    })
  })

  it('lists entries ordered by created_at DESC without a filter', async () => {
    const session = unlockVault()
    const thread = makeThread()
    const first = createLogEntry({ threadId: thread.id, kind: 'task', event: 'first' })
    const second = createLogEntry({ threadId: thread.id, kind: 'git', event: 'second' })

    const req = fakeReq('GET', '/api/logs', session)
    const res = fakeRes()
    handleLogsRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    const entries = (body as { entries: Array<{ id: string }> }).entries
    expect(entries.map((e) => e.id)).toEqual([second.id, first.id])
  })

  it('filters by kind', async () => {
    const session = unlockVault()
    const thread = makeThread()
    createLogEntry({ threadId: thread.id, kind: 'task', event: 'a task' })
    const toolEntry = createLogEntry({ threadId: thread.id, kind: 'tool', event: 'a tool' })

    const req = fakeReq('GET', '/api/logs?kind=tool', session)
    const res = fakeRes()
    handleLogsRequest(req, res)
    const { body } = await res.result()

    const entries = (body as { entries: Array<{ id: string }> }).entries
    expect(entries).toEqual([expect.objectContaining({ id: toolEntry.id })])
  })

  it('rejects an invalid kind with 400 validation_error', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/logs?kind=bogus', session)
    const res = fakeRes()
    handleLogsRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('rejects a negative limit with 400 validation_error', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/logs?limit=-1', session)
    const res = fakeRes()
    handleLogsRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('paginates with limit/offset', async () => {
    const session = unlockVault()
    const thread = makeThread()
    for (let i = 0; i < 3; i++) {
      createLogEntry({ threadId: thread.id, kind: 'git', event: `event-${i}` })
    }

    const req = fakeReq('GET', '/api/logs?limit=2&offset=0', session)
    const res = fakeRes()
    handleLogsRequest(req, res)
    const { body } = await res.result()

    expect((body as { entries: unknown[] }).entries).toHaveLength(2)
  })
})
