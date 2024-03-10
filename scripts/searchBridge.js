const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  searchForSong: (args) => ipcRenderer.invoke('searchForSong', args),
  addSongToQueue: (args) => ipcRenderer.invoke('addSongToQueue', args),
  resizeSearchWindow: (height, width) => ipcRenderer.invoke('resizeSearchWindow', height, width),
  getDevices: () => ipcRenderer.invoke('getDevices')
})