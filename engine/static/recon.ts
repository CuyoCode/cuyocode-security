// Reconocimiento del proyecto: detecta tecnologías por EVIDENCIA (contenido de
// archivos), no por el nombre de carpetas. No ejecuta código del objetivo.

import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { readTextFile, walkTarget } from './walk';

export const RECON_VERSION = 'cuyocode-recon/1.0';

interface TechHit {
  tech: string;
  evidence: string;
}

function hasFile(files: Set<string>, ...names: string[]): string | null {
  for (const n of names) {
    if (files.has(n)) return n;
  }
  return null;
}

function pkgHas(pkgJson: string | null, dep: string): boolean {
  if (!pkgJson) return false;
  try {
    const p = JSON.parse(pkgJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(p.dependencies?.[dep] ?? p.devDependencies?.[dep]);
  } catch {
    return false;
  }
}

export async function reconEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const maxFiles = job.limits.maxFiles ?? 20000;
  const maxFileBytes = job.limits.maxFileBytes ?? 1048576;

  const { files, truncated } = walkTarget(job.target, { maxFiles, maxFileBytes });
  if (truncated) {
    skipped.push({ engine: 'recon', reason: `recorrido truncado en ${maxFiles} archivos` });
  }
  const byRel = new Map(files.map((f) => [f.relPath, f]));
  const names = new Set(byRel.keys());
  const read = (rel: string): string | null => {
    const f = byRel.get(rel);
    return f ? readTextFile(f.absPath, maxFileBytes) : null;
  };

  const hits: TechHit[] = [];
  const pkgJson = read('package.json');
  if (pkgJson) {
    hits.push({ tech: 'Node.js (package.json)', evidence: 'package.json presente en la raíz' });
    if (pkgHas(pkgJson, '@nestjs/core')) hits.push({ tech: 'NestJS', evidence: 'dependencia @nestjs/core en package.json' });
    if (pkgHas(pkgJson, 'express')) hits.push({ tech: 'Express', evidence: 'dependencia express en package.json' });
    if (pkgHas(pkgJson, 'vue')) hits.push({ tech: 'Vue', evidence: 'dependencia vue en package.json' });
    if (pkgHas(pkgJson, 'react')) hits.push({ tech: 'React', evidence: 'dependencia react en package.json' });
    if (pkgHas(pkgJson, 'mongoose')) hits.push({ tech: 'MongoDB (mongoose)', evidence: 'dependencia mongoose en package.json' });
    if (pkgHas(pkgJson, 'pg') || pkgHas(pkgJson, 'typeorm') || pkgHas(pkgJson, 'sequelize')) {
      hits.push({ tech: 'PostgreSQL (driver/ORM)', evidence: 'driver pg/typeorm/sequelize en package.json' });
    }
    if (pkgHas(pkgJson, 'jsonwebtoken') || pkgHas(pkgJson, '@nestjs/jwt')) {
      hits.push({ tech: 'JWT', evidence: 'librería JWT en package.json' });
    }
  }
  const lock = hasFile(names, 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock');
  if (lock) hits.push({ tech: `Lockfile (${lock})`, evidence: `${lock} presente` });
  if (hasFile(names, 'Dockerfile', 'dockerfile')) hits.push({ tech: 'Docker', evidence: 'Dockerfile presente' });
  if (names.has('docker-compose.yml') || names.has('docker-compose.yaml')) {
    hits.push({ tech: 'Docker Compose', evidence: 'docker-compose presente' });
  }
  const ci =
    [...names].find((n) => n.startsWith('.github/workflows/')) ??
    (names.has('.gitlab-ci.yml') ? '.gitlab-ci.yml' : null);
  if (ci) hits.push({ tech: 'CI/CD', evidence: `${ci} presente` });
  const envExample = [...names].find((n) => /(^|\/)\.env(\.|$)/.test(n));
  if (envExample) hits.push({ tech: 'Variables de entorno', evidence: `${envExample} (revisar secretos en Fase de secretos)` });

  // Rutas API identificables estáticamente (NestJS controllers / Express routers)
  // + marcadores de framework por imports (no por nombre de carpetas).
  let apiRoutes = 0;
  let nestImport: string | null = null;
  let vueImport: string | null = null;
  for (const f of files) {
    if (!/\.(ts|js|vue)$/.test(f.absPath)) continue;
    const content = readTextFile(f.absPath, maxFileBytes);
    if (!content) continue;
    if (/@Controller\(|@Get\(|@Post\(|router\.(get|post|put|delete)\(/.test(content)) apiRoutes += 1;
    if (!nestImport && /from\s+['"]@nestjs\//.test(content)) nestImport = f.relPath;
    if (!vueImport && (/\.vue$/.test(f.absPath) || /from\s+['"]vue['"]/.test(content))) vueImport = f.relPath;
  }
  if (apiRoutes > 0) {
    hits.push({ tech: `Rutas API (${apiRoutes} archivos con definiciones)`, evidence: 'decoradores @Controller/@Get/@Post o router.*()' });
  }

  const tsCount = files.filter((f) => /\.tsx?$/.test(f.absPath)).length;
  const vueCount = files.filter((f) => /\.vue$/.test(f.absPath)).length;
  if (tsCount > 0 && !pkgJson) hits.push({ tech: 'TypeScript/JavaScript', evidence: `${tsCount} archivos .ts/.js` });
  if (nestImport && !hits.some((h) => h.tech === 'NestJS')) {
    hits.push({ tech: 'NestJS', evidence: `imports @nestjs/ en ${nestImport}` });
  }
  if (vueImport && !hits.some((h) => h.tech === 'Vue')) {
    hits.push({ tech: 'Vue', evidence: vueCount > 0 ? `${vueCount} archivos .vue` : `import desde 'vue' en ${vueImport}` });
  } else if (vueCount > 0 && !pkgHas(pkgJson, 'vue') && !vueImport) {
    hits.push({ tech: 'Vue (SFC)', evidence: `${vueCount} archivos .vue` });
  }

  const now = new Date().toISOString();
  const findings: Finding[] = [];
  if (hits.length > 0) {
    const id = stableFindingId({
      source: RECON_VERSION,
      ruleId: 'recon-stack@1',
      target: job.target,
      file: null,
      lineStart: null,
      evidenceKind: 'tech-stack',
      evidenceSnippet: hits.map((h) => h.tech).join(';'),
    });
    findings.push({
      id,
      title: `Stack detectado: ${hits.length} tecnologías/artefactos`,
      category: 'reconnaissance',
      severity: 'info',
      confidence: 'medium',
      verificationStatus: 'informational',
      source: RECON_VERSION,
      ruleId: 'recon-stack@1',
      target: job.target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: hits.map((h) => ({ kind: 'tech', snippet: h.tech, detail: h.evidence })),
      impact: 'Información de contexto para enfocar la auditoría. La detección es heurística y debe confirmarse.',
      reproduction: [],
      remediation: [],
      references: [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'recon', version: RECON_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
