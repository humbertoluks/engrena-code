import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encrypt } from './crypto.js'
import { createVaultFromResolver } from './create-vault.js'

const privateUserData = mkdtempSync(join(tmpdir(), 'engrena-vault-store-test-'))
const { vaultStore } = createVaultFromResolver({
  resolveUserData: () => privateUserData,
})

const vaultPath = vaultStore.path

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

describe('createUserDataResolver / createVault env', () => {
  it('honours userDataEnvVar when set', async () => {
    const { createVault } = await import('./create-vault.js')
    const envDir = mkdtempSync(join(tmpdir(), 'engrena-vault-env-test-'))
    const envVar = 'ENGRENA_VAULT_TEST_USER_DATA'
    const prev = process.env[envVar]
    process.env[envVar] = envDir
    try {
      const { vaultStore: envStore } = createVault({
        userDataEnvVar: envVar,
        fallbackUserData: () => {
          throw new Error('fallback should not run')
        },
      })
      expect(envStore.path).toBe(join(envDir, 'vault.enc'))
    } finally {
      if (prev === undefined) delete process.env[envVar]
      else process.env[envVar] = prev
      rmSync(envDir, { recursive: true, force: true })
    }
  })
})
