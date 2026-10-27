// Detector de secretos incorporado (sin binarios externos).
// Patrones + entropía. Jamás emite el valor: snippet parcial + huella.
// Gitleaks (adaptador opcional) lo complementa cuando está instalado.

import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { secretFingerprint } from '../finding/redact';
import { readTextFile, walkTarget } from './walk';

export const SECRETS_VERSION = 'cuyocode-secrets/1.0';

interface SecretPattern {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  regex: RegExp;
  /** Grupos del regex que contienen el valor (para no mostrarlo). */
  valueGroups: number[];
}

const PATTERNS: SecretPattern[] = [
  { id: 'private-key', title: 'Clave privada en el repositorio', severity: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, valueGroups: [] },
  { id: 'aws-key', title: 'Posible AWS Access Key', severity: 'high', regex: /\bAKIA[0-9A-Z]{16}\b/g, valueGroups: [] },
  { id: 'github-token', title: 'Posible token de GitHub', severity: 'high', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, valueGroups: [] },
  { id: 'stripe-key', title: 'Posible clave de Stripe', severity: 'high', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, valueGroups: [] },
  { id: 'mercadopago-token', title: 'Posible token de MercadoPago', severity: 'high', regex: /\b(APP_USR|TEST)-[A-Za-z0-9_-]{16,}\b/g, valueGroups: [] },
  { id: 'generic-api-key', title: 'Posible API key asignada', severity: 'medium', regex: /\b(api[_-]?key|apikey)\b\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,})["']?/gi, valueGroups: [2] },
  { id: 'generic-secret', title: 'Posible secreto asignado', severity: 'medium', regex: /\b(secret|passwd|password|pwd|client_secret)\b\s*[:=]\s*["']?([^\s"'},;]{8,})["']?/gi, valueGroups: [2] },
  { id: 'bearer-token', title: 'Posible bearer token', severity: 'medium', regex: /\bearer\s+([A-Za-z0-9\-._~+/=]{16,})/gi, valueGroups: [1] },
  { id: 'mongodb-uri', title: 'Cadena de conexión MongoDB', severity: 'high', regex: /\bmongodb(?:\+srv)?:\/\/([^/\s@]+@)?[^\s"'},;]+/gi, valueGroups: [] },
  { id: 'postgres-uri', title: 'Cadena de conexión PostgreSQL', severity: 'high', regex: /\bpostgres(?:ql)?:\/\/([^/\s@]+@)?[^\s"'},;]+/gi, valueGroups: [] },
];

function shannon(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Muestra parcial segura: 4 primeros + longitud + huella (nunca el valor). */
export function safeSnippet(value: string): string {
  return `${value.slice(0, 4)}…[${value.length} caracteres, huella ${secretFingerprint(value)}]`;
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

export async function secretsEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const maxFiles = job.limits.maxFiles ?? 20000;
  const maxFileBytes = job.limits.maxFileBytes ?? 1048576;

  const { files, truncated } = walkTarget(job.target, { maxFiles, maxFileBytes });
  if (truncated) skipped.push({ engine: 'secrets-builtin', reason: `recorrido truncado en ${maxFiles} archivos` });

  const now = new Date().toISOString();
  let count = 0;
  for (const f of files) {
    if (job.signal.aborted) break;
    const content = readTextFile(f.absPath, maxFileBytes);
    if (!content) continue;
    for (const p of PATTERNS) {
      p.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      let perPattern = 0;
      while ((m = p.regex.exec(content)) !== null && perPattern < 5) {
        perPattern += 1;
        count += 1;
        const line = lineOf(content, m.index);
        const groupIdx = p.valueGroups[0];
        const rawValue = groupIdx !== undefined ? String(m[groupIdx] ?? '') : m[0];
        // Filtro de entropía para patrones genéricos: evita "password=12345678".
        if ((p.id === 'generic-secret' || p.id === 'generic-api-key') && shannon(rawValue) < 2.5) {
          continue;
        }
        const id = stableFindingId({
          source: SECRETS_VERSION,
          ruleId: `secret-${p.id}@1`,
          target: job.target,
          file: f.relPath,
          lineStart: line,
          evidenceKind: p.id,
          evidenceSnippet: secretFingerprint(`${f.relPath}:${line}:${rawValue}`),
        });
        findings.push({
          id,
          title: `${p.title} en ${f.relPath}:${line}`,
          category: 'secrets',
          severity: p.severity,
          confidence: 'medium',
          verificationStatus: 'evidence-found',
          source: SECRETS_VERSION,
          ruleId: `secret-${p.id}@1`,
          target: job.target,
          location: { file: f.relPath, lineStart: line, lineEnd: line },
          evidence: [
            {
              kind: p.id,
              snippet: safeSnippet(rawValue),
              detail: `Coincidencia del patrón "${p.id}" en ${f.relPath} línea ${line}. Verificar si es un secreto real o un placeholder y rotarlo si corresponde.`,
            },
          ],
          impact: 'Un secreto expuesto permite suplantación, acceso a datos o costos (APIs de pago).',
          reproduction: ['Inspeccionar la línea indicada sin copiar el valor a canales inseguros.'],
          remediation: [
            'Rotar el secreto de inmediato si es real.',
            'Moverlo a variables de entorno o gestor de secretos; no versionarlo.',
            'Añadir el patrón a .gitignore/gitleaks y purgar el historial si se versionó.',
          ],
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html'],
          firstSeen: now,
          lastSeen: now,
          status: 'open',
        });
      }
    }
    if (count > 500) {
      skipped.push({ engine: 'secrets-builtin', reason: 'tope de 500 hallazgos de secretos alcanzado' });
      break;
    }
  }
  return { engine: 'secrets-builtin', version: SECRETS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
