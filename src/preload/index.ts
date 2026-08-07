const { contextBridge, ipcRenderer } = require('electron')

const api = {
  vault: {
    getSessionToken: () => ipcRenderer.invoke('engrenacode:vault:get-session'),
    isLocked: () => ipcRenderer.invoke('engrenacode:vault:is-locked'),
    lock: () => ipcRenderer.invoke('engrenacode:vault:lock'),
    onLocked: (listener: () => void) => {
      ipcRenderer.on('engrenacode:vault:locked', listener)
    },
  },
  dialog: {
    openFolder: (): Promise<{ canceled: boolean; path: string | null }> =>
      ipcRenderer.invoke('engrenacode:dialog:open-folder'),
  },
  shell: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke('engrenacode:shell:open-external', url),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
