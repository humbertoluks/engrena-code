import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearIgnoreCache, filterIgnoredPaths, isPathIgnored } from './ignore-service.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'engrenacode_claude_ignore_'))
  clearIgnoreCache()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('ignore-service', () => {
  it('sem .engrenaignore nada é excluído', () => {
    expect(isPathIgnored(root, '.env')).toBe(false)
    expect(filterIgnoredPaths(root, ['a.ts', '.env'])).toEqual(['a.ts', '.env'])
  })

  it('aplica as regras do arquivo do projeto', () => {
    writeFileSync(join(root, '.engrenaignore'), '.env\nsecrets/\n')
    expect(isPathIgnored(root, '.env')).toBe(true)
    expect(isPathIgnored(root, 'secrets/api.json')).toBe(true)
    expect(isPathIgnored(root, 'src/app.ts')).toBe(false)
    expect(filterIgnoredPaths(root, ['src/app.ts', '.env', 'secrets/api.json'])).toEqual(['src/app.ts'])
  })

  it('recarrega quando o arquivo muda', () => {
    writeFileSync(join(root, '.engrenaignore'), 'a.ts\n')
    expect(isPathIgnored(root, 'a.ts')).toBe(true)

    clearIgnoreCache()
    writeFileSync(join(root, '.engrenaignore'), 'b.ts\n')
    expect(isPathIgnored(root, 'a.ts')).toBe(false)
    expect(isPathIgnored(root, 'b.ts')).toBe(true)
  })

  it('arquivo vazio ou só com comentário não exclui nada', () => {
    writeFileSync(join(root, '.engrenaignore'), '# só comentário\n\n')
    expect(isPathIgnored(root, 'qualquer.ts')).toBe(false)
  })
})
