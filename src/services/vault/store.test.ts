import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encrypt } from './crypto.js'

// `vaultStore` is a module-level singleton whose `vaultPath` is fixed at import time.
// Point ENGRENACODE_USER_DATA at a directory private to this test file *before*
// importing store.js, so concurrent runs of other vault test files never race on the
// same vault.enc on disk.
const privateUserData = mkdtempSync(join(tmpdir(), 'engrenacode-vault-store-test-'))
process.env.ENGRENACODE_USER_DATA = privateUserData

const { vaultStore } = await import('./store.js')

const vaultPath = join(privateUserData, 'vault.enc')

afterAll(() => {
  rmSync(privateUserData, { recursive: true, force: true })
})

function cleanup(): void {
  rmSync(vaultPath, { force: true })
  rmSync(`${vaultPath}.tmp`, { force: true })
}

beforeEach(cleanup)
afterEach(cleanup)

describe('vaultStore', () => {
  it('exists() is false before any write and true after', () => {
    expect(vaultStore.exists()).toBe(false)
    vaultStore.write(Buffer.from('anything'))
    expect(vaultStore.exists()).toBe(true)
  })

  it('read() returns exactly what write() persisted', () => {
    const payload = Buffer.from('vault-payload-bytes', 'utf-8')
    vaultStore.write(payload)
    expect(vaultStore.read().equals(payload)).toBe(true)
  })

  it('read() throws vault_not_found when there is no vault.enc yet', () => {
    expect(() => vaultStore.read()).toThrow('vault_not_found')
  })

  it('write() does not leave a .tmp file behind on success', () => {
    vaultStore.write(Buffer.from('data'))
    expect(existsSync(`${vaultPath}.tmp`)).toBe(false)
  })

  it('write() replaces existing content rather than appending', () => {
    vaultStore.write(Buffer.from('first'))
    vaultStore.write(Buffer.from('second'))
    expect(vaultStore.read().toString('utf-8')).toBe('second')
  })

  it('serialize()/deserialize() round-trip a real crypto envelope', () => {
    const envelope = encrypt(Buffer.from('secret'), 'senha-forte-123')
    const serialized = vaultStore.serialize(envelope)
    const restored = vaultStore.deserialize(serialized)
    expect(restored.salt.equals(envelope.salt)).toBe(true)
    expect(restored.iv.equals(envelope.iv)).toBe(true)
    expect(restored.ciphertext.equals(envelope.ciphertext)).toBe(true)
    expect(restored.authTag.equals(envelope.authTag)).toBe(true)
  })

  it('write() persisted data survives a serialize/deserialize round-trip through disk', () => {
    const envelope = encrypt(Buffer.from('secret-on-disk'), 'senha-forte-123')
    vaultStore.write(vaultStore.serialize(envelope))
    const restored = vaultStore.deserialize(vaultStore.read())
    expect(restored.ciphertext.equals(envelope.ciphertext)).toBe(true)
  })
})
