const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopTooltip', {
  onText(callback) { ipcRenderer.on('desktop:tooltip-text', (_event, text) => callback(text)); },
  onTheme(callback) { ipcRenderer.on('desktop:theme', (_event, theme) => callback(theme)); }
});
