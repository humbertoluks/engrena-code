import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_consumo_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleConsumoRequest } = await import('./consumo-handler.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createUsageEvent } = await import('../db/repositories/usage-events.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_consumo_http_fixture_'))

interface FakeResult {
  status: number
  body: unknown
}

function fakeReq(method: string, url: string, session?: string, body?: unknown): IncomingMessage {
  const raw = body !== undefined ? JSON.stringify(body) : ''
  const req = {
    method,
    url,
    headers: session !== undefined ? { 'x-engrenacode-session': session } : {},
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'data' && raw) queueMicrotask(() => cb(Buffer.from(raw)))
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

function makeThread() {
  const dir = join(fixtureRoot, `project-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  const project = createProject({ path: dir })
  const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
  return { project, thread }
}

beforeEach(() => {
  vaultService.lock()
  vi.restoreAllMocks()
  const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
  if (existsSync(vaultPath)) rmSync(vaultPath)
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM model_pricing')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('handleConsumoRequest — guard', () => {
  it('returns 423 when the vault is locked', async () => {
    const req = fakeReq('GET', '/api/metrics/summary', 'qualquer-token')
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('returns 401 without a valid session', async () => {
    unlockVault()
    const req = fakeReq('GET', '/api/metrics/summary')
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(401)
    expect((body as { error: { code: string } }).error.code).toBe('unauthorized')
  })
})

describe('GET /api/metrics/summary', () => {
  it('returns 200 with an empty summary when there are no events', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/metrics/summary', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    expect((body as { partial: boolean }).partial).toBe(false)
  })

  it('rejects a malformed from with 400 validation_error', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/metrics/summary?from=not-a-date', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('rejects from > to with 400 validation_error', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/metrics/summary?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status } = await res.result()
    expect(status).toBe(400)
  })
})

describe('GET /api/metrics/projects', () => {
  it('lists per-project aggregates', async () => {
    const session = unlockVault()
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.1,
      costSource: 'sdk',
    })

    const req = fakeReq('GET', '/api/metrics/projects', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    const projects = (body as { projects: Array<{ projectId: string }> }).projects
    expect(projects).toHaveLength(1)
    expect(projects[0]?.projectId).toBe(project.id)
  })
})

describe('GET /api/metrics/projects/:id', () => {
  it('returns 404 for an unknown project', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/metrics/projects/does-not-exist', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(404)
    expect((body as { error: { code: string } }).error.code).toBe('not_found')
  })

  it('returns the thread breakdown for a known project', async () => {
    const session = unlockVault()
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.1,
      costSource: 'sdk',
    })

    const req = fakeReq('GET', `/api/metrics/projects/${project.id}`, session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    expect((body as { threads: Array<{ threadId: string }> }).threads[0]?.threadId).toBe(thread.id)
  })
})

describe('GET /api/metrics/threads/:id', () => {
  it('returns 404 for an unknown thread', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/metrics/threads/does-not-exist', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status } = await res.result()
    expect(status).toBe(404)
  })

  it('paginates events and validates limit range 1-500', async () => {
    const session = unlockVault()
    const { project, thread } = makeThread()
    for (let i = 0; i < 3; i++) {
      createUsageEvent({
        turnId: `t${i}`,
        projectId: project.id,
        threadId: thread.id,
        source: 'agent',
        provider: 'claude',
        billingMode: 'subscription',
        inputTokens: 1,
        outputTokens: 1,
        costSource: 'table',
      })
    }

    const page = fakeReq('GET', `/api/metrics/threads/${thread.id}?limit=2&offset=0`, session)
    const res1 = fakeRes()
    handleConsumoRequest(page, res1)
    const { status: status1, body: body1 } = await res1.result()
    expect(status1).toBe(200)
    expect((body1 as { events: unknown[] }).events).toHaveLength(2)
    expect((body1 as { page: { hasMore: boolean } }).page.hasMore).toBe(true)

    const badLimit = fakeReq('GET', `/api/metrics/threads/${thread.id}?limit=501`, session)
    const res2 = fakeRes()
    handleConsumoRequest(badLimit, res2)
    const { status: status2, body: body2 } = await res2.result()
    expect(status2).toBe(400)
    expect((body2 as { error: { code: string } }).error.code).toBe('validation_error')
  })
})

describe('pricing endpoints', () => {
  it('GET /api/pricing lists pricing and unpriced models observed in usage_events', async () => {
    const session = unlockVault()
    const { project, thread } = makeThread()
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'codex',
      model: 'gpt-5-codex',
      billingMode: 'api-key',
      inputTokens: 10,
      outputTokens: 5,
      costUsd: null,
      costSource: 'table',
    })

    const req = fakeReq('GET', '/api/pricing', session)
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    expect((body as { pricing: unknown[] }).pricing).toEqual([])
    expect((body as { unpricedModels: Array<{ provider: string; model: string }> }).unpricedModels).toEqual([
      { provider: 'codex', model: 'gpt-5-codex' },
    ])
  })

  it('POST /api/pricing creates a price and triggers recalculateNullCosts', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/pricing', session, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputPerMTok: 3,
      outputPerMTok: 15,
    })
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(201)
    expect((body as { pricing: { id: string } }).pricing.id).toBe('price_anthropic_claude-sonnet-4-6')
    expect((body as { recalculatedEvents: number }).recalculatedEvents).toBe(0)
  })

  it('POST /api/pricing rejects missing input/output rates', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/pricing', session, { provider: 'anthropic', model: 'x' })
    const res = fakeRes()
    handleConsumoRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('POST /api/pricing returns 409 pricing_conflict on a duplicate pair', async () => {
    const session = unlockVault()
    const payload = { provider: 'anthropic', model: 'claude-sonnet-4-6', inputPerMTok: 3, outputPerMTok: 15 }

    const first = fakeReq('POST', '/api/pricing', session, payload)
    const res1 = fakeRes()
    handleConsumoRequest(first, res1)
    await res1.result()

    const second = fakeReq('POST', '/api/pricing', session, payload)
    const res2 = fakeRes()
    handleConsumoRequest(second, res2)
    const { status, body } = await res2.result()

    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('pricing_conflict')
  })

  it('PUT /api/pricing/:id updates rates and returns 404 for an unknown id', async () => {
    const session = unlockVault()
    const create = fakeReq('POST', '/api/pricing', session, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputPerMTok: 1,
      outputPerMTok: 5,
    })
    const createRes = fakeRes()
    handleConsumoRequest(create, createRes)
    const { body: createdBody } = await createRes.result()
    const id = (createdBody as { pricing: { id: string } }).pricing.id

    const update = fakeReq('PUT', `/api/pricing/${id}`, session, { inputPerMTok: 2 })
    const updateRes = fakeRes()
    handleConsumoRequest(update, updateRes)
    const { status, body } = await updateRes.result()
    expect(status).toBe(200)
    expect((body as { pricing: { inputPerMTok: number } }).pricing.inputPerMTok).toBe(2)

    const missing = fakeReq('PUT', '/api/pricing/does-not-exist', session, { inputPerMTok: 2 })
    const missingRes = fakeRes()
    handleConsumoRequest(missing, missingRes)
    const { status: missingStatus } = await missingRes.result()
    expect(missingStatus).toBe(404)
  })
})
