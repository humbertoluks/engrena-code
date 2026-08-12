import { describe, expect, it } from 'vitest'
import { isIgnored, parseIgnoreFile } from './ignore-matcher.js'

function rules(content: string) {
  return parseIgnoreFile(content)
}

describe('parseIgnoreFile', () => {
  it('ignora linha vazia e comentário', () => {
    expect(rules('\n# comentário\n\n')).toHaveLength(0)
  })

  it('marca negação e diretório', () => {
    const parsed = rules('build/\n!build/keep.txt')
    expect(parsed[0].directoryOnly).toBe(true)
    expect(parsed[1].negated).toBe(true)
  })
})

describe('isIgnored', () => {
  it('casa nome solto em qualquer profundidade', () => {
    const r = rules('.env')
    expect(isIgnored(r, '.env')).toBe(true)
    expect(isIgnored(r, 'config/.env')).toBe(true)
    expect(isIgnored(r, 'config/env.ts')).toBe(false)
  })

  it('casa curinga por extensão', () => {
    const r = rules('*.pem')
    expect(isIgnored(r, 'certs/server.pem')).toBe(true)
    expect(isIgnored(r, 'certs/server.pem.txt')).toBe(false)
  })

  it('casa diretório inteiro', () => {
    const r = rules('secrets/')
    expect(isIgnored(r, 'secrets/api.json')).toBe(true)
    expect(isIgnored(r, 'src/secrets/api.json')).toBe(true)
    expect(isIgnored(r, 'src/app.ts')).toBe(false)
  })

  it('respeita âncora na raiz', () => {
    const r = rules('/dist')
    expect(isIgnored(r, 'dist/app.js')).toBe(true)
    expect(isIgnored(r, 'packages/dist/app.js')).toBe(false)
  })

  it('atravessa segmentos com **', () => {
    const r = rules('**/fixtures/*.json')
    expect(isIgnored(r, 'test/fixtures/a.json')).toBe(true)
    expect(isIgnored(r, 'a/b/fixtures/c.json')).toBe(true)
    expect(isIgnored(r, 'fixtures/a.json')).toBe(true)
    expect(isIgnored(r, 'test/fixtures/nested/a.json')).toBe(false)
  })

  it('último padrão que casa vence (negação reabre)', () => {
    const r = rules('docs/\n!docs/public.md')
    expect(isIgnored(r, 'docs/interno.md')).toBe(true)
    expect(isIgnored(r, 'docs/public.md')).toBe(false)
  })

  it('normaliza separador do Windows e prefixo ./', () => {
    const r = rules('secrets/')
    const backslash = String.fromCharCode(92)
    expect(isIgnored(r, `secrets${backslash}api.json`)).toBe(true)
    expect(isIgnored(r, './secrets/api.json')).toBe(true)
  })

  it('sem regras nada é excluído', () => {
    expect(isIgnored([], 'qualquer/coisa.ts')).toBe(false)
  })
})
