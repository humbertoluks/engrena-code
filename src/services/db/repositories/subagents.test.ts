import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { SubagentInput } from './subagents.js'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_subagents_repo_'))

const { getDb, closeDb } = await import('../client.js')
const {
  CatalogOrderError,
  createSubagent,
  getSubagentById,
  getSubagentCounts,
  listProjectSubagents,
  listSubagentRunsForParentThread,
  removeSubagent,
  resolveSubagentTurnCatalog,
  setSubagentCatalogOrder,
  SubagentNameConflictError,
  SubagentNotFoundError,
  SubagentTooLongError,
  SubagentValidationError,
  unlinkProjectSubagent,
  updateSubagent,
  updateSubagentRun,
  upsertProjectSubagentLink,
  createSubagentRun,
} = await import('./subagents.js')

function makeInput(overrides: Partial<SubagentInput> = {}) {
  return {
    name: 'revisor-seguranca',
    description: 'Revisa diffs em busca de vulnerabilidades.',
    prompt: 'Você é um revisor de segurança.',
    provider: 'claude' as const,
    ...overrides,
  }
}

describe('subagentsRepository', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM subagent_runs')
    getDb().exec('DELETE FROM project_subagents')
    getDb().exec('DELETE FROM subagents')
  })

  afterAll(() => {
    closeDb()
    rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  })

  it('creates and reads back a subagent', () => {
    const created = createSubagent(makeInput())
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('revisor-seguranca')
    expect(created.tools).toBeNull()
    expect(created.enabled).toBe(true)
    expect(getSubagentById(created.id)).toEqual(created)
  })

  it('rejects_duplicate_name', () => {
    createSubagent(makeInput())
    expect(() => createSubagent(makeInput())).toThrow(SubagentNameConflictError)
  })

  it('rejects_prompt_over_1mib', () => {
    const bigPrompt = 'a'.repeat(1_048_577)
    expect(() => createSubagent(makeInput({ prompt: bigPrompt }))).toThrow(SubagentTooLongError)
  })

  it('rejects_unknown_provider', () => {
    // @ts-expect-error testing invalid provider on purpose
    expect(() => createSubagent(makeInput({ provider: 'grok' }))).toThrow(SubagentValidationError)
  })

  it('rejects empty name', () => {
    expect(() => createSubagent(makeInput({ name: '' }))).toThrow(SubagentValidationError)
  })

  it('tools_null_means_all', () => {
    const created = createSubagent(makeInput({ tools: null }))
    expect(created.tools).toBeNull()
  })

  it('tools_empty_array_means_none', () => {
    const created = createSubagent(makeInput({ tools: [] }))
    expect(created.tools).toEqual([])
  })

  it('tools allowlist persists', () => {
    const created = createSubagent(makeInput({ tools: ['Read', 'Grep'] }))
    expect(created.tools).toEqual(['Read', 'Grep'])
  })

  it('updates a subagent', () => {
    const created = createSubagent(makeInput())
    const updated = updateSubagent(created.id, { description: 'Nova descrição.' })
    expect(updated.description).toBe('Nova descrição.')
    expect(updated.name).toBe(created.name)
  })

  it('update throws not found for unknown id', () => {
    expect(() => updateSubagent('nope', { description: 'x' })).toThrow(SubagentNotFoundError)
  })

  it('update to duplicate name conflicts', () => {
    createSubagent(makeInput({ name: 'a' }))
    const b = createSubagent(makeInput({ name: 'b' }))
    expect(() => updateSubagent(b.id, { name: 'a' })).toThrow(SubagentNameConflictError)
  })

  it('deletes a subagent', () => {
    const created = createSubagent(makeInput())
    expect(removeSubagent(created.id)).toBe(true)
    expect(getSubagentById(created.id)).toBeUndefined()
  })

  describe('project links', () => {
    it('resolve_excludes_unlinked', () => {
      createSubagent(makeInput())
      expect(resolveSubagentTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve_excludes_disabled_project', () => {
      const s = createSubagent(makeInput())
      upsertProjectSubagentLink('proj-1', s.id, { enabled: false })
      expect(resolveSubagentTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve_excludes_disabled_global', () => {
      const s = createSubagent(makeInput({ enabled: false }))
      upsertProjectSubagentLink('proj-1', s.id, { enabled: true })
      expect(resolveSubagentTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve includes linked + enabled everywhere', () => {
      const s = createSubagent(makeInput())
      upsertProjectSubagentLink('proj-1', s.id, { enabled: true })
      const catalog = resolveSubagentTurnCatalog('proj-1')
      expect(catalog).toHaveLength(1)
      expect(catalog[0].id).toBe(s.id)
    })

    it('listProjectSubagents reports linked flag for all globals', () => {
      const s1 = createSubagent(makeInput({ name: 'a' }))
      const s2 = createSubagent(makeInput({ name: 'b' }))
      upsertProjectSubagentLink('proj-1', s1.id, {})
      const states = listProjectSubagents('proj-1')
      const stateFor = (id: string) => states.find((s) => s.id === id)
      expect(stateFor(s1.id)?.linked).toBe(true)
      expect(stateFor(s2.id)?.linked).toBe(false)
      expect(stateFor(s2.id)?.sortOrder).toBeNull()
    })

    it('upsertProjectLink throws not found for unknown subagent', () => {
      expect(() => upsertProjectSubagentLink('proj-1', 'nope', {})).toThrow(SubagentNotFoundError)
    })

    it('unlinkProject removes the link', () => {
      const s = createSubagent(makeInput())
      upsertProjectSubagentLink('proj-1', s.id, {})
      expect(unlinkProjectSubagent('proj-1', s.id)).toBe(true)
      expect(listProjectSubagents('proj-1').find((x) => x.id === s.id)?.linked).toBe(false)
    })

    it('catalog_order_requires_contiguous', () => {
      const s1 = createSubagent(makeInput({ name: 'a' }))
      const s2 = createSubagent(makeInput({ name: 'b' }))
      upsertProjectSubagentLink('proj-1', s1.id, {})
      upsertProjectSubagentLink('proj-1', s2.id, {})
      expect(() =>
        setSubagentCatalogOrder('proj-1', [
          { id: s1.id, enabled: true, sortOrder: 0 },
          { id: s2.id, enabled: true, sortOrder: 2 },
        ])
      ).toThrow(CatalogOrderError)
    })

    it('setCatalogOrder reorders linked subagents', () => {
      const s1 = createSubagent(makeInput({ name: 'a' }))
      const s2 = createSubagent(makeInput({ name: 'b' }))
      upsertProjectSubagentLink('proj-1', s1.id, {})
      upsertProjectSubagentLink('proj-1', s2.id, {})
      const result = setSubagentCatalogOrder('proj-1', [
        { id: s1.id, enabled: true, sortOrder: 1 },
        { id: s2.id, enabled: true, sortOrder: 0 },
      ])
      const ordered = [...result].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      expect(ordered[0].id).toBe(s2.id)
      expect(ordered[1].id).toBe(s1.id)
    })
  })

  describe('counts', () => {
    it('reports global and per-project counts', () => {
      const s1 = createSubagent(makeInput({ name: 'a' }))
      const s2 = createSubagent(makeInput({ name: 'b' }))
      upsertProjectSubagentLink('proj-1', s1.id, {})
      upsertProjectSubagentLink('proj-1', s2.id, {})
      upsertProjectSubagentLink('proj-2', s1.id, {})
      const counts = getSubagentCounts()
      expect(counts.global).toBe(2)
      expect(counts.linkedByProject['proj-1']).toBe(2)
      expect(counts.linkedByProject['proj-2']).toBe(1)
    })
  })

  describe('runs', () => {
    it('creates and updates a run', () => {
      const run = createSubagentRun({
        childThreadId: 'run-1',
        parentThreadId: 'thread-1',
        subagentName: 'revisor-seguranca',
        provider: 'claude',
        status: 'running',
      })
      expect(run.status).toBe('running')
      expect(run.actionCount).toBe(0)

      const updated = updateSubagentRun('run-1', {
        status: 'completed',
        text: 'done',
        actionCount: 3,
      })
      expect(updated?.status).toBe('completed')
      expect(updated?.text).toBe('done')
      expect(updated?.actionCount).toBe(3)
    })

    it('idle_silence_marks_timeout', () => {
      createSubagentRun({
        childThreadId: 'run-2',
        parentThreadId: 'thread-1',
        subagentName: 'revisor-seguranca',
        provider: 'claude',
        status: 'running',
      })
      const updated = updateSubagentRun('run-2', { status: 'timeout' })
      expect(updated?.status).toBe('timeout')
    })

    it('listRunsForParentThread returns runs in order', () => {
      createSubagentRun({
        childThreadId: 'run-a',
        parentThreadId: 'thread-x',
        subagentName: 'a',
        provider: 'claude',
        status: 'running',
      })
      createSubagentRun({
        childThreadId: 'run-b',
        parentThreadId: 'thread-x',
        subagentName: 'b',
        provider: 'claude',
        status: 'running',
      })
      const runs = listSubagentRunsForParentThread('thread-x')
      expect(runs.map((r) => r.childThreadId)).toEqual(['run-a', 'run-b'])
    })
  })
})
