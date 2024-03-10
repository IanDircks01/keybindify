const { app, components, Tray, Menu, nativeImage, BrowserWindow, globalShortcut, screen, ipcMain, nativeTheme, dialog } = require('electron')
const express = require('express')
const axios = require('axios')
const Store = require('electron-store')
const querystring = require("querystring")
const PubSub = require('pubsub-js')
const path = require('node:path')
require('dotenv').config()

const store = new Store()
var expressApp = express()

expressApp.get('/login', (req, res) => {
  var state = generateRandomString(16)
  var scope = 'user-modify-playback-state user-read-currently-playing user-read-playback-state user-read-private user-library-read user-library-modify app-remote-control streaming user-read-email user-read-private'

  res.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
    response_type: 'code',
    client_id: process.env.CLIENT_ID,
    scope: scope,
    redirect_uri: process.env.REDIRECT_URL,
    state: state
  }))
})

expressApp.get('/callback', async (req, res) => {
  var code = req.query.code || null
  var state = req.query.state || null

  if (state === null) {
    res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }))
  } else {
    let authRes = await axios.post('https://accounts.spotify.com/api/token', {
      code: code,
      redirect_uri: process.env.REDIRECT_URL,
      grant_type: 'authorization_code'
    }, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      }
    })

    if (authRes.status == 200) {
      store.set('refreshToken', authRes.data.refresh_token)
      store.set('accessToken', {
        expire: Date.now() + (authRes.data.expires_in * 1000),
        token: authRes.data.access_token
      })
      loginWindow.setSize(550, 200)
      res.send('<h1 style="color: #cdd6f4;">Authentication successful!<br/>You may now close this window.</h1>')
      PubSub.publish('newAuth', store.get('accessToken'))
    } else {
      res.status(402).send("Unable to get auth")
    }
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
let loginWindow = undefined
let deviceWindow = undefined
let profile = undefined

let currentPlaybackDevice = undefined

const getAuthorizationToken = async () => {
  const tokenInfo = store.get('accessToken')

  try {
    if (!tokenInfo) {
      console.log("No Token Found")
      await authenticateUser()
    } else {
      if (tokenInfo?.expire < Date.now()) {
        console.log('Token Expired, refreshing')
        store.delete('accessToken')
        await refreshAccessToken()
      } else {
        PubSub.publish('tokenValid', store.get('accessToken'))
      }
    }
  
    return store.get('accessToken')
  } catch (err) {
    console.log(err)
    return undefined
  }

}

const refreshAccessToken = async () => {
  try {
    let authRes = await axios.post('https://accounts.spotify.com/api/token', {
      grant_type: 'refresh_token',
      refresh_token: store.get('refreshToken')
    }, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      }
    })
    store.delete('refreshToken')
    store.set('refreshToken', authRes.data.refresh_token)
    store.set('accessToken', {
      expire: Date.now() + authRes.data.expires_in,
      token: authRes.data.access_token
    })

    PubSub.publish('tokenRefreshed', store.get('accessToken'))
  } catch (err) {
    console.log(err)
    await authenticateUser()
  }
}

const togglePlayerWindow = () => {
  if (playerWindow === undefined) {
    const workArea = screen.getPrimaryDisplay().workAreaSize
    playerWindow = new BrowserWindow({ 
      width: 400, 
      height: 105, 
      show: false, 
      frame: false, 
      x: workArea.width - 400, 
      y: workArea.height - 105, 
      resizable: false, 
      roundedCorners: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, '/scripts/playerBridge.js'),
        plugins: true
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

const toggleSearchWindow = async () => {
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

    await searchWindow.loadFile('./pages/search.html')
    devices = await getDevices()
  }

  if (searchWindow.isVisible()) {
    searchWindow.hide()
  } else {
    searchWindow.show()
  }
}

const toggleDeviceWindow = () => {
  if (deviceWindow === undefined) {
    deviceWindow = new BrowserWindow({
      width: 500,
      height: 500,
      show: false,
      frame: false,
      resizable: false,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(__dirname, '/scripts/deviceBridge.js')
      }
    })
  
    deviceWindow.on('show', () => {
      deviceWindow.webContents.executeJavaScript('syncDeviceList()')
    })
    
    deviceWindow.loadFile('./pages/device.html')
  }

  if (deviceWindow.isVisible()) {
    deviceWindow.hide()
  } else {
    deviceWindow.show()
  }
}

const authenticateUser = async () => {
  loginWindow = new BrowserWindow({
    height: 800,
    width: 800,
    Menu: null,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e2e'
  })

  await loginWindow.loadURL('http://localhost:3000/login')
}

const getUserProfile = async (token) => {
  try {
    let res = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (res.status == 200 || res.status == 204) {
      return res.data
    } else {
      return undefined
    }

  } catch (err) {
    console.log(err)
    return undefined
  }
}

const getDevices = async () => {
  const { expire, token } = await getAuthorizationToken()
  const res = await axios.get(`https://api.spotify.com/v1/me/player?market=${profile.country}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (res.status == 200) {
    return res.data
  } else if (res.status == 204) {
    return undefined
  }
}

app.whenReady().then(async () => {
  await components.whenReady()
  const icon = nativeImage.createFromPath('./assets/icon.png')
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: "Exit", click: () => { app.quit() } }
  ])

  ipcMain.handle('searchForSong', async (event, args) => {
    const { expire, token } = await getAuthorizationToken()
    const res = await axios.get(`https://api.spotify.com/v1/search?q=${args}&type=track&market=${profile.country}`, {
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
    
    const res = await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${args}`, undefined, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (res.status == 200 || res.status == 204) {
      await toggleSearchWindow()
      return undefined
    } else if (res.status == 404) {
      let devices = await getDevices()

      const res2 = await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${args}&device_id=${currentPlaybackDevice.id}`, undefined, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res2.status == 200 || res2.status == 204) {
        await toggleSearchWindow()
        return undefined
      }
    }
  })

  ipcMain.handle('resizeSearchWindow', async (event, height, width) => {
    searchWindow.setSize(height, width);
  })

  ipcMain.handle('getPlayerState', async (event, args) => {
    return await getDevices()
  })

  ipcMain.handle('getAccessToken', async (event) => {
    let token = await getAuthorizationToken()
    return token
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

  ipcMain.handle('getDevices', async (event, args) => {
    const { expire, token } = await getAuthorizationToken()
    const res = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (res.status == 200) {
      return res.data.devices
    } else if (res.status == 204) {
      return undefined
    }
  })

  ipcMain.handle('setDevice', (event, args) => {
    currentPlaybackDevice = args
    deviceWindow.hide()
    return currentPlaybackDevice
  })

  ipcMain.handle('showDeviceChooser', (event, args) => {
    toggleDeviceWindow()
  })

  ipcMain.handle('checkLove', async (event, args) => {
    const { expire, token } = await getAuthorizationToken()
    const res = await axios.get(`https://api.spotify.com/v1/me/tracks/contains?ids=${args}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (res.status == 200) {
      return res.data[0]
    } else if (res.status == 204) {
      return undefined
    }
  })

  ipcMain.handle('loveTrack', async (event, args) => {
    const { expire, token } = await getAuthorizationToken()
    const res = await axios.put(`https://api.spotify.com/v1/me/tracks?ids=${args}`, undefined, {
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

  ipcMain.handle('unloveTrack', async (event, args) => {
    const { expire, token } = await getAuthorizationToken()
    const res = await axios.delete(`https://api.spotify.com/v1/me/tracks?ids=${args}`, {
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
    const res = await axios.put(`https://api.spotify.com/v1/me/player/repeat?state=${args}&device_id=${currentPlaybackDevice.id}`, undefined, {
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
    const res = await axios.put(`https://api.spotify.com/v1/me/player/shuffle?state=${args}&device_id=${currentPlaybackDevice.id}`, undefined, {
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
    const res = await axios.put(`https://api.spotify.com/v1/me/player/volume?volume_percent=${args}&device_id=${currentPlaybackDevice.id}`, undefined, {
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
    const res = await axios.put(`https://api.spotify.com/v1/me/player/pause?device_id=${currentPlaybackDevice.id}`, undefined, {
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
    const res = await axios.put(`https://api.spotify.com/v1/me/player/play?device_id=${currentPlaybackDevice.id}`, {
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
    const res = await axios.post(`https://api.spotify.com/v1/me/player/next?device_id=${currentPlaybackDevice.id}`, undefined, {
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
    const res = await axios.post(`https://api.spotify.com/v1/me/player/previous?device_id=${currentPlaybackDevice.id}`, undefined, {
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

  PubSub.subscribe('newAuth', async (msg, data) => {
    profile = await getUserProfile(store.get('accessToken').token)

    if (profile == undefined) {
      dialog.showErrorBox("Profile Error", "Unable to retrieve account information, please relaunch application and login into account.")
      store.clear()
      app.quit()
      return
    }

    if (profile.product != 'premium') {
      dialog.showErrorBox("Auth Error", "Your account is required to have spotify premium to use this application. Please subscribe then relaunch this app.")
      store.clear()
      app.quit()
      return
    }

    togglePlayerWindow()
    PubSub.unsubscribe('newAuth')
    //loginWindow.close()
  })

  PubSub.subscribe('tokenValid', async (msg, data) => {
    profile = await getUserProfile(store.get('accessToken').token)

    togglePlayerWindow()
    PubSub.unsubscribe('tokenValid')
  })

  PubSub.subscribe()

  await getAuthorizationToken()
})

expressApp.listen(process.env.PORT, () => {
  console.log(`Application now listening on port ${process.env.PORT}`)
})