import { describe, expect, it } from 'vitest'
import { validateGithubToken } from './github-token'

describe('validateGithubToken', () => {
  it('clears when token is empty', () => {
    expect(validateGithubToken('')).toEqual({ ok: true, action: 'clear' })
  })

  it('rejects tokens with whitespace', () => {
    expect(validateGithubToken('ghp_ abcdef')).toEqual({
      ok: false,
      message: 'A chave não pode conter espaços.',
    })
  })

  it('rejects tokens shorter than 8 chars', () => {
    expect(validateGithubToken('ghp_12')).toEqual({
      ok: false,
      message: 'Chave muito curta para ser válida.',
    })
  })

  it('rejects invalid prefixes', () => {
    expect(validateGithubToken('invalid_token_here')).toEqual({
      ok: false,
      message: 'Formato inválido. Esperado: ghp_… ou github_pat_…',
    })
  })

  it.each([
    'ghp_12345678',
    'github_pat_abcdefgh',
    'gho_12345678',
    'ghu_12345678',
    'ghs_12345678',
    'ghr_12345678',
  ])('accepts valid prefix token %s', (token) => {
    expect(validateGithubToken(token)).toEqual({ ok: true, action: 'save', token })
  })
})
