import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';
import { getAudit, listFindings } from '../../electron/main/database/audit-store';
import { runDemo } from '../../electron/main/services/audit-service';
import { stopNodeLab } from '../../engine/lab/node-manager';

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-demo-'));
  return path.join(dir, 'demo.sqlite');
}

describe('demo reproducible de un clic', () => {
  it('crea proyecto, ejecuta auditorías sintéticas y deja hallazgos revisables', async () => {
    const file = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations);
      const result = await runDemo(db, { isDestroyed: () => true, send: () => undefined } as never);
      expect(result.findings).toBeGreaterThan(0);
      const local = getAudit(db, result.localAuditId);
      expect(local?.status).toBe('done');
      const localFindings = listFindings(db, { auditId: result.localAuditId }, 100);
      expect(localFindings.length).toBeGreaterThan(0);
      expect(localFindings.some((f) => f.status === 'reviewed')).toBe(true);

      if (result.labId) {
        const web = getAudit(db, result.auditId);
        expect(web?.status).toBe('done');
        expect(result.labTarget).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
        await stopNodeLab(result.labId);
      }
    } finally {
      closeDatabase(db);
    }
  }, 120000);
});
