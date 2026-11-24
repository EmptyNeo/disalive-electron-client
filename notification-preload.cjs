const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopNotifications', {
  action(value, id) { ipcRenderer.send('desktop:notification-action', value, id); },
  onNotifications(callback) { ipcRenderer.on('desktop:notifications', (_event, value) => callback(value)); },
  onTheme(callback) { ipcRenderer.on('desktop:theme', (_event, value) => callback(value)); }
});
