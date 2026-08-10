import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { appendEntry } = await import('../vault/memory-service.js')
const { handleMemoryRequest } = await import('./memory-handler.js')

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

function unlockVault(): string {
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  return vaultService.getSessionToken() as string
}

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function makeProjectFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_http_fixture_'))
  return createProject({ path: dir }).id
}

describe('handleMemoryRequest', () => {
  it('memoryHandler_guard_returns423WhenLocked', async () => {
    const req = fakeReq('GET', '/api/projects/p1/memory/status')
    const res = fakeRes()
    expect(await handleMemoryRequest(req, res)).toBe(true)
    expect((await res.result()).status).toBe(423)
  })

  it('memoryHandler_guard_returns401WhenSessionInvalid', async () => {
    unlockVault()
    const req = fakeReq('GET', '/api/projects/p1/memory/status', undefined, 'token-errado')
    const res = fakeRes()
    expect(await handleMemoryRequest(req, res)).toBe(true)
    expect((await res.result()).status).toBe(401)
  })

  it('memoryHandler_getStatus_returnsCountsAndToggle', async () => {
    const session = unlockVault()
    const projectId = makeProjectFixture()
    const thread = createThread({ projectId, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    appendEntry({ projectId, threadId: thread.id, summary: 'decisão registrada' })

    const req = fakeReq('GET', `/api/projects/${projectId}/memory/status`, undefined, session)
    const res = fakeRes()
    await handleMemoryRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    expect(body).toMatchObject({ enabled: true, entryCount: 1, corrupted: false })
    expect((body as { lastEntryAt: string }).lastEntryAt).toBeTruthy()
    expect((body as { sizeBytes: number }).sizeBytes).toBeGreaterThan(0)
  })

  it('returns 404 for an unknown project', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/projects/nao-existe/memory/status', undefined, session)
    const res = fakeRes()
    await handleMemoryRequest(req, res)
    expect((await res.result()).status).toBe(404)
  })

  it('memoryHandler_patchStatus_togglesWithoutErasingJournal', async () => {
    const session = unlockVault()
    const projectId = makeProjectFixture()
    const thread = createThread({ projectId, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    appendEntry({ projectId, threadId: thread.id, summary: 'não apagar isso' })

    const patchReq = fakeReq('PATCH', `/api/projects/${projectId}/memory/status`, { enabled: false }, session)
    const patchRes = fakeRes()
    await handleMemoryRequest(patchReq, patchRes)
    const patched = await patchRes.result()
    expect(patched.status).toBe(200)
    expect((patched.body as { enabled: boolean }).enabled).toBe(false)

    const journalReq = fakeReq('GET', `/api/projects/${projectId}/memory/journal`, undefined, session)
    const journalRes = fakeRes()
    await handleMemoryRequest(journalReq, journalRes)
    const journal = await journalRes.result()
    expect((journal.body as { content: string }).content).toContain('não apagar isso')
  })

  it('rejects a PATCH with a missing/invalid enabled field', async () => {
    const session = unlockVault()
    const projectId = makeProjectFixture()
    const req = fakeReq('PATCH', `/api/projects/${projectId}/memory/status`, { enabled: 'yes' }, session)
    const res = fakeRes()
    await handleMemoryRequest(req, res)
    expect((await res.result()).status).toBe(400)
  })

  it('journal view reports corrupted content as empty with the flag set', async () => {
    const session = unlockVault()
    const projectId = makeProjectFixture()
    vaultService.setSecret(`memory:${projectId}`, 'not a journal at all')

    const req = fakeReq('GET', `/api/projects/${projectId}/memory/journal`, undefined, session)
    const res = fakeRes()
    await handleMemoryRequest(req, res)
    const { body } = await res.result()
    expect(body).toEqual({ content: '', corrupted: true })
  })
})
