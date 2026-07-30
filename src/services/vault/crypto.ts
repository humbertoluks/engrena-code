import crypto from 'crypto'

const SCRYPT_PARAMS = {
  N: 32768, // 2^15
  r: 8,
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
  } catch (err) {
    throw new Error('vault_corrupted: decryption failed or auth tag mismatch')
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
  let offset = 0

  const version = data.readUInt8(offset)
  offset += 1
  if (version !== 1) throw new Error('vault_corrupted: unsupported version')

  const saltLen = data.readUInt16BE(offset)
  offset += 2
  const salt = data.slice(offset, offset + saltLen)
  offset += saltLen

  const ivLen = data.readUInt16BE(offset)
  offset += 2
  const iv = data.slice(offset, offset + ivLen)
  offset += ivLen

  const ciphertextLen = data.readUInt32BE(offset)
  offset += 4
  const ciphertext = data.slice(offset, offset + ciphertextLen)
  offset += ciphertextLen

  const authTagLen = data.readUInt16BE(offset)
  offset += 2
  const authTag = data.slice(offset, offset + authTagLen)

  return {
    salt,
    kdf: SCRYPT_PARAMS,
    iv,
    ciphertext,
    authTag
  }
}
