import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f23_provider_resolution_'))

const { vaultService } = await import('../vault/vault-service.js')
const { resolveProviderApiKey, resolveBillingMode } = await import('./provider-resolution.js')

beforeEach(() => {
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('resolveProviderApiKey — glm/grok (F23)', () => {
  it('returns undefined when no key is saved', () => {
    expect(resolveProviderApiKey('glm')).toBeUndefined()
    expect(resolveProviderApiKey('grok')).toBeUndefined()
  })

  it('returns the vault value once a key is saved', () => {
    vaultService.setSecret('keys:glm', 'abcdef01234.5678secretpart')
    vaultService.setSecret('keys:grok', 'xai-abcdef0123456789')
    expect(resolveProviderApiKey('glm')).toBe('abcdef01234.5678secretpart')
    expect(resolveProviderApiKey('grok')).toBe('xai-abcdef0123456789')
  })
})

describe('resolveBillingMode — glm/grok (F23)', () => {
  it('is always api-key regardless of vault state (same treatment as Minimax)', () => {
    expect(resolveBillingMode('glm')).toBe('api-key')
    expect(resolveBillingMode('grok')).toBe('api-key')

    vaultService.setSecret('keys:glm', 'abcdef01234.5678secretpart')
    vaultService.setSecret('keys:grok', 'xai-abcdef0123456789')
    expect(resolveBillingMode('glm')).toBe('api-key')
    expect(resolveBillingMode('grok')).toBe('api-key')
  })
})
