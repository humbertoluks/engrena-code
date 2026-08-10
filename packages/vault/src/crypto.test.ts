import { describe, expect, it } from 'vitest'
import {
  decrypt,
  deserializeEnvelope,
  encrypt,
  serializeEnvelope,
} from './crypto.js'

describe('crypto envelope', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = Buffer.from('{"secrets":{},"workspace":"ws","createdAt":1}', 'utf-8')
    const envelope = encrypt(plaintext, 'senha-forte-123')
    const roundTrip = decrypt(envelope, 'senha-forte-123')
    expect(roundTrip.equals(plaintext)).toBe(true)
  })

  it('throws vault_decrypt_failed for the wrong password', () => {
    const envelope = encrypt(Buffer.from('payload', 'utf-8'), 'senha-certa')
    expect(() => decrypt(envelope, 'senha-errada')).toThrow(/vault_decrypt_failed:/)
  })

  it('throws vault_corrupted for an unsupported version', () => {
    const envelope = encrypt(Buffer.from('payload', 'utf-8'), 'senha')
    const serialized = serializeEnvelope(envelope)
    serialized[0] = 99
    expect(() => deserializeEnvelope(serialized)).toThrow(/vault_corrupted: unsupported version/)
  })

  it('throws vault_corrupted for an adulterated/truncated envelope', () => {
    expect(() => deserializeEnvelope(Buffer.from([1, 0, 16]))).toThrow(/vault_corrupted:/)
    expect(() => deserializeEnvelope(Buffer.alloc(0))).toThrow(/vault_corrupted:/)
  })
})
