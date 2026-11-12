import { BrowserWindow, app, dialog, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logging/logger';

const DEV_URL = 'http://localhost:5199';

function windowIcon(): string | undefined {
  const candidate = path.join(app.getAppPath(), 'resources', 'icon.png');
  return fs.existsSync(candidate) ? candidate : undefined;
}

export function createMainWindow(): BrowserWindow {
  const icon = windowIcon();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'CuyoCode Security',
    backgroundColor: '#0a0e15',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  // Defensa en profundidad: el renderer solo puede quedarse en su propio origen.
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = app.isPackaged ? url.startsWith('file://') : url.startsWith(DEV_URL);
    if (!allowed) {
      event.preventDefault();
      logger.warn(`Navegación bloqueada: ${url.slice(0, 200)}`);
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());

  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    logger.warn(`Permiso denegado: ${permission}`);
    callback(false);
  });
  ses.setPermissionCheckHandler(() => false);

  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    logger.error(`Fallo de carga (${code}): ${description} ${url.slice(0, 200)}`);
  });
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error(`Preload falló (${preloadPath})`, error);
  });

  // En desarrollo, evitar mostrar otra app si el puerto fue ocupado por error.
  window.webContents.on('did-finish-load', () => {
    if (app.isPackaged) return;
    void window.webContents
      .executeJavaScript('document.querySelector(\'meta[name="application-name"]\')?.content ?? ""')
      .then((name: unknown) => {
        if (name !== 'CuyoCode Security') {
          logger.error('El servidor de desarrollo no corresponde a CuyoCode Security');
          dialog.showErrorBox(
            'CuyoCode Security — desarrollo',
            `El puerto 5199 responde con otra aplicación.\n\nCerrá ese proceso y ejecutá npm run dev.`,
          );
          app.quit();
        }
      })
      .catch(() => {
        /* si el renderer se cerró, no hay nada que verificar */
      });
  });

  window.once('ready-to-show', () => window.show());

  if (app.isPackaged) {
    void window.loadFile(path.join(__dirname, '../../../dist/index.html'));
  } else {
    void window.loadURL(DEV_URL);
  }

  return window;
}
