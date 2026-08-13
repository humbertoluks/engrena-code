import { describe, expect, it } from 'vitest'
import { describe, expect, it } from 'vitest'
import {
  normalizeCodeLanguage,
  parseMarkdownCodeLanguage,
  resolveHighlightLanguage,
  selectMarkdownRenderPath,
} from './chatMarkdown.logic'

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
    expect(normalizeCodeLanguage('c++')).toBe('cpp')
    expect(normalizeCodeLanguage('c#')).toBe('csharp')
  })
})

describe('resolveHighlightLanguage', () => {
  it('keeps bundled langs and maps unknown grammars to text', () => {
    expect(resolveHighlightLanguage('ts')).toBe('typescript')
    expect(resolveHighlightLanguage('c++')).toBe('cpp')
    expect(resolveHighlightLanguage('emacs-lisp')).toBe('text')
    expect(resolveHighlightLanguage('wolfram')).toBe('text')
    expect(resolveHighlightLanguage(null)).toBe('text')
  })
})

describe('selectMarkdownRenderPath', () => {
  it('uses light path while streaming and full when settled', () => {
    expect(selectMarkdownRenderPath(true)).toBe('light')
    expect(selectMarkdownRenderPath(false)).toBe('full')
  })
})

