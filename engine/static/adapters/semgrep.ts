// Adaptador Semgrep: usa el binario real con reglas LOCALES versionadas.
// Sin conjunto local (rules/semgrep/*.yaml) o sin binario → omitido honesto.

import fs from 'node:fs';
import path from 'node:path';
import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { runTool } from '../../process/runner';
import { rulesDir } from '../../paths';

const rulesConfiguredDir = rulesDir;

interface SemgrepResult {
  check_id?: string;
  path?: string;
  start?: { line?: number };
  end?: { line?: number };
  extra?: { message?: string; severity?: string; metadata?: { references?: string[] } };
}

function toSeverity(s: string | undefined): Finding['severity'] {
  if (s === 'ERROR') return 'high';
  if (s === 'WARNING') return 'medium';
  return 'low';
}

export async function semgrepEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];

  const ver = await runTool('semgrep', { args: ['--version'], timeoutMs: 30000, maxOutputBytes: 4096 });
  if (ver.exitCode === null) {
    skipped.push({ engine: 'semgrep', reason: 'semgrep no instalado (ver Herramientas)' });
    return { engine: 'semgrep', version: 'semgrep/no-disponible', findings, errors, skipped, durationMs: Date.now() - started };
  }
  const version = ver.stdout.trim().split('\n')[0] ?? 'desconocida';

  const rulesDirPath = path.join(rulesConfiguredDir(), 'semgrep');
  let configs: string[] = [];
  try {
    configs = fs.readdirSync(rulesDirPath).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).map((f) => path.join(rulesDirPath, f));
  } catch {
    configs = [];
  }
  if (configs.length === 0) {
    skipped.push({ engine: 'semgrep', reason: 'sin conjunto de reglas locales en rules/semgrep/ (no se usa --config auto)' });
    return { engine: 'semgrep', version: `semgrep/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const args = ['scan', '--metrics=off', '--json', '--quiet', ...configs.flatMap((c) => ['--config', c]), job.target];
  const res = await runTool('semgrep', { args, timeoutMs: 600000, maxOutputBytes: 16 * 1024 * 1024, cwd: job.target });
  if (res.timedOut || res.exitCode === null) {
    errors.push({ engine: 'semgrep', message: 'semgrep no respondió (timeout o error)' });
    return { engine: 'semgrep', version: `semgrep/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  let results: SemgrepResult[] = [];
  try {
    const parsed = JSON.parse(res.stdout) as { results?: SemgrepResult[]; errors?: unknown };
    results = parsed.results ?? [];
  } catch {
    errors.push({ engine: 'semgrep', message: 'salida JSON de semgrep no parseable' });
    return { engine: 'semgrep', version: `semgrep/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const now = new Date().toISOString();
  for (const r of results.slice(0, 500)) {
    const rel = typeof r.path === 'string' ? r.path.replace(/\\/g, '/') : '?';
    const line = r.start?.line ?? 1;
    const rule = r.check_id ?? 'semgrep-rule';
    const id = stableFindingId({
      source: `semgrep/${version}`,
      ruleId: `${rule}@local`,
      target: job.target,
      file: rel,
      lineStart: line,
      evidenceKind: 'semgrep',
      evidenceSnippet: `${rule}:${rel}:${line}`,
    });
    findings.push({
      id,
      title: `Semgrep ${rule} — ${rel}:${line}`,
      category: 'static-analysis',
      severity: toSeverity(r.extra?.severity),
      confidence: 'medium',
      verificationStatus: 'possible',
      source: `semgrep/${version}`,
      ruleId: `${rule}@local`,
      target: job.target,
      location: { file: rel, lineStart: line, lineEnd: r.end?.line ?? line },
      evidence: [{ kind: 'semgrep', snippet: `${rule} en ${rel}:${line}`, detail: r.extra?.message ?? 'Coincidencia de regla Semgrep local.' }],
      impact: 'Patrón estático que requiere revisión manual del flujo.',
      reproduction: ['Re-ejecutar semgrep con el mismo conjunto local.'],
      remediation: ['Revisar el código marcado y aplicar la corrección de la regla.'],
      references: r.extra?.metadata?.references ?? [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'semgrep', version: `semgrep/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
}
