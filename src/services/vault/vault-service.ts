import crypto from 'crypto'
import { decrypt, encrypt } from './crypto'
import { vaultStore } from './store'

interface VaultData {
  secrets: Record<string, string>
  createdAt: number
  workspace: string
}

class VaultService {
  private isUnlocked = false
  private sessionToken: string | null = null
  private secrets: Record<string, string> = {}
  private workspace: string = ''
  private password: string = ''
  private lastFailureTime: Map<string, number> = new Map()

  unlock(workspace: string, password: string): { unlocked: boolean; retryAfterMs?: number } {
    const now = Date.now()
    const lastFailureKey = `${workspace}:lastFailure`
    const failureCountKey = `${workspace}:failures`

    // Backoff check
    const lastFailure = this.lastFailureTime.get(lastFailureKey) || 0
    const failureCount = this.lastFailureTime.get(failureCountKey) || 0

    if (failureCount >= 5) {
      const elapsed = now - lastFailure
      const baseMs = 1000
      const maxMs = 60000
      const retryAfterMs = Math.min(baseMs * Math.pow(2, failureCount - 5), maxMs)

      if (elapsed < retryAfterMs) {
        return {
          unlocked: false,
          retryAfterMs: retryAfterMs - elapsed
        }
      }
    }

    try {
      if (vaultStore.exists()) {
        // Existing vault - decrypt
        const envelopeData = vaultStore.read()
        const envelope = vaultStore.deserialize(envelopeData)
        const plaintext = decrypt(envelope, password)
        const vaultData: VaultData = JSON.parse(plaintext.toString('utf-8'))

        this.secrets = vaultData.secrets
        this.workspace = vaultData.workspace
      } else {
        // First unlock - initialize
        this.secrets = {}
        this.workspace = workspace
      }

      // Success - reset failures
      this.lastFailureTime.delete(lastFailureKey)
      this.lastFailureTime.delete(failureCountKey)

      this.isUnlocked = true
      this.password = password
      this.sessionToken = crypto.randomBytes(16).toString('hex')

      return { unlocked: true }
    } catch (err) {
      // Increment failure count
      const newCount = failureCount + 1
      this.lastFailureTime.set(lastFailureKey, now)
      this.lastFailureTime.set(failureCountKey, newCount)

      return {
        unlocked: false,
        retryAfterMs: newCount >= 5 ? 1000 : 0
      }
    }
  }

  lock(): void {
    this.isUnlocked = false
    this.sessionToken = null
    this.secrets = {}
    this.workspace = ''
    this.password = ''
  }

  getSessionToken(): string | null {
    return this.isUnlocked ? this.sessionToken : null
  }

  isLocked(): boolean {
    return !this.isUnlocked
  }

  setSecret(key: string, value: string): void {
    if (!this.isUnlocked) throw new Error('vault_locked')
    this.secrets[key] = value
    this.persist()
  }

  getSecret(key: string): string | undefined {
    if (!this.isUnlocked) throw new Error('vault_locked')
    return this.secrets[key]
  }

  getAllSecrets(): Record<string, string> {
    if (!this.isUnlocked) throw new Error('vault_locked')
    return { ...this.secrets }
  }

  deleteSecret(key: string): void {
    if (!this.isUnlocked) throw new Error('vault_locked')
    delete this.secrets[key]
    this.persist()
  }

  private persist(): void {
    if (!this.isUnlocked) throw new Error('vault_locked')

    const vaultData: VaultData = {
      secrets: this.secrets,
      createdAt: Date.now(),
      workspace: this.workspace
    }

    const plaintext = Buffer.from(JSON.stringify(vaultData), 'utf-8')
    const envelope = encrypt(plaintext, this.password)
    const serialized = vaultStore.serialize(envelope)
    vaultStore.write(serialized)
  }
}

export const vaultService = new VaultService()
