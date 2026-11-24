const path = require('node:path');
const hotkeys = require('./hotkeys.cjs');
const updater = require('./updater.cjs');
const { app, BrowserWindow, WebContentsView, Tray, Menu, nativeImage, desktopCapturer, dialog, ipcMain, screen, session, shell } = require('electron');

if (process.argv.some(argument => argument.startsWith('--squirrel-'))) {
  app.quit();
} else {
  const siteUrl = 'https://disalive.ru/app/';
  const siteOrigin = new URL(siteUrl).origin;
  const headerHeight = 32; //в Discord высота 32px
  const allowedPermissions = new Set(['media', 'display-capture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
  const defaultTheme = { background: '#1e1f22', foreground: '#dbdee1', muted: '#949ba4', border: '#3f4147', accent: '#0e6ee2', danger: '#ed4245' };
  let theme = { ...defaultTheme, 'rail-gradient': 'none', 'rail-gradient-height': '32px' };
  let mainWindow, appView, titleView, pickerView, tray, trayMenuWindow, notificationWindow, tooltipWindow, splashWindow;
  let updateChoiceResolver = null;
  let checkingUpdates = false;
  let applicationStarted = false;
  let htmlFullscreen = false;
  let notifications = [];
  const notificationTimers = new Map();
  let tooltipRequest = 0;
  let quitting = false;

  function isSiteUrl(value) {
    try { return new URL(value).origin === siteOrigin; } catch { return false; }
  }
  function openExternalUrl(value) {
    try {
      const url = new URL(value);
      if (['https:', 'http:'].includes(url.protocol)) void shell.openExternal(url.href);
    } catch { /* Ignore malformed links. */ }
  }
  function sendTo(view, channel, payload) {
    if (view?.webContents && !view.webContents.isDestroyed()) view.webContents.send(channel, payload);
  }
  function updateNavigation() {
    if (!appView) return;
    const history = appView.webContents.navigationHistory;
    sendTo(titleView, 'desktop:navigation', { back: history.canGoBack(), forward: history.canGoForward() });
  }
  function applyTheme(nextTheme) {
    if (!nextTheme || typeof nextTheme !== 'object') return;
    for (const key of Object.keys(defaultTheme)) {
      const value = nextTheme[key];
      if (typeof value === 'string' && value.length < 80 && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value)) theme[key] = value;
    }
    const gradient = nextTheme.railGradient;
    if (gradient === 'none' || (typeof gradient === 'string' && gradient.length < 512
      && /^linear-gradient\([\da-z#\s.,%()+-]+\)$/i.test(gradient) && !/url\s*\(/i.test(gradient))) {
      theme['rail-gradient'] = gradient;
    }
    if (Number.isSafeInteger(nextTheme.railHeight) && nextTheme.railHeight >= headerHeight
      && nextTheme.railHeight <= 16384) {
      theme['rail-gradient-height'] = `${nextTheme.railHeight}px`;
    }
    sendTo(titleView, 'desktop:theme', theme);
    if (notificationWindow && !notificationWindow.isDestroyed()) notificationWindow.webContents.send('desktop:theme', theme);
    if (trayMenuWindow && !trayMenuWindow.isDestroyed()) trayMenuWindow.webContents.send('desktop:theme', theme);
    if (tooltipWindow && !tooltipWindow.isDestroyed()) tooltipWindow.webContents.send('desktop:theme', theme);
  }

  async function selectDisplaySource() {
    return new Promise(resolve => {
      pickerView = new WebContentsView({ webPreferences: {
        preload: path.join(__dirname, 'screen-picker-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true
      } });
      pickerView.setBackgroundColor('#00000000');
      mainWindow.contentView.addChildView(pickerView);
      layoutViews();
      let finished = false;
      let sources = [];
      let refreshing = false;
      let refreshTimer;
      let lastRoster = null;
      const finish = source => {
        if (finished) return;
        finished = true;
        clearInterval(refreshTimer);
        ipcMain.removeListener('desktop:pick-source', onPick);
        ipcMain.removeListener('desktop:cancel-source', onCancel);
        ipcMain.removeListener('desktop:refresh-sources', onRefresh);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(pickerView);
        if (!pickerView.webContents.isDestroyed()) pickerView.webContents.close();
        pickerView = null;
        if (appView && !appView.webContents.isDestroyed()) appView.webContents.focus();
        resolve(source);
      };
      const onPick = (event, sourceId) => {
        if (event.sender === pickerView?.webContents) finish(sources.find(source => source.id === sourceId) || null);
      };
      const onCancel = event => { if (event.sender === pickerView?.webContents) finish(null); };
      const refresh = async () => {
        if (refreshing || finished) return;
        refreshing = true;
        try {
          const [windows, screens] = await Promise.all([
            desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 360, height: 210 }, fetchWindowIcons: true }),
            desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 360, height: 210 } })
          ]);
          if (finished) return;
          sources = [...windows, ...screens];
          const roster = sources.map(source => `${source.id}\u0000${source.name}`).sort().join('\u0001');
          if (roster === lastRoster) return;
          lastRoster = roster;
          sendTo(pickerView, 'desktop:sources', {
            theme,
            sources: sources.map(source => ({ id: source.id, name: source.name,
              type: source.id.startsWith('screen:') ? 'screen' : 'window',
              thumbnail: source.thumbnail.toDataURL(),
              icon: source.appIcon?.isEmpty() ? '' : source.appIcon?.toDataURL() || '' }))
          });
        } catch (error) {
          if (!finished) {
            lastRoster = null;
            sources = [];
            sendTo(pickerView, 'desktop:sources', { theme, sources: [], error: String(error) });
          }
        } finally { refreshing = false; }
      };
      const onRefresh = event => { if (event.sender === pickerView?.webContents) void refresh(); };
      ipcMain.on('desktop:pick-source', onPick);
      ipcMain.on('desktop:cancel-source', onCancel);
      ipcMain.on('desktop:refresh-sources', onRefresh);
      pickerView.webContents.on('destroyed', () => finish(null));
      pickerView.webContents.once('did-finish-load', () => {
        void refresh();
        refreshTimer = setInterval(() => {
          if (mainWindow?.isVisible() && !mainWindow.isMinimized()) void refresh();
        }, 3000);
      });
      pickerView.webContents.loadFile(path.join(__dirname, 'screen-picker.html')).catch(() => finish(null));
    });
  }
  function configurePermissions() {
    const webSession = session.defaultSession;
    webSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
      isSiteUrl(requestingOrigin) && allowedPermissions.has(permission));
    webSession.setPermissionRequestHandler((contents, permission, callback, details) =>
      callback(isSiteUrl(details.requestingUrl || contents.getURL()) && allowedPermissions.has(permission)));
    webSession.setDisplayMediaRequestHandler(async (request, callback) => {
      if (!isSiteUrl(request.securityOrigin) || !mainWindow || pickerView) return callback(null);
      try {
        const source = await selectDisplaySource();
        callback(source ? { video: source, ...(request.audioRequested ? { audio: 'loopback' } : {}) } : null);
      } catch { callback(null); }
    });
  }

  function layoutViews() {
    if (!mainWindow || !titleView || !appView) return;
    const [width, height] = mainWindow.getContentSize();
    titleView.setVisible(!htmlFullscreen);
    if (!htmlFullscreen) titleView.setBounds({ x: 0, y: 0, width, height: headerHeight });
    appView.setBounds({ x: 0, y: htmlFullscreen ? 0 : headerHeight,
      width, height: Math.max(1, height - (htmlFullscreen ? 0 : headerHeight)) });
    pickerView?.setBounds({ x: 0, y: 0, width, height });
  }
  function openMainWindow() {
    if (!mainWindow && splashWindow) { splashWindow.show(); splashWindow.focus(); return; }
    if (!mainWindow) createMainWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    trayMenuWindow?.hide();
  }
  function createMainWindow() {
    mainWindow = new BrowserWindow({ title: 'Disalive', width: 1280, height: 800, minWidth: 800, minHeight: 600,
      frame: false, backgroundColor: '#1e1f22', autoHideMenuBar: true,
      icon: path.join(__dirname, 'assets', 'icon.png') });
    titleView = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'titlebar-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true } });
    appView = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'app-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false,
      backgroundThrottling: false } });
    mainWindow.contentView.addChildView(appView);
    mainWindow.contentView.addChildView(titleView);
    layoutViews();
    mainWindow.on('resize', layoutViews);
    mainWindow.on('maximize', () => sendTo(titleView, 'desktop:maximized', true));
    mainWindow.on('unmaximize', () => sendTo(titleView, 'desktop:maximized', false));
    mainWindow.on('enter-full-screen', layoutViews);
    mainWindow.on('leave-full-screen', layoutViews);
    appView.webContents.on('enter-html-full-screen', () => {
      htmlFullscreen = true;
      layoutViews();
    });
    appView.webContents.on('leave-html-full-screen', () => {
      htmlFullscreen = false;
      layoutViews();
    });
    const handleFullScreenKey = (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') {
        event.preventDefault();
        if (htmlFullscreen) void appView.webContents.executeJavaScript('document.exitFullscreen()').catch(() => {});
        else mainWindow.setFullScreen(!mainWindow.isFullScreen());
      } else if (input.key === 'Escape' && mainWindow.isFullScreen() && !htmlFullscreen) {
        event.preventDefault();
        mainWindow.setFullScreen(false);
      }
    };
    appView.webContents.on('before-input-event', handleFullScreenKey);
    titleView.webContents.on('before-input-event', handleFullScreenKey);
    mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
    mainWindow.on('closed', () => {
      hotkeys.configure(null, () => {});
      if (pickerView && !pickerView.webContents.isDestroyed()) pickerView.webContents.close();
      pickerView = null;
      tooltipWindow?.destroy();
      tooltipWindow = null;
      appView?.webContents.close();
      titleView?.webContents.close();
      mainWindow = appView = titleView = null;
    });
    appView.webContents.setWindowOpenHandler(({ url }) => { openExternalUrl(url); return { action: 'deny' }; });
    appView.webContents.on('will-navigate', (event, url) => {
      if (isSiteUrl(url)) return;
      event.preventDefault();
      openExternalUrl(url);
    });
    for (const eventName of ['did-navigate', 'did-navigate-in-page', 'did-finish-load']) appView.webContents.on(eventName, updateNavigation);
    appView.webContents.on('did-finish-load', () => {
      if (!appView.webContents.getURL().startsWith(siteUrl)) hotkeys.configure(null, () => {});
    });
    appView.webContents.on('did-fail-load', async (_event, code, _message, url, isMainFrame) => {
      if (code === -3 || !isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Нет соединения с Disalive', message: 'Не удалось загрузить приложение.', detail: url,
        buttons: ['Повторить', 'Закрыть'], defaultId: 0, cancelId: 1
      });
      if (response === 0 && !mainWindow.isDestroyed()) void appView.webContents.loadURL(siteUrl).catch(() => {});
      else if (!mainWindow.isDestroyed()) mainWindow.hide();
    });
    titleView.webContents.once('did-finish-load', () => {
      sendTo(titleView, 'desktop:title', { title: 'Disalive', type: 'app' });
      sendTo(titleView, 'desktop:theme', theme);
      updateNavigation();
    });
    void titleView.webContents.loadFile(path.join(__dirname, 'titlebar.html'));
    void appView.webContents.loadURL(siteUrl).catch(() => {});
  }

  const trayMenuWidth = 176;
  const trayMenuHeight = 82;
  let trayMenuShownAt = 0;
  function showTrayMenu() {
    if (!trayMenuWindow) {
      trayMenuWindow = new BrowserWindow({ width: trayMenuWidth, height: trayMenuHeight, frame: false, transparent: true, show: false,
        skipTaskbar: true, resizable: false, alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname, 'tray-menu-preload.cjs'),
          contextIsolation: true, nodeIntegration: false, sandbox: true } });
      trayMenuWindow.on('blur', () => {
        const delay = Math.max(0, 250 - (Date.now() - trayMenuShownAt));
        setTimeout(() => {
          if (trayMenuWindow && !trayMenuWindow.isDestroyed() && !trayMenuWindow.isFocused()) trayMenuWindow.hide();
        }, delay);
      });
      trayMenuWindow.webContents.once('did-finish-load', () => trayMenuWindow.webContents.send('desktop:theme', theme));
      void trayMenuWindow.loadFile(path.join(__dirname, 'tray-menu.html'));
    }
    const bounds = tray.getBounds();
    const { workArea } = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const x = Math.min(Math.max(bounds.x + bounds.width / 2 - trayMenuWidth / 2, workArea.x + 8), workArea.x + workArea.width - trayMenuWidth - 8);
    const y = Math.max(workArea.y + 4, bounds.y - trayMenuHeight - 2);
    trayMenuWindow.setPosition(Math.round(x), Math.round(y));
    trayMenuShownAt = Date.now();
    trayMenuWindow.show();
    trayMenuWindow.focus();
  }
  function createTray() {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico')));
    tray.setToolTip('Disalive');
    tray.on('double-click', openMainWindow);
    tray.on('right-click', () => setTimeout(showTrayMenu, 0));
  }

  function showSplash() {
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.show(); return; }
    splashWindow = new BrowserWindow({ width: 360, height: 288, frame: false, resizable: false,
      backgroundColor: '#1e1f22', skipTaskbar: true, icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'splash-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true } });
    splashWindow.on('closed', () => { splashWindow = null; });
    void splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  }

  function updateSplash(state) {
    const contents = splashWindow?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const send = () => { if (!contents.isDestroyed()) contents.send('desktop:update-state', state); };
    if (contents.isLoading()) contents.once('did-finish-load', send);
    else send();
  }

  function startApplication() {
    if (applicationStarted || quitting) return;
    applicationStarted = true;
    splashWindow?.close();
    createMainWindow();
    createTray();
    setInterval(() => { void checkForUpdates(false); }, 6 * 60 * 60 * 1000).unref();
  }

  async function checkForUpdates(startup) {
    if (checkingUpdates || quitting) return;
    checkingUpdates = true;
    const startedAt = Date.now();
    if (startup) { showSplash(); updateSplash({ text: 'Проверяем обновления...', progress: 12 }); }
    try {
      const update = await updater.check();
      if (!update) {
        if (startup) {
          updateSplash({ text: 'Запуск Disalive...', progress: 100 });
          await new Promise(resolve => setTimeout(resolve, Math.max(0, 700 - (Date.now() - startedAt))));
          startApplication();
        }
        return;
      }
      showSplash();
      while (!quitting) {
        updateSplash({ text: `Доступна версия ${update.version}`, progress: 0, choices: true });
        const choice = await new Promise(resolve => { updateChoiceResolver = resolve; });
        updateChoiceResolver = null;
        if (choice !== 'install') break;
        try {
          updateSplash({ text: 'Загружаем обновление...', progress: 0 });
          const files = await updater.download(update, progress =>
            updateSplash({ text: `Загружаем обновление... ${progress}%`, progress }));
          updateSplash({ text: 'Устанавливаем обновление...', progress: 100 });
          await updater.install(files);
          quitting = true;
          app.quit();
          return;
        } catch (error) {
          console.error('Update installation failed:', error);
          updateSplash({ text: 'Не удалось установить обновление. Повторите попытку.', progress: 0, choices: true });
        }
      }
      splashWindow?.close();
      if (startup) startApplication();
    } catch (error) {
      console.error('Update check failed:', error);
      if (startup) startApplication();
    } finally {
      checkingUpdates = false;
    }
  }

  function layoutNotifications() {
    if (!notificationWindow || notificationWindow.isDestroyed()) return;
    if (!notifications.length) { notificationWindow.hide(); return; }
    if (notificationWindow.webContents.isDestroyed() || notificationWindow.webContents.isLoadingMainFrame()) return;
    const display = mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay();
    const { workArea } = display;
    const width = 366;
    const height = notifications.length * 72 + (notifications.length - 1) * 8 + 8;
    notificationWindow.setBounds({ x: workArea.x + workArea.width - width - 16,
      y: workArea.y + workArea.height - height - 16, width, height });
    notificationWindow.showInactive();
    notificationWindow.webContents.send('desktop:notifications', { notifications, theme });
  }
  function removeNotification(id) {
    clearTimeout(notificationTimers.get(id));
    notificationTimers.delete(id);
    notifications = notifications.filter(item => item.id !== id);
    layoutNotifications();
  }
  function ensureNotificationWindow() {
    if (notificationWindow && !notificationWindow.isDestroyed() && !notificationWindow.webContents.isDestroyed()) return;
    const window = new BrowserWindow({ width: 366, height: 80, frame: false, transparent: true,
      show: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
      webPreferences: { preload: path.join(__dirname, 'notification-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true } });
    notificationWindow = window;
    window.on('closed', () => {
      if (notificationWindow !== window) return;
      notificationWindow = null;
      if (!quitting && notifications.length) ensureNotificationWindow();
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('Notification renderer stopped:', details.reason);
      if (notificationWindow !== window) return;
      notificationWindow = null;
      window.destroy();
      if (!quitting && notifications.length) ensureNotificationWindow();
    });
    window.on('unresponsive', () => {
      if (notificationWindow === window && !window.webContents.isDestroyed()) window.webContents.reload();
    });
    window.webContents.on('did-fail-load', (_event, code, message, _url, isMainFrame) => {
      if (code === -3 || !isMainFrame || notificationWindow !== window) return;
      console.error('Notification overlay load failed:', code, message);
      notificationWindow = null;
      window.destroy();
    });
    window.webContents.on('did-finish-load', () => {
      if (notificationWindow === window) layoutNotifications();
    });
    void window.loadFile(path.join(__dirname, 'notification.html')).catch(error => {
      console.error('Notification overlay failed to load:', error);
      if (notificationWindow === window) {
        notificationWindow = null;
        window.destroy();
      }
    });
  }
  function showNotification(data) {
    if (!data || typeof data !== 'object') return;
    const title = String(data.title || 'Disalive').slice(0, 120);
    const body = String(data.body || '').slice(0, 600);
    const tag = String(data.tag || '').slice(0, 120);
    const route = typeof data.path === 'string' && /^\/?[\w/#-]+$/.test(data.path) ? data.path : '';
    let icon = '';
    try {
      const iconUrl = new URL(data.icon);
      if (iconUrl.protocol === 'https:') icon = iconUrl.href;
    } catch { /* use fallback */ }
    applyTheme(data.theme);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    notifications.push({ id, title, body, icon, route, tag });
    while (notifications.length > 3) {
      const oldest = notifications.shift();
      clearTimeout(notificationTimers.get(oldest.id));
      notificationTimers.delete(oldest.id);
    }
    ensureNotificationWindow();
    layoutNotifications();
    notificationTimers.set(id, setTimeout(() => removeNotification(id), 8000));
  }

  function configureIpc() {
    ipcMain.on('desktop:update-choice', (event, action) => {
      if (event.sender === splashWindow?.webContents && ['install', 'later'].includes(action)) {
        updateChoiceResolver?.(action);
      }
    });
    ipcMain.on('desktop:hotkeys', (event, payload) => {
      if (event.sender !== appView?.webContents) return;
      hotkeys.configure(payload, action => sendTo(appView, 'desktop:hotkey', action));
    });
    ipcMain.on('desktop:title', (event, payload) => {
      if (event.sender !== appView?.webContents || !payload) return;
      const title = String(payload.title || 'Disalive').slice(0, 100);
      const route = String(payload.route || '');
      const type = /servers\//.test(route) ? 'server' : /chat\//.test(route) ? 'chat'
        : /discover-servers/.test(route) ? 'discover' : /profiles\//.test(route) ? 'profile' : 'friends';
      let icon = '';
      if (type === 'server' && typeof payload.icon === 'string' && payload.icon.length < 2048) {
        try {
          const imagePath = payload.icon.replace(/^\/var\/www\/VoiceHub/, '');
          const imageUrl = new URL(/^https?:\/\//.test(imagePath) ? imagePath : encodeURI(imagePath), siteOrigin);
          if (imageUrl.protocol === 'https:') icon = imageUrl.href;
        } catch { /* Use the app icon. */ }
      }
      sendTo(titleView, 'desktop:title', { title, type, icon });
    });
    ipcMain.on('desktop:theme', (event, payload) => { if (event.sender === appView?.webContents) applyTheme(payload); });
    ipcMain.on('desktop:notification', (event, payload) => { if (event.sender === appView?.webContents) showNotification(payload); });
    ipcMain.on('desktop:control', (event, command) => {
      if (event.sender !== titleView?.webContents || !mainWindow) return;
      const history = appView.webContents.navigationHistory;
      if (command === 'back' && history.canGoBack()) history.goBack();
      if (command === 'forward' && history.canGoForward()) history.goForward();
      if (command === 'reload') appView.webContents.reload();
      if (command === 'minimize') mainWindow.minimize();
      if (command === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
      if (command === 'close') mainWindow.close();
      updateNavigation();
    });
    ipcMain.on('desktop:tooltip', (event, payload) => {
      if (event.sender !== titleView?.webContents) return;
      const requestId = ++tooltipRequest;
      if (!payload?.text || !mainWindow?.isVisible()) { tooltipWindow?.hide(); return; }
      if (!tooltipWindow || tooltipWindow.isDestroyed()) {
        tooltipWindow = new BrowserWindow({ width: 180, height: 34, frame: false, transparent: true,
          show: false, skipTaskbar: true, resizable: false, focusable: false, parent: mainWindow,
          webPreferences: { preload: path.join(__dirname, 'tooltip-preload.cjs'),
            contextIsolation: true, nodeIntegration: false, sandbox: true } });
        tooltipWindow.setIgnoreMouseEvents(true);
        tooltipWindow.webContents.once('did-finish-load', () => tooltipWindow.webContents.send('desktop:theme', theme));
        void tooltipWindow.loadFile(path.join(__dirname, 'tooltip.html'));
      }
      const text = String(payload.text).slice(0, 80);
      const width = Math.min(230, Math.max(76, text.length * 8 + 24));
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayMatching(bounds).workArea;
      const centerX = bounds.x + Number(payload.x || 0);
      const x = Math.round(Math.max(display.x + 4, Math.min(centerX - width / 2, display.x + display.width - width - 4)));
      tooltipWindow.setBounds({ x, y: bounds.y + headerHeight + 4, width, height: 34 });
      const sendText = () => {
        if (requestId === tooltipRequest && tooltipWindow && !tooltipWindow.isDestroyed()) {
          tooltipWindow.webContents.send('desktop:tooltip-text', text);
          tooltipWindow.showInactive();
        }
      };
      if (tooltipWindow.webContents.isLoading()) tooltipWindow.webContents.once('did-finish-load', sendText);
      else sendText();
    });
    ipcMain.on('desktop:tray-action', (event, action) => {
      if (event.sender !== trayMenuWindow?.webContents) return;
      if (action === 'open') openMainWindow();
      if (action === 'quit') { quitting = true; app.quit(); }
    });
    ipcMain.on('desktop:notification-action', (event, action, id) => {
      if (event.sender !== notificationWindow?.webContents) return;
      const item = notifications.find(value => value.id === id);
      if (!item) return;
      removeNotification(id);
      if (action === 'open') {
        openMainWindow();
        if (item.route) sendTo(appView, 'desktop:navigate', item.route);
      }
    });
  }

  if (!app.requestSingleInstanceLock()) app.quit();
  else {
    app.on('second-instance', openMainWindow);
    app.whenReady().then(() => {
      if (process.platform === 'win32') app.setAppUserModelId('ru.disalive.desktop');
      Menu.setApplicationMenu(null);
      configurePermissions();
      configureIpc();
      if (app.isPackaged) void checkForUpdates(true);
      else startApplication();
      app.on('activate', openMainWindow);
    });
    app.on('before-quit', () => { quitting = true; hotkeys.stop(); });
  }
}
