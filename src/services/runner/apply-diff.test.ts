import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_applydiff_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread } = await import('../db/repositories/threads.js')
const { createDiff, getDiff, listPendingForThread } = await import('../db/repositories/diffs.js')
const { applyDiffAction, ApplyDiffValidationError } = await import('./apply-diff.js')
const { acquireLease, clearAllLeases } = await import('./project-execution.js')
const { LeaseBusyError } = await import('./project-execution.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString()
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_applydiff_fixture_'))
  writeFileSync(join(dir, 'existing.txt'), 'conteudo original\n')
  git(dir, ['init'])
  git(dir, ['add', '-A'])
  git(dir, ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-m', 'init'])
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  clearAllLeases()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function seedTurn(dir: string) {
  const project = createProject({ path: dir })
  const thread = createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'full-access',
    executionMode: 'main',
    state: 'idle',
  })

  writeFileSync(join(dir, 'existing.txt'), 'conteudo modificado\n')
  writeFileSync(join(dir, 'new-file.txt'), 'arquivo novo\n')

  const diffExisting = createDiff({
    threadId: thread.id,
    file: 'existing.txt',
    additions: 1,
    deletions: 1,
    hunks: [{ header: '@@ -1 +1 @@', lines: ['-conteudo original', '+conteudo modificado'] }],
    provider: 'claude',
    worktreePath: dir,
  })
  const diffNew = createDiff({
    threadId: thread.id,
    file: 'new-file.txt',
    additions: 1,
    deletions: 0,
    hunks: [{ header: '@@ -0,0 +1 @@', lines: ['+arquivo novo'] }],
    provider: 'claude',
    worktreePath: dir,
  })

  return { project, thread, diffExisting, diffNew }
}

describe('applyDiffAction — accept', () => {
  it('accepts a single file by id, leaves the other pending, thread stays idle', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting, diffNew } = seedTurn(dir)

    const result = await applyDiffAction({ threadId: thread.id, ids: [diffExisting.id] })
    expect(result.applied).toBe(true)
    expect(result.acceptedIds).toEqual([diffExisting.id])

    expect(getDiff(diffExisting.id)?.status).toBe('accepted')
    expect(getDiff(diffNew.id)?.status).toBe('pending')
    expect(getThread(thread.id)?.state).toBe('idle')

    const entries = listLogEntries({ kind: 'git' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(thread.id)
    expect(entries[0]?.event).toContain('diff aceito')

    rmSync(dir, { recursive: true, force: true })
  })

  it('accepts all pending when ids/paths are omitted and moves the thread to committed', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting, diffNew } = seedTurn(dir)

    const result = await applyDiffAction({ threadId: thread.id })
    expect(result.acceptedIds?.sort()).toEqual([diffExisting.id, diffNew.id].sort())
    expect(getThread(thread.id)?.state).toBe('committed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('accepts by paths XOR ids', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting } = seedTurn(dir)

    const result = await applyDiffAction({ threadId: thread.id, paths: ['existing.txt'] })
    expect(result.acceptedIds).toEqual([diffExisting.id])

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('applyDiffAction — reject', () => {
  it('restores only the rejected subset, keeps the other file pending on disk', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting, diffNew } = seedTurn(dir)

    const result = await applyDiffAction({ threadId: thread.id, action: 'reject', ids: [diffExisting.id] })
    expect(result.rejectedIds).toEqual([diffExisting.id])
    expect(getDiff(diffExisting.id)?.status).toBe('rejected')
    expect(getDiff(diffNew.id)?.status).toBe('pending')

    // git no Windows pode normalizar EOL (core.autocrlf) ao restaurar — compara ignorando CRLF/LF
    expect(readFileSync(join(dir, 'existing.txt'), 'utf-8').replace(/\r\n/g, '\n')).toBe('conteudo original\n')
    expect(existsSync(join(dir, 'new-file.txt'))).toBe(true)
    expect(getThread(thread.id)?.state).toBe('idle')

    const entries = listLogEntries({ kind: 'git' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.event).toContain('diff rejeitado')

    rmSync(dir, { recursive: true, force: true })
  })

  it('removes a rejected new file from disk', async () => {
    const dir = makeProjectDir()
    const { thread, diffNew } = seedTurn(dir)

    await applyDiffAction({ threadId: thread.id, action: 'reject', ids: [diffNew.id] })
    expect(existsSync(join(dir, 'new-file.txt'))).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('applyDiffAction — validation and busy', () => {
  it('rejects ids and paths together', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting } = seedTurn(dir)

    await expect(
      applyDiffAction({ threadId: thread.id, ids: [diffExisting.id], paths: ['existing.txt'] })
    ).rejects.toBeInstanceOf(ApplyDiffValidationError)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects an empty ids array', async () => {
    const dir = makeProjectDir()
    const { thread } = seedTurn(dir)

    await expect(applyDiffAction({ threadId: thread.id, ids: [] })).rejects.toBeInstanceOf(ApplyDiffValidationError)

    rmSync(dir, { recursive: true, force: true })
  })

  it('returns diff_not_found when the subset has nothing pending', async () => {
    const dir = makeProjectDir()
    const { thread, diffExisting } = seedTurn(dir)
    await applyDiffAction({ threadId: thread.id, ids: [diffExisting.id] })

    try {
      await applyDiffAction({ threadId: thread.id, ids: [diffExisting.id] })
      expect.unreachable()
    } catch (err) {
      expect((err as InstanceType<typeof ApplyDiffValidationError>).code).toBe('diff_not_found')
    }

    rmSync(dir, { recursive: true, force: true })
  })

  it('throws LeaseBusyError (thread_busy) when the project is already leased', async () => {
    const dir = makeProjectDir()
    const { project, thread, diffExisting } = seedTurn(dir)
    acquireLease(project.id, 'agent', 'dispatch', thread.id)

    await expect(applyDiffAction({ threadId: thread.id, ids: [diffExisting.id] })).rejects.toBeInstanceOf(
      LeaseBusyError
    )

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })
})
