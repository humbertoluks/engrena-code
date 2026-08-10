/**
 * Code app vault singleton — wires @engrena/vault with ENGRENACODE_USER_DATA
 * (smoke/tests) and Electron userData as fallback. Plan will use the same
 * package with ENGRENAPLAN_USER_DATA.
 */
import { app } from 'electron'
import { createVault } from '@engrena/vault'

export const { vaultStore, vaultService } = createVault({
  userDataEnvVar: 'ENGRENACODE_USER_DATA',
  fallbackUserData: () => app.getPath('userData'),
})
