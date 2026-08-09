import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f27_voice_http_'))

const { vaultService } = await import('../vault/vault-service.js')
const { handleVoiceRequest } = await import('./voice-handler.js')
const { setFetchForTesting, resetFetchForTesting } = await import('../voice/transcribe.js')

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
  const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
  if (existsSync(vaultPath)) rmSync(vaultPath)
})

afterEach(() => {
  resetFetchForTesting()
})

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('voice_handler_guard_vault_locked', () => {
  it('returns 423 vault_locked before checking the session token', async () => {
    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' })
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('returns 401 unauthorized once unlocked with an invalid session token', async () => {
    unlockVault()
    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' }, 'token-invalido')
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    expect((await res.result()).status).toBe(401)
  })
})

describe('voice_handler validates audio payload', () => {
  it('rejects an unsupported mime type with audio_type_invalid', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/mp3', audioBase64: 'YQ==' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('audio_type_invalid')
  })

  it('rejects an empty audioBase64 with audio_empty', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: '' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    expect((await res.result()).status).toBe(400)
  })
})

describe('voice_handler transcribe end-to-end error mapping', () => {
  it('returns 400 voice_key_missing when no key is saved', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('voice_key_missing')
  })

  it('voice_handler_maps_transcribe_error_to_502 when both providers fail', async () => {
    const session = unlockVault()
    vaultService.setSecret('voice:openai', 'sk-abcdefgh')
    setFetchForTesting(async () => new Response('boom', { status: 500 }))

    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(502)
    expect((body as { error: { code: string } }).error.code).toBe('voice_upstream_error')
  })

  it('returns 422 voice_auth_error (not 401) when the provider rejects the key, so the renderer does not relock the vault', async () => {
    const session = unlockVault()
    vaultService.setSecret('voice:openai', 'sk-abcdefgh')
    setFetchForTesting(async () => new Response('unauthorized', { status: 401 }))

    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(422)
    expect((body as { error: { code: string } }).error.code).toBe('voice_auth_error')
  })

  it('returns 200 with the transcribed text on success', async () => {
    const session = unlockVault()
    vaultService.setSecret('voice:openai', 'sk-abcdefgh')
    setFetchForTesting(async () => new Response(JSON.stringify({ text: 'ola mundo' }), { status: 200 }))

    const req = fakeReq('POST', '/api/voice/transcribe', { mimeType: 'audio/webm', audioBase64: 'YQ==' }, session)
    const res = fakeRes()
    await handleVoiceRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({ text: 'ola mundo', provider: 'openai' })
  })
})
