import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { deserializeEnvelope, serializeEnvelope, type CryptoEnvelope } from './crypto.js'

export interface VaultData {
  secrets: Record<string, string>
  createdAt: number
  workspace: string
}

export type UserDataResolver = () => string

/**
 * Resolve userData from an env override (smoke/tests) or a fallback (e.g. Electron app.getPath).
 * Apps pass their own env var: ENGRENACODE_USER_DATA / ENGRENAPLAN_USER_DATA.
 */
export function createUserDataResolver(options: {
  userDataEnvVar: string
  fallbackUserData: () => string
}): UserDataResolver {
  return () => {
    const override = process.env[options.userDataEnvVar]
    if (override) {
      mkdirSync(override, { recursive: true })
      return override
    }
    return options.fallbackUserData()
  }
}

export class VaultStore {
  private vaultPath: string

  constructor(resolveUserData: UserDataResolver) {
    this.vaultPath = join(resolveUserData(), 'vault.enc')
  }

  /** Absolute path to vault.enc (tests / diagnostics). */
  get path(): string {
    return this.vaultPath
  }

  exists(): boolean {
    return existsSync(this.vaultPath)
  }

  read(): Buffer {
    if (!this.exists()) {
      throw new Error('vault_not_found')
    }
    return readFileSync(this.vaultPath)
  }

  /** Write via temp + rename so a crash mid-write cannot truncate vault.enc. */
  write(data: Buffer): void {
    const tmpPath = `${this.vaultPath}.tmp`
    writeFileSync(tmpPath, data, { mode: 0o600 })
    try {
      renameSync(tmpPath, this.vaultPath)
    } catch (err) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // best-effort cleanup of the temp file
      }
      throw err
    }
  }

  serialize(envelope: CryptoEnvelope): Buffer {
    return serializeEnvelope(envelope)
  }

  deserialize(data: Buffer): CryptoEnvelope {
    return deserializeEnvelope(data)
  }
}

export function createVaultStore(resolveUserData: UserDataResolver): VaultStore {
  return new VaultStore(resolveUserData)
}
