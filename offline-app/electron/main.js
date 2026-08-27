'use strict';

const path = require('node:path');
const { app, BrowserWindow, Menu } = require('electron');

const ENTRY_FILE = path.join(__dirname, '..', 'index.html');

function isAllowedNavigation(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'file:' && path.normalize(url.pathname) === path.normalize(ENTRY_FILE);
  } catch (_err) {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(ENTRY_FILE);

  return win;
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (navEvent, targetUrl) => {
    if (!isAllowedNavigation(targetUrl)) {
      navEvent.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
