// Deduplicación y correlación: id estable por (motor, regla, objetivo, ubicación,
// huella de evidencia). Dos corridas del mismo hallazgo conservan el id y
// actualizan lastSeen; firstSeen no se reescribe.

import { createHash } from 'node:crypto';

export interface DedupKey {
  source: string;
  ruleId: string;
  target: string;
  file: string | null;
  lineStart: number | null;
  evidenceKind: string;
  evidenceSnippet: string;
}

export function stableFindingId(key: DedupKey): string {
  const h = createHash('sha256');
  h.update(
    [key.source, key.ruleId, key.target, key.file ?? '', key.lineStart ?? '', key.evidenceKind, key.evidenceSnippet]
      .join('|'),
  );
  return `f-${h.digest('hex').slice(0, 24)}`;
}
