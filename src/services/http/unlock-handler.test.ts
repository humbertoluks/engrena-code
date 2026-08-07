import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import axios from 'axios'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_unlock_boot_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread } = await import('../db/repositories/threads.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { skillsRepository } = await import('../db/repositories/skills.js')
const { createSubagentsRepository } = await import('../db/repositories/subagents.js')
const { vaultService } = await import('../vault/vault-service.js')
const { SEED_SKILLS, SEED_SUBAGENTS } = await import('../seeds/catalog.js')
const { createUnlockServer } = await import('./unlock-handler.js')

const subagentsRepo = createSubagentsRepository(getDb())
const SEED_FLAG_KEY = 'seeds:catalog:v1'

async function waitForPort(srv: ReturnType<typeof createUnlockServer>): Promise<number> {
  if (!srv.listening) {
    await new Promise<void>((resolve) => srv.once('listening', resolve))
  }
  const address = srv.address()
  return typeof address === 'object' && address ? address.port : 0
}

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_unlock_boot_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

let server: ReturnType<typeof createUnlockServer> | undefined

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterEach(() => {
  server?.close()
  server = undefined
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('createUnlockServer boot recovery', () => {
  it('moves orphaned running threads to error and records a task log_entries', () => {
    const project = createProject({ path: makeProjectDir('project-a') })
    const running = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'running',
    })

    server = createUnlockServer(0)

    expect(getThread(running.id)?.state).toBe('error')
    const entries = listLogEntries({ kind: 'task' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(running.id)
  })

  it('does nothing when there are no orphaned threads', () => {
    server = createUnlockServer(0)
    expect(listLogEntries({ kind: 'task' })).toEqual([])
  })
})

describe('createUnlockServer seed catalog application', () => {
  const WORKSPACE = 'f17-unlock-seed-ws'
  const PASSWORD = 'f17-unlock-seed-pass-123'

  beforeEach(() => {
    vaultService.unlock(WORKSPACE, PASSWORD)
    try {
      vaultService.deleteSecret(SEED_FLAG_KEY)
    } catch {
      // flag never set yet — fine
    }
    vaultService.lock()

    for (const skill of skillsRepository.list()) skillsRepository.remove(skill.id)
    getDb().exec('DELETE FROM project_subagents')
    getDb().exec('DELETE FROM subagents')
  })

  afterEach(() => {
    vaultService.lock()
  })

  it('test_unlock_applies_seed_catalog_on_first_success', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)

    const res = await axios.post(`http://127.0.0.1:${port}/api/vault/unlock`, {
      workspace: WORKSPACE,
      password: PASSWORD,
    })

    expect(res.data.unlocked).toBe(true)
    expect(res.data.sessionToken).toBeTruthy()
    expect(skillsRepository.list()).toHaveLength(SEED_SKILLS.length)
    expect(subagentsRepo.list()).toHaveLength(SEED_SUBAGENTS.length)
  })

  it('test_unlock_does_not_duplicate_seeds_on_relock', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)

    await axios.post(`http://127.0.0.1:${port}/api/vault/unlock`, {
      workspace: WORKSPACE,
      password: PASSWORD,
    })
    const firstSkillCount = skillsRepository.list().length
    const firstSubagentCount = subagentsRepo.list().length

    vaultService.lock()
    await axios.post(`http://127.0.0.1:${port}/api/vault/unlock`, {
      workspace: WORKSPACE,
      password: PASSWORD,
    })

    expect(skillsRepository.list()).toHaveLength(firstSkillCount)
    expect(subagentsRepo.list()).toHaveLength(firstSubagentCount)
  })

  it('test_unlock_succeeds_when_seed_apply_partially_fails', async () => {
    const spy = vi.spyOn(skillsRepository, 'create').mockImplementationOnce(() => {
      throw new Error('disk full')
    })

    server = createUnlockServer(0)
    const port = await waitForPort(server)

    const res = await axios.post(`http://127.0.0.1:${port}/api/vault/unlock`, {
      workspace: WORKSPACE,
      password: PASSWORD,
    })

    expect(res.status).toBe(200)
    expect(res.data.unlocked).toBe(true)
    expect(res.data.sessionToken).toBeTruthy()

    spy.mockRestore()
  })
})

describe('createUnlockServer project route chain with vault locked', () => {
  beforeEach(() => {
    vaultService.lock()
  })

  afterEach(() => {
    vaultService.lock()
  })

  it('returns 423 vault_locked for project nested routes through the real handler chain', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)
    const projectId = 'proj_chain_test'
    const paths = [
      `/api/projects/${projectId}/skills`,
      `/api/projects/${projectId}/rules`,
      `/api/projects/${projectId}/mcps`,
      `/api/projects/${projectId}/subagents`,
      `/api/projects/${projectId}/files`,
    ]

    for (const path of paths) {
      const res = await axios.get(`http://127.0.0.1:${port}${path}`, {
        validateStatus: () => true,
      })
      expect(res.status, path).toBe(423)
      expect(res.data?.error?.code, path).toBe('vault_locked')
    }
  })
})

describe('POST /api/vault/unlock payload validation', () => {
  beforeEach(() => {
    vaultService.lock()
  })

  afterEach(() => {
    vaultService.lock()
  })

  it('returns 400 invalid_json for malformed JSON', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)
    const res = await axios.post(`http://127.0.0.1:${port}/api/vault/unlock`, '{not-json', {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
      transformRequest: [(data) => data],
    })
    expect(res.status).toBe(400)
    expect(res.data?.error?.code).toBe('invalid_json')
  })

  it('returns 400 validation_error when workspace/password are non-strings', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)
    const res = await axios.post(
      `http://127.0.0.1:${port}/api/vault/unlock`,
      { workspace: 1, password: true },
      { validateStatus: () => true }
    )
    expect(res.status).toBe(400)
    expect(res.data?.error?.code).toBe('validation_error')
  })

  it('returns 400 validation_error when workspace/password are missing', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)
    const res = await axios.post(
      `http://127.0.0.1:${port}/api/vault/unlock`,
      { workspace: '', password: '' },
      { validateStatus: () => true }
    )
    expect(res.status).toBe(400)
    expect(res.data?.error?.code).toBe('validation_error')
  })

  it('returns 404 in the ApiErrorBody envelope for unknown routes', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)
    const res = await axios.get(`http://127.0.0.1:${port}/api/does-not-exist`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(404)
    expect(res.data).toEqual({ error: { code: 'not_found', message: 'Not found' } })
  })
})

describe('createUnlockServer CORS allowlist', () => {
  afterEach(() => {
    vaultService.lock()
  })

  it('reflects allowed Vite origin and rejects foreign origin', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)

    const allowed = await axios.options(`http://127.0.0.1:${port}/api/vault/unlock`, {
      headers: { Origin: 'http://localhost:5175' },
      validateStatus: () => true,
    })
    expect(allowed.status).toBe(204)
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5175')

    const denied = await axios.post(
      `http://127.0.0.1:${port}/api/vault/unlock`,
      { workspace: 'x', password: 'y' },
      {
        headers: { Origin: 'https://evil.example' },
        validateStatus: () => true,
      }
    )
    expect(denied.status).toBe(403)
    expect(denied.data?.error?.code).toBe('cors_denied')
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('allows null origin (Electron file://) and requests without Origin', async () => {
    server = createUnlockServer(0)
    const port = await waitForPort(server)

    const fileOrigin = await axios.options(`http://127.0.0.1:${port}/api/projects`, {
      headers: { Origin: 'null' },
      validateStatus: () => true,
    })
    expect(fileOrigin.status).toBe(204)
    expect(fileOrigin.headers['access-control-allow-origin']).toBe('null')

    const noOrigin = await axios.get(`http://127.0.0.1:${port}/api/does-not-exist`, {
      validateStatus: () => true,
    })
    expect(noOrigin.status).toBe(404)
    expect(noOrigin.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('test_corrupted_vault_message', () => {
  const WORKSPACE = 'f01-corrupted-ws'
  const PASSWORD = 'f01-corrupted-pass-123'

  beforeEach(() => {
    vaultService.lock()
  })

  afterEach(() => {
    vaultService.lock()
  })

  it('returns 422 vault_corrupted without consuming backoff', async () => {
    const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
    writeFileSync(vaultPath, Buffer.from([1, 0, 16, 1, 2, 3]))

    server = createUnlockServer(0)
    const port = await waitForPort(server)

    const first = await axios.post(
      `http://127.0.0.1:${port}/api/vault/unlock`,
      { workspace: WORKSPACE, password: PASSWORD },
      { validateStatus: () => true }
    )
    expect(first.status).toBe(422)
    expect(first.data?.error?.code).toBe('vault_corrupted')
    expect(first.data?.error?.message).toContain('danificado ou ilegível')

    const second = await axios.post(
      `http://127.0.0.1:${port}/api/vault/unlock`,
      { workspace: WORKSPACE, password: PASSWORD },
      { validateStatus: () => true }
    )
    expect(second.status).toBe(422)
    expect(second.data?.retryAfterMs).toBeUndefined()
  })
})
