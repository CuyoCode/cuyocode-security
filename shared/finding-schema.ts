// Esquema común de hallazgos — fuente única para todos los motores.
// Separa severidad, confianza y estado de verificación. Sin inventar datos:
// los campos de evidencia son obligatorios salvo justificación explícita.

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** Taxonomía de verificación — nunca colapsar en un booleano. */
export const VERIFICATION_STATUSES = [
  'confirmed',
  'evidence-found',
  'possible',
  'misconfiguration',
  'informational',
  'unverified',
  'not-run',
  'failed',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const FINDING_STATUSES = ['open', 'reviewed', 'false-positive', 'resolved', 'accepted-risk'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export interface FindingLocation {
  file: string | null;
  lineStart: number | null;
  lineEnd: number | null;
}

export interface Evidence {
  kind: string;
  /** Fragmento ya redactado (sin secretos completos). */
  snippet: string;
  detail: string;
}

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  verificationStatus: VerificationStatus;
  /** Motor o adaptador que lo produjo, con versión. Ej. "cuyocode-patterns/1.0". */
  source: string;
  /** Regla que lo produjo, con versión. Ej. "js-exec-eval@1". */
  ruleId: string;
  target: string;
  location: FindingLocation;
  evidence: Evidence[];
  impact: string;
  reproduction: string[];
  remediation: string[];
  references: string[];
  firstSeen: string;
  lastSeen: string;
  status: FindingStatus;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Valida un hallazgo desconocido (salida de motor o de IA). Lanza Error si no cumple. */
export function validateFinding(input: unknown): Finding {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Hallazgo: se esperaba un objeto');
  }
  const f = input as Record<string, unknown>;
  const req = (key: string): unknown => {
    if (f[key] === undefined || f[key] === null) throw new Error(`Hallazgo: falta "${key}"`);
    return f[key];
  };
  const title = req('title');
  const category = req('category');
  const source = req('source');
  const ruleId = req('ruleId');
  const target = req('target');
  const impact = req('impact');
  if (typeof title !== 'string' || title.trim().length === 0) throw new Error('Hallazgo: título vacío');
  for (const [k, v] of [['category', category], ['source', source], ['ruleId', ruleId], ['target', target], ['impact', impact]] as const) {
    if (typeof v !== 'string' || v.trim().length === 0) throw new Error(`Hallazgo: "${k}" vacío`);
  }
  const severity = req('severity');
  const confidence = req('confidence');
  const verificationStatus = req('verificationStatus');
  if (!SEVERITIES.includes(severity as Severity)) throw new Error('Hallazgo: severidad inválida');
  if (!CONFIDENCES.includes(confidence as Confidence)) throw new Error('Hallazgo: confianza inválida');
  if (!VERIFICATION_STATUSES.includes(verificationStatus as VerificationStatus)) {
    throw new Error('Hallazgo: estado de verificación inválido');
  }
  const evidence = req('evidence');
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error('Hallazgo: se requiere al menos una evidencia');
  }
  for (const e of evidence) {
    if (typeof e !== 'object' || e === null) throw new Error('Hallazgo: evidencia inválida');
    const ev = e as Record<string, unknown>;
    if (typeof ev['kind'] !== 'string' || typeof ev['snippet'] !== 'string' || typeof ev['detail'] !== 'string') {
      throw new Error('Hallazgo: evidencia incompleta (kind/snippet/detail)');
    }
  }
  const loc = (f['location'] ?? {}) as Record<string, unknown>;
  const reproduction = f['reproduction'] ?? [];
  const remediation = f['remediation'] ?? [];
  const references = f['references'] ?? [];
  if (!isStringArray(reproduction) || !isStringArray(remediation) || !isStringArray(references)) {
    throw new Error('Hallazgo: reproduction/remediation/references deben ser string[]');
  }
  const firstSeen = f['firstSeen'];
  const lastSeen = f['lastSeen'];
  if (!isIsoDate(firstSeen) || !isIsoDate(lastSeen)) throw new Error('Hallazgo: fechas ISO inválidas');
  const id = f['id'];
  if (typeof id !== 'string' || id.length < 8) throw new Error('Hallazgo: id inválido');
  const status = f['status'] ?? 'open';
  if (!FINDING_STATUSES.includes(status as FindingStatus)) throw new Error('Hallazgo: status inválido');
  return {
    id,
    title: title.trim(),
    category: (category as string).trim(),
    severity: severity as Severity,
    confidence: confidence as Confidence,
    verificationStatus: verificationStatus as VerificationStatus,
    source: (source as string).trim(),
    ruleId: (ruleId as string).trim(),
    target: (target as string).trim(),
    location: {
      file: typeof loc['file'] === 'string' ? loc['file'] : null,
      lineStart: typeof loc['lineStart'] === 'number' ? loc['lineStart'] : null,
      lineEnd: typeof loc['lineEnd'] === 'number' ? loc['lineEnd'] : null,
    },
    evidence: evidence as Evidence[],
    impact: (impact as string).trim(),
    reproduction,
    remediation,
    references,
    firstSeen,
    lastSeen,
    status: status as FindingStatus,
  };
}
