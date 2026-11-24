const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('disaliveDesktop', {
  updateTitle(title, route, icon) { ipcRenderer.send('desktop:title', { title, route, icon }); },
  showNotification(data) { ipcRenderer.send('desktop:notification', data); },
  setHotkeys(data) { ipcRenderer.send('desktop:hotkeys', data); },
  onHotkey(callback) { ipcRenderer.on('desktop:hotkey', (_event, action) => callback(action)); },
  onNavigate(callback) { ipcRenderer.on('desktop:navigate', (_event, route) => callback(route)); }
});

function publishTheme() {
  const style = getComputedStyle(document.documentElement);
  ipcRenderer.send('desktop:theme', {
    background: style.getPropertyValue('--background-tertiary').trim(),
    railGradient: style.getPropertyValue('--app-rail-gradient').trim(),
    railHeight: window.innerHeight + 38,
    foreground: style.getPropertyValue('--text-normal').trim(),
    muted: style.getPropertyValue('--text-muted').trim(),
    border: style.getPropertyValue('--outline').trim(),
    accent: style.getPropertyValue('--brand').trim(),
    danger: style.getPropertyValue('--status-danger').trim()
  });
}

function removePageChrome(root) {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.matches('.navbar, .footer')) root.remove();
  else root.querySelectorAll('.navbar, .footer').forEach(element => element.remove());
}

window.addEventListener('DOMContentLoaded', () => {
  removePageChrome(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) removePageChrome(node);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  new MutationObserver(publishTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  window.addEventListener('resize', publishTheme);
  publishTheme();
  setTimeout(publishTheme, 1000);
});
