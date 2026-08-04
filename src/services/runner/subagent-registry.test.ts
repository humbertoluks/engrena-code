import { beforeEach, describe, expect, it } from 'vitest'
import { openDb } from '../db/client.js'
import { createSubagentsRepository, type SubagentsRepository } from '../db/repositories/subagents.js'
import { buildSubagentCatalogByName, findCatalogSubagent, resolveSubagentCatalog } from './subagent-registry.js'

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'revisor-seguranca',
    description: 'Revisa diffs em busca de vulnerabilidades.',
    prompt: 'Você é um revisor de segurança.',
    provider: 'claude' as const,
    ...overrides,
  }
}

describe('subagent-registry', () => {
  let repo: SubagentsRepository

  beforeEach(() => {
    repo = createSubagentsRepository(openDb(':memory:'))
  })

  it('excludes unlinked subagents from the turn catalog', () => {
    repo.create(makeInput())
    expect(resolveSubagentCatalog(repo, 'proj-1')).toEqual([])
  })

  it('excludes subagents disabled at the project link level', () => {
    const s = repo.create(makeInput())
    repo.upsertProjectLink('proj-1', s.id, { enabled: false })
    expect(resolveSubagentCatalog(repo, 'proj-1')).toEqual([])
  })

  it('excludes subagents disabled globally even if linked+enabled', () => {
    const s = repo.create(makeInput({ enabled: false }))
    repo.upsertProjectLink('proj-1', s.id, { enabled: true })
    expect(resolveSubagentCatalog(repo, 'proj-1')).toEqual([])
  })

  it('includes linked + enabled everywhere', () => {
    const s = repo.create(makeInput())
    repo.upsertProjectLink('proj-1', s.id, { enabled: true })
    const catalog = resolveSubagentCatalog(repo, 'proj-1')
    expect(catalog.map((c) => c.id)).toEqual([s.id])
  })

  it('buildSubagentCatalogByName indexes by name', () => {
    const s = repo.create(makeInput())
    repo.upsertProjectLink('proj-1', s.id, { enabled: true })
    const byName = buildSubagentCatalogByName(repo, 'proj-1')
    expect(byName.get('revisor-seguranca')?.id).toBe(s.id)
  })

  it('findCatalogSubagent returns undefined for a name outside the catalog', () => {
    expect(findCatalogSubagent(repo, 'proj-1', 'ghost')).toBeUndefined()
  })
})
