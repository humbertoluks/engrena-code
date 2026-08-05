import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_dashboard_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleDashboardRequest, computeDashboardHealth } = await import('./dashboard-handler.js')
const { createProject } = await import('../db/repositories/projects.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f04_dashboard_http_fixture_'))

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
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('computeDashboardHealth', () => {
  const baseConfig = {
    claude: { mode: 'subscription' as const, subscriptionOk: false },
    clis: {
      claude: { installed: false, loggedIn: false },
      codex: { installed: false, loggedIn: null },
      kimi: { installed: false, loggedIn: null },
    },
    prompt: { isDefault: true, isEmpty: false, currentText: 'x' },
    github: { tokenPresent: false },
    keys: { claude: false, codex: false, minimax: false },
    providers: {
      claude: { available: false },
      codex: { available: false },
      kimi: { available: false },
      minimax: { available: false },
    },
  }

  it('marks setupIncomplete when no provider is available, even with a GitHub token', () => {
    const health = computeDashboardHealth({ ...baseConfig, github: { tokenPresent: true } })
    expect(health.setupIncomplete).toBe(true)
    expect(health.claude).toBe('warn')
    expect(health.clis).toBe('warn')
  })

  it('marks setupIncomplete when a provider is available but the GitHub token is missing', () => {
    const health = computeDashboardHealth({
      ...baseConfig,
      providers: { ...baseConfig.providers, claude: { available: true } },
    })
    expect(health.setupIncomplete).toBe(true)
    expect(health.claude).toBe('ok')
  })

  it('reports setupIncomplete=false with at least one provider and a GitHub token', () => {
    const health = computeDashboardHealth({
      ...baseConfig,
      github: { tokenPresent: true },
      providers: { ...baseConfig.providers, codex: { available: true } },
    })
    expect(health.setupIncomplete).toBe(false)
    expect(health.clis).toBe('ok')
  })

  it('reports prompt=off only when the global prompt is explicitly emptied', () => {
    expect(computeDashboardHealth({ ...baseConfig, prompt: { isDefault: false, isEmpty: true, currentText: '' } }).prompt).toBe('off')
    expect(computeDashboardHealth(baseConfig).prompt).toBe('ok')
  })
})

describe('handleDashboardRequest', () => {
  it('returns 401 without a valid session', async () => {
    unlockVault()
    const req = fakeReq('GET', '/api/dashboard')
    const res = fakeRes()
    await handleDashboardRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(401)
    expect((body as { error: { code: string } }).error.code).toBe('unauthorized')
  })

  it('returns 423 when the vault is locked', async () => {
    const req = fakeReq('GET', '/api/dashboard', 'qualquer-token')
    const res = fakeRes()
    await handleDashboardRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('aggregates health, metrics, inbox, projects, catalog and recent in one 200 response', async () => {
    const session = unlockVault()
    createProject({ path: fixtureRoot })

    const req = fakeReq('GET', '/api/dashboard', session)
    const res = fakeRes()
    await handleDashboardRequest(req, res)
    const { status, body } = await res.result()

    expect(status).toBe(200)
    const parsed = body as {
      health: { claude: string; clis: string; github: string; prompt: string; setupIncomplete: boolean }
      metrics: { projects: number; running: number; pendingDiffs: number; errors: number }
      inbox: unknown[]
      projects: unknown[]
      catalog: { skills: number; rules: number; subagents: number }
      recent: unknown[]
    }
    expect(parsed.metrics.projects).toBe(1)
    expect(parsed.projects).toHaveLength(1)
    expect(typeof parsed.catalog.skills).toBe('number')
    expect(typeof parsed.catalog.rules).toBe('number')
    expect(typeof parsed.catalog.subagents).toBe('number')
    expect(Array.isArray(parsed.inbox)).toBe(true)
    expect(Array.isArray(parsed.recent)).toBe(true)
    expect(typeof parsed.health.setupIncomplete).toBe('boolean')
  })
})
