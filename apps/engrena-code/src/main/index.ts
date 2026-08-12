import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import isDev from 'electron-is-dev'
import { vaultService } from '../services/vault/vault-service.js'
import { createUnlockServer } from '../services/http/unlock-handler.js'
import { ptySessionRegistry, type CreateSessionInput } from '../services/terminal/pty-session-registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

/** Ícone da janela: extraResources em produção, assets/ no disco em dev. */
function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '../assets/icon.png'),
    path.join(__dirname, '../../assets/icon.png'),
  ]
  return candidates.find((p) => fs.existsSync(p))
}

function createWindow() {
  const icon = resolveWindowIcon()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0a0b',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Microfone (F27 — ditado por voz): Electron nega getUserMedia por padrão em app empacotado
  // sem handler explícito. Libera 'media' só pra própria janela principal, nunca globalmente.
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && webContents === mainWindow?.webContents)
  })

  if (isDev) {
    const fromVite = import.meta.env.VITE_DEV_SERVER_URL
    const fromProcess = process.env.VITE_DEV_SERVER_URL
    const devServerUrl =
      (typeof fromVite === 'string' && fromVite.trim() !== '' ? fromVite : undefined) ??
      (typeof fromProcess === 'string' && fromProcess.trim() !== '' ? fromProcess : undefined) ??
      'http://localhost:5173'
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  // Sem AppUserModelId o Windows agrupa/caches como Electron genérico e ignora o ícone do .exe.
  app.setAppUserModelId('com.lukse.engrenacode')
  Menu.setApplicationMenu(null)
  createUnlockServer(5174)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// Vault IPC handlers
ipcMain.handle('engrenacode:vault:get-session', () => {
  return vaultService.getSessionToken()
})

ipcMain.handle('engrenacode:vault:is-locked', () => {
  return vaultService.isLocked()
})

ipcMain.handle('engrenacode:vault:lock', () => {
  vaultService.lock()
  mainWindow?.webContents.send('engrenacode:vault:locked')
  return true
})

// Workspace IPC handlers
ipcMain.handle('engrenacode:dialog:open-folder', async () => {
  if (!mainWindow) return { canceled: true, path: null }
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return { canceled: result.canceled, path: result.canceled ? null : (result.filePaths[0] ?? null) }
})

// Git IPC handlers (F14) — abre a URL do PR no browser do SO; allowlist https only.
ipcMain.handle('engrenacode:shell:open-external', async (_event, url: unknown) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false
  await shell.openExternal(url)
  return true
})

// Terminal PTY IPC handlers (F26) — streaming main<->renderer, sem HTTP/vault envolvidos.

/** `typeof x === 'number'` aceita NaN/Infinity/negativo — dimensão de PTY inválida quebra o host nativo. */
function isValidPtyDimension(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 500
}

function isCreateSessionInput(value: unknown): value is CreateSessionInput {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.projectId === 'string' &&
    (v.threadId === null || typeof v.threadId === 'string') &&
    isValidPtyDimension(v.cols) &&
    isValidPtyDimension(v.rows)
  )
}

ipcMain.handle('engrenacode:terminal:create', (_event, payload: unknown) => {
  if (!isCreateSessionInput(payload)) {
    return { error: { code: 'validation_error', message: 'Payload inválido para criar sessão de terminal.' } }
  }
  return ptySessionRegistry.create(payload)
})

ipcMain.handle('engrenacode:terminal:kill', (_event, payload: unknown) => {
  const sessionId =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).sessionId : undefined
  if (typeof sessionId !== 'string') {
    return { error: { code: 'validation_error', message: 'sessionId inválido.' } }
  }
  return ptySessionRegistry.kill(sessionId)
})

ipcMain.on('engrenacode:terminal:write', (_event, payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) return
  const { sessionId, data } = payload as Record<string, unknown>
  if (typeof sessionId === 'string' && typeof data === 'string') {
    ptySessionRegistry.write(sessionId, data)
  }
})

ipcMain.on('engrenacode:terminal:resize', (_event, payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) return
  const { sessionId, cols, rows } = payload as Record<string, unknown>
  if (typeof sessionId === 'string' && isValidPtyDimension(cols) && isValidPtyDimension(rows)) {
    ptySessionRegistry.resize(sessionId, cols, rows)
  }
})

ptySessionRegistry.on('data', (event) => {
  mainWindow?.webContents.send('engrenacode:terminal:data', event)
})

ptySessionRegistry.on('exit', (event) => {
  mainWindow?.webContents.send('engrenacode:terminal:exit', event)
})
