import {
  createUserDataResolver,
  createVaultStore,
  type UserDataResolver,
  type VaultStore,
} from './store.js'
import { createVaultService, type VaultService } from './vault-service.js'

export interface CreateVaultOptions {
  /** Env var checked first (e.g. ENGRENACODE_USER_DATA / ENGRENAPLAN_USER_DATA). */
  userDataEnvVar: string
  /** Fallback when the env var is unset (typically Electron `app.getPath('userData')`). */
  fallbackUserData: () => string
}

export interface CreateVaultFromResolverOptions {
  resolveUserData: UserDataResolver
}

export interface VaultInstance {
  vaultStore: VaultStore
  vaultService: VaultService
}

/** App-facing factory: env override + Electron (or other) fallback. */
export function createVault(options: CreateVaultOptions): VaultInstance {
  const resolveUserData = createUserDataResolver({
    userDataEnvVar: options.userDataEnvVar,
    fallbackUserData: options.fallbackUserData,
  })
  return createVaultFromResolver({ resolveUserData })
}

/** Direct factory for tests that already own a temp directory. */
export function createVaultFromResolver(options: CreateVaultFromResolverOptions): VaultInstance {
  const vaultStore = createVaultStore(options.resolveUserData)
  const vaultService = createVaultService(vaultStore)
  return { vaultStore, vaultService }
}
