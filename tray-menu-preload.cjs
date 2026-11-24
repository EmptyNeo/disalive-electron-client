const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopTray', {
  action(value) { ipcRenderer.send('desktop:tray-action', value); },
  onTheme(callback) { ipcRenderer.on('desktop:theme', (_event, value) => callback(value)); }
});
