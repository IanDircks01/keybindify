const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('auth', {
  authenticate: () => ipcRenderer.invoke('auth-user:save')
})