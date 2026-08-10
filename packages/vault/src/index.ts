export {
  deriveKey,
  encrypt,
  decrypt,
  serializeEnvelope,
  deserializeEnvelope,
  type CryptoEnvelope,
} from './crypto.js'

export {
  VaultStore,
  createVaultStore,
  createUserDataResolver,
  type VaultData,
  type UserDataResolver,
} from './store.js'

export { VaultService, createVaultService } from './vault-service.js'

export {
  createVault,
  createVaultFromResolver,
  type CreateVaultOptions,
  type CreateVaultFromResolverOptions,
  type VaultInstance,
} from './create-vault.js'
