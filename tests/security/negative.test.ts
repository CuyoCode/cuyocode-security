import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../electron/main/database/connection';
import { runPendingMigrations } from '../../electron/main/database/migration-runner';
import { migrations } from '../../electron/main/database/migrations';
import { createAudit, updateFindingStatus, saveFindings } from '../../electron/main/database/audit-store';
import { loadProfile } from '../../engine/orchestrator/runner';
import { execAllowedOp } from '../../engine/server/ssh';
import { buildReviewRequest } from '../../engine/ai/consent';
import { validateAnalysis } from '../../engine/ai/providers';
import { validateExternalConfig } from '../../engine/ai/external';
import { assertLabIsolation } from '../../engine/lab/verify';
import { assertTargetForProfile, loadProfile } from '../../engine/orchestrator/runner';
import type { Finding } from '../../shared/finding-schema';

function tempDb(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-sec-'));
  return { dir, file: path.join(dir, 'sec.sqlite') };
}

const finding: Finding = {
  id: 'f-test-0123456789',
  title: 'Prueba',
  category: 'test',
  severity: 'low',
  confidence: 'low',
  verificationStatus: 'possible',
  source: 'test/1.0',
  ruleId: 't@1',
  target: '/tmp',
  location: { file: '.env', lineStart: 1, lineEnd: 1 },
  evidence: [{ kind: 't', snippet: 'password=hunter2-real', detail: 'd' }],
  impact: 'i',
  reproduction: [],
  remediation: [],
  references: [],
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  status: 'open',
};

describe('pruebas negativas de seguridad', () => {
  it('SSH rechaza operaciones fuera del catálogo sin conectarse', async () => {
    await expect(
      execAllowedOp(
        { id: 'x', name: 'x', host: 'h', port: 22, user: 'u', keyPath: '', knownHostsPath: 'kh', opsVersion: 1 },
        'rm -rf /',
      ),
    ).rejects.toThrow(/no permitida/);
    await expect(
      execAllowedOp(
        { id: 'x', name: 'x', host: 'h', port: 22, user: 'u', keyPath: '', knownHostsPath: 'kh', opsVersion: 1 },
        '__proto__',
      ),
    ).rejects.toThrow(/no permitida/);
  });

  it('falso positivo exige justificación', () => {
    const { file } = tempDb();
    const db = openDatabase(file);
    try {
      runPendingMigrations(db, file, migrations);
      createAudit(db, 'a1', {
        projectId: null, target: '/tmp', kind: 'folder', profileId: 'local-code',
        aiMode: 'off', aiConsent: null, allowPrivate: false,
      }, loadProfile('local-code'));
      saveFindings(db, 'a1', [finding]);
      expect(() => updateFindingStatus(db, finding.id, 'false-positive', 'corto')).toThrow(/justificación/);
      expect(() => updateFindingStatus(db, finding.id, 'estado-raro', 'nota suficientemente larga')).toThrow(/inválido/);
    } finally {
      closeDatabase(db);
    }
  });

  it('consentimiento IA excluye .env y redacta', () => {
    const { request, consent } = buildReviewRequest('goal', ['Node'], '/tmp', ['t@1'], [finding], () => 'password=hunter2-real');
    expect(consent.files).not.toContain('.env');
    expect(request.snippets).toEqual([]);
    expect(JSON.stringify(request)).not.toContain('hunter2-real');
  });

  it('salida de IA inválida se rechaza', () => {
    expect(() => validateAnalysis({ summary: '' }, 'p', 'm')).toThrow();
    expect(() => validateAnalysis({ resumen: 'x' }, 'p', 'm')).toThrow(/resumen/);
    const ok = validateAnalysis(
      { summary: 'resumen', annotations: [{ findingId: 'a', opinion: 'supports', rationale: 'motivo suficiente' }], suggestedNextSteps: ['x'] },
      'p',
      'm',
    );
    expect(ok.annotations.length).toBe(1);
  });

  it('config externa exige https', () => {
    expect(() => validateExternalConfig({ endpoint: 'http://x/v1', model: 'm' })).toThrow(/https/);
    expect(validateExternalConfig({ endpoint: 'https://x/v1', model: 'm' }).maxTokens).toBe(2000);
  });

  it('laboratorio bloquea sin Docker', async () => {
    const check = await assertLabIsolation('inexistente', 'http://127.0.0.1:3001/');
    // En este entorno Docker está ausente: debe bloquear, no simular.
    expect(check.ok).toBe(false);
    expect(check.reasons.join(' ')).toMatch(/Docker|inexistente|detenido/);
  });

  it('perfil avanzado exige laboratorio', () => {
    const profile = loadProfile('lab-advanced');
    expect(() =>
      assertTargetForProfile(
        { projectId: null, target: 'http://127.0.0.1:3001/', kind: 'url', profileId: 'lab-advanced', aiMode: 'off', aiConsent: null, allowPrivate: true },
        profile,
      ),
    ).toThrow(/laboratorio/i);
  });
});
