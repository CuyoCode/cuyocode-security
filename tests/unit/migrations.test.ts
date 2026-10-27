import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, getUserVersion, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-test-'));
  return path.join(dir, 'test.sqlite');
}

describe('migraciones versionadas', () => {
  it('aplica v4 en base nueva y crea las tablas', () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      const v = runPendingMigrations(db, file, migrations);
      expect(v).toBe(migrations[migrations.length - 1]?.version);
      expect(getUserVersion(db)).toBe(migrations[migrations.length - 1]?.version);
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);
      expect(names).toContain('projects');
      expect(names).toContain('audits');
      expect(names).toContain('findings');
    } finally {
      closeDatabase(db);
    }
  });

  it('es idempotente: segunda corrida no cambia versión ni duplica', () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations);
      const v2 = runPendingMigrations(db, file, migrations);
      expect(v2).toBe(migrations[migrations.length - 1]?.version);
    } finally {
      closeDatabase(db);
    }
  });

  it('genera backup antes de migrar una base existente', () => {
    const file = tempDb();
    const db0 = openDatabase(file);
    closeDatabase(db0);
    const db = openDatabase(file);
    try {
      db.exec('PRAGMA user_version = 0;');
      runPendingMigrations(db, file, migrations);
      const backups = fs.readdirSync(path.dirname(file)).filter((f) => f.includes('.bak-'));
      expect(backups.length).toBeGreaterThan(0);
    } finally {
      closeDatabase(db);
    }
  });
});
