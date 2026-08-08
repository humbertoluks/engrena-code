import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

vi.mock('electron', () => ({ shell: { openExternal: vi.fn(async () => {}) } }))

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f10_config_http_'))

const { vaultService } = await import('../vault/vault-service.js')
const { handleConfigRequest } = await import('./config-handler.js')

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
})

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('POST /api/config/keys/save', () => {
  it('returns 423 vault_locked when vault is locked', async () => {
    const req = fakeReq('POST', '/api/config/keys/save', { claude: 'sk-ant-12345678' })
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('returns unauthorized with unlocked vault and invalid session', async () => {
    unlockVault()
    const req = fakeReq('POST', '/api/config/keys/save', { claude: 'sk-ant-12345678' }, 'token-invalido')
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(401)
    expect((body as { error: { code: string } }).error.code).toBe('unauthorized')
  })

  it('saves valid keys and reports presence', async () => {
    const session = unlockVault()
    const req = fakeReq(
      'POST',
      '/api/config/keys/save',
      { claude: 'sk-ant-12345678', codex: 'sk-12345678', minimax: 'mm-12345678' },
      session
    )
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({
      saved: true,
      keys: { claude: true, codex: true, minimax: true, glm: false, grok: false },
      message: 'Chaves salvas localmente (não validadas com o provider).',
    })
  })

  it('partial save with empty field preserves the previously saved key', async () => {
    const session = unlockVault()
    await handleConfigRequest(
      fakeReq('POST', '/api/config/keys/save', { claude: 'sk-ant-12345678' }, session),
      fakeRes()
    )

    const req = fakeReq('POST', '/api/config/keys/save', { claude: '', minimax: 'mm-12345678' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { body } = await res.result()
    expect((body as { keys: { claude: boolean; codex: boolean; minimax: boolean; glm: boolean; grok: boolean } }).keys).toEqual({
      claude: true,
      codex: false,
      minimax: true,
      glm: false,
      grok: false,
    })
  })

  it('rejects malformed keys with validation_error and per-field details', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/config/keys/save', { claude: 'not-a-claude-key' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    const err = (body as { error: { code: string; details?: Record<string, string> } }).error
    expect(err.code).toBe('validation_error')
    expect(err.details?.claude).toBe('Formato inválido. Esperado: sk-ant-…')
  })
})

describe('GET /api/config/status', () => {
  it('reports key presence and provider availability', async () => {
    const session = unlockVault()
    await handleConfigRequest(
      fakeReq('POST', '/api/config/keys/save', { minimax: 'mm-12345678' }, session),
      fakeRes()
    )

    const req = fakeReq('GET', '/api/config/status', undefined, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    const parsed = body as {
      keys: { claude: boolean; codex: boolean; minimax: boolean; glm: boolean; grok: boolean }
      providers: { minimax: { available: boolean } }
    }
    expect(parsed.keys).toEqual({ claude: false, codex: false, minimax: true, glm: false, grok: false })
    expect(parsed.providers.minimax.available).toBe(true)
  })
})

describe('POST /api/config/keys/save — glm/grok (F23)', () => {
  it('saves valid glm/grok keys and reports presence', async () => {
    const session = unlockVault()
    const req = fakeReq(
      'POST',
      '/api/config/keys/save',
      { glm: 'abcdef01234.5678secretpart', grok: 'xai-abcdef0123456789' },
      session
    )
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { keys: { glm: boolean; grok: boolean } }).keys).toMatchObject({ glm: true, grok: true })
  })

  it('rejects a grok key without the xai- prefix, nothing saved', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/config/keys/save', { grok: 'not-a-grok-key' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    const err = (body as { error: { code: string; details?: Record<string, string> } }).error
    expect(err.code).toBe('validation_error')
    expect(err.details?.grok).toBe('Formato inválido. Esperado: xai-…')
  })
})

describe('GET /api/config/status — glm/grok (F23)', () => {
  it('reports glm/grok availability with reason when key is missing', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/config/status', undefined, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { body } = await res.result()
    const parsed = body as { providers: { glm: { available: boolean; reason?: string }; grok: { available: boolean; reason?: string } } }
    expect(parsed.providers.glm).toEqual({ available: false, reason: 'GLM sem key salva — configure em #configuracao.' })
    expect(parsed.providers.grok).toEqual({ available: false, reason: 'Grok sem key salva — configure em #configuracao.' })
  })
})

describe('POST /api/config/glm/test and /api/config/grok/test (F23)', () => {
  it('returns 423 vault_locked when vault is locked', async () => {
    const req = fakeReq('POST', '/api/config/glm/test')
    const res = fakeRes()
    await handleConfigRequest(req, res)
    expect((await res.result()).status).toBe(423)
  })

  it('returns success:false with a key-missing detail when no key is saved', async () => {
    const session = unlockVault()
    const glmReq = fakeReq('POST', '/api/config/glm/test', undefined, session)
    const glmRes = fakeRes()
    await handleConfigRequest(glmReq, glmRes)
    const glmBody = (await glmRes.result()).body as { success: boolean; detail: string }
    expect(glmBody.success).toBe(false)

    const grokReq = fakeReq('POST', '/api/config/grok/test', undefined, session)
    const grokRes = fakeRes()
    await handleConfigRequest(grokReq, grokRes)
    const grokBody = (await grokRes.result()).body as { success: boolean; detail: string }
    expect(grokBody.success).toBe(false)
  })
})

describe('POST /api/config/claude/mode', () => {
  it('rejects api-key mode when no Claude key is saved', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/config/claude/mode', { mode: 'api-key' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('accepts api-key mode once a Claude key is saved', async () => {
    const session = unlockVault()
    await handleConfigRequest(
      fakeReq('POST', '/api/config/keys/save', { claude: 'sk-ant-12345678' }, session),
      fakeRes()
    )

    const req = fakeReq('POST', '/api/config/claude/mode', { mode: 'api-key' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { mode: string }).mode).toBe('api-key')
  })
})

describe('VCS (F24)', () => {
  it('GET /api/config/vcs/status returns 423 vault_locked when locked', async () => {
    const req = fakeReq('GET', '/api/config/vcs/status')
    const res = fakeRes()
    await handleConfigRequest(req, res)
    expect((await res.result()).status).toBe(423)
  })

  it('lists github as pat and the 3 OAuth providers, defaulting to needs-client-id', async () => {
    const session = unlockVault()
    const req = fakeReq('GET', '/api/config/vcs/status', undefined, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    const providers = (body as { providers: Array<{ kind: string; auth: string; status: string; tokenPresent: boolean }> }).providers
    expect(providers).toEqual([
      { kind: 'github', auth: 'pat', status: 'disconnected', tokenPresent: false },
      { kind: 'gitlab', auth: 'oauth', status: 'needs-client-id', tokenPresent: false },
      { kind: 'bitbucket', auth: 'oauth', status: 'needs-client-id', tokenPresent: false },
      { kind: 'azure', auth: 'oauth', status: 'needs-client-id', tokenPresent: false },
    ])
  })

  it('github reports connected once the PAT is saved', async () => {
    const session = unlockVault()
    await handleConfigRequest(fakeReq('POST', '/api/config/github/token', { token: 'ghp_1234567890abcdef1234567890abcdef1234' }, session), fakeRes())

    const req = fakeReq('GET', '/api/config/vcs/status', undefined, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const providers = ((await res.result()).body as { providers: Array<{ kind: string; status: string }> }).providers
    expect(providers.find((p) => p.kind === 'github')).toMatchObject({ status: 'connected' })
  })

  it('PUT client rejects an unknown provider kind with 400', async () => {
    const session = unlockVault()
    const req = fakeReq('PUT', '/api/config/vcs/notaprovider/oauth/client', { clientId: 'x' }, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    expect((await res.result()).status).toBe(400)
  })

  it('PUT client without clientId returns 400 validation_error', async () => {
    const session = unlockVault()
    const req = fakeReq('PUT', '/api/config/vcs/gitlab/oauth/client', {}, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
  })

  it('POST oauth/start reports needs-client-id before any client id is saved', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/config/vcs/bitbucket/oauth/start', undefined, session)
    const res = fakeRes()
    await handleConfigRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { status: string }).status).toBe('needs-client-id')
  })

  it('saving a client id then starting oauth returns an authorizeUrl and status becomes pending, then disconnect clears it', async () => {
    const session = unlockVault()
    await handleConfigRequest(fakeReq('PUT', '/api/config/vcs/gitlab/oauth/client', { clientId: 'test-client' }, session), fakeRes())

    const startReq = fakeReq('POST', '/api/config/vcs/gitlab/oauth/start', undefined, session)
    const startRes = fakeRes()
    await handleConfigRequest(startReq, startRes)
    const startBody = (await startRes.result()).body as { authorizeUrl: string }
    expect(typeof startBody.authorizeUrl).toBe('string')

    const statusReq = fakeReq('GET', '/api/config/vcs/status', undefined, session)
    const statusRes = fakeRes()
    await handleConfigRequest(statusReq, statusRes)
    const providers = ((await statusRes.result()).body as { providers: Array<{ kind: string; status: string }> }).providers
    expect(providers.find((p) => p.kind === 'gitlab')).toMatchObject({ status: 'pending' })

    const disconnectReq = fakeReq('POST', '/api/config/vcs/gitlab/oauth/disconnect', undefined, session)
    const disconnectRes = fakeRes()
    await handleConfigRequest(disconnectReq, disconnectRes)
    expect((await disconnectRes.result()).status).toBe(200)
  })
})
