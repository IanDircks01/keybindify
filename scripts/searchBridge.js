const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  searchForSong: (args) => ipcRenderer.invoke('searchForSong', args)
})