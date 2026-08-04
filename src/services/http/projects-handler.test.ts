import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_projects_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { handleProjectsRequest } = await import('./projects-handler.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_projects_http_fixture_'))
const projectDir = join(fixtureRoot, 'meu-projeto')
mkdirSync(projectDir, { recursive: true })

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

beforeEach(() => {
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

function unlockVault(): string {
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  return vaultService.getSessionToken() as string
}

describe('handleProjectsRequest', () => {
  it('returns 423 vault_locked when vault is locked', async () => {
    const req = fakeReq('GET', '/api/projects')
    const res = fakeRes()
    await handleProjectsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(423)
    expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
  })

  it('adds a project without requiring .git (201, no not_git_repo)', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/projects', { path: projectDir }, session)
    const res = fakeRes()
    await handleProjectsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const created = body as { project: { id: string; path: string } }
    expect(created.project.id).toBeTruthy()
  })

  it('rejects invalid path with project_path_invalid + reason details', async () => {
    const session = unlockVault()
    const req = fakeReq('POST', '/api/projects', { path: join(fixtureRoot, 'nao-existe') }, session)
    const res = fakeRes()
    await handleProjectsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    const err = (body as { error: { code: string; details?: { reason?: string } } }).error
    expect(err.code).toBe('project_path_invalid')
    expect(err.details?.reason).toBe('not_found')
  })

  it('returns 409 on duplicate path', async () => {
    const session = unlockVault()
    const req1 = fakeReq('POST', '/api/projects', { path: projectDir }, session)
    await handleProjectsRequest(req1, fakeRes())

    const req2 = fakeReq('POST', '/api/projects', { path: projectDir }, session)
    const res2 = fakeRes()
    await handleProjectsRequest(req2, res2)
    const { status, body } = await res2.result()
    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('project_duplicate')
  })

  it('lists and deletes a project', async () => {
    const session = unlockVault()
    const createReq = fakeReq('POST', '/api/projects', { path: projectDir }, session)
    const createRes = fakeRes()
    await handleProjectsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { project: { id: string } }

    const listReq = fakeReq('GET', '/api/projects', undefined, session)
    const listRes = fakeRes()
    await handleProjectsRequest(listReq, listRes)
    const list = (await listRes.result()).body as { projects: Array<{ id: string }> }
    expect(list.projects.some((p) => p.id === created.project.id)).toBe(true)

    const delReq = fakeReq('DELETE', `/api/projects/${created.project.id}`, undefined, session)
    const delRes = fakeRes()
    await handleProjectsRequest(delReq, delRes)
    expect((await delRes.result()).status).toBe(204)
  })
})
