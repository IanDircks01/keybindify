const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  getPlayerState: () => ipcRenderer.invoke('getPlayerState'),
  setRepeatState: (args) => ipcRenderer.invoke('setRepeatState', args),
  setShuffleState: (args) => ipcRenderer.invoke('setShuffleState', args),
  setVolumeState: (args) => ipcRenderer.invoke('setVolumeState', args),
  seekToPosition: (args) => ipcRenderer.invoke('seekToPosition', args),
  pausePlayback: () => ipcRenderer.invoke('pausePlayback'),
  resumePlayback: () => ipcRenderer.invoke('resumePlayback'),
  skipToNext: () => ipcRenderer.invoke('skipToNext'),
  skipToPrevious: () => ipcRenderer.invoke('skipToPrevious')
})