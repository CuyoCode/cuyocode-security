import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, getUserVersion, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';
import { listFindings, recoverInterruptedAudits } from '../../electron/main/database/audit-store';

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

  it('v6 repara fechas vacías y los hallazgos vuelven a ser visibles', () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations.filter((m) => m.version <= 5));
      db.exec(`
        INSERT INTO audits (id, profile, status, started_at, target) VALUES ('audit-repair-1', 'local-code', 'done', '2026-01-01T00:00:00.000Z', 'C:\\x');
        INSERT INTO findings (id, audit_id, title, severity, verification_status, status, created_at,
          category, confidence, source, rule_id, target, location_json, evidence_json, impact,
          reproduction_json, remediation_json, references_json, first_seen, last_seen)
        VALUES ('f-repair-0123456789', 'audit-repair-1', 'Prueba', 'low', 'possible', 'open', '2026-01-01T00:00:00.000Z',
          'test', 'low', 'test/1', 't@1', 'C:\\x', '{}', '[{"kind":"t","snippet":"s","detail":"d"}]', 'i',
          '[]', '[]', '[]', '', '');
      `);
      runPendingMigrations(db, file, migrations);
      const findings = listFindings(db, {});
      expect(findings.length).toBe(1);
      expect(findings[0]?.firstSeen).toBe('2026-01-01T00:00:00.000Z');
      expect(findings[0]?.lastSeen).toBe('2026-01-01T00:00:00.000Z');
    } finally {
      closeDatabase(db);
    }
  });

  it('recupera auditorías que quedaron running tras un cierre inesperado', () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations);
      db.exec(`INSERT INTO audits (id, profile, status, started_at, target) VALUES ('audit-stuck-1', 'local-code', 'running', '2026-01-01T00:00:00.000Z', 'C:\\x');`);
      expect(recoverInterruptedAudits(db)).toBe(1);
      const row = db.prepare('SELECT status, error FROM audits WHERE id = ?').get('audit-stuck-1') as { status: string; error: string };
      expect(row.status).toBe('failed');
      expect(row.error).toMatch(/interrumpida/i);
    } finally {
      closeDatabase(db);
    }
  });
});
