import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';
import { createAudit, saveFindings } from '../../electron/main/database/audit-store';
import { loadProfile } from '../../engine/orchestrator/runner';
import { buildReport, renderHtml, renderJson } from '../../engine/reporting/report';
import type { Finding } from '../../shared/finding-schema';

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-report-'));
  return path.join(dir, 'report.sqlite');
}

const secretFinding: Finding = {
  id: 'f-report-0123456789',
  title: 'Token hardcodeado AKIAIOSFODNN7EXAMPLE',
  category: 'secrets',
  severity: 'high',
  confidence: 'high',
  verificationStatus: 'evidence-found',
  source: 'secrets-builtin/1.0',
  ruleId: 'secret-aws@1',
  target: 'C:\\demo',
  location: { file: 'config.js', lineStart: 3, lineEnd: 3 },
  evidence: [
    {
      kind: 'secret',
      snippet: 'const KEY = "AKIAIOSFODNN7EXAMPLE"',
      detail: 'authorization: Bearer abc123secret',
    },
  ],
  impact: 'Acceso con password=hunter2-real en el entorno de prueba.',
  reproduction: ['Revisar config.js'],
  remediation: ['Rotar la clave'],
  references: [],
  firstSeen: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  lastSeen: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  status: 'open',
};

describe('informe ejecutivo', () => {
  it('incluye cobertura, versión y redacta secretos en todos los campos', () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations);
      createAudit(
        db,
        'audit-report-1',
        {
          projectId: null,
          target: 'C:\\demo',
          kind: 'folder',
          profileId: 'local-code',
          aiMode: 'off',
          aiConsent: null,
          allowPrivate: false,
        },
        loadProfile('local-code'),
      );
      saveFindings(db, 'audit-report-1', [secretFinding]);
      const report = buildReport(db, 'audit-report-1', '9.9.9');
      expect(report.version).toBe('9.9.9');
      expect(report.generator).toBe('CuyoCode Security');
      expect(report.coverage.plannedEngines).toContain('patterns-builtin');
      expect(report.summary.total).toBe(1);
      expect(report.summary.actionable).toBe(1);

      const json = renderJson(report);
      expect(json).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(json).not.toContain('abc123secret');
      expect(json).not.toContain('hunter2-real');
      expect(json).toContain('[REDACTED');

      const html = renderHtml(report);
      expect(html).toContain('CuyoCode Security');
      expect(html).toContain('Resumen ejecutivo');
      expect(html).toContain('Cobertura y limitaciones');
      expect(html).not.toContain('AKIAIOSFODNN7EXAMPLE');
    } finally {
      closeDatabase(db);
    }
  });
});
