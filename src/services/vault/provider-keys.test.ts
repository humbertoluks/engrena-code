import { describe, expect, it } from 'vitest'
import { validateClaudeKey, validateCodexKey, validateMinimaxKey } from './provider-keys'

describe('validateClaudeKey', () => {
  it('preserves the existing key when input is empty', () => {
    expect(validateClaudeKey('')).toEqual({ ok: true, action: 'skip' })
  })

  it('rejects keys with whitespace', () => {
    expect(validateClaudeKey('sk-ant- abcdef')).toEqual({
      ok: false,
      message: 'A chave não pode conter espaços.',
    })
  })

  it('rejects keys shorter than 8 chars', () => {
    expect(validateClaudeKey('sk-a12')).toEqual({
      ok: false,
      message: 'Chave muito curta para ser válida.',
    })
  })

  it('rejects invalid prefix', () => {
    expect(validateClaudeKey('invalid_key_here')).toEqual({
      ok: false,
      message: 'Formato inválido. Esperado: sk-ant-…',
    })
  })

  it('accepts a valid sk-ant- key', () => {
    expect(validateClaudeKey('sk-ant-12345678')).toEqual({
      ok: true,
      action: 'save',
      key: 'sk-ant-12345678',
    })
  })
})

describe('validateCodexKey', () => {
  it('preserves the existing key when input is empty', () => {
    expect(validateCodexKey('')).toEqual({ ok: true, action: 'skip' })
  })

  it('rejects keys with whitespace', () => {
    expect(validateCodexKey('sk- abcdef12')).toEqual({
      ok: false,
      message: 'A chave não pode conter espaços.',
    })
  })

  it('rejects keys shorter than 8 chars', () => {
    expect(validateCodexKey('sk-a12')).toEqual({
      ok: false,
      message: 'Chave muito curta para ser válida.',
    })
  })

  it('rejects invalid prefix', () => {
    expect(validateCodexKey('invalid_key_here')).toEqual({
      ok: false,
      message: 'Formato inválido. Esperado: sk-… ou sk-codex-…',
    })
  })

  it.each(['sk-12345678', 'sk-codex-12345678'])('accepts valid prefix key %s', (key) => {
    expect(validateCodexKey(key)).toEqual({ ok: true, action: 'save', key })
  })
})

describe('validateMinimaxKey', () => {
  it('preserves the existing key when input is empty', () => {
    expect(validateMinimaxKey('')).toEqual({ ok: true, action: 'skip' })
  })

  it('rejects keys with whitespace', () => {
    expect(validateMinimaxKey('mm- abcdef12')).toEqual({
      ok: false,
      message: 'A chave não pode conter espaços.',
    })
  })

  it('rejects keys shorter than 8 chars', () => {
    expect(validateMinimaxKey('mm-a12')).toEqual({
      ok: false,
      message: 'Chave muito curta para ser válida.',
    })
  })

  it('accepts any key without a required prefix', () => {
    expect(validateMinimaxKey('mm-12345678')).toEqual({ ok: true, action: 'save', key: 'mm-12345678' })
    expect(validateMinimaxKey('anything123')).toEqual({ ok: true, action: 'save', key: 'anything123' })
  })
})
