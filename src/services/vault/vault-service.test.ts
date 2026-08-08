import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

// `vaultStore`'s path is fixed at import time. Point ENGRENACODE_USER_DATA at a
// directory private to this test file *before* importing vault-service.js (which
// imports store.js), so concurrent runs of other vault test files never race on the
// same vault.enc on disk.
const privateUserData = mkdtempSync(join(tmpdir(), 'engrenacode-vault-service-test-'))
process.env.ENGRENACODE_USER_DATA = privateUserData

const { vaultService } = await import('./vault-service.js')

const vaultPath = join(privateUserData, 'vault.enc')

afterAll(() => {
  rmSync(privateUserData, { recursive: true, force: true })
})

function cleanup(): void {
  rmSync(vaultPath, { force: true })
  rmSync(`${vaultPath}.tmp`, { force: true })
}

beforeEach(() => {
  cleanup()
  vaultService.lock()
})

afterEach(cleanup)

// The failure/backoff counters are keyed by workspace and live in a Map that persists
// for the whole test file (private `lastFailureTime` on the singleton). Each test uses
// its own workspace name so failure streaks never leak across tests.
describe('vaultService.unlock', () => {
  it('initializes a brand-new vault (no vault.enc yet) and unlocks it', () => {
    const result = vaultService.unlock('/ws-init', 'senha-forte-123')
    expect(result).toEqual({ unlocked: true })
    expect(vaultService.isLocked()).toBe(false)
    expect(vaultService.getSessionToken()).toBeTypeOf('string')
  })

  it('re-unlocking with the same password after a lock() decrypts the persisted secrets', () => {
    vaultService.unlock('/ws-reunlock', 'senha-forte-123')
    vaultService.setSecret('claude', 'sk-ant-abc123')
    vaultService.lock()

    const result = vaultService.unlock('/ws-reunlock', 'senha-forte-123')
    expect(result).toEqual({ unlocked: true })
    expect(vaultService.getSecret('claude')).toBe('sk-ant-abc123')
  })

  it('rejects the wrong password for an existing vault without unlocking', () => {
    // `unlock()` on a brand-new vault never touches disk by itself — it only
    // initializes in-memory state. Persist via setSecret() so vault.enc actually
    // exists and the next unlock() takes the decrypt branch instead of "first unlock".
    vaultService.unlock('/ws-wrongpass', 'senha-correta-123')
    vaultService.setSecret('seed', 'value')
    vaultService.lock()

    const result = vaultService.unlock('/ws-wrongpass', 'senha-errada-999')
    expect(result.unlocked).toBe(false)
    expect(vaultService.isLocked()).toBe(true)
  })

  it('returns retryAfterMs once the failure count reaches the backoff threshold', () => {
    vaultService.unlock('/ws-backoff', 'senha-correta-123')
    vaultService.setSecret('seed', 'value')
    vaultService.lock()

    for (let i = 0; i < 4; i++) {
      vaultService.unlock('/ws-backoff', 'senha-errada')
    }
    const fifth = vaultService.unlock('/ws-backoff', 'senha-errada')
    expect(fifth.unlocked).toBe(false)
    expect(fifth.retryAfterMs).toBeGreaterThan(0)

    const sixth = vaultService.unlock('/ws-backoff', 'senha-correta-123')
    expect(sixth.unlocked).toBe(false)
    expect(sixth.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets the failure count after a successful unlock', () => {
    vaultService.unlock('/ws-resetcount', 'senha-correta-123')
    vaultService.setSecret('seed', 'value')
    vaultService.lock()

    vaultService.unlock('/ws-resetcount', 'senha-errada')
    vaultService.unlock('/ws-resetcount', 'senha-correta-123')
    vaultService.lock()

    // A single fresh failure right after a success must not carry over the previous streak.
    const result = vaultService.unlock('/ws-resetcount', 'senha-errada-outra-vez')
    expect(result.retryAfterMs ?? 0).toBe(0)
  })
})

describe('vaultService secrets API', () => {
  it('throws vault_locked for every secret operation while locked', () => {
    expect(() => vaultService.setSecret('k', 'v')).toThrow('vault_locked')
    expect(() => vaultService.getSecret('k')).toThrow('vault_locked')
    expect(() => vaultService.getAllSecrets()).toThrow('vault_locked')
    expect(() => vaultService.deleteSecret('k')).toThrow('vault_locked')
  })

  it('sets, lists and deletes secrets once unlocked', () => {
    vaultService.unlock('/ws-secrets', 'senha-forte-123')

    vaultService.setSecret('codex', 'sk-codex-1')
    vaultService.setSecret('grok', 'xai-1')
    expect(vaultService.getAllSecrets()).toEqual({ codex: 'sk-codex-1', grok: 'xai-1' })

    vaultService.deleteSecret('codex')
    expect(vaultService.getAllSecrets()).toEqual({ grok: 'xai-1' })
    expect(vaultService.getSecret('codex')).toBeUndefined()
  })
})

describe('vaultService session/lock state', () => {
  it('getSessionToken() returns null while locked', () => {
    expect(vaultService.getSessionToken()).toBeNull()
  })

  it('lock() clears the session token and secrets from memory', () => {
    vaultService.unlock('/ws-lockclears', 'senha-forte-123')
    vaultService.setSecret('k', 'v')
    vaultService.lock()

    expect(vaultService.isLocked()).toBe(true)
    expect(vaultService.getSessionToken()).toBeNull()
  })
})
