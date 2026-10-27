import fs from 'node:fs';
import path from 'node:path';
import { databaseFileExists, getUserVersion, type Db } from './connection';
import { logger } from '../logging/logger';
import type { Migration } from './migrations';

const KEEP_BACKUPS = 3;

function backupDatabase(dbPath: string): string | null {
  try {
    const dir = path.dirname(dbPath);
    const base = path.basename(dbPath, path.extname(dbPath));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(dir, `${base}.bak-${stamp}.sqlite`);
    fs.copyFileSync(dbPath, dest);
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${base}.bak-`))
      .sort()
      .reverse();
    for (const extra of backups.slice(KEEP_BACKUPS)) {
      fs.rmSync(path.join(dir, extra), { force: true });
    }
    return dest;
  } catch (err) {
    logger.error('No se pudo crear el backup previo a migrar', err);
    return null;
  }
}

export function runPendingMigrations(db: Db, dbPath: string, all: Migration[]): number {
  const current = getUserVersion(db);
  const pending = all.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return current;
  if (databaseFileExists(dbPath)) {
    backupDatabase(dbPath);
  }
  for (const m of pending) {
    db.exec('BEGIN;');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}; COMMIT;`);
      logger.info(`Migración aplicada: v${m.version} ${m.name}`);
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        /* rollback defensivo */
      }
      logger.error(`Migración fallida: v${m.version}`, err);
      throw err;
    }
  }
  return getUserVersion(db);
}
