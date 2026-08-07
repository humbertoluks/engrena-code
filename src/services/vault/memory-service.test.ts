import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_service_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { vaultService } = await import('./vault-service.js')
const { readJournal, appendEntry, getEntryCount, getLastEntryAt, getJournalSizeBytes } = await import(
  './memory-service.js'
)

function makeThreadFixture(): { projectId: string; threadId: string } {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f20_memory_service_fixture_'))
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

describe('readJournal', () => {
  it('returns empty content for a project with no journal yet', () => {
    const { projectId } = makeThreadFixture()
    expect(readJournal(projectId)).toEqual({ content: '', corrupted: false })
  })

  it('readJournal_corruptedReturnsEmptyWithFlag', () => {
    const { projectId } = makeThreadFixture()
    vaultService.setSecret(`memory:${projectId}`, 'not a journal at all')
    expect(readJournal(projectId)).toEqual({ content: '', corrupted: true })
  })
})

describe('appendEntry', () => {
  it('appendEntry_prependsNewestFirst', () => {
    const { projectId, threadId } = makeThreadFixture()
    appendEntry({ projectId, threadId, summary: 'primeira decisão', now: Date.parse('2026-01-01T00:00:00.000Z') })
    appendEntry({ projectId, threadId, summary: 'segunda decisão', now: Date.parse('2026-01-02T00:00:00.000Z') })

    const { content } = readJournal(projectId)
    expect(content.startsWith('### 2026-01-02T00:00:00.000Z')).toBe(true)
    expect(content).toContain('segunda decisão')
    expect(content).toContain('primeira decisão')
    expect(getEntryCount(projectId)).toBe(2)
    expect(getLastEntryAt(projectId)).toBe('2026-01-02T00:00:00.000Z')
  })

  it('ignores a blank summary without writing an entry', () => {
    const { projectId, threadId } = makeThreadFixture()
    appendEntry({ projectId, threadId, summary: '   ' })
    expect(readJournal(projectId)).toEqual({ content: '', corrupted: false })
  })

  it('appendEntry_truncatesAt256KiB', () => {
    const { projectId, threadId } = makeThreadFixture()
    const bigSummary = 'x'.repeat(140 * 1024)
    appendEntry({ projectId, threadId, summary: bigSummary, now: Date.parse('2026-01-01T00:00:00.000Z') })
    appendEntry({ projectId, threadId, summary: bigSummary, now: Date.parse('2026-01-02T00:00:00.000Z') })
    appendEntry({ projectId, threadId, summary: 'entrada nova preservada', now: Date.parse('2026-01-03T00:00:00.000Z') })

    expect(getJournalSizeBytes(projectId)).toBeLessThanOrEqual(256 * 1024)
    const { content } = readJournal(projectId)
    expect(content).toContain('entrada nova preservada')

    const entries = listLogEntries({ kind: 'task' })
    expect(entries.some((e) => e.event === 'memory: journal truncado (limite 256 KiB)')).toBe(true)
  })

  it('discards a corrupted journal instead of building on top of it', () => {
    const { projectId, threadId } = makeThreadFixture()
    vaultService.setSecret(`memory:${projectId}`, 'not a journal at all')
    appendEntry({ projectId, threadId, summary: 'entrada nova', now: Date.parse('2026-01-01T00:00:00.000Z') })

    const { content, corrupted } = readJournal(projectId)
    expect(corrupted).toBe(false)
    expect(content).not.toContain('not a journal at all')
    expect(content).toContain('entrada nova')
  })
})
