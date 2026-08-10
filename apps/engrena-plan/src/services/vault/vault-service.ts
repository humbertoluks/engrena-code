/**
 * Plan app vault singleton — wires @engrena/vault with ENGRENAPLAN_USER_DATA
 * and Electron userData as fallback (appId com.lukse.engrenaplan).
 */
import { app } from 'electron'
import { createVault } from '@engrena/vault'

export const { vaultStore, vaultService } = createVault({
  userDataEnvVar: 'ENGRENAPLAN_USER_DATA',
  fallbackUserData: () => app.getPath('userData'),
})
