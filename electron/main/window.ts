import { BrowserWindow, app } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#10151d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    void window.loadFile(path.join(__dirname, '../../../dist/index.html'));
  } else {
    void window.loadURL('http://localhost:5173');
  }

  return window;
}
