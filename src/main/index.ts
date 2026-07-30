import { app, BrowserWindow, ipcMain } from 'electron'
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
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.ts'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../../dist/index.html')}`

  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
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
