// Persistencia local con node:sqlite (sin dependencias nativas).
// Migraciones versionadas con PRAGMA user_version + backup previo.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

export function databaseFileExists(dbPath: string): boolean {
  try {
    return fs.statSync(dbPath).isFile();
  } catch {
    return false;
  }
}

export function openDatabase(dbPath: string): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return db;
}

export function getUserVersion(db: Db): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: unknown };
  return typeof row.user_version === 'number' ? row.user_version : 0;
}

export function closeDatabase(db: Db): void {
  db.close();
}
