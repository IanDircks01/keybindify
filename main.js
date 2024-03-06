const { app, Tray, Menu, nativeImage, BrowserWindow, globalShortcut, screen, ipcMain, nativeTheme, dialog } = require('electron')
const express = require('express')
const axios = require('axios')
const Store = require('electron-store')
const querystring = require("querystring")
const path = require('node:path')
require('dotenv').config()

const store = new Store()
var expressApp = express()

expressApp.get('/login', (req, res) => {
  var state = generateRandomString(16)
  var scope = 'user-modify-playback-state user-read-currently-playing user-read-playback-state'

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
    axios.post('https://accounts.spotify.com/api/token', {
      code: code,
      redirect_uri: process.env.REDIRECT_URL,
      grant_type: 'authorization_code'
    }, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      }
    }).then((response) => {
      if (response.status == 200) {
        store.set('refreshToken', response.data.refresh_token)
        store.set('accessToken', {
          expire: Date.now() + (response.data.expires_in * 1000),
          token: response.data.access_token
        })
        res.send(response.data)
      } else {
        res.send("Unable to get auth", 402)
      }
    }).catch((error) => {
      console.log(error)
      res.send(error, 500)
    })
  }
});

const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

let tray
let playerWindow = undefined
let searchWindow = undefined

const getAuthorizationToken = async () => {
  const tokenInfo = store.get('accessToken')
  if (!tokenInfo) {
    await authenticateUser()
  } else {
    if (tokenInfo?.expire < Date.now()) {
      store.delete('refreshToken')
      store.delete('accessToken')
      await refreshAccessToken()
    }
  }

  return store.get('accessToken')
}

const refreshAccessToken = () => {
  axios.post('https://accounts.spotify.com/api/token', {
    grant_type: 'refresh_token',
    refresh_token: store.get('refreshToken')
  }, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
    }
  }).then((response) => {
    if (response.status == 200) {
      store.set('refreshToken', response.data.refresh_token)
      store.set('accessToken', {
        expire: Date.now() + response.data.expires_in,
        token: response.data.access_token
      })
    }
  }).catch((error) => {
    console.log(error)
  })
}

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
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '/scripts/playerBridge.js')
      }
    })

    playerWindow.loadFile('./pages/player.html')
  }

  if (playerWindow.isVisible()) {
    playerWindow.hide()
  } else {
    playerWindow.show()
  }
}

const toggleSearchWindow = () => {
  if (searchWindow === undefined) {
    searchWindow = new BrowserWindow({
      width: 800,
      height: 60,
      show: false,
      frame: false,
      resizable: false,
      roundedCorners: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '/scripts/searchBridge.js')
      }
    })

    searchWindow.on('show', () => {
      searchWindow.webContents.executeJavaScript('focusSearch()')
    })

    searchWindow.loadFile('./pages/search.html')
  }

  if (searchWindow.isVisible()) {
    searchWindow.hide()
  } else {
    searchWindow.show()
  }
}

const authenticateUser = async () => {
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

app.whenReady().then(async () => {
    const icon = nativeImage.createFromPath('./assets/icon.png')
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
      { label: "Exit", click: () => { app.quit() } }
    ])

    ipcMain.handle('searchForSong', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.get(`https://api.spotify.com/v1/search?q=${args}&type=track&market=US`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 200) {
        return res.data.tracks.items
      } else if (res.status == 204) {
        return undefined
      }
    })

    ipcMain.handle('addSongToQueue', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()

      const link = args.replaceAll(":", "%3A")

      const res = await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${link}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 200 || res.status == 204) {
        toggleSearchWindow()
        return undefined
      }
    })

    ipcMain.handle('getPlayerState', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.get('https://api.spotify.com/v1/me/player?market=US', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 200) {
        return res.data
      } else if (res.status == 204) {
        return undefined
      }
    })

    ipcMain.handle('seekToPosition', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put(`https://api.spotify.com/v1/me/player/seek?position_ms=${args}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('setRepeatState', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put(`https://api.spotify.com/v1/me/player/repeat?state=${args}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('setShuffleState', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put(`https://api.spotify.com/v1/me/player/shuffle?state=${args}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('setVolumeState', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put(`https://api.spotify.com/v1/me/player/volume?volume_percent=${args}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('pausePlayback', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put("https://api.spotify.com/v1/me/player/pause", undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('resumePlayback', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.put("https://api.spotify.com/v1/me/player/play", {
        "position_ms": 0
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('skipToNext', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.post("https://api.spotify.com/v1/me/player/next", undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    ipcMain.handle('skipToPrevious', async (event, args) => {
      const { expire, token } = await getAuthorizationToken()
      const res = await axios.post("https://api.spotify.com/v1/me/player/previous", undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status == 204) {
        return "ok"
      } else {
        return undefined
      }
    })

    tray.setToolTip("Keybindify")
    tray.setContextMenu(contextMenu)

    globalShortcut.register('Alt+CommandOrControl+F9', () => togglePlayerWindow())
    globalShortcut.register('Alt+CommandOrControl+F10', () => toggleSearchWindow())

    getAuthorizationToken().then((data) => {
      togglePlayerWindow()
    })
})

expressApp.listen(process.env.PORT, () => {
  console.log(`Application now listening on port ${process.env.PORT}`)
})