import { describe, expect, it } from 'vitest'
import {
  KEY_VALIDATION_MESSAGES,
  validateClaudeKeyLocal,
  validateCodexKeyLocal,
  validateMinimaxKeyLocal,
  validateGlmKeyLocal,
  validateGrokKeyLocal,
  validateGithubTokenLocal,
  validateOpenaiKeyLocal,
  validateGroqKeyLocal,
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

describe('validateGlmKeyLocal', () => {
  it('only checks emptiness, spaces and length (F23 — no documented prefix)', () => {
    expect(validateGlmKeyLocal('')).toBeNull()
    expect(validateGlmKeyLocal('abcdef01234.5678secretpart')).toBeNull()
    expect(validateGlmKeyLocal('short')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateGlmKeyLocal('abc def12345')).toBe(KEY_VALIDATION_MESSAGES.spaces)
  })
})

describe('validateGrokKeyLocal', () => {
  it('requires xai- prefix without spaces (F23)', () => {
    expect(validateGrokKeyLocal('')).toBeNull()
    expect(validateGrokKeyLocal('xai-abcdefgh')).toBeNull()
    expect(validateGrokKeyLocal('xai-abc def')).toBe(KEY_VALIDATION_MESSAGES.spaces)
    expect(validateGrokKeyLocal('xai-a12')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateGrokKeyLocal('other-abcdefgh')).toBe(KEY_VALIDATION_MESSAGES.grokFormat)
  })
})

describe('validateOpenaiKeyLocal', () => {
  it('requires sk- prefix without spaces (F27 — STT card)', () => {
    expect(validateOpenaiKeyLocal('')).toBeNull()
    expect(validateOpenaiKeyLocal('sk-abcdefgh')).toBeNull()
    expect(validateOpenaiKeyLocal('sk-abc def')).toBe(KEY_VALIDATION_MESSAGES.spaces)
    expect(validateOpenaiKeyLocal('sk-a12')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateOpenaiKeyLocal('other-abcdefgh')).toBe(KEY_VALIDATION_MESSAGES.openaiFormat)
  })
})

describe('validateGroqKeyLocal', () => {
  it('requires gsk_ prefix without spaces (F27 — STT card)', () => {
    expect(validateGroqKeyLocal('')).toBeNull()
    expect(validateGroqKeyLocal('gsk_abcdefgh')).toBeNull()
    expect(validateGroqKeyLocal('gsk_abc def')).toBe(KEY_VALIDATION_MESSAGES.spaces)
    expect(validateGroqKeyLocal('gsk_a12')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateGroqKeyLocal('other-abcdefgh')).toBe(KEY_VALIDATION_MESSAGES.groqFormat)
  })
})

describe('validateGithubTokenLocal', () => {
  it('accepts empty draft and known GitHub token prefixes', () => {
    expect(validateGithubTokenLocal('')).toBeNull()
    expect(validateGithubTokenLocal('ghp_abcdefgh')).toBeNull()
    expect(validateGithubTokenLocal('github_pat_abcdefgh')).toBeNull()
  })

  it('rejects spaces, short values, and an unknown prefix', () => {
    expect(validateGithubTokenLocal('ghp_ab cd')).toBe(KEY_VALIDATION_MESSAGES.spaces)
    expect(validateGithubTokenLocal('ghp_ab')).toBe(KEY_VALIDATION_MESSAGES.short)
    expect(validateGithubTokenLocal('token-abcdefgh')).toBe('Formato inválido. Esperado: ghp_… ou github_pat_…')
  })
})
