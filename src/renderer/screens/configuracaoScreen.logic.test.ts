import { describe, expect, it } from 'vitest'
import {
  KEY_VALIDATION_MESSAGES,
  validateClaudeKeyLocal,
  validateCodexKeyLocal,
  validateMinimaxKeyLocal,
} from './configuracaoScreen.logic'

describe('validateClaudeKeyLocal', () => {
  it('accepts empty draft and sk-ant- keys', () => {
    expect(validateClaudeKeyLocal('')).toBeNull()
    expect(validateClaudeKeyLocal('sk-ant-abcdefgh')).toBeNull()
  })

  it('rejects spaces, short values, and wrong prefix', () => {
    expect(validateClaudeKeyLocal('sk-ant- ab')).toBe(KEY_VALIDATION_MESSAGES.spaces)
    expect(validateClaudeKeyLocal('sk-ant')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateClaudeKeyLocal('sk-abcdefgh')).toBe(KEY_VALIDATION_MESSAGES.claudeFormat)
  })
})

describe('validateCodexKeyLocal', () => {
  it('requires sk- prefix without spaces', () => {
    expect(validateCodexKeyLocal('sk-abcdefgh')).toBeNull()
    expect(validateCodexKeyLocal('sk-codex-abcdefgh')).toBeNull()
    expect(validateCodexKeyLocal('openai-abcdefgh')).toBe(KEY_VALIDATION_MESSAGES.codexFormat)
  })
})

describe('validateMinimaxKeyLocal', () => {
  it('only checks emptiness, spaces and length', () => {
    expect(validateMinimaxKeyLocal('abcdefgh')).toBeNull()
    expect(validateMinimaxKeyLocal('short')).toBe(KEY_VALIDATION_MESSAGES.short)
  })
})
