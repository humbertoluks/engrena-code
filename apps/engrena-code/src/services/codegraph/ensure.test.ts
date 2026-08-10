import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphStatusPayload } from './store.js'

const needsRebuildMock = vi.fn<(projectId: string) => boolean>()
const getStatusPayloadMock = vi.fn<(projectId: string, root: string) => CodegraphStatusPayload>()
const indexPathMock = vi.fn<(projectId: string) => string>()
const buildIndexMock = vi.fn()

vi.mock('./store.js', () => ({
  needsRebuild: (projectId: string) => needsRebuildMock(projectId),
  getStatusPayload: (projectId: string, root: string) => getStatusPayloadMock(projectId, root),
  indexPath: (projectId: string) => indexPathMock(projectId),
}))

vi.mock('./indexer.js', () => ({
  buildIndex: (...args: unknown[]) => buildIndexMock(...args),
}))

const { ensureIndexForTurn } = await import('./ensure.js')

function makeStatus(overrides: Partial<CodegraphStatusPayload> = {}): CodegraphStatusPayload {
  return {
    status: 'indexed',
    indexedAt: 1000,
    ageHours: 0,
    fileCount: 3,
    symbolCount: 10,
    root: '/repo/project',
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ensureIndexForTurn', () => {
  it('does not rebuild when needsRebuild is false, and returns the existing index path', () => {
    needsRebuildMock.mockReturnValue(false)
    getStatusPayloadMock.mockReturnValue(makeStatus())
    indexPathMock.mockReturnValue('/userData/codegraph/proj_1/index.json')

    const result = ensureIndexForTurn('proj_1', '/repo/project')

    expect(buildIndexMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      indexPath: '/userData/codegraph/proj_1/index.json',
      status: makeStatus(),
      rebuilt: false,
    })
  })

  it('rebuilds when needsRebuild is true and reports rebuilt:true', () => {
    needsRebuildMock.mockReturnValue(true)
    getStatusPayloadMock.mockReturnValue(makeStatus())
    indexPathMock.mockReturnValue('/userData/codegraph/proj_1/index.json')

    const result = ensureIndexForTurn('proj_1', '/repo/project')

    expect(buildIndexMock).toHaveBeenCalledWith('proj_1', '/repo/project')
    expect(result.rebuilt).toBe(true)
  })

  it('returns indexPath:null when the status is missing, even without rebuilding', () => {
    needsRebuildMock.mockReturnValue(false)
    getStatusPayloadMock.mockReturnValue(makeStatus({ status: 'missing' }))
    indexPathMock.mockReturnValue('/userData/codegraph/proj_1/index.json')

    const result = ensureIndexForTurn('proj_1', '/repo/project')

    expect(result.indexPath).toBeNull()
  })

  it('degrades without throwing when buildIndex fails, still returning a status payload', () => {
    needsRebuildMock.mockReturnValue(true)
    buildIndexMock.mockImplementation(() => {
      throw new Error('disk full')
    })
    getStatusPayloadMock.mockReturnValue(makeStatus({ status: 'missing' }))

    const result = ensureIndexForTurn('proj_1', '/repo/project')

    expect(result).toEqual({ indexPath: null, status: makeStatus({ status: 'missing' }), rebuilt: false })
  })
})
