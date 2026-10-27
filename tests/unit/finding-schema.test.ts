import { describe, expect, it } from 'vitest';
import { validateFinding } from '../../shared/finding-schema';

const base = {
  id: 'f-0123456789abcdef',
  title: 'Hallazgo de prueba',
  category: 'test',
  severity: 'high',
  confidence: 'medium',
  verificationStatus: 'evidence-found',
  source: 'test/1.0',
  ruleId: 'test-rule@1',
  target: '/tmp/objetivo',
  location: { file: 'a.js', lineStart: 1, lineEnd: 2 },
  evidence: [{ kind: 'test', snippet: 'x', detail: 'detalle' }],
  impact: 'impacto',
  reproduction: [],
  remediation: ['corregir'],
  references: [],
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  status: 'open',
};

describe('esquema de hallazgos', () => {
  it('acepta un hallazgo completo', () => {
    expect(validateFinding({ ...base }).id).toBe(base.id);
  });

  it('rechaza sin evidencia', () => {
    expect(() => validateFinding({ ...base, evidence: [] })).toThrow(/evidencia/);
  });

  it('rechaza severidad inventada', () => {
    expect(() => validateFinding({ ...base, severity: 'critica' })).toThrow(/severidad/);
  });

  it('rechaza estado de verificación inválido', () => {
    expect(() => validateFinding({ ...base, verificationStatus: 'seguro' })).toThrow(/verificación/);
  });

  it('rechaza fechas no ISO', () => {
    expect(() => validateFinding({ ...base, firstSeen: 'ayer' })).toThrow(/fechas/);
  });
});
