const { contextBridge, ipcRenderer } = require('electron')

const api = {
  vault: {
    getSessionToken: () => ipcRenderer.invoke('engrenaplan:vault:get-session'),
    isLocked: () => ipcRenderer.invoke('engrenaplan:vault:is-locked'),
    lock: () => ipcRenderer.invoke('engrenaplan:vault:lock'),
    onLocked: (listener: () => void) => {
      ipcRenderer.on('engrenaplan:vault:locked', listener)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
