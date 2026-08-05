import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

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
  it('returns unauthorized without a valid session', async () => {
    const req = fakeReq('POST', '/api/config/keys/save', { claude: 'sk-ant-12345678' })
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
      keys: { claude: true, codex: true, minimax: true },
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
    expect((body as { keys: { claude: boolean; codex: boolean; minimax: boolean } }).keys).toEqual({
      claude: true,
      codex: false,
      minimax: true,
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
      keys: { claude: boolean; codex: boolean; minimax: boolean }
      providers: { minimax: { available: boolean } }
    }
    expect(parsed.keys).toEqual({ claude: false, codex: false, minimax: true })
    expect(parsed.providers.minimax.available).toBe(true)
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
