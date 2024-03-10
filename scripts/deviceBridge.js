const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
    getDevices: () => ipcRenderer.invoke('getDevices'),
    setDevice: (args) => ipcRenderer.invoke('setDevice', args)
})