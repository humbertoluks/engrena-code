import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f19_store_'))

const { loadMeta, loadIndex, saveIndexAndMeta, getStatusPayload, isTtlExpired, needsRebuild, CODEGRAPH_TTL_HOURS } =
  await import('./store.js')

const userData = process.env.ENGRENACODE_USER_DATA as string

beforeEach(() => {
  // wipe codegraph dir between tests
  const cg = join(userData, 'codegraph')
  if (existsSync(cg)) rmSync(cg, { recursive: true, force: true })
})

afterEach(() => {
  /* keep userData for suite */
})

describe('codegraph store', () => {
  it('returns missing status when no meta', () => {
    const status = getStatusPayload('proj-1', '/tmp/root')
    expect(status.status).toBe('missing')
    expect(status.indexedAt).toBeNull()
  })

  it('persists index and meta atomically', () => {
    saveIndexAndMeta(
      'proj-1',
      { version: 1, files: {}, symbols: {} },
      {
        projectId: 'proj-1',
        root: '/tmp/root',
        indexedAt: 1_700_000_000_000,
        status: 'indexed',
        fileCount: 0,
        symbolCount: 0,
        ttlHours: CODEGRAPH_TTL_HOURS,
      },
    )
    expect(loadMeta('proj-1')?.status).toBe('indexed')
    expect(loadIndex('proj-1')?.version).toBe(1)
    expect(getStatusPayload('proj-1').status).toBe('indexed')
  })

  it('test_ttl_expired_triggers_rebuild flag via isTtlExpired', () => {
    const meta = {
      projectId: 'proj-1',
      root: '/tmp',
      indexedAt: Date.now() - (CODEGRAPH_TTL_HOURS + 1) * 3_600_000,
      status: 'indexed' as const,
      fileCount: 1,
      symbolCount: 1,
      ttlHours: CODEGRAPH_TTL_HOURS,
    }
    expect(isTtlExpired(meta)).toBe(true)
    saveIndexAndMeta('proj-1', { version: 1, files: {}, symbols: {} }, meta)
    expect(needsRebuild('proj-1')).toBe(true)
  })
})

// Cleanup suite userdata after all — vitest afterAll
import { afterAll } from 'vitest'
afterAll(() => {
  rmSync(userData, { recursive: true, force: true })
})
