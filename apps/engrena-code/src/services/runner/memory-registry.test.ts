import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_registry_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject, setMemoryEnabled } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { vaultService } = await import('../vault/vault-service.js')
const { appendEntry } = await import('../vault/memory-service.js')
const { MemoryRegistry } = await import('./memory-registry.js')

function makeThreadFixture(): { projectId: string; threadId: string } {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_registry_fixture_'))
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

describe('MemoryRegistry.composeBlockForTurn', () => {
  it('buildSystemPrompt_omitsMemoryBlockWhenDisabled', () => {
    const { projectId, threadId } = makeThreadFixture()
    appendEntry({ projectId, threadId, summary: 'decisão qualquer' })
    setMemoryEnabled(projectId, false)

    expect(MemoryRegistry.composeBlockForTurn(projectId, threadId)).toBe('')
  })

  it('buildSystemPrompt_includesMemoryBlockWhenEnabled', () => {
    const { projectId, threadId } = makeThreadFixture()
    appendEntry({ projectId, threadId, summary: 'decisão qualquer' })

    const block = MemoryRegistry.composeBlockForTurn(projectId, threadId)
    expect(block).toContain('EngrenaCode Memory')
    expect(block).toContain('decisão qualquer')
  })

  it('returns empty string for an empty journal', () => {
    const { projectId, threadId } = makeThreadFixture()
    expect(MemoryRegistry.composeBlockForTurn(projectId, threadId)).toBe('')
  })

  it('returns empty string and logs when the journal is corrupted', () => {
    const { projectId, threadId } = makeThreadFixture()
    vaultService.setSecret(`memory:${projectId}`, 'not a journal at all')

    expect(MemoryRegistry.composeBlockForTurn(projectId, threadId)).toBe('')
    const entries = listLogEntries({ kind: 'task' })
    expect(entries.some((e) => e.event === 'memory: journal corrompido, tratado como vazio')).toBe(true)
  })
})
