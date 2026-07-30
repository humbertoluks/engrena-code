import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { deserializeEnvelope, serializeEnvelope, type CryptoEnvelope } from './crypto'

export interface VaultData {
  secrets: Record<string, string>
  createdAt: number
  workspace: string
}

class VaultStore {
  private vaultPath: string

  constructor() {
    const userData = app.getPath('userData')
    this.vaultPath = join(userData, 'vault.enc')
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

  write(data: Buffer): void {
    writeFileSync(this.vaultPath, data, { mode: 0o600 })
  }

  serialize(envelope: CryptoEnvelope): Buffer {
    return serializeEnvelope(envelope)
  }

  deserialize(data: Buffer): CryptoEnvelope {
    return deserializeEnvelope(data)
  }
}

export const vaultStore = new VaultStore()
