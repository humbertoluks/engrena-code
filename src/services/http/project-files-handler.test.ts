import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f16_files_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createProject } = await import('../db/repositories/projects.js')
const { handleProjectFilesRequest } = await import('./project-files-handler.js')

function fakeReq(method: string, url: string, session?: string): IncomingMessage {
  return { method, url, headers: session !== undefined ? { 'x-engrenacode-session': session } : {} } as unknown as IncomingMessage
}

interface FakeResult {
  status: number
  body: unknown
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

let session: string
let fixtureRoot: string

beforeEach(() => {
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  session = vaultService.getSessionToken() as string

  fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f16_files_fixture_'))
  mkdirSync(join(fixtureRoot, 'src', 'renderer'), { recursive: true })
  mkdirSync(join(fixtureRoot, 'node_modules', 'ignored-pkg'), { recursive: true })
  mkdirSync(join(fixtureRoot, '.git'), { recursive: true })
  writeFileSync(join(fixtureRoot, 'src', 'renderer', 'App.tsx'), '// app')
  writeFileSync(join(fixtureRoot, 'src', 'renderer', 'Other.tsx'), '// other')
  writeFileSync(join(fixtureRoot, 'node_modules', 'ignored-pkg', 'index.js'), '// ignored')
  writeFileSync(join(fixtureRoot, '.git', 'HEAD'), 'ref: refs/heads/main')
  writeFileSync(join(fixtureRoot, 'README.md'), '# readme')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('handleProjectFilesRequest', () => {
  it('returns false for unrelated routes', async () => {
    const handled = await handleProjectFilesRequest(fakeReq('GET', '/api/threads/thr_1/history'), fakeRes())
    expect(handled).toBe(false)
  })

  it('rejects unauthorized requests with 401', async () => {
    const project = createProject({ path: fixtureRoot })
    const res = fakeRes()
    const handled = await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files`, 'invalid'), res)
    expect(handled).toBe(true)
    expect((await res.result()).status).toBe(401)
  })

  it('returns 404 for an unknown project', async () => {
    const res = fakeRes()
    await handleProjectFilesRequest(fakeReq('GET', '/api/projects/does-not-exist/files', session), res)
    const result = await res.result()
    expect(result.status).toBe(404)
    expect((result.body as { error: { code: string } }).error.code).toBe('project_not_found')
  })

  it('lists project files excluding .git/node_modules, with forward-slash relative paths', async () => {
    const project = createProject({ path: fixtureRoot })
    const res = fakeRes()
    await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files`, session), res)
    const result = await res.result()
    expect(result.status).toBe(200)
    const paths = (result.body as { files: Array<{ path: string }> }).files.map((f) => f.path).sort()
    expect(paths).toEqual(['README.md', 'src/renderer/App.tsx', 'src/renderer/Other.tsx'])
  })

  describe('test_files_search_respects_limit_50', () => {
    it('caps results at the requested limit', async () => {
      const project = createProject({ path: fixtureRoot })
      const res = fakeRes()
      await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files?limit=1`, session), res)
      const result = await res.result()
      expect((result.body as { files: unknown[] }).files.length).toBe(1)
    })

    it('rejects limit above 50', async () => {
      const project = createProject({ path: fixtureRoot })
      const res = fakeRes()
      await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files?limit=51`, session), res)
      expect((await res.result()).status).toBe(400)
    })

    it('rejects a non-integer limit', async () => {
      const project = createProject({ path: fixtureRoot })
      const res = fakeRes()
      await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files?limit=abc`, session), res)
      expect((await res.result()).status).toBe(400)
    })
  })

  it('filters by q case-insensitively', async () => {
    const project = createProject({ path: fixtureRoot })
    const res = fakeRes()
    await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files?q=APP`, session), res)
    const result = await res.result()
    const paths = (result.body as { files: Array<{ path: string }> }).files.map((f) => f.path)
    expect(paths).toEqual(['src/renderer/App.tsx'])
  })

  describe('test_files_rejects_path_escape', () => {
    it('never returns entries outside the project root', async () => {
      const project = createProject({ path: fixtureRoot })
      const res = fakeRes()
      await handleProjectFilesRequest(fakeReq('GET', `/api/projects/${project.id}/files?q=..`, session), res)
      const result = await res.result()
      const paths = (result.body as { files: Array<{ path: string }> }).files.map((f) => f.path)
      expect(paths).toEqual([])
      expect(paths.every((p) => !p.includes('..'))).toBe(true)
    })
  })
})
