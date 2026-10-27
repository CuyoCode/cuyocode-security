// Adaptador OWASP ZAP: ejecuta el escaneo rápido por CLI real cuando ZAP y
// Java están instalados; parsea el informe JSON tradicional documentado.
// Sin binario → omitido con motivo. E2E pendiente de entorno con ZAP.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { runTool } from '../../process/runner';

export const ZAP_VERSION = 'cuyocode-zap-adapter/1.0';

interface ZapInstance {
  uri?: string;
  evidence?: string;
  attack?: string;
}

interface ZapAlert {
  alert?: string;
  riskcode?: string;
  confidence?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  instances?: ZapInstance[];
}

interface ZapSite {
  '@name'?: string;
  alerts?: ZapAlert[];
}

export function parseZapReport(json: string, target: string, zapVersion: string): Finding[] {
  const now = new Date().toISOString();
  const parsed = JSON.parse(json) as { site?: ZapSite[] };
  const out: Finding[] = [];
  for (const site of parsed.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const risk = alert.riskcode ?? '0';
      const severity: Finding['severity'] =
        risk === '3' ? 'high' : risk === '2' ? 'medium' : risk === '1' ? 'low' : 'info';
      const instances = (alert.instances ?? []).slice(0, 5);
      const firstUri = instances[0]?.uri ?? site['@name'] ?? target;
      const id = stableFindingId({
        source: `zap/${zapVersion}`,
        ruleId: `zap-${(alert.alert ?? 'alerta').slice(0, 60)}@1`,
        target,
        file: null,
        lineStart: null,
        evidenceKind: 'zap',
        evidenceSnippet: `${alert.alert}:${firstUri}`,
      });
      out.push({
        id,
        title: `ZAP: ${alert.alert ?? 'alerta sin nombre'}`,
        category: 'dynamic-analysis',
        severity,
        confidence: (alert.confidence ?? '').toLowerCase() === 'high' ? 'high' : (alert.confidence ?? '').toLowerCase() === 'medium' ? 'medium' : 'low',
        verificationStatus: 'evidence-found',
        source: `zap/${zapVersion}`,
        ruleId: `zap-${(alert.alert ?? 'alerta').slice(0, 60)}@1`,
        target,
        location: { file: null, lineStart: null, lineEnd: null },
        evidence: instances.length > 0
          ? instances.map((i) => ({ kind: 'zap-instance', snippet: (i.uri ?? '').slice(0, 200), detail: `Evidencia: ${(i.evidence ?? '').slice(0, 300)}` }))
          : [{ kind: 'zap-alert', snippet: (alert.desc ?? '').slice(0, 300), detail: alert.desc ?? 'Alerta ZAP sin instancias.' }],
        impact: alert.desc ?? 'Ver descripción de la alerta.',
        reproduction: ['Repetir el escaneo ZAP sobre el mismo objetivo autorizado.'],
        remediation: alert.solution ? [alert.solution] : ['Ver documentación de la alerta ZAP.'],
        references: alert.reference ? [alert.reference] : [],
        firstSeen: now,
        lastSeen: now,
        status: 'open',
      });
    }
  }
  return out;
}

export async function zapEngine(job: EngineJob, mode: 'baseline' | 'full'): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];
  const engineName = mode === 'full' ? 'zap-full' : 'zap-baseline';

  const java = await runTool('java', { args: ['-version'], timeoutMs: 15000, maxOutputBytes: 4096 });
  if (java.exitCode === null) {
    skipped.push({ engine: engineName, reason: 'Java no instalado (ZAP lo requiere)' });
    return { engine: engineName, version: `${ZAP_VERSION}/sin-java`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const zap = await runTool('zap', { args: ['-version'], timeoutMs: 30000, maxOutputBytes: 4096 });
  if (zap.exitCode === null) {
    skipped.push({ engine: engineName, reason: 'OWASP ZAP no instalado (ver Herramientas)' });
    return { engine: engineName, version: `${ZAP_VERSION}/no-disponible`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const zapVersion = zap.stdout.trim().split('\n')[0] ?? 'desconocida';
  if (job.profile.id !== 'lab-advanced' && mode === 'full') {
    skipped.push({ engine: engineName, reason: 'escaneo completo solo en laboratorio verificado' });
    return { engine: engineName, version: `zap/${zapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-zap-'));
  const outFile = path.join(tmp, 'report.json');
  try {
    const res = await runTool('zap', {
      args: ['-cmd', '-quickurl', job.target, '-quickprogress', '-quickout', outFile],
      timeoutMs: job.limits.timeoutMs,
      maxOutputBytes: 1024 * 1024,
      cwd: tmp,
    });
    if (res.timedOut || res.exitCode === null) {
      errors.push({ engine: engineName, message: 'ZAP no respondió dentro del límite' });
      return { engine: engineName, version: `zap/${zapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
    }
    let json = '';
    try {
      json = fs.readFileSync(outFile, 'utf8');
    } catch {
      errors.push({ engine: engineName, message: 'ZAP no generó el informe esperado' });
      return { engine: engineName, version: `zap/${zapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
    }
    try {
      for (const f of parseZapReport(json, job.target, zapVersion).slice(0, 500)) findings.push(f);
    } catch {
      errors.push({ engine: engineName, message: 'informe ZAP no parseable' });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { engine: engineName, version: `zap/${zapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
}

export const zapBaselineEngine = (job: EngineJob): Promise<EngineResult> => zapEngine(job, 'baseline');
export const zapFullEngine = (job: EngineJob): Promise<EngineResult> => zapEngine(job, 'full');
