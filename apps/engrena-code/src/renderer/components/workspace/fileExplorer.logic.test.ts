import { describe, expect, it } from 'vitest'
import {
  buildFileTree,
  changedAncestorDirs,
  filterProjectFilePaths,
  sortedFileTreeDirs,
  sortedFileTreeFiles,
} from './fileExplorer.logic'

describe('buildFileTree', () => {
  it('nests directories and keeps files at the leaf', () => {
    const tree = buildFileTree(['src/a.ts', 'src/b/c.ts', 'README.md'])
    expect(sortedFileTreeFiles(tree).map((f) => f.path)).toEqual(['README.md'])
    const src = sortedFileTreeDirs(tree)[0]
    expect(src.name).toBe('src')
    expect(sortedFileTreeFiles(src).map((f) => f.name)).toEqual(['a.ts'])
    expect(sortedFileTreeDirs(src)[0].path).toBe('src/b')
  })
})

describe('changedAncestorDirs', () => {
  it('marks every ancestor folder of a changed file', () => {
    expect([...changedAncestorDirs(['src/renderer/App.tsx'])].sort()).toEqual([
      'src',
      'src/renderer',
    ])
  })
})

describe('filterProjectFilePaths', () => {
  it('returns null when needle is empty', () => {
    expect(filterProjectFilePaths(['a.ts'], '  ')).toBeNull()
  })

  it('filters case-insensitively and caps results', () => {
    expect(filterProjectFilePaths(['App.tsx', 'other.ts'], 'app')).toEqual(['App.tsx'])
    expect(filterProjectFilePaths(['a', 'b', 'c'], ' ', 2)).toBeNull()
    expect(filterProjectFilePaths(['aa', 'ab', 'ac'], 'a', 2)).toEqual(['aa', 'ab'])
  })
})
