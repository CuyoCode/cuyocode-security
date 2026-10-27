import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { patternsEngine } from '../../engine/static/patterns';
import { secretsEngine } from '../../engine/static/secrets';
import { reconEngine } from '../../engine/static/recon';
import type { EngineJob } from '../../engine/orchestrator/types';
import { loadProfile } from '../../engine/orchestrator/runner';

const FIX = path.join(__dirname, '..', 'fixtures', 'vuln-app');
const CLEAN = path.join(__dirname, '..', 'fixtures', 'clean-app');

function job(target: string): EngineJob {
  return {
    auditId: 'test',
    target,
    kind: 'folder',
    profile: loadProfile('local-code'),
    limits: { timeoutMs: 60000, maxFiles: 5000, maxFileBytes: 512 * 1024 },
    signal: new AbortController().signal,
    allowPrivate: false,
    aiMode: 'off',
    report: () => undefined,
  };
}

describe('motores estáticos sobre fixtures', () => {
  it('recon detecta stack por evidencia', async () => {
    const r = await reconEngine(job(FIX));
    expect(r.errors).toEqual([]);
    expect(r.findings.length).toBe(1);
    expect(r.findings[0]?.verificationStatus).toBe('informational');
    const techs = (r.findings[0]?.evidence ?? []).map((e) => e.snippet).join(' ');
    expect(techs).toContain('NestJS');
    expect(techs).toContain('Vue');
  });

  it('patrones detectan vulnerabilidades conocidas del fixture', async () => {
    const r = await patternsEngine(job(FIX));
    const ids = new Set(r.findings.map((f) => f.ruleId.split('@')[0]));
    for (const expected of ['js-eval', 'js-child-process', 'js-sql-concat', 'js-jwt-hardcoded', 'vue-v-html', 'vue-token-storage', 'vue-postmessage-wildcard', 'nest-cors-wildcard', 'nest-typeorm-sync']) {
      expect(ids.has(expected)).toBe(true);
    }
    for (const f of r.findings) {
      expect(f.verificationStatus).toBe('possible');
      expect(f.location.file).toBeTruthy();
    }
  });

  it('patrones no marcan el fixture limpio', async () => {
    const r = await patternsEngine(job(CLEAN));
    expect(r.findings).toEqual([]);
  });

  it('secretos detecta claves sintéticas sin exponer valores', async () => {
    const r = await secretsEngine(job(FIX));
    const kinds = new Set(r.findings.map((f) => f.evidence[0]?.kind));
    expect(kinds.has('aws-key')).toBe(true);
    expect(kinds.has('mongodb-uri')).toBe(true);
    const all = JSON.stringify(r.findings);
    expect(all).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(all).not.toContain('fixture-password-123');
    expect(all).toContain('huella fp');
  });

  it('redactCode enmascara tokens y literales de alta entropía', async () => {
    const { redactCode } = await import('../../engine/finding/redact');
    expect(redactCode(`const K = 'AKIAIOSFODNN7EXAMPLE';`)).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redactCode(`uri='mongodb://user:pass1234@host/db'`)).not.toContain('pass1234');
    expect(redactCode(`const name = 'administrator';`)).toContain('administrator');
  });
});
