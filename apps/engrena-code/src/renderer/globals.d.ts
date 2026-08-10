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

interface EngrenaCreateSessionInput {
  projectId: string
  threadId: string | null
  cols: number
  rows: number
}

interface EngrenaCreateSessionSuccess {
  sessionId: string
  shell: string
  cwd: string
}

interface EngrenaSessionError {
  error: { code: string; message: string }
}

interface EngrenaTerminalDataEvent {
  sessionId: string
  chunk: string
}

interface EngrenaTerminalExitEvent {
  sessionId: string
  exitCode: number
  signal: number | null
  expected: boolean
}

interface EngrenaTerminalApi {
  create: (
    input: EngrenaCreateSessionInput
  ) => Promise<EngrenaCreateSessionSuccess | EngrenaSessionError>
  kill: (sessionId: string) => Promise<{ ok: true } | EngrenaSessionError>
  write: (sessionId: string, data: string) => void
  resize: (sessionId: string, cols: number, rows: number) => void
  onData: (listener: (event: EngrenaTerminalDataEvent) => void) => () => void
  onExit: (listener: (event: EngrenaTerminalExitEvent) => void) => () => void
}

interface EngrenaElectronApi {
  vault: EngrenaVaultApi
  dialog: EngrenaDialogApi
  shell: EngrenaShellApi
  terminal: EngrenaTerminalApi
}

interface Window {
  electronAPI: EngrenaElectronApi
}
