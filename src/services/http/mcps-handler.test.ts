import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f09_mcps_http_'))
const projectDir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f09_mcps_http_project_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleMcpsRequest } = await import('./mcps-handler.js')
const { createProject } = await import('../db/repositories/projects.js')

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

async function call(method: string, url: string, session?: string, body?: unknown): Promise<FakeResult> {
  const req = fakeReq(method, url, session, body)
  const res = fakeRes()
  await handleMcpsRequest(req, res)
  return res.result()
}

let sessionToken: string

function unlockVault(): void {
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  sessionToken = vaultService.getSessionToken() as string
}

beforeEach(() => {
  vaultService.lock()
  const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
  if (existsSync(vaultPath)) rmSync(vaultPath)
  getDb().exec('DELETE FROM project_mcps')
  getDb().exec('DELETE FROM mcps')
  getDb().exec('DELETE FROM projects')
  unlockVault()
})

afterAll(() => {
  vaultService.lock()
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(projectDir, { recursive: true, force: true })
})

describe('mcps-handler guards', () => {
  it('rejects without a valid session', async () => {
    const res = await call('GET', '/api/mcps')
    expect(res.status).toBe(401)
  })

  it('returns 423 when the vault is locked', async () => {
    vaultService.lock()
    const res = await call('GET', '/api/mcps', sessionToken)
    expect(res.status).toBe(423)
  })
})

describe('mcps CRUD', () => {
  it('creates, lists and rejects reserved/invalid names', async () => {
    const create = await call('POST', '/api/mcps', sessionToken, { name: 'github', transport: 'stdio', command: 'npx' })
    expect(create.status).toBe(201)

    const list = await call('GET', '/api/mcps', sessionToken)
    expect((list.body as { mcps: unknown[] }).mcps).toHaveLength(1)

    const reserved = await call('POST', '/api/mcps', sessionToken, { name: 'engrenacode', transport: 'stdio', command: 'npx' })
    expect(reserved.status).toBe(400)

    const dup = await call('POST', '/api/mcps', sessionToken, { name: 'github', transport: 'stdio', command: 'npx' })
    expect(dup.status).toBe(409)
  })

  it('rejects non-https remote URL and updates/deletes', async () => {
    const bad = await call('POST', '/api/mcps', sessionToken, { name: 'remote', transport: 'http', url: 'http://example.com' })
    expect(bad.status).toBe(400)

    const create = await call('POST', '/api/mcps', sessionToken, { name: 'remote', transport: 'http', url: 'https://mcp.example.com' })
    expect(create.status).toBe(201)
    const id = (create.body as { mcp: { id: string } }).mcp.id

    const update = await call('PUT', `/api/mcps/${id}`, sessionToken, { description: 'nova' })
    expect(update.status).toBe(200)

    const del = await call('DELETE', `/api/mcps/${id}`, sessionToken)
    expect(del.status).toBe(200)
    expect((del.body as { deleted: boolean }).deleted).toBe(true)
  })
})

describe('mcp-catalog', () => {
  it('lists presets and installs, rejecting a second install with 409', async () => {
    const list = await call('GET', '/api/mcp-catalog', sessionToken)
    expect((list.body as { presets: unknown[] }).presets.length).toBeGreaterThanOrEqual(10)

    const install = await call('POST', '/api/mcp-catalog/github/install', sessionToken)
    expect(install.status).toBe(201)
    expect((install.body as { mcp: { env: Record<string, string> } }).mcp.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('vault:github_token')

    const again = await call('POST', '/api/mcp-catalog/github/install', sessionToken)
    expect(again.status).toBe(409)

    const unknown = await call('POST', '/api/mcp-catalog/does-not-exist/install', sessionToken)
    expect(unknown.status).toBe(400)
  })
})

describe('mcp-secrets', () => {
  it('never echoes value and supports save/list/delete', async () => {
    const empty = await call('GET', '/api/mcp-secrets', sessionToken)
    expect((empty.body as { keys: string[] }).keys).toEqual([])

    const save = await call('PUT', '/api/mcp-secrets/github_token', sessionToken, { value: 'ghp_xxx' })
    expect(save.status).toBe(200)
    expect(JSON.stringify(save.body)).not.toContain('ghp_xxx')

    const list = await call('GET', '/api/mcp-secrets', sessionToken)
    expect((list.body as { keys: string[] }).keys).toEqual(['github_token'])

    const del = await call('DELETE', '/api/mcp-secrets/github_token', sessionToken)
    expect(del.status).toBe(200)
    const after = await call('GET', '/api/mcp-secrets', sessionToken)
    expect((after.body as { keys: string[] }).keys).toEqual([])
  })

  it('rejects empty value with 400', async () => {
    const res = await call('PUT', '/api/mcp-secrets/github_token', sessionToken, { value: '' })
    expect(res.status).toBe(400)
  })
})

describe('oauth', () => {
  it('rejects starting oauth on a key-mode mcp', async () => {
    const create = await call('POST', '/api/mcps', sessionToken, { name: 'github', transport: 'stdio', command: 'npx' })
    const id = (create.body as { mcp: { id: string } }).mcp.id
    const res = await call('POST', `/api/mcps/${id}/oauth/start`, sessionToken)
    expect(res.status).toBe(400)
  })

  it('defaults status to disconnected and disconnect is idempotent', async () => {
    const create = await call('POST', '/api/mcps', sessionToken, {
      name: 'notion',
      transport: 'http',
      url: 'https://mcp.notion.com/mcp',
      authMode: 'oauth',
    })
    const id = (create.body as { mcp: { id: string } }).mcp.id

    const status = await call('GET', `/api/mcps/${id}/oauth/status`, sessionToken)
    expect((status.body as { status: string }).status).toBe('disconnected')

    const disconnect = await call('POST', `/api/mcps/${id}/oauth/disconnect`, sessionToken)
    expect(disconnect.status).toBe(200)
  })
})

describe('project link', () => {
  it('links, lists and unlinks an mcp for a project', async () => {
    const project = createProject({ path: projectDir })
    const mcp = await call('POST', '/api/mcps', sessionToken, { name: 'github', transport: 'stdio', command: 'npx' })
    const mcpId = (mcp.body as { mcp: { id: string } }).mcp.id

    const link = await call('PUT', `/api/projects/${project.id}/mcps/${mcpId}`, sessionToken, { enabled: true })
    expect(link.status).toBe(200)

    const list = await call('GET', `/api/projects/${project.id}/mcps`, sessionToken)
    const state = (list.body as { mcps: Array<{ id: string; linked: boolean }> }).mcps.find((m) => m.id === mcpId)
    expect(state?.linked).toBe(true)

    const unlink = await call('DELETE', `/api/projects/${project.id}/mcps/${mcpId}`, sessionToken)
    expect((unlink.body as { unlinked: boolean }).unlinked).toBe(true)
  })
})
