import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f06_rules_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleRulesRequest } = await import('./rules-handler.js')

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
  const done = new Promise<FakeResult>((resolve) => { resolveDone = resolve })
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

beforeEach(() => {
  getDb().exec('DELETE FROM project_rules')
  getDb().exec('DELETE FROM rules')
  vaultService.lock()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function unlockVault(): string {
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  return vaultService.getSessionToken() as string
}

describe('handleRulesRequest', () => {
  it('returns 423 vault_locked when vault is locked', async () => {
    const req = fakeReq('GET', '/api/rules')
    const res = fakeRes()
    await handleRulesRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('returns 401 unauthorized with wrong session token', async () => {
    unlockVault()
    const req = fakeReq('GET', '/api/rules', undefined, 'token-invalido')
    const res = fakeRes()
    await handleRulesRequest(req, res)
    const { status } = await res.result()
    expect(status).toBe(401)
  })

  it('rejects name with CRLF with 400', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/rules', { name: 'quebra\nlinha', content: 'x' }, session)
    const res = fakeRes()
    await handleRulesRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('invalid_request')
  })

  it('rejects content over 1 MiB with 400 too_long', async () => {
    const session = unlockVault()
    const huge = 'a'.repeat(1024 * 1024 + 1)
    const req = fakeReq('POST', '/api/rules', { name: 'grande', content: huge }, session)
    const res = fakeRes()
    await handleRulesRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('too_long')
  })

  it('returns 409 on duplicate name', async () => {
    const session = unlockVault()

    const req1 = fakeReq('POST', '/api/rules', { name: 'dup', content: 'a' }, session)
    const res1 = fakeRes()
    await handleRulesRequest(req1, res1)
    expect((await res1.result()).status).toBe(201)

    const req2 = fakeReq('POST', '/api/rules', { name: 'dup', content: 'b' }, session)
    const res2 = fakeRes()
    await handleRulesRequest(req2, res2)
    const { status, body } = await res2.result()
    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('rule_name_conflict')
  })

  it('creates, links to a project and resolves the active block', async () => {
    const session = unlockVault()

    const createReq = fakeReq('POST', '/api/rules', { name: 'local-x', content: 'conteudo' }, session)
    const createRes = fakeRes()
    await handleRulesRequest(createReq, createRes)
    const created = (await createRes.result()).body as { rule: { id: string } }

    const linkReq = fakeReq('PUT', `/api/projects/proj-1/rules/${created.rule.id}`, { enabled: true }, session)
    const linkRes = fakeRes()
    await handleRulesRequest(linkReq, linkRes)
    expect((await linkRes.result()).status).toBe(200)

    const listReq = fakeReq('GET', '/api/projects/proj-1/rules', undefined, session)
    const listRes = fakeRes()
    await handleRulesRequest(listReq, listRes)
    const { body } = await listRes.result()
    const rules = (body as { rules: Array<{ id: string; activeInProject: boolean }> }).rules
    expect(rules.find((r) => r.id === created.rule.id)?.activeInProject).toBe(true)
  })
})
