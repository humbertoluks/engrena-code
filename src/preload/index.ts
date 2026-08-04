const { contextBridge, ipcRenderer } = require('electron')

const api = {
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event: any, ...args: unknown[]) => listener(...args))
  },
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  // Vault-specific handlers
  vault: {
    getSessionToken: () => ipcRenderer.invoke('engrenacode:vault:get-session'),
    isLocked: () => ipcRenderer.invoke('engrenacode:vault:is-locked'),
    lock: () => ipcRenderer.invoke('engrenacode:vault:lock'),
    onLocked: (listener: () => void) => {
      ipcRenderer.on('engrenacode:vault:locked', listener)
    }
  },
  dialog: {
    openFolder: (): Promise<{ canceled: boolean; path: string | null }> =>
      ipcRenderer.invoke('engrenacode:dialog:open-folder')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
