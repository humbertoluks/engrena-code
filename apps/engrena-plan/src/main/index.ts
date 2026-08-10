import { app, BrowserWindow, ipcMain, Menu } from 'electron'
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
    width: 1100,
    height: 760,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    const fromVite = import.meta.env.VITE_DEV_SERVER_URL
    const fromProcess = process.env.VITE_DEV_SERVER_URL
    const devServerUrl =
      (typeof fromVite === 'string' && fromVite.trim() !== '' ? fromVite : undefined) ??
      (typeof fromProcess === 'string' && fromProcess.trim() !== '' ? fromProcess : undefined) ??
      'http://localhost:5175'
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
  Menu.setApplicationMenu(null)
  createUnlockServer(5184)
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

ipcMain.handle('engrenaplan:vault:get-session', () => {
  return vaultService.getSessionToken()
})

ipcMain.handle('engrenaplan:vault:is-locked', () => {
  return vaultService.isLocked()
})

ipcMain.handle('engrenaplan:vault:lock', () => {
  vaultService.lock()
  mainWindow?.webContents.send('engrenaplan:vault:locked')
  return true
})
