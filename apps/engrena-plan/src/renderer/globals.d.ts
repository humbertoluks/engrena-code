interface PlanVaultApi {
  getSessionToken: () => Promise<string | null>
  isLocked: () => Promise<boolean>
  lock: () => Promise<boolean>
  onLocked: (listener: () => void) => void
}

interface PlanElectronApi {
  vault: PlanVaultApi
}

declare global {
  interface Window {
    electronAPI?: PlanElectronApi
  }
}

export {}
