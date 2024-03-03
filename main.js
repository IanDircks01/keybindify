const { app, Tray, Menu, nativeImage, BrowserWindow, globalShortcut, screen, ipcMain, nativeTheme } = require('electron')
require('dotenv').config()

let tray
let playerWindow = undefined

const path = require('node:path')

const togglePlayerWindow = () => {
  if (playerWindow === undefined) {
    const workArea = screen.getPrimaryDisplay().workAreaSize
    playerWindow = new BrowserWindow({ 
      width: 400, 
      height: 100, 
      show: false, 
      frame: false, 
      x: workArea.width - 400, 
      y: workArea.height - 100, 
      resizable: false, 
      roundedCorners: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      },
      alwaysOnTop: true
    })

    playerWindow.loadFile('./pages/index.html')

    ipcMain.handle('dark-mode:toggle', () => {
      if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light'
      } else {
        nativeTheme.themeSource = 'dark'
      }
      return nativeTheme.shouldUseDarkColors
    })
  
    ipcMain.handle('dark-mode:system', () => {
      nativeTheme.themeSource = 'system'
    })
  }

  if (playerWindow.isVisible()) {
    playerWindow.hide()
  } else {
    playerWindow.show()
  }
}

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath('./assets/icon.png')
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
      { label: "Exit", click: () => { app.quit() } }
    ])

    tray.setToolTip("Keybindify")
    tray.setContextMenu(contextMenu)

    globalShortcut.register('Alt+CommandOrControl+F9', () => togglePlayerWindow())

    togglePlayerWindow()
})