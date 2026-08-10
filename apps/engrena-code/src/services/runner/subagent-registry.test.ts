import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_subagent_registry_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createSubagent, upsertProjectSubagentLink } = await import('../db/repositories/subagents.js')
const { buildSubagentCatalogByName, findCatalogSubagent, resolveSubagentCatalog } = await import(
  './subagent-registry.js'
)

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
  beforeEach(() => {
    getDb().exec('DELETE FROM project_subagents')
    getDb().exec('DELETE FROM subagents')
  })

  afterAll(() => {
    closeDb()
    rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  })

  it('excludes unlinked subagents from the turn catalog', () => {
    createSubagent(makeInput())
    expect(resolveSubagentCatalog('proj-1')).toEqual([])
  })

  it('excludes subagents disabled at the project link level', () => {
    const s = createSubagent(makeInput())
    upsertProjectSubagentLink('proj-1', s.id, { enabled: false })
    expect(resolveSubagentCatalog('proj-1')).toEqual([])
  })

  it('excludes subagents disabled globally even if linked+enabled', () => {
    const s = createSubagent(makeInput({ enabled: false }))
    upsertProjectSubagentLink('proj-1', s.id, { enabled: true })
    expect(resolveSubagentCatalog('proj-1')).toEqual([])
  })

  it('includes linked + enabled everywhere', () => {
    const s = createSubagent(makeInput())
    upsertProjectSubagentLink('proj-1', s.id, { enabled: true })
    const catalog = resolveSubagentCatalog('proj-1')
    expect(catalog.map((c) => c.id)).toEqual([s.id])
  })

  it('buildSubagentCatalogByName indexes by name', () => {
    const s = createSubagent(makeInput())
    upsertProjectSubagentLink('proj-1', s.id, { enabled: true })
    const byName = buildSubagentCatalogByName('proj-1')
    expect(byName.get('revisor-seguranca')?.id).toBe(s.id)
  })

  it('findCatalogSubagent returns undefined for a name outside the catalog', () => {
    expect(findCatalogSubagent('proj-1', 'ghost')).toBeUndefined()
  })
})
