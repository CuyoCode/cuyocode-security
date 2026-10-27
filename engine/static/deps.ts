// Dependencias: parsea lockfiles y ejecuta `npm audit` real cuando hay red.
// Nunca actualiza paquetes. Diferencia vulnerabilidad conocida de mantenimiento.

import fs from 'node:fs';
import path from 'node:path';
import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { runTool } from '../process/runner';

export const DEPS_VERSION = 'cuyocode-deps/1.0';

interface LockEntry {
  name: string;
  version: string;
  direct: boolean;
}

function parsePackageLock(root: string): LockEntry[] | null {
  const file = path.join(root, 'package-lock.json');
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const lock = JSON.parse(raw) as { packages?: Record<string, { version?: string; dev?: boolean }> };
    const out: LockEntry[] = [];
    for (const [k, v] of Object.entries(lock.packages ?? {})) {
      if (!k.startsWith('node_modules/') || !v.version) continue;
      const name = k.slice('node_modules/'.length);
      if (name.includes('node_modules/')) continue; // solo primer nivel del árbol
      out.push({ name, version: v.version, direct: true });
    }
    return out;
  } catch {
    return null;
  }
}

interface NpmAdvisory {
  severity: string;
  title?: string;
  url?: string;
  via?: unknown[];
  range?: string;
  fixAvailable?: unknown;
}

function toSeverity(s: string): Finding['severity'] {
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate') return 'medium';
  return 'low';
}

export async function depsEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();

  const hasPkg = fs.existsSync(path.join(job.target, 'package.json'));
  if (!hasPkg) {
    skipped.push({ engine: 'deps-npm-audit', reason: 'sin package.json en el objetivo' });
    return { engine: 'deps-npm-audit', version: DEPS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const lock = parsePackageLock(job.target);
  if (!lock) {
    skipped.push({ engine: 'deps-npm-audit', reason: 'sin package-lock.json: versiones no fijadas, auditar con cautela' });
  }

  const res = await runTool('npm', {
    args: ['audit', '--json', '--no-progress'],
    timeoutMs: 120000,
    maxOutputBytes: 4 * 1024 * 1024,
    cwd: job.target,
  });
  if (res.timedOut || res.exitCode === null) {
    skipped.push({ engine: 'deps-npm-audit', reason: 'npm audit no disponible (sin red o npm ausente)' });
    return { engine: 'deps-npm-audit', version: DEPS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  // npm audit sale con código != 0 cuando hay vulnerabilidades: parsear igual.
  let data: unknown;
  try {
    data = JSON.parse(res.stdout) as unknown;
  } catch {
    errors.push({ engine: 'deps-npm-audit', message: 'salida de npm audit no parseable' });
    return { engine: 'deps-npm-audit', version: DEPS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const advisories = (data as { advisories?: Record<string, NpmAdvisory>; vulnerabilities?: Record<string, NpmAdvisory> })
    .advisories ??
    (data as { vulnerabilities?: Record<string, NpmAdvisory> }).vulnerabilities ??
    {};
  for (const [name, adv] of Object.entries(advisories)) {
    if (job.signal.aborted) break;
    const severity = toSeverity(adv.severity ?? 'info');
    const id = stableFindingId({
      source: `npm-audit/${adv.severity ?? 'n/a'}`,
      ruleId: `npm-${name}@1`,
      target: job.target,
      file: 'package-lock.json',
      lineStart: null,
      evidenceKind: 'npm-advisory',
      evidenceSnippet: `${name}@${adv.range ?? '?'}`,
    });
    findings.push({
      id,
      title: `Dependencia vulnerable: ${name} (${adv.range ?? 'rango desc.'})`,
      category: 'dependencies',
      severity,
      confidence: 'high',
      verificationStatus: 'evidence-found',
      source: 'npm-audit/registry',
      ruleId: `npm-${name}@1`,
      target: job.target,
      location: { file: 'package-lock.json', lineStart: null, lineEnd: null },
      evidence: [
        {
          kind: 'npm-advisory',
          snippet: adv.title ?? name,
          detail: `Rango afectado: ${adv.range ?? 'desconocido'}. Corrección: ${typeof adv.fixAvailable === 'object' ? JSON.stringify(adv.fixAvailable).slice(0, 200) : 'revisar npm audit fix (manual, fuera de la auditoría)'}.`,
        },
      ],
      impact: 'La dependencia arrastra una vulnerabilidad conocida informada por el registro npm.',
      reproduction: ['Repetir `npm audit` en el proyecto para confirmar.'],
      remediation: [
        'Actualizar al rango corregido indicado y ejecutar la suite de pruebas del proyecto.',
        'Si no hay corrección, evaluar reemplazo o mitigación documentada.',
      ],
      references: adv.url ? [adv.url] : [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'deps-npm-audit', version: DEPS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
