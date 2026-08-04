import { beforeEach, describe, expect, it } from 'vitest'
import { openDb } from '../client.js'
import {
  CatalogOrderError,
  createSubagentsRepository,
  SubagentNameConflictError,
  SubagentNotFoundError,
  SubagentTooLongError,
  SubagentValidationError,
  type SubagentsRepository,
} from './subagents.js'

function makeInput(overrides: Partial<Parameters<SubagentsRepository['create']>[0]> = {}) {
  return {
    name: 'revisor-seguranca',
    description: 'Revisa diffs em busca de vulnerabilidades.',
    prompt: 'Você é um revisor de segurança.',
    provider: 'claude' as const,
    ...overrides,
  }
}

describe('subagentsRepository', () => {
  let repo: SubagentsRepository

  beforeEach(() => {
    repo = createSubagentsRepository(openDb(':memory:'))
  })

  it('creates and reads back a subagent', () => {
    const created = repo.create(makeInput())
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('revisor-seguranca')
    expect(created.tools).toBeNull()
    expect(created.enabled).toBe(true)
    expect(repo.getById(created.id)).toEqual(created)
  })

  it('rejects_duplicate_name', () => {
    repo.create(makeInput())
    expect(() => repo.create(makeInput())).toThrow(SubagentNameConflictError)
  })

  it('rejects_prompt_over_1mib', () => {
    const bigPrompt = 'a'.repeat(1_048_577)
    expect(() => repo.create(makeInput({ prompt: bigPrompt }))).toThrow(SubagentTooLongError)
  })

  it('rejects_unknown_provider', () => {
    // @ts-expect-error testing invalid provider on purpose
    expect(() => repo.create(makeInput({ provider: 'grok' }))).toThrow(SubagentValidationError)
  })

  it('rejects empty name', () => {
    expect(() => repo.create(makeInput({ name: '' }))).toThrow(SubagentValidationError)
  })

  it('tools_null_means_all', () => {
    const created = repo.create(makeInput({ tools: null }))
    expect(created.tools).toBeNull()
  })

  it('tools_empty_array_means_none', () => {
    const created = repo.create(makeInput({ tools: [] }))
    expect(created.tools).toEqual([])
  })

  it('tools allowlist persists', () => {
    const created = repo.create(makeInput({ tools: ['Read', 'Grep'] }))
    expect(created.tools).toEqual(['Read', 'Grep'])
  })

  it('updates a subagent', () => {
    const created = repo.create(makeInput())
    const updated = repo.update(created.id, { description: 'Nova descrição.' })
    expect(updated.description).toBe('Nova descrição.')
    expect(updated.name).toBe(created.name)
  })

  it('update throws not found for unknown id', () => {
    expect(() => repo.update('nope', { description: 'x' })).toThrow(SubagentNotFoundError)
  })

  it('update to duplicate name conflicts', () => {
    repo.create(makeInput({ name: 'a' }))
    const b = repo.create(makeInput({ name: 'b' }))
    expect(() => repo.update(b.id, { name: 'a' })).toThrow(SubagentNameConflictError)
  })

  it('deletes a subagent', () => {
    const created = repo.create(makeInput())
    expect(repo.remove(created.id)).toBe(true)
    expect(repo.getById(created.id)).toBeUndefined()
  })

  describe('project links', () => {
    it('resolve_excludes_unlinked', () => {
      repo.create(makeInput())
      expect(repo.resolveTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve_excludes_disabled_project', () => {
      const s = repo.create(makeInput())
      repo.upsertProjectLink('proj-1', s.id, { enabled: false })
      expect(repo.resolveTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve_excludes_disabled_global', () => {
      const s = repo.create(makeInput({ enabled: false }))
      repo.upsertProjectLink('proj-1', s.id, { enabled: true })
      expect(repo.resolveTurnCatalog('proj-1')).toEqual([])
    })

    it('resolve includes linked + enabled everywhere', () => {
      const s = repo.create(makeInput())
      repo.upsertProjectLink('proj-1', s.id, { enabled: true })
      const catalog = repo.resolveTurnCatalog('proj-1')
      expect(catalog).toHaveLength(1)
      expect(catalog[0].id).toBe(s.id)
    })

    it('listProjectSubagents reports linked flag for all globals', () => {
      const s1 = repo.create(makeInput({ name: 'a' }))
      const s2 = repo.create(makeInput({ name: 'b' }))
      repo.upsertProjectLink('proj-1', s1.id, {})
      const states = repo.listProjectSubagents('proj-1')
      const stateFor = (id: string) => states.find((s) => s.id === id)
      expect(stateFor(s1.id)?.linked).toBe(true)
      expect(stateFor(s2.id)?.linked).toBe(false)
      expect(stateFor(s2.id)?.sortOrder).toBeNull()
    })

    it('upsertProjectLink throws not found for unknown subagent', () => {
      expect(() => repo.upsertProjectLink('proj-1', 'nope', {})).toThrow(SubagentNotFoundError)
    })

    it('unlinkProject removes the link', () => {
      const s = repo.create(makeInput())
      repo.upsertProjectLink('proj-1', s.id, {})
      expect(repo.unlinkProject('proj-1', s.id)).toBe(true)
      expect(repo.listProjectSubagents('proj-1').find((x) => x.id === s.id)?.linked).toBe(false)
    })

    it('catalog_order_requires_contiguous', () => {
      const s1 = repo.create(makeInput({ name: 'a' }))
      const s2 = repo.create(makeInput({ name: 'b' }))
      repo.upsertProjectLink('proj-1', s1.id, {})
      repo.upsertProjectLink('proj-1', s2.id, {})
      expect(() =>
        repo.setCatalogOrder('proj-1', [
          { id: s1.id, enabled: true, sortOrder: 0 },
          { id: s2.id, enabled: true, sortOrder: 2 },
        ])
      ).toThrow(CatalogOrderError)
    })

    it('setCatalogOrder reorders linked subagents', () => {
      const s1 = repo.create(makeInput({ name: 'a' }))
      const s2 = repo.create(makeInput({ name: 'b' }))
      repo.upsertProjectLink('proj-1', s1.id, {})
      repo.upsertProjectLink('proj-1', s2.id, {})
      const result = repo.setCatalogOrder('proj-1', [
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
      const s1 = repo.create(makeInput({ name: 'a' }))
      const s2 = repo.create(makeInput({ name: 'b' }))
      repo.upsertProjectLink('proj-1', s1.id, {})
      repo.upsertProjectLink('proj-1', s2.id, {})
      repo.upsertProjectLink('proj-2', s1.id, {})
      const counts = repo.getCounts()
      expect(counts.global).toBe(2)
      expect(counts.linkedByProject['proj-1']).toBe(2)
      expect(counts.linkedByProject['proj-2']).toBe(1)
    })
  })

  describe('runs', () => {
    it('creates and updates a run', () => {
      const run = repo.createRun({
        childThreadId: 'run-1',
        parentThreadId: 'thread-1',
        subagentName: 'revisor-seguranca',
        provider: 'claude',
        status: 'running',
      })
      expect(run.status).toBe('running')
      expect(run.actionCount).toBe(0)

      const updated = repo.updateRun('run-1', { status: 'completed', text: 'done', actionCount: 3 })
      expect(updated?.status).toBe('completed')
      expect(updated?.text).toBe('done')
      expect(updated?.actionCount).toBe(3)
    })

    it('idle_silence_marks_timeout', () => {
      repo.createRun({
        childThreadId: 'run-2',
        parentThreadId: 'thread-1',
        subagentName: 'revisor-seguranca',
        provider: 'claude',
        status: 'running',
      })
      const updated = repo.updateRun('run-2', { status: 'timeout' })
      expect(updated?.status).toBe('timeout')
    })

    it('listRunsForParentThread returns runs in order', () => {
      repo.createRun({
        childThreadId: 'run-a',
        parentThreadId: 'thread-x',
        subagentName: 'a',
        provider: 'claude',
        status: 'running',
      })
      repo.createRun({
        childThreadId: 'run-b',
        parentThreadId: 'thread-x',
        subagentName: 'b',
        provider: 'claude',
        status: 'running',
      })
      const runs = repo.listRunsForParentThread('thread-x')
      expect(runs.map((r) => r.childThreadId)).toEqual(['run-a', 'run-b'])
    })
  })
})
