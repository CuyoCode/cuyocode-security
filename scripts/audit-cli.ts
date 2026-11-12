// CLI headless para CI: ejecuta un perfil determinista, persiste en una base
// temporal y escribe informes JSON/HTML. No usa Electron ni IA.
//
// Uso:
//   node dist-electron/scripts/audit-cli.js --profile local-code --target ./mi-app --out reporte
//   node dist-electron/scripts/audit-cli.js --profile web-passive --target https://ejemplo.com --fail-on high

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { closeDatabase, openDatabase } from '../electron/main/database/connection';
import { runPendingMigrations } from '../electron/main/database/migration-runner';
import { migrations } from '../electron/main/database/migrations';
import {
  createAudit,
  finishAudit,
  listFindings,
  saveFindings,
  setAuditNotes,
  updateAuditProgress,
} from '../electron/main/database/audit-store';
import { buildReport, renderHtml, renderJson } from '../engine/reporting/report';
import { BASE_ENGINES } from '../engine/orchestrator/registry';
import { loadProfile, runAudit } from '../engine/orchestrator/runner';
import type { AuditRequest } from '../engine/orchestrator/types';
import type { Finding } from '../shared/finding-schema';

interface CliOptions {
  profile: string;
  target: string;
  kind: 'folder' | 'url' | 'server';
  out: string;
  db: string;
  failOn: 'none' | 'critical' | 'high' | 'medium' | 'low' | 'info';
  allowPrivate: boolean;
  jsonOnly: boolean;
}

function usage(): never {
  console.error(
    [
      'CuyoCode Security — CLI headless',
      '',
      'Opciones:',
      '  --profile <id>       local-code | web-passive | web-active | server-readonly',
      '  --target <valor>     carpeta, URL o host:puerto',
      '  --kind <tipo>        folder | url | server (se infiere si se omite)',
      '  --out <base>         prefijo de salida (default: cuyocode-report)',
      '  --db <archivo>       base SQLite temporal (default: tmp)',
      '  --fail-on <sev>      none | critical | high | medium | low | info (default: none)',
      '  --allow-private      permite destinos de red privada (solo autorizado)',
      '  --json-only          no escribir HTML',
      '  --help               esta ayuda',
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--allow-private' || arg === '--json-only') {
      flags.add(arg);
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) usage();
    values.set(arg, next);
    i += 1;
  }
  const target = values.get('--target');
  const profile = values.get('--profile');
  if (!target || !profile) usage();
  const kindRaw = values.get('--kind');
  const kind: CliOptions['kind'] =
    kindRaw === 'folder' || kindRaw === 'url' || kindRaw === 'server'
      ? kindRaw
      : /^https?:\/\//i.test(target)
        ? 'url'
        : /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(target) && !fs.existsSync(target)
          ? 'server'
          : 'folder';
  const failOnRaw = values.get('--fail-on') ?? 'none';
  if (!['none', 'critical', 'high', 'medium', 'low', 'info'].includes(failOnRaw)) usage();
  return {
    profile,
    target,
    kind,
    out: values.get('--out') ?? 'cuyocode-report',
    db: values.get('--db') ?? path.join(os.tmpdir(), `cuyocode-cli-${process.pid}-${Date.now()}.sqlite`),
    failOn: failOnRaw as CliOptions['failOn'],
    allowPrivate: flags.has('--allow-private'),
    jsonOnly: flags.has('--json-only'),
  };
}

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_LABEL: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo', info: 'Informativo' };

function shouldFail(findings: Finding[], failOn: CliOptions['failOn']): boolean {
  if (failOn === 'none') return false;
  const threshold = SEV_RANK[failOn] ?? 5;
  return findings.some(
    (f) =>
      (f.status === 'open' || f.status === 'reviewed') &&
      (SEV_RANK[f.severity] ?? 5) <= threshold,
  );
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const profile = loadProfile(options.profile);
  if (profile.requiresLab) {
    console.error('Este perfil exige un laboratorio verificado; usá la aplicación desktop.');
    return 1;
  }
  if (profile.engines.includes('ssh-readonly')) {
    console.error('El perfil SSH requiere credenciales y host key; usá la aplicación desktop.');
    return 1;
  }

  const auditId = randomUUID();
  const request: AuditRequest = {
    projectId: null,
    target: options.kind === 'folder' ? path.resolve(options.target) : options.target,
    kind: options.kind,
    profileId: options.profile,
    aiMode: 'off',
    aiConsent: null,
    allowPrivate: options.allowPrivate,
  };

  const db = openDatabase(options.db);
  try {
    runPendingMigrations(db, options.db, migrations);
    const controller = new AbortController();
    const onSigint = (): void => controller.abort(new Error('cancelado por SIGINT'));
    process.once('SIGINT', onSigint);
    const result = await runAudit(
      auditId,
      request,
      { ...BASE_ENGINES },
      {
        onProgress: (done, total, engine) => {
          updateAuditProgress(db, auditId, done, total, engine);
          process.stderr.write(`\r[${done}/${total}] ${engine.padEnd(24)}`);
        },
        createAudit: (id, req, prof) => createAudit(db, id, req, prof),
        finishAudit: (id, status, error) => finishAudit(db, id, status, error),
        saveFindings: (id, findings) => saveFindings(db, id, findings),
      },
      controller.signal,
      profile.limits.timeoutMs,
    );
    process.off('SIGINT', onSigint);
    setAuditNotes(db, auditId, result.errors);

    const findings = listFindings(db, { auditId }, 5000);
    const report = buildReport(db, auditId, process.env['npm_package_version'] ?? '0.3.0');
    const base = options.out.replace(/\.(json|html?)$/i, '');
    fs.mkdirSync(path.dirname(path.resolve(base)), { recursive: true });
    fs.writeFileSync(`${base}.json`, renderJson(report), 'utf8');
    if (!options.jsonOnly) fs.writeFileSync(`${base}.html`, renderHtml(report), 'utf8');

    const bySev = report.summary.bySeverity;
    process.stderr.write('\n');
    console.log(`Estado: ${result.status}`);
    console.log(`Objetivo: ${report.audit.target} (${report.audit.profileTitle})`);
    console.log(
      `Hallazgos: ${report.summary.total} total · ${report.summary.actionable} accionables · ` +
        Object.entries(bySev)
          .filter(([, n]) => n > 0)
          .map(([sev, n]) => `${SEV_LABEL[sev] ?? sev} ${n}`)
          .join(' · '),
    );
    console.log(`Informe JSON: ${path.resolve(base)}.json`);
    if (!options.jsonOnly) console.log(`Informe HTML: ${path.resolve(base)}.html`);
    for (const note of report.notes) console.log(`Nota: ${note}`);

    return shouldFail(findings, options.failOn) ? 2 : 0;
  } finally {
    closeDatabase(db);
    if (options.db.includes(`cuyocode-cli-${process.pid}`)) {
      for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${options.db}${suffix}`, { force: true });
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
