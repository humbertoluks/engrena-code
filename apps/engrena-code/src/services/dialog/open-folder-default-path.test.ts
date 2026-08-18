import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  expandHomePath,
  parseOpenFolderDefaultPath,
  resolveOpenFolderDefaultPath,
} from './open-folder-default-path.js'

const posix = {
  join: path.posix.join,
  dirname: path.posix.dirname,
}

const win32 = {
  join: path.win32.join,
  dirname: path.win32.dirname,
}

describe('parseOpenFolderDefaultPath', () => {
  it('accepts a trimmed object payload from preload', () => {
    expect(parseOpenFolderDefaultPath({ defaultPath: '  ~/dev  ' })).toBe('~/dev')
  })

  it('accepts a bare string', () => {
    expect(parseOpenFolderDefaultPath('C:\\Users\\Me\\Code')).toBe('C:\\Users\\Me\\Code')
  })

  it('rejects empty, oversized, and non-string payloads', () => {
    expect(parseOpenFolderDefaultPath(undefined)).toBeUndefined()
    expect(parseOpenFolderDefaultPath(null)).toBeUndefined()
    expect(parseOpenFolderDefaultPath({})).toBeUndefined()
    expect(parseOpenFolderDefaultPath({ defaultPath: 12 })).toBeUndefined()
    expect(parseOpenFolderDefaultPath('   ')).toBeUndefined()
    expect(parseOpenFolderDefaultPath({ defaultPath: 'a'.repeat(4097) })).toBeUndefined()
  })
})

describe('expandHomePath', () => {
  it('expands ~ and ~/ on posix', () => {
    expect(expandHomePath('~', '/home/me', posix.join)).toBe('/home/me')
    expect(expandHomePath('~/dev', '/home/me', posix.join)).toBe('/home/me/dev')
  })

  it('expands ~\\ on win32', () => {
    expect(expandHomePath('~\\dev', 'C:\\Users\\Me', win32.join)).toBe('C:\\Users\\Me\\dev')
  })

  it('leaves ~user and absolute paths untouched', () => {
    expect(expandHomePath('~other/dev', '/home/me', posix.join)).toBe('~other/dev')
    expect(expandHomePath('/opt/repos', '/home/me', posix.join)).toBe('/opt/repos')
  })
})

describe('resolveOpenFolderDefaultPath', () => {
  it('returns the expanded directory when it exists', () => {
    const exists = new Set(['/home/me', '/home/me/dev'])
    expect(
      resolveOpenFolderDefaultPath(
        { defaultPath: '~/dev' },
        { homedir: '/home/me', existsDir: (p) => exists.has(p), ...posix },
      ),
    ).toBe('/home/me/dev')
  })

  it('walks up to the nearest existing ancestor', () => {
    const exists = new Set(['C:\\Users\\Me'])
    expect(
      resolveOpenFolderDefaultPath(
        { defaultPath: 'C:\\Users\\Me\\Code\\missing-repo' },
        { homedir: 'C:\\Users\\Me', existsDir: (p) => exists.has(p), ...win32 },
      ),
    ).toBe('C:\\Users\\Me')
  })

  it('returns undefined when nothing on the chain exists', () => {
    expect(
      resolveOpenFolderDefaultPath('/nope', {
        homedir: '/home/me',
        existsDir: () => false,
        ...posix,
      }),
    ).toBeUndefined()
  })
})
