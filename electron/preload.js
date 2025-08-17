const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action))
  },
  removeMenuActionListener: () => {
    ipcRenderer.removeAllListeners('menu-action')
  },
  shutdown: () => ipcRenderer.invoke('app-shutdown')
})
