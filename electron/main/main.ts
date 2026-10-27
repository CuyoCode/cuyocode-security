import { app, ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { openDatabase, closeDatabase, type Db } from './database/connection';
import { migrations } from './database/migrations';
import { runPendingMigrations } from './database/migration-runner';
import { registerAllHandlers } from './ipc/register-handlers';
import { createMainWindow } from './window';
import { logger } from './logging/logger';
import { stopAllNodeLabs } from '../../engine/lab/node-manager';
import { initAiStore } from './services/audit-service';

let db: Db | undefined;

function dataDir(): string {
  return path.join(app.getPath('userData'), 'cuyocode-security');
}

app.whenReady().then(() => {
  try {
    const dir = dataDir();
    const dbPath = path.join(dir, 'cuyocode-security.sqlite');
    logger.configure({ level: 'info', file: path.join(dir, 'logs', 'app.log') });
    db = openDatabase(dbPath);
    runPendingMigrations(db, dbPath, migrations);
    initAiStore(dir);
    registerAllHandlers(ipcMain, {
      db,
      dbPath,
      dataDir: dir,
      appName: 'CuyoCode Security',
      appVersion: app.getVersion(),
    });
    createMainWindow();
    logger.info('Aplicación iniciada');
  } catch (error) {
    logger.error('Error fatal al inicializar la aplicación', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    stopAllNodeLabs();
  } catch (error) {
    logger.error('Error al detener laboratorios node', error);
  }
  if (db) {
    try {
      closeDatabase(db);
    } catch (error) {
      logger.error('Error al cerrar la base de datos', error);
    }
    db = undefined;
  }
});
