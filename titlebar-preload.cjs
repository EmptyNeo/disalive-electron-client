const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopTitlebar', {
  control(command) { ipcRenderer.send('desktop:control', command); },
  tooltip(data) { ipcRenderer.send('desktop:tooltip', data); },
  onTitle(callback) { ipcRenderer.on('desktop:title', (_event, value) => callback(value)); },
  onNavigation(callback) { ipcRenderer.on('desktop:navigation', (_event, value) => callback(value)); },
  onTheme(callback) { ipcRenderer.on('desktop:theme', (_event, value) => callback(value)); },
  onMaximized(callback) { ipcRenderer.on('desktop:maximized', (_event, value) => callback(value)); }
});
