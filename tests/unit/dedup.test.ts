import { describe, expect, it } from 'vitest';
import { stableFindingId } from '../../engine/finding/dedup';
import { secretFingerprint } from '../../engine/finding/redact';

const key = {
  source: 'engine/1.0',
  ruleId: 'rule@1',
  target: '/tmp/t',
  file: 'a.js',
  lineStart: 10,
  evidenceKind: 'k',
  evidenceSnippet: 's',
};

describe('deduplicación', () => {
  it('id estable ante mismas entradas', () => {
    expect(stableFindingId(key)).toBe(stableFindingId({ ...key }));
  });

  it('id distinto ante distinta ubicación', () => {
    expect(stableFindingId(key)).not.toBe(stableFindingId({ ...key, lineStart: 11 }));
  });

  it('la huella no contiene el secreto', () => {
    const fp = secretFingerprint('supersecreto-real-123');
    expect(fp).not.toContain('supersecreto-real-123');
    expect(secretFingerprint('supersecreto-real-123')).toBe(fp);
  });
});
