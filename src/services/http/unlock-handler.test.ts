import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
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
