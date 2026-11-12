// Adaptador Nuclei: ejecuta plantillas SELECCIONADAS cuando el binario y un
// directorio local de plantillas existen. Sin plantillas locales → omitido
// (no se descarga ni ejecuta nada automáticamente).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { runTool } from '../../process/runner';

export const NUCLEI_VERSION = 'cuyocode-nuclei-adapter/1.0';

interface NucleiHit {
  'template-id'?: string;
  info?: { name?: string; severity?: string; description?: string; reference?: string[] };
  'matched-at'?: string;
  'extracted-results'?: string[];
}

export function parseNucleiJsonl(jsonl: string, target: string, nucleiVersion: string): Finding[] {
  const now = new Date().toISOString();
  const out: Finding[] = [];
  for (const line of jsonl.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let hit: NucleiHit;
    try {
      hit = JSON.parse(t) as NucleiHit;
    } catch {
      continue;
    }
    const sev = (hit.info?.severity ?? 'info').toLowerCase();
    const severity: Finding['severity'] =
      sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : sev === 'low' ? 'low' : 'info';
    const tpl = hit['template-id'] ?? 'nuclei-template';
    const matched = hit['matched-at'] ?? target;
    const id = stableFindingId({
      source: `nuclei/${nucleiVersion}`,
      ruleId: `nuclei-${tpl}@1`,
      target,
      file: null,
      lineStart: null,
      evidenceKind: 'nuclei',
      evidenceSnippet: `${tpl}:${matched}`,
    });
    out.push({
      id,
      title: `Nuclei ${tpl}: ${hit.info?.name ?? matched}`,
      category: 'dynamic-analysis',
      severity,
      confidence: 'medium',
      verificationStatus: 'evidence-found',
      source: `nuclei/${nucleiVersion}`,
      ruleId: `nuclei-${tpl}@1`,
      target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: [{
        kind: 'nuclei',
        snippet: matched.slice(0, 200),
        detail: `${hit.info?.description ?? 'Coincidencia de plantilla Nuclei'}. Extraído: ${(hit['extracted-results'] ?? []).join('; ').slice(0, 300)}`,
      }],
      impact: hit.info?.description ?? 'Coincidencia de plantilla Nuclei seleccionada.',
      reproduction: ['Repetir nuclei con la misma plantilla sobre el objetivo autorizado.'],
      remediation: ['Verificar manualmente y aplicar la corrección según la plantilla.'],
      references: hit.info?.reference ?? [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return out;
}

export async function nucleiEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];

  const bin = await runTool('nuclei', { args: ['-version'], timeoutMs: 15000, maxOutputBytes: 4096 });
  if (bin.exitCode === null) {
    skipped.push({ engine: 'nuclei-selected', reason: 'nuclei no instalado (ver Herramientas)' });
    return { engine: 'nuclei-selected', version: `${NUCLEI_VERSION}/no-disponible`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const nucleiVersion = bin.stdout.trim().split('\n')[0] ?? 'desconocida';
  const templatesDir = process.env['NUCLEI_TEMPLATES'] ?? '';
  if (!templatesDir || !fs.existsSync(templatesDir)) {
    skipped.push({ engine: 'nuclei-selected', reason: 'sin directorio local de plantillas (NUCLEI_TEMPLATES)' });
    return { engine: 'nuclei-selected', version: `nuclei/${nucleiVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-nuclei-'));
  const outFile = path.join(tmp, 'out.jsonl');
  try {
    const res = await runTool('nuclei', {
      args: ['-u', job.target, '-t', templatesDir, '-json', '-o', outFile, '-rl', '30', '-c', '10', '-timeout', '20', '-retries', '1', '-silent'],
      timeoutMs: job.limits.timeoutMs,
      maxOutputBytes: 1024 * 1024,
      cwd: tmp,
      signal: job.signal,
    });
    if (res.timedOut || res.exitCode === null) {
      errors.push({ engine: 'nuclei-selected', message: 'nuclei no respondió dentro del límite' });
      return { engine: 'nuclei-selected', version: `nuclei/${nucleiVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
    }
    let jsonl = '';
    try {
      jsonl = fs.readFileSync(outFile, 'utf8');
    } catch {
      skipped.push({ engine: 'nuclei-selected', reason: 'nuclei no generó resultados' });
      return { engine: 'nuclei-selected', version: `nuclei/${nucleiVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
    }
    for (const f of parseNucleiJsonl(jsonl, job.target, nucleiVersion).slice(0, 500)) findings.push(f);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { engine: 'nuclei-selected', version: `nuclei/${nucleiVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
}
