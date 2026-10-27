import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';
import { createAudit, finishAudit, listFindings, saveFindings, setAuditNotes } from '../../electron/main/database/audit-store';
import { loadProfile, runAudit } from '../../engine/orchestrator/runner';
import { reconEngine } from '../../engine/static/recon';
import { secretsEngine } from '../../engine/static/secrets';
import { patternsEngine } from '../../engine/static/patterns';
import { depsEngine } from '../../engine/static/deps';
import { buildReport } from '../../engine/reporting/report';
import { validateFinding } from '../../shared/finding-schema';

const FIX = path.join(__dirname, '..', 'fixtures', 'vuln-app');

// Corrida completa del perfil local-code sobre el fixture, con persistencia e
// informe: criterio de aceptación de Fase 2.
describe('orquestador local-code de punta a punta', () => {
  it('ejecuta, persiste, deduplica e informa', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-e2e-'));
    const dbPath = path.join(dir, 'e2e.sqlite');
    const db = openDatabase(dbPath);
    try {
      const version = runPendingMigrations(db, dbPath, migrations);
      expect(version).toBeGreaterThanOrEqual(4);

      const profile = loadProfile('local-code');
      const auditId = 'audit-e2e-01';
      const target = FIX;
      const result = await runAudit(
        auditId,
        { projectId: null, target, kind: 'folder', profileId: 'local-code', aiMode: 'off', aiConsent: null, allowPrivate: false },
        { recon: reconEngine, 'secrets-builtin': secretsEngine, 'deps-npm-audit': depsEngine, 'patterns-builtin': patternsEngine },
        {
          onProgress: () => undefined,
          createAudit: (id, req, prof) => createAudit(db, id, req, prof),
          finishAudit: (id, status, error) => finishAudit(db, id, status, error),
          saveFindings: (id, findings) => saveFindings(db, id, findings),
        },
        new AbortController().signal,
        300000,
      );
      expect(result.status).toBe('done');
      setAuditNotes(db, auditId, result.errors);

      const findings = listFindings(db, { auditId }, 5000);
      // recon(1) + secretos(>=2) + patrones(>=9). deps puede omitirse sin red.
      expect(findings.length).toBeGreaterThanOrEqual(10);
      for (const f of findings) {
        expect(() => validateFinding(JSON.parse(JSON.stringify(f)))).not.toThrow();
      }

      // Segunda corrida: mismos ids estables (deduplicación).
      const before = new Set(findings.map((f) => f.id));
      const second = await runAudit(
        'audit-e2e-02',
        { projectId: null, target, kind: 'folder', profileId: 'local-code', aiMode: 'off', aiConsent: null, allowPrivate: false },
        { recon: reconEngine, 'secrets-builtin': secretsEngine, 'patterns-builtin': patternsEngine },
        {
          onProgress: () => undefined,
          createAudit: (id, req, prof) => createAudit(db, id, req, prof),
          finishAudit: (id, status, error) => finishAudit(db, id, status, error),
          saveFindings: (id, f2) => saveFindings(db, id, f2),
        },
        new AbortController().signal,
        300000,
      );
      expect(second.status).toBe('done');
      const again = listFindings(db, { auditId: 'audit-e2e-02' }, 5000);
      const againIds = new Set(again.map((f) => f.id));
      const overlap = [...before].filter((id) => againIds.has(id));
      expect(overlap.length).toBeGreaterThanOrEqual(8);

      const report = buildReport(db, auditId);
      expect(report.audit.id).toBe(auditId);
      expect(report.summary.total).toBe(findings.length);
      expect(report.engines.length).toBeGreaterThan(0);
      expect(JSON.stringify(report)).not.toContain('AKIAIOSFODNN7EXAMPLE');
    } finally {
      closeDatabase(db);
    }
  }, 300000);
});
