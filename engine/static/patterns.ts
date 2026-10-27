// Motor de patrones: aplica rules/*.json sobre el código con regex auditables.
// Cada hallazgo cita motor+versión y regla+versión. Determinista, sin IA.

import fs from 'node:fs';
import path from 'node:path';
import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { redactCode } from '../finding/redact';
import { readTextFile, walkTarget } from './walk';
import { findRepoRoot } from '../paths';

export const PATTERNS_VERSION = 'cuyocode-patterns/1.0';

interface Rule {
  id: string;
  version: number;
  title: string;
  category: string;
  severity: Finding['severity'];
  confidence: Finding['confidence'];
  files: string[];
  pattern: string;
  evidence: string;
  impact: string;
  remediation: string[];
  references: string[];
  falsePositives: string;
}

const SEV = ['critical', 'high', 'medium', 'low', 'info'] as const;
const CONF = ['high', 'medium', 'low'] as const;

function repoRoot(): string {
  return findRepoRoot();
}

function globToTest(glob: string, fileName: string): boolean {
  // Soporte mínimo: "*.ext" y nombre exacto.
  if (glob.startsWith('*.')) return fileName.endsWith(glob.slice(1));
  return fileName === glob;
}

function loadRules(): { rules: Rule[]; files: string[] } {
  const manifestPath = path.join(repoRoot(), 'rules', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files: string[] };
  const rules: Rule[] = [];
  for (const rel of manifest.files) {
    const full = path.join(repoRoot(), rel.replace(/\//g, path.sep));
    const data = JSON.parse(fs.readFileSync(full, 'utf8')) as { engine: string; version: number; rules: Rule[] };
    for (const r of data.rules) {
      if (typeof r.id !== 'string' || typeof r.pattern !== 'string' || !Array.isArray(r.files)) continue;
      if (!SEV.includes(r.severity) || !CONF.includes(r.confidence)) continue;
      try {
        void new RegExp(r.pattern);
      } catch {
        continue;
      }
      rules.push(r);
    }
  }
  return { rules, files: manifest.files };
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

function snippetAround(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(content.length, index + length + 80);
  const lineStart = content.lastIndexOf('\n', start) + 1;
  const lineEnd = content.indexOf('\n', end);
  return content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).slice(0, 400);
}

export async function patternsEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();
  const maxFiles = job.limits.maxFiles ?? 20000;
  const maxFileBytes = job.limits.maxFileBytes ?? 1048576;

  let loaded: { rules: Rule[]; files: string[] };
  try {
    loaded = loadRules();
  } catch (e) {
    errors.push({ engine: 'patterns-builtin', message: `reglas no disponibles: ${e instanceof Error ? e.message : '?'}` });
    return { engine: 'patterns-builtin', version: PATTERNS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  if (loaded.rules.length === 0) {
    skipped.push({ engine: 'patterns-builtin', reason: 'conjunto de reglas vacío' });
    return { engine: 'patterns-builtin', version: PATTERNS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const { files, truncated } = walkTarget(job.target, { maxFiles, maxFileBytes });
  if (truncated) skipped.push({ engine: 'patterns-builtin', reason: `recorrido truncado en ${maxFiles} archivos` });

  for (const f of files) {
    if (job.signal.aborted) break;
    const base = path.basename(f.absPath);
    const applicable = loaded.rules.filter((r) => r.files.some((g) => globToTest(g, base)));
    if (applicable.length === 0) continue;
    const content = readTextFile(f.absPath, maxFileBytes);
    if (!content) continue;
    for (const rule of applicable) {
      const rx = new RegExp(rule.pattern, 'g');
      let m: RegExpExecArray | null;
      let hits = 0;
      while ((m = rx.exec(content)) !== null && hits < 5) {
        hits += 1;
        const line = lineOf(content, m.index);
        const id = stableFindingId({
          source: PATTERNS_VERSION,
          ruleId: `${rule.id}@${rule.version}`,
          target: job.target,
          file: f.relPath,
          lineStart: line,
          evidenceKind: rule.id,
          evidenceSnippet: m[0].slice(0, 120),
        });
        findings.push({
          id,
          title: `${rule.title} — ${f.relPath}:${line}`,
          category: rule.category,
          severity: rule.severity,
          confidence: rule.confidence,
          verificationStatus: 'possible',
          source: PATTERNS_VERSION,
          ruleId: `${rule.id}@${rule.version}`,
          target: job.target,
          location: { file: f.relPath, lineStart: line, lineEnd: line },
          evidence: [
            { kind: rule.id, snippet: redactCode(snippetAround(content, m.index, m[0].length)), detail: `${rule.evidence} Falso positivo frecuente: ${rule.falsePositives}` },
          ],
          impact: rule.impact,
          reproduction: ['Revisar el flujo de datos hasta el sumidero marcado; confirmar con prueba manual segura.'],
          remediation: rule.remediation,
          references: rule.references,
          firstSeen: now,
          lastSeen: now,
          status: 'open',
        });
      }
    }
    if (findings.length > 1000) {
      skipped.push({ engine: 'patterns-builtin', reason: 'tope de 1000 hallazgos alcanzado' });
      break;
    }
  }
  return { engine: 'patterns-builtin', version: PATTERNS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
