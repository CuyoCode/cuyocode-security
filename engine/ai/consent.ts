// Consentimiento y minimización para IA externa: qué se envía, con qué
// límites y exclusiones. El código fuente no sale del equipo por defecto.

import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../../shared/finding-schema';
import { redactCode } from '../finding/redact';
import type { AiReviewRequest, AiSnippet } from './providers';

const EXCLUDED_FILES = [
  /(^|\/)\.env(\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.git\//,
  /credentials/i,
  /secrets/i,
];

const MAX_SNIPPETS = 12;
const MAX_EXCERPT = 1500;

export interface ConsentRecord {
  provider: string;
  model: string;
  scope: string;
  files: string[];
  at: string;
}

/** Filtra hallazgos+fragmentos aptos para envío externo (redactados). */
export function buildReviewRequest(
  auditGoal: string,
  technologies: string[],
  scope: string,
  rules: string[],
  findings: Finding[],
  readSnippet: (file: string, lineStart: number | null) => string | null,
): { request: AiReviewRequest; consent: ConsentRecord } {
  const snippets: AiSnippet[] = [];
  const files: string[] = [];
  for (const f of findings.slice(0, MAX_SNIPPETS)) {
    const file = f.location.file;
    if (!file) continue;
    if (EXCLUDED_FILES.some((rx) => rx.test(file))) continue;
    const raw = readSnippet(file, f.location.lineStart);
    if (!raw) continue;
    snippets.push({ file, excerpt: redactCode(raw).slice(0, MAX_EXCERPT) });
    files.push(file);
  }
  const request: AiReviewRequest = {
    auditGoal,
    technologies,
    scope,
    rules,
    findingsSummary: findings.slice(0, 40).map((f) => ({
      id: f.id,
      title: redactCode(f.title),
      severity: f.severity,
      verificationStatus: f.verificationStatus,
    })),
    snippets,
  };
  return {
    request,
    consent: {
      provider: '',
      model: '',
      scope,
      files: [...new Set(files)],
      at: new Date().toISOString(),
    },
  };
}

/** Lee un fragmento acotado alrededor de una línea (para revisión con IA). */
export function readExcerpt(root: string, relFile: string, lineStart: number | null, context = 15): string | null {
  let realRoot: string;
  let realFile: string;
  try {
    realRoot = fs.realpathSync(root);
    realFile = fs.realpathSync(path.resolve(realRoot, relFile));
  } catch {
    return null;
  }
  const rel = path.relative(realRoot, realFile);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  let content: string;
  try {
    const stat = fs.statSync(realFile);
    if (!stat.isFile() || stat.size > 1024 * 1024) return null;
    const buf = fs.readFileSync(realFile);
    if (buf.includes(0)) return null;
    content = buf.toString('utf8');
  } catch {
    return null;
  }
  if (lineStart === null) return content.slice(0, MAX_EXCERPT);
  const lines = content.split('\n');
  const from = Math.max(0, lineStart - 1 - context);
  const to = Math.min(lines.length, lineStart + context);
  return lines.slice(from, to).join('\n').slice(0, MAX_EXCERPT);
}
