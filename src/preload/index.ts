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
  terminal: {
    create: (input: { projectId: string; threadId: string | null; cols: number; rows: number }) =>
      ipcRenderer.invoke('engrenacode:terminal:create', input),
    kill: (sessionId: string) => ipcRenderer.invoke('engrenacode:terminal:kill', { sessionId }),
    write: (sessionId: string, data: string): void => {
      ipcRenderer.send('engrenacode:terminal:write', { sessionId, data })
    },
    resize: (sessionId: string, cols: number, rows: number): void => {
      ipcRenderer.send('engrenacode:terminal:resize', { sessionId, cols, rows })
    },
    onData: (listener: (event: { sessionId: string; chunk: string }) => void) => {
      ipcRenderer.on('engrenacode:terminal:data', (_event: unknown, data: { sessionId: string; chunk: string }) =>
        listener(data)
      )
    },
    onExit: (
      listener: (event: { sessionId: string; exitCode: number; signal: number | null; expected: boolean }) => void
    ) => {
      ipcRenderer.on(
        'engrenacode:terminal:exit',
        (_event: unknown, data: { sessionId: string; exitCode: number; signal: number | null; expected: boolean }) =>
          listener(data)
      )
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
