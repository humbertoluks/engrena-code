import { describe, expect, it } from 'vitest'
import { sanitizeProcessError, stderrTail } from './process-error.js'

describe('sanitizeProcessError', () => {
  it('redacts git HTTPS tokens embedded in URLs', () => {
    const out = sanitizeProcessError(
      'fatal: could not read from https://x-access-token:ghs_secretvalue@github.com/org/repo.git'
    )
    expect(out).toContain('x-access-token:***@')
    expect(out).not.toContain('ghs_secretvalue')
  })

  it('redacts common API key prefixes', () => {
    expect(sanitizeProcessError('key sk-ant-abcdefghijklmnop failed')).toContain('sk-ant-***')
    expect(sanitizeProcessError('token sk-abcdefghijklmnop')).toContain('sk-***')
  })

  it('redacts oauth2/x-token-auth/azure userinfo in HTTPS URLs', () => {
    const gitlab = sanitizeProcessError('fatal: could not read from https://oauth2:glpat-secretvalue@gitlab.com/org/repo.git')
    expect(gitlab).toContain('https://***@')
    expect(gitlab).not.toContain('glpat-secretvalue')

    const bitbucket = sanitizeProcessError('fatal: could not read from https://x-token-auth:secretvalue@bitbucket.org/org/repo.git')
    expect(bitbucket).toContain('https://***@')
    expect(bitbucket).not.toContain('secretvalue')

    const azure = sanitizeProcessError('fatal: could not read from https://:secretvalue@dev.azure.com/org/repo.git')
    expect(azure).toContain('https://***@')
    expect(azure).not.toContain('secretvalue')
  })

  it('redacts xai- and gsk_ API key prefixes', () => {
    expect(sanitizeProcessError('key xai-abcdefghijklmnop failed')).toContain('xai-***')
    expect(sanitizeProcessError('key xai-abcdefghijklmnop failed')).not.toContain('abcdefghijklmnop')
    expect(sanitizeProcessError('token gsk_abcdefghijklmnop')).toContain('gsk_***')
    expect(sanitizeProcessError('token gsk_abcdefghijklmnop')).not.toContain('abcdefghijklmnop')
  })

  it('shortens absolute paths', () => {
    const out = sanitizeProcessError('error in C:\\Users\\Me\\Code\\repo\\file.ts:1')
    expect(out).toContain('…/file.ts')
    expect(out).not.toContain('C:\\Users\\Me')
  })
})

describe('stderrTail', () => {
  it('reads stderr from exec-style errors', () => {
    expect(stderrTail({ stderr: 'x-access-token:abc@host' })).toBe('x-access-token:***@host')
  })
})
