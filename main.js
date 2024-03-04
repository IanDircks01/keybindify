const { app, Tray, Menu, nativeImage, BrowserWindow, globalShortcut, screen, ipcMain, nativeTheme } = require('electron')
const express = require('express')
const Store = require('electron-store')
const querystring = require("querystring")
require('dotenv').config()

const store = new Store()

var expressApp = express()

expressApp.get('/login', (req, res) => {
  var state = generateRandomString(16)
  var scope = 'user-read-private user-read-email'

  res.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
    response_type: 'code',
    client_id: process.env.CLIENT_ID,
    scope: scope,
    redirect_uri: process.env.REDIRECT_URL,
    state: state
  }))
})

expressApp.get('/callback', (req, res) => {
  var code = req.query.code || null
  var state = req.query.state || null

  if (state === null) {
    res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }))
  } else {
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: process.env.REDIRECT_URL,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      },
      json: true
    };
  }
});

const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

let tray
let playerWindow = undefined

const path = require('node:path')

let authorization = store.get('token')

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
        preload: path.join(__dirname, '/scripts/playerBridge.js')
      },
      alwaysOnTop: true
    })

    playerWindow.loadFile('./pages/player.html')

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

const authenticateUser = () => {
  const loginWindow = new BrowserWindow({
    height: 800,
    width: 800,
    Menu: null,
    webPreferences: {
      preload: path.join(__dirname, '/scripts/authBridge.js')
    }
  })

  loginWindow.loadURL('http://localhost:3000/login');
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

    if (authorization === undefined) {
      authenticateUser()
    } else {
      togglePlayerWindow()
    }
})

expressApp.listen(process.env.PORT, () => {
  console.log(`Application now listening on port ${process.env.PORT}`)
})