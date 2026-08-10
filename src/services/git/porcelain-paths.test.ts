import { describe, expect, it } from 'vitest'
import { parseDirtyPathsFromPorcelain } from './porcelain-paths.js'

describe('parseDirtyPathsFromPorcelain', () => {
  it('parses modified and untracked files', () => {
    expect(parseDirtyPathsFromPorcelain(' M src/App.tsx\n?? notes.md\n')).toEqual([
      'src/App.tsx',
      'notes.md',
    ])
  })

  it('uses the destination path for renames', () => {
    expect(parseDirtyPathsFromPorcelain('R  old.ts -> new.ts\n')).toEqual(['new.ts'])
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(parseDirtyPathsFromPorcelain(' M src\\App.tsx\n')).toEqual(['src/App.tsx'])
  })

  it('returns empty for blank status', () => {
    expect(parseDirtyPathsFromPorcelain('')).toEqual([])
    expect(parseDirtyPathsFromPorcelain('\n')).toEqual([])
  })
})
