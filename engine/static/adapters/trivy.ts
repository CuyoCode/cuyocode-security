// Adaptador Trivy: escaneo de filesystem real (`trivy fs`) si está instalado.
// La primera ejecución descarga la BD de vulnerabilidades (requiere red);
// si falla, se informa omitido en lugar de inventar resultados.

import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { runTool } from '../../process/runner';

interface TrivyVuln {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Severity?: string;
  Title?: string;
  PrimaryURL?: string;
}

function toSeverity(s: string | undefined): Finding['severity'] {
  const v = (s ?? '').toUpperCase();
  if (v === 'CRITICAL') return 'critical';
  if (v === 'HIGH') return 'high';
  if (v === 'MEDIUM') return 'medium';
  if (v === 'LOW') return 'low';
  return 'info';
}

export async function trivyEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];

  const ver = await runTool('trivy', { args: ['--version'], timeoutMs: 30000, maxOutputBytes: 4096 });
  if (ver.exitCode === null) {
    skipped.push({ engine: 'trivy', reason: 'trivy no instalado (ver Herramientas)' });
    return { engine: 'trivy', version: 'trivy/no-disponible', findings, errors, skipped, durationMs: Date.now() - started };
  }
  const m = /Version: ([^\s]+)/.exec(ver.stdout);
  const version = m?.[1] ?? 'desconocida';

  const res = await runTool('trivy', {
    args: ['fs', '--format', 'json', '--severity', 'HIGH,CRITICAL,MEDIUM', '--quiet', job.target],
    timeoutMs: 600000,
    maxOutputBytes: 16 * 1024 * 1024,
    cwd: job.target,
  });
  if (res.timedOut || res.exitCode === null) {
    errors.push({ engine: 'trivy', message: 'trivy no respondió (timeout o error; la BD inicial requiere red)' });
    return { engine: 'trivy', version: `trivy/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  let vulns: TrivyVuln[] = [];
  try {
    const parsed = JSON.parse(res.stdout) as { Results?: Array<{ Vulnerabilities?: TrivyVuln[] }> };
    for (const r of parsed.Results ?? []) {
      for (const v of r.Vulnerabilities ?? []) vulns.push(v);
    }
  } catch {
    errors.push({ engine: 'trivy', message: 'salida JSON de trivy no parseable' });
    return { engine: 'trivy', version: `trivy/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const now = new Date().toISOString();
  for (const v of vulns.slice(0, 500)) {
    const id = stableFindingId({
      source: `trivy/${version}`,
      ruleId: `trivy-${v.VulnerabilityID ?? 'unknown'}@1`,
      target: job.target,
      file: null,
      lineStart: null,
      evidenceKind: 'trivy',
      evidenceSnippet: `${v.PkgName}@${v.InstalledVersion}:${v.VulnerabilityID}`,
    });
    findings.push({
      id,
      title: `Trivy ${v.VulnerabilityID}: ${v.PkgName}@${v.InstalledVersion ?? '?'}`,
      category: 'dependencies',
      severity: toSeverity(v.Severity),
      confidence: 'high',
      verificationStatus: 'evidence-found',
      source: `trivy/${version}`,
      ruleId: `trivy-${v.VulnerabilityID ?? 'unknown'}@1`,
      target: job.target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: [
        {
          kind: 'trivy',
          snippet: v.Title ?? v.VulnerabilityID ?? 'vulnerabilidad',
          detail: `Paquete ${v.PkgName}@${v.InstalledVersion ?? '?'}. Versión corregida: ${v.FixedVersion ?? 'no informada'}.`,
        },
      ],
      impact: 'Vulnerabilidad conocida en una dependencia del objetivo.',
      reproduction: ['Repetir `trivy fs` sobre el mismo objetivo.'],
      remediation: v.FixedVersion
        ? [`Actualizar ${v.PkgName} a ${v.FixedVersion} y correr la suite de pruebas.`]
        : ['Sin versión corregida informada: evaluar mitigación o reemplazo.'],
      references: v.PrimaryURL ? [v.PrimaryURL] : [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'trivy', version: `trivy/${version}`, findings, errors, skipped, durationMs: Date.now() - started };
}
