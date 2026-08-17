import { describe, expect, it } from 'vitest'
import {
  validateClaudeKeyLocal,
  validateCodexKeyLocal,
  validateMinimaxKeyLocal,
  validateGlmKeyLocal,
  validateGrokKeyLocal,
  shouldOfferGithubTokenRemoval,
  validateGithubTokenLocal,
  validateOpenaiKeyLocal,
  validateGroqKeyLocal,
} from './configuracaoScreen.logic'

const SPACES_MSG = 'A chave não pode conter espaços.'
const SHORT_MSG = 'Chave muito curta para ser válida.'

describe('validateClaudeKeyLocal', () => {
  it('accepts empty draft and sk-ant- keys', () => {
    expect(validateClaudeKeyLocal('')).toBeNull()
    expect(validateClaudeKeyLocal('sk-ant-abcdefgh')).toBeNull()
  })

  it('rejects spaces, short values, and wrong prefix', () => {
    expect(validateClaudeKeyLocal('sk-ant- ab')).toBe(SPACES_MSG)
    expect(validateClaudeKeyLocal('sk-ant')).toBe(SHORT_MSG)
    expect(validateClaudeKeyLocal('sk-abcdefgh')).toBe('Formato inválido. Esperado: sk-ant-…')
  })
})

describe('validateCodexKeyLocal', () => {
  it('requires sk- prefix without spaces', () => {
    expect(validateCodexKeyLocal('sk-abcdefgh')).toBeNull()
    expect(validateCodexKeyLocal('sk-codex-abcdefgh')).toBeNull()
    expect(validateCodexKeyLocal('openai-abcdefgh')).toBe('Formato inválido. Esperado: sk-… ou sk-codex-…')
  })
})

describe('validateMinimaxKeyLocal', () => {
  it('only checks emptiness, spaces and length', () => {
    expect(validateMinimaxKeyLocal('abcdefgh')).toBeNull()
    expect(validateMinimaxKeyLocal('short')).toBe(SHORT_MSG)
  })
})

describe('validateGlmKeyLocal', () => {
  it('only checks emptiness, spaces and length (F23 — no documented prefix)', () => {
    expect(validateGlmKeyLocal('')).toBeNull()
    expect(validateGlmKeyLocal('abcdef01234.5678secretpart')).toBeNull()
    expect(validateGlmKeyLocal('short')).toBe(SHORT_MSG)
    expect(validateGlmKeyLocal('abc def12345')).toBe(SPACES_MSG)
  })
})

describe('validateGrokKeyLocal', () => {
  it('requires xai- prefix without spaces (F23)', () => {
    expect(validateGrokKeyLocal('')).toBeNull()
    expect(validateGrokKeyLocal('xai-abcdefgh')).toBeNull()
    expect(validateGrokKeyLocal('xai-abc def')).toBe(SPACES_MSG)
    expect(validateGrokKeyLocal('xai-a12')).toBe(SHORT_MSG)
    expect(validateGrokKeyLocal('other-abcdefgh')).toBe('Formato inválido. Esperado: xai-…')
  })
})

describe('validateOpenaiKeyLocal', () => {
  it('requires sk- prefix without spaces (F27 — STT card)', () => {
    expect(validateOpenaiKeyLocal('')).toBeNull()
    expect(validateOpenaiKeyLocal('sk-abcdefgh')).toBeNull()
    expect(validateOpenaiKeyLocal('sk-abc def')).toBe(SPACES_MSG)
    expect(validateOpenaiKeyLocal('sk-a12')).toBe(SHORT_MSG)
    expect(validateOpenaiKeyLocal('other-abcdefgh')).toBe('Formato inválido. Esperado: sk-…')
  })
})

describe('validateGroqKeyLocal', () => {
  it('requires gsk_ prefix without spaces (F27 — STT card)', () => {
    expect(validateGroqKeyLocal('')).toBeNull()
    expect(validateGroqKeyLocal('gsk_abcdefgh')).toBeNull()
    expect(validateGroqKeyLocal('gsk_abc def')).toBe(SPACES_MSG)
    expect(validateGroqKeyLocal('gsk_a12')).toBe(SHORT_MSG)
    expect(validateGroqKeyLocal('other-abcdefgh')).toBe('Formato inválido. Esperado: gsk_…')
  })
})

describe('validateGithubTokenLocal', () => {
  it('accepts empty draft and known GitHub token prefixes', () => {
    expect(validateGithubTokenLocal('')).toBeNull()
    expect(validateGithubTokenLocal('ghp_abcdefgh')).toBeNull()
    expect(validateGithubTokenLocal('github_pat_abcdefgh')).toBeNull()
  })

  it('rejects spaces, short values, and an unknown prefix', () => {
    expect(validateGithubTokenLocal('ghp_ab cd')).toBe(SPACES_MSG)
    expect(validateGithubTokenLocal('ghp_ab')).toBe(SHORT_MSG)
    expect(validateGithubTokenLocal('token-abcdefgh')).toBe('Formato inválido. Esperado: ghp_… ou github_pat_…')
  })
})

/**
 * A remoção sempre existiu no backend (salvar vazio apaga o segredo), mas não havia como
 * descobrir isso pela tela. Depende só do que está guardado: a versão que também escondia o botão
 * com rascunho digitado sumia logo depois de salvar, porque o campo mantém o texto.
 */
describe('shouldOfferGithubTokenRemoval', () => {
  it('oferece remover quando há token guardado', () => {
    expect(shouldOfferGithubTokenRemoval(true)).toBe(true)
  })

  it('não oferece quando não há token guardado — não há o que remover', () => {
    expect(shouldOfferGithubTokenRemoval(false)).toBe(false)
  })
})
