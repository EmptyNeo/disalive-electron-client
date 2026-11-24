const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('updateSplash', {
  onState(callback) { ipcRenderer.on('desktop:update-state', (_event, state) => callback(state)); },
  choose(action) { ipcRenderer.send('desktop:update-choice', action); }
});
