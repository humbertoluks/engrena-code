import { describe, expect, it } from 'vitest'
import {
  MENTION_RESULTS_LIMIT,
  canAddMoreImages,
  clampCatalogModel,
  clampCatalogReasoningLevel,
  extractMentionQuery,
  insertMentionPath,
  isAllowedImageMimeType,
  validateImageFile,
} from './composer.logic'

describe('test_extract_mention_query_debounce_contract', () => {
  it('extracts the query after the last @ under the cursor', () => {
    expect(extractMentionQuery('veja @src/App', 14)).toEqual({ query: 'src/App', start: 5 })
  })

  it('returns null when there is no @ before the cursor', () => {
    expect(extractMentionQuery('sem mention aqui', 5)).toBeNull()
  })

  it('returns null when whitespace breaks the @token', () => {
    expect(extractMentionQuery('email fulano@example.com depois', 15)).not.toBeNull()
    expect(extractMentionQuery('@foo bar', 8)).toBeNull()
  })

  it('exposes a stable results limit of 50', () => {
    expect(MENTION_RESULTS_LIMIT).toBe(50)
  })
})

describe('insertMentionPath', () => {
  it('replaces the @token with the chosen relative path plus a trailing space', () => {
    const result = insertMentionPath('veja @src/A', { query: 'src/A', start: 5 }, 'src/renderer/App.tsx', 11)
    expect(result.text).toBe('veja @src/renderer/App.tsx ')
    expect(result.cursor).toBe(result.text.length)
  })

  it('preserves text after the cursor', () => {
    const result = insertMentionPath('veja @src depois', { query: 'src', start: 5 }, 'src/App.tsx', 9)
    expect(result.text).toBe('veja @src/App.tsx  depois')
  })
})

describe('clampCatalogModel / clampCatalogReasoningLevel', () => {
  it('keeps the model when it is a catalog member', () => {
    expect(clampCatalogModel(['a', 'b'], 'a', 'b')).toBe('b')
  })

  it('falls back to the default when the model is unknown or null', () => {
    expect(clampCatalogModel(['a', 'b'], 'a', 'nope')).toBe('a')
    expect(clampCatalogModel(['a', 'b'], 'a', null)).toBe('a')
  })

  it('keeps the reasoning level when valid, falls back to default otherwise', () => {
    expect(clampCatalogReasoningLevel(['low', 'high'], null, 'high')).toBe('high')
    expect(clampCatalogReasoningLevel(['low', 'high'], 'low', 'unknown')).toBe('low')
    expect(clampCatalogReasoningLevel([], null, 'high')).toBeNull()
  })
})

describe('test_validate_composer_images (client rules)', () => {
  it('accepts an allowed mime type within the size limit', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024, name: 'a.png' })).toEqual({ ok: true })
  })

  it('rejects a disallowed mime type', () => {
    const result = validateImageFile({ type: 'application/pdf', size: 10, name: 'doc.pdf' })
    expect(result).toMatchObject({ ok: false, code: 'type' })
  })

  it('rejects a file over the 4 MiB limit', () => {
    const result = validateImageFile({ type: 'image/png', size: 5 * 1024 * 1024, name: 'big.png' })
    expect(result).toMatchObject({ ok: false, code: 'size' })
  })
})

describe('canAddMoreImages', () => {
  it('allows adding up to the 5-image cap', () => {
    expect(canAddMoreImages(4, 1)).toBe(true)
    expect(canAddMoreImages(5, 1)).toBe(false)
    expect(canAddMoreImages(3, 2)).toBe(true)
    expect(canAddMoreImages(3, 3)).toBe(false)
  })
})

describe('isAllowedImageMimeType', () => {
  it('accepts the 4 allowed types and rejects others', () => {
    expect(isAllowedImageMimeType('image/png')).toBe(true)
    expect(isAllowedImageMimeType('image/gif')).toBe(true)
    expect(isAllowedImageMimeType('image/svg+xml')).toBe(false)
  })
})
