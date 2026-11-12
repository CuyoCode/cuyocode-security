import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { openDatabase, closeDatabase, type Db } from './database/connection';
import { migrations } from './database/migrations';
import { runPendingMigrations } from './database/migration-runner';
import { recoverInterruptedAudits } from './database/audit-store';
import { registerAllHandlers } from './ipc/register-handlers';
import { createMainWindow } from './window';
import { logger } from './logging/logger';
import { stopAllNodeLabs } from '../../engine/lab/node-manager';
import { initAiStore } from './services/audit-service';
import { cancelAllAudits } from './services/audit-service';

let db: Db | undefined;

function dataDir(): string {
  return path.join(app.getPath('userData'), 'cuyocode-security');
}

app.setAppUserModelId('com.cuyocode.security');
app.enableSandbox();

// Perfil de datos alternativo para demos, capturas y pruebas de humo.
if (process.env['CUYOCODE_USER_DATA']) {
  app.setPath('userData', path.resolve(process.env['CUYOCODE_USER_DATA']));
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows()[0];
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
    }
  });

  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada', error);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Promesa rechazada sin manejar', reason);
  });

  app.on('render-process-gone', (_event, _contents, details) => {
    logger.error('Renderer finalizado', details);
  });
  app.on('child-process-gone', (_event, details) => {
    logger.error('Proceso hijo finalizado', details);
  });

  app
    .whenReady()
    .then(() => {
      try {
        const dir = dataDir();
        const dbPath = path.join(dir, 'cuyocode-security.sqlite');
        logger.configure({ level: 'info', file: path.join(dir, 'logs', 'app.log') });
        db = openDatabase(dbPath);
        runPendingMigrations(db, dbPath, migrations);
        const recovered = recoverInterruptedAudits(db);
        if (recovered > 0) logger.warn(`Se marcaron ${recovered} auditorías interrumpidas como fallidas`);
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
        try {
          dialog.showErrorBox(
            'CuyoCode Security no pudo iniciar',
            `No se pudo abrir la base local. Revisá los logs en:\n${path.join(dataDir(), 'logs', 'app.log')}\n\n${error instanceof Error ? error.message : 'Error desconocido'}`,
          );
        } catch {
          /* diálogo no disponible */
        }
        app.quit();
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createMainWindow();
        }
      });
    })
    .catch((error: unknown) => {
      logger.error('Fallo al preparar Electron', error);
      app.quit();
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    cancelAllAudits();
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
}
