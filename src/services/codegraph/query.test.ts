import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphIndex } from './store.js'

const loadIndexMock = vi.fn<(projectId: string) => CodegraphIndex | null>()
const existsSyncMock = vi.fn<(path: string) => boolean>()
const readFileSyncMock = vi.fn<(path: string, enc: string) => string>()

vi.mock('./store.js', () => ({
  loadIndex: (projectId: string) => loadIndexMock(projectId),
}))

vi.mock('fs', () => ({
  existsSync: (path: string) => existsSyncMock(path),
  readFileSync: (path: string, enc: string) => readFileSyncMock(path, enc),
}))

const {
  findDefinition,
  findReferences,
  moduleDeps,
  findDefinitionForProject,
  findReferencesForProject,
  moduleDepsForProject,
  readIndexFile,
} = await import('./query.js')

function makeIndex(): CodegraphIndex {
  return {
    version: 1,
    files: {
      'src/foo.ts': { language: 'ts', mtimeMs: 0, symbols: [], imports: ['./bar.ts'] },
      'src/bar.ts': { language: 'ts', mtimeMs: 0, symbols: [], imports: [] },
    },
    symbols: {
      doThing: [
        { file: 'src/foo.ts', line: 3, kind: 'definition', symbolKind: 'function' },
        { file: 'src/bar.ts', line: 10, kind: 'reference' },
      ],
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('findDefinition', () => {
  it('finds a definition hit for a known symbol', () => {
    const { hits, text } = findDefinition(makeIndex(), 'doThing')
    expect(hits).toEqual([{ file: 'src/foo.ts', line: 3, kind: 'function', snippet: undefined }])
    expect(text).toContain('src/foo.ts:3')
  })

  it('returns an empty result and a "not found" message for an unknown symbol', () => {
    const { hits, text } = findDefinition(makeIndex(), 'unknownSymbol')
    expect(hits).toEqual([])
    expect(text).toContain('not found')
  })
})

describe('findReferences', () => {
  it('finds a reference hit for a known symbol', () => {
    const { hits } = findReferences(makeIndex(), 'doThing')
    expect(hits).toEqual([{ file: 'src/bar.ts', line: 10, kind: 'reference' }])
  })

  it('returns an empty result for an unknown symbol', () => {
    const { hits, text } = findReferences(makeIndex(), 'unknownSymbol')
    expect(hits).toEqual([])
    expect(text).toContain('No references found')
  })
})

describe('moduleDeps', () => {
  it('reports imports and importedBy for a known file', () => {
    const { deps } = moduleDeps(makeIndex(), 'src/bar.ts')
    expect(deps.imports).toEqual([])
    expect(deps.importedBy).toContain('src/foo.ts')
  })

  it('reports empty deps for an unknown file', () => {
    const { deps } = moduleDeps(makeIndex(), 'src/missing.ts')
    expect(deps).toEqual({ imports: [], importedBy: [] })
  })
})

describe('*ForProject wrappers', () => {
  it('findDefinitionForProject delegates to loadIndex and findDefinition', () => {
    loadIndexMock.mockReturnValueOnce(makeIndex())
    const { hits } = findDefinitionForProject('proj_1', 'doThing')
    expect(loadIndexMock).toHaveBeenCalledWith('proj_1')
    expect(hits).toHaveLength(1)
  })

  it('findDefinitionForProject returns an "index missing" result when loadIndex returns null', () => {
    loadIndexMock.mockReturnValueOnce(null)
    const { hits, text } = findDefinitionForProject('proj_1', 'doThing')
    expect(hits).toEqual([])
    expect(text).toContain('index missing')
  })

  it('findReferencesForProject returns an "index missing" result when loadIndex returns null', () => {
    loadIndexMock.mockReturnValueOnce(null)
    const { hits, text } = findReferencesForProject('proj_1', 'doThing')
    expect(hits).toEqual([])
    expect(text).toContain('index missing')
  })

  it('moduleDepsForProject returns empty deps when loadIndex returns null', () => {
    loadIndexMock.mockReturnValueOnce(null)
    const { deps, text } = moduleDepsForProject('proj_1', 'src/foo.ts')
    expect(deps).toEqual({ imports: [], importedBy: [] })
    expect(text).toContain('index missing')
  })
})

describe('readIndexFile', () => {
  it('returns null when the file does not exist', () => {
    existsSyncMock.mockReturnValueOnce(false)
    expect(readIndexFile('/nope/index.json')).toBeNull()
  })

  it('returns null for malformed JSON instead of throwing', () => {
    existsSyncMock.mockReturnValueOnce(true)
    readFileSyncMock.mockReturnValueOnce('{not valid json')
    expect(readIndexFile('/repo/index.json')).toBeNull()
  })

  it('parses and returns a valid index file', () => {
    const index = makeIndex()
    existsSyncMock.mockReturnValueOnce(true)
    readFileSyncMock.mockReturnValueOnce(JSON.stringify(index))
    expect(readIndexFile('/repo/index.json')).toEqual(index)
  })
})
