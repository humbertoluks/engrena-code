/** Tipagem de `window.electronAPI` espelhando `src/preload/index.ts` — sem importar electron. */

interface EngrenaVaultApi {
  getSessionToken: () => Promise<string | null>
  isLocked: () => Promise<boolean>
  lock: () => Promise<void>
  onLocked: (listener: () => void) => void
}

interface EngrenaDialogApi {
  openFolder: () => Promise<{ canceled: boolean; path: string | null }>
}

interface EngrenaShellApi {
  openExternal: (url: string) => Promise<boolean>
}

interface EngrenaElectronApi {
  vault: EngrenaVaultApi
  dialog: EngrenaDialogApi
  shell: EngrenaShellApi
}

interface Window {
  electronAPI: EngrenaElectronApi
}
