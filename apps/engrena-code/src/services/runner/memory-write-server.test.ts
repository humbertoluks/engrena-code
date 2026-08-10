import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_write_server_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { vaultService } = await import('../vault/vault-service.js')
const { readJournal } = await import('../vault/memory-service.js')
const { createMemoryWriteServer } = await import('./memory-write-server.js')

function makeThreadFixture(): { projectId: string; threadId: string } {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_write_server_fixture_'))
  const project = createProject({ path: dir })
  const thread = createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
  })
  return { projectId: project.id, threadId: thread.id }
}

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createMemoryWriteServer', () => {
  it('appends a journal entry and calls onEntryWritten', async () => {
    const { projectId, threadId } = makeThreadFixture()
    let notified = false
    const server = await createMemoryWriteServer({ projectId, threadId }, () => {
      notified = true
    })

    const res = await fetch(`http://127.0.0.1:${server.port}/memory-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-memory-token': server.token },
      body: JSON.stringify({ summary: 'decisão do turno' }),
    })
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }

    expect(body.isError).toBe(false)
    expect(notified).toBe(true)
    expect(readJournal(projectId).content).toContain('decisão do turno')

    server.close()
  })

  it('rejects requests with a wrong token', async () => {
    const { projectId, threadId } = makeThreadFixture()
    const server = await createMemoryWriteServer({ projectId, threadId })

    const res = await fetch(`http://127.0.0.1:${server.port}/memory-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-memory-token': 'token-errado' },
      body: JSON.stringify({ summary: 'x' }),
    })

    expect(res.status).toBe(403)
    server.close()
  })

  it('runTurn_writeMemoryFailureDoesNotFailTurn — vault write failure is logged, request still resolves 200', async () => {
    const { projectId, threadId } = makeThreadFixture()
    vaultService.lock()
    const server = await createMemoryWriteServer({ projectId, threadId })

    const res = await fetch(`http://127.0.0.1:${server.port}/memory-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-memory-token': server.token },
      body: JSON.stringify({ summary: 'nunca grava, cofre travado' }),
    })
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }

    expect(res.status).toBe(200)
    expect(body.isError).toBe(true)

    vaultService.unlock('workspace-teste', 'senha-forte-123')
    const entries = listLogEntries({ kind: 'task' })
    expect(entries.some((e) => e.event.startsWith('memory: falha ao escrever entrada'))).toBe(true)

    server.close()
  })
})
