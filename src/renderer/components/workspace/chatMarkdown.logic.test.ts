import { describe, expect, it } from 'vitest'
import { normalizeCodeLanguage, parseMarkdownCodeLanguage } from './chatMarkdown.logic'

describe('parseMarkdownCodeLanguage', () => {
  it('reads language-* from className', () => {
    expect(parseMarkdownCodeLanguage(undefined)).toBeNull()
    expect(parseMarkdownCodeLanguage('')).toBeNull()
    expect(parseMarkdownCodeLanguage('language-ts')).toBe('ts')
    expect(parseMarkdownCodeLanguage('foo language-python bar')).toBe('python')
    expect(parseMarkdownCodeLanguage('language-c++')).toBe('c++')
  })
})

describe('normalizeCodeLanguage', () => {
  it('maps common aliases and defaults empty to text', () => {
    expect(normalizeCodeLanguage(null)).toBe('text')
    expect(normalizeCodeLanguage('js')).toBe('javascript')
    expect(normalizeCodeLanguage('TS')).toBe('typescript')
    expect(normalizeCodeLanguage('rust')).toBe('rust')
  })
})
