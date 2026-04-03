const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key)
  },
  apiKey: {
    set: (apiKey) => ipcRenderer.invoke('apikey:set', apiKey),
    get: () => ipcRenderer.invoke('apikey:get'),
    delete: () => ipcRenderer.invoke('apikey:delete')
  },
  openai: {
    getPort: () => ipcRenderer.invoke('openai:port')
  },
  app: {
    getProjectsPath: () => ipcRenderer.invoke('app:getProjectsPath'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getRuntimeFlags: () => ipcRenderer.invoke('app:getRuntimeFlags')
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder')
  },
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    readFileBase64: (filePath) => ipcRenderer.invoke('fs:readFileBase64', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
    mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
    readdir: (dirPath) => ipcRenderer.invoke('fs:readdir', dirPath),
    downloadImage: (url, savePath) => ipcRenderer.invoke('fs:downloadImage', url, savePath)
  }
});
