import crypto from 'crypto'

const SCRYPT_PARAMS = {
  N: 16384, // 2^14: ~16MB memory, balanced for Electron
  r: 4,
  p: 1,
  keylen: 32
}

const CIPHER_ALGO = 'aes-256-gcm'
const SALT_BYTES = 16
const IV_BYTES = 12

export interface CryptoEnvelope {
  salt: Buffer
  kdf: typeof SCRYPT_PARAMS
  iv: Buffer
  ciphertext: Buffer
  authTag: Buffer
}

export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(
    password,
    salt,
    SCRYPT_PARAMS.keylen,
    {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p
    }
  )
}

export function encrypt(plaintext: Buffer, password: string): CryptoEnvelope {
  const salt = crypto.randomBytes(SALT_BYTES)
  const key = deriveKey(password, salt)
  const iv = crypto.randomBytes(IV_BYTES)

  const cipher = crypto.createCipheriv(CIPHER_ALGO, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return {
    salt,
    kdf: SCRYPT_PARAMS,
    iv,
    ciphertext,
    authTag
  }
}

export function decrypt(envelope: CryptoEnvelope, password: string): Buffer {
  const key = deriveKey(password, envelope.salt)

  const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, envelope.iv)
  decipher.setAuthTag(envelope.authTag)

  try {
    return Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final()
    ])
  } catch {
    // Auth tag mismatch: wrong password or tampered ciphertext — not a structural corruption.
    throw new Error('vault_decrypt_failed: decryption failed or auth tag mismatch')
  }
}

export function serializeEnvelope(envelope: CryptoEnvelope): Buffer {
  const saltLen = Buffer.alloc(2)
  saltLen.writeUInt16BE(envelope.salt.length, 0)

  const ivLen = Buffer.alloc(2)
  ivLen.writeUInt16BE(envelope.iv.length, 0)

  const ciphertextLen = Buffer.alloc(4)
  ciphertextLen.writeUInt32BE(envelope.ciphertext.length, 0)

  const authTagLen = Buffer.alloc(2)
  authTagLen.writeUInt16BE(envelope.authTag.length, 0)

  return Buffer.concat([
    Buffer.from([1]), // version
    saltLen,
    envelope.salt,
    ivLen,
    envelope.iv,
    ciphertextLen,
    envelope.ciphertext,
    authTagLen,
    envelope.authTag
  ])
}

export function deserializeEnvelope(data: Buffer): CryptoEnvelope {
  try {
    let offset = 0

    if (data.length < 1) throw new Error('vault_corrupted: truncated envelope')

    const version = data.readUInt8(offset)
    offset += 1
    if (version !== 1) throw new Error('vault_corrupted: unsupported version')

    if (offset + 2 > data.length) throw new Error('vault_corrupted: truncated envelope')
    const saltLen = data.readUInt16BE(offset)
    offset += 2
    if (offset + saltLen > data.length) throw new Error('vault_corrupted: truncated envelope')
    const salt = data.subarray(offset, offset + saltLen)
    offset += saltLen

    if (offset + 2 > data.length) throw new Error('vault_corrupted: truncated envelope')
    const ivLen = data.readUInt16BE(offset)
    offset += 2
    if (offset + ivLen > data.length) throw new Error('vault_corrupted: truncated envelope')
    const iv = data.subarray(offset, offset + ivLen)
    offset += ivLen

    if (offset + 4 > data.length) throw new Error('vault_corrupted: truncated envelope')
    const ciphertextLen = data.readUInt32BE(offset)
    offset += 4
    if (offset + ciphertextLen > data.length) throw new Error('vault_corrupted: truncated envelope')
    const ciphertext = data.subarray(offset, offset + ciphertextLen)
    offset += ciphertextLen

    if (offset + 2 > data.length) throw new Error('vault_corrupted: truncated envelope')
    const authTagLen = data.readUInt16BE(offset)
    offset += 2
    if (offset + authTagLen > data.length) throw new Error('vault_corrupted: truncated envelope')
    const authTag = data.subarray(offset, offset + authTagLen)

    return {
      salt,
      kdf: SCRYPT_PARAMS,
      iv,
      ciphertext,
      authTag
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('vault_corrupted:')) throw err
    throw new Error('vault_corrupted: invalid envelope')
  }
}
