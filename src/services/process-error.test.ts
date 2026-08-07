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
