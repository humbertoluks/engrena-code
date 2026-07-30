const { contextBridge, ipcRenderer } = require('electron')

const api = {
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event: any, ...args: unknown[]) => listener(...args))
  },
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data)
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
