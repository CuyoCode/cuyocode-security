// Adaptador Gitleaks: ejecuta el binario real si está instalado.
// Si falta, informa "omitido" en lugar de simular resultados.

import path from 'node:path';
import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { secretFingerprint } from '../../finding/redact';
import { safeSnippet } from '../secrets';
import { runTool } from '../../process/runner';

interface GitleaksFinding {
  File?: string;
  StartLine?: number;
  EndLine?: number;
  RuleID?: string;
  Description?: string;
  Secret?: string;
}

export async function gitleaksEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];

  const ver = await runTool('gitleaks', { args: ['version'], timeoutMs: 15000, maxOutputBytes: 4096 });
  if (ver.exitCode === null) {
    skipped.push({ engine: 'gitleaks', reason: 'gitleaks no instalado (ver Herramientas)' });
    return { engine: 'gitleaks', version: 'gitleaks/no-disponible', findings, errors, skipped, durationMs: Date.now() - started };
  }
  const version = ver.stdout.split('\n')[0]?.trim() ?? 'desconocida';

  const res = await runTool('gitleaks', {
    args: ['detect', '--source', job.target, '--no-git', '--no-banner', '-v', '--report-format', 'json', '--report-path', 'stdout'],
    timeoutMs: 300000,
    maxOutputBytes: 8 * 1024 * 1024,
    cwd: job.target,
  });
  if (res.timedOut || res.exitCode === null) {
    errors.push({ engine: 'gitleaks', message: 'gitleaks no respondió (timeout o error de ejecución)' });
    return { engine: 'gitleaks', version: `gitleaks/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  // Gitleaks sale != 0 cuando encuentra secretos: parsear igual.
  let items: GitleaksFinding[] = [];
  try {
    const start = res.stdout.indexOf('[');
    items = start >= 0 ? (JSON.parse(res.stdout.slice(start)) as GitleaksFinding[]) : [];
  } catch {
    errors.push({ engine: 'gitleaks', message: 'salida de gitleaks no parseable' });
    return { engine: 'gitleaks', version: `gitleaks/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const now = new Date().toISOString();
  for (const g of items.slice(0, 200)) {
    const file = typeof g.File === 'string' ? g.File : '?';
    const line = typeof g.StartLine === 'number' ? g.StartLine : 1;
    const secret = typeof g.Secret === 'string' ? g.Secret : '';
    const rel = path.relative(job.target, path.join(job.target, file)).replace(/\\/g, '/');
    const id = stableFindingId({
      source: `gitleaks/${version}`,
      ruleId: `gitleaks-${g.RuleID ?? 'generic'}@1`,
      target: job.target,
      file: rel,
      lineStart: line,
      evidenceKind: 'gitleaks',
      evidenceSnippet: secretFingerprint(`${rel}:${line}:${secret}`),
    });
    findings.push({
      id,
      title: `Secreto (Gitleaks ${g.RuleID ?? ''}) en ${rel}:${line}`,
      category: 'secrets',
      severity: 'high',
      confidence: 'medium',
      verificationStatus: 'evidence-found',
      source: `gitleaks/${version}`,
      ruleId: `gitleaks-${g.RuleID ?? 'generic'}@1`,
      target: job.target,
      location: { file: rel, lineStart: line, lineEnd: typeof g.EndLine === 'number' ? g.EndLine : line },
      evidence: [
        {
          kind: 'gitleaks',
          snippet: secret ? safeSnippet(secret) : '[sin valor capturado]',
          detail: (g.Description ?? 'Regla de Gitleaks') + '. Rotar si es real; no versionar secretos.',
        },
      ],
      impact: 'Secreto expuesto detectable por terceros con acceso al código.',
      reproduction: ['Re-ejecutar gitleaks sobre el mismo origen.'],
      remediation: ['Rotar el secreto y moverlo a gestor de secretos o variables de entorno.'],
      references: ['https://github.com/gitleaks/gitleaks'],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'gitleaks', version: `gitleaks/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
}
