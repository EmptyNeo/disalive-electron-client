const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenPicker', {
  onSources(callback) {
    ipcRenderer.on('desktop:sources', (_event, sources) => callback(sources));
  },
  choose(sourceId) {
    ipcRenderer.send('desktop:pick-source', sourceId);
  },
  cancel() {
    ipcRenderer.send('desktop:cancel-source');
  },
  refresh() {
    ipcRenderer.send('desktop:refresh-sources');
  }
});
