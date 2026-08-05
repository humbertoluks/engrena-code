import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import isDev from 'electron-is-dev'
import { vaultService } from '../services/vault/vault-service.js'
import { createUnlockServer } from '../services/http/unlock-handler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
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
