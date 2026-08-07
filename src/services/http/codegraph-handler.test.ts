import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'

const SESSION_TOKEN = 'test-session-token'
const vaultState = { locked: false }

vi.mock('../vault/vault-service.js', () => ({
  vaultService: {
    getSessionToken: () => SESSION_TOKEN,
    isLocked: () => vaultState.locked,
  },
}))

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f19_codegraph_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { handleCodegraphRequest } = await import('./codegraph-handler.js')

function fakeRequest(method: string, url: string, authorized = true): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage
  req.method = method
  req.url = url
  req.headers = { 'x-engrenacode-session': authorized ? SESSION_TOKEN : 'invalid-token' }
  queueMicrotask(() => req.emit('end'))
  return req
}

function fakeResponse(): ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 0,
    body: '',
    writeHead(status: number) {
      res.statusCode = status
      return res
    },
    end(chunk?: string) {
      if (chunk !== undefined) res.body = chunk
    },
  } as unknown as ServerResponse & { statusCode: number; body: string }
  return res
}

beforeEach(() => {
  vaultState.locked = false
  getDb().exec('DELETE FROM projects')
})

afterEach(() => {
  /* keep */
})

describe('handleCodegraphRequest', () => {
  it('returns 423 when vault locked', async () => {
    vaultState.locked = true
    const req = fakeRequest('GET', '/api/projects/p1/codegraph/status')
    const res = fakeResponse()
    expect(await handleCodegraphRequest(req, res)).toBe(true)
    expect(res.statusCode).toBe(423)
  })

  it('returns 401 when unauthorized', async () => {
    const req = fakeRequest('GET', '/api/projects/p1/codegraph/status', false)
    const res = fakeResponse()
    expect(await handleCodegraphRequest(req, res)).toBe(true)
    expect(res.statusCode).toBe(401)
  })

  it('test_status_and_reindex_http', async () => {
    const root = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f19_http_proj_'))
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src/foo.ts'), 'export function Foo() { return 1 }\n')
    const project = createProject({ path: root })

    const statusReq = fakeRequest('GET', `/api/projects/${project.id}/codegraph/status`)
    const statusRes = fakeResponse()
    await handleCodegraphRequest(statusReq, statusRes)
    expect(statusRes.statusCode).toBe(200)
    expect(JSON.parse(statusRes.body).status).toBe('missing')

    const reindexReq = fakeRequest('POST', `/api/projects/${project.id}/codegraph/reindex`)
    const reindexRes = fakeResponse()
    await handleCodegraphRequest(reindexReq, reindexRes)
    expect(reindexRes.statusCode).toBe(200)
    const body = JSON.parse(reindexRes.body)
    expect(body.status).toBe('indexed')
    expect(body.symbolCount).toBeGreaterThan(0)

    rmSync(root, { recursive: true, force: true })
  })
})

import { afterAll } from 'vitest'
afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})
