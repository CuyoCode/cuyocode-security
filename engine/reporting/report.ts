// Informes JSON y HTML a partir de datos persistidos. Sin secretos completos:
// toda evidencia se redacta de nuevo antes de exportar (defensa en profundidad).

import type { Db } from '../../electron/main/database/connection';
import type { Finding } from '../../shared/finding-schema';
import { redact, redactCode } from '../finding/redact';
import { getAudit, getAuditNotes, listFindings } from '../../electron/main/database/audit-store';

export const REPORT_GENERATOR = 'CuyoCode Security';
const DEFAULT_VERSION = '0.3.0';

const PROFILE_LABEL: Record<string, string> = {
  'local-code': 'Código local',
  'demo-code': 'Código local (demo)',
  'web-passive': 'Web pasiva',
  'web-active': 'Web activa controlada',
  'server-readonly': 'Servidor solo-lectura',
  'lab-advanced': 'Laboratorio avanzado',
};

export interface ReportSummary {
  total: number;
  actionable: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  confirmed: number;
  pending: number;
}

export interface ReportCoverage {
  plannedEngines: string[];
  enginesWithFindings: string[];
  notes: string[];
}

export interface Report {
  generator: string;
  version: string;
  generatedAt: string;
  audit: {
    id: string;
    profile: string;
    profileTitle: string;
    target: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    error: string | null;
  };
  scope: Record<string, unknown>;
  engines: string[];
  coverage: ReportCoverage;
  summary: ReportSummary;
  findings: Finding[];
  notes: string[];
  limitations: string[];
}

function summarize(findings: Finding[]): ReportSummary {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byStatus: Record<string, number> = {};
  let confirmed = 0;
  let pending = 0;
  let actionable = 0;
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    if (f.status === 'open' || f.status === 'reviewed') {
      actionable += 1;
      if (f.verificationStatus === 'confirmed') confirmed += 1;
      else pending += 1;
    }
  }
  return { total: findings.length, actionable, bySeverity, byStatus, confirmed, pending };
}

function durationMs(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

export function buildReport(db: Db, auditId: string, version = DEFAULT_VERSION): Report {
  const audit = getAudit(db, auditId);
  if (!audit) throw new Error('Auditoría inexistente');
  const raw = listFindings(db, { auditId }, 5000);
  const findings = raw.map((f) => ({
    ...f,
    title: redactCode(f.title),
    target: redact(f.target),
    impact: redactCode(f.impact),
    evidence: f.evidence.map((e) => ({ ...e, snippet: redactCode(e.snippet), detail: redactCode(e.detail) })),
    reproduction: f.reproduction.map((r) => redactCode(r)),
    remediation: f.remediation.map((r) => redactCode(r)),
    references: f.references.map((r) => redactCode(r)),
  }));
  let scope: Record<string, unknown> = {};
  try {
    const row = db.prepare('SELECT scope_json FROM audits WHERE id = ?').get(auditId) as unknown as {
      scope_json: string;
    };
    scope = JSON.parse(row.scope_json) as Record<string, unknown>;
  } catch {
    scope = {};
  }
  const planned = Array.isArray(scope['engines']) ? (scope['engines'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const enginesWithFindings = [...new Set(findings.map((f) => f.source))];
  const notes = getAuditNotes(db, auditId).map((n) => redact(n));
  return {
    generator: REPORT_GENERATOR,
    version,
    generatedAt: new Date().toISOString(),
    audit: {
      id: audit.id,
      profile: audit.profile,
      profileTitle: PROFILE_LABEL[audit.profile] ?? audit.profile,
      target: redact(audit.target),
      status: audit.status,
      startedAt: audit.startedAt,
      finishedAt: audit.finishedAt,
      durationMs: durationMs(audit.startedAt, audit.finishedAt),
      error: audit.error ? redact(audit.error) : null,
    },
    scope,
    engines: [...new Set(findings.map((f) => f.source))],
    coverage: { plannedEngines: planned, enginesWithFindings, notes },
    summary: summarize(findings),
    findings,
    notes,
    limitations: [
      'La ausencia de hallazgos no implica que el objetivo sea seguro.',
      'Los hallazgos con verificación distinta de "Confirmado" requieren validación manual.',
      'El alcance cubierto es exclusivamente el declarado en el perfil ejecutado.',
      'Este informe no asigna una puntuación global de seguridad ni constituye una certificación.',
    ],
  };
}

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return '<1 s';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60} s`;
}

const SEV_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo', info: 'Informativo',
};

function severityRank(s: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5;
}

export function renderHtml(report: Report): string {
  const sev = report.summary.bySeverity;
  const top = [...report.findings]
    .filter((f) => f.status === 'open' || f.status === 'reviewed')
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 5);
  const rows = report.findings
    .map(
      (f) => `<tr><td><span class="sev sev-${esc(f.severity)}">${esc(SEV_LABEL[f.severity] ?? f.severity)}</span></td>` +
        `<td>${esc(f.title)}</td><td>${esc(f.category)}</td>` +
        `<td>${esc(f.verificationStatus)}</td><td>${esc(f.status)}</td>` +
        `<td>${esc(f.location.file ?? '—')}${f.location.lineStart ? `:${f.location.lineStart}` : ''}</td></tr>`,
    )
    .join('\n');
  const details = report.findings
    .map(
      (f) => `<section class="finding"><h3>${esc(f.title)}</h3>` +
        `<p class="meta"><span class="sev sev-${esc(f.severity)}">${esc(SEV_LABEL[f.severity] ?? f.severity)}</span> ` +
        `Confianza: ${esc(f.confidence)} · Verificación: ${esc(f.verificationStatus)} · Estado: ${esc(f.status)} · ` +
        `Motor: ${esc(f.source)} (${esc(f.ruleId)})</p>` +
        `<p><strong>Impacto:</strong> ${esc(f.impact)}</p>` +
        `<ul>${f.evidence.map((e) => `<li><em>${esc(e.kind)}:</em> ${esc(e.detail)}<br><code>${esc(e.snippet)}</code></li>`).join('')}</ul>` +
        (f.reproduction.length > 0 ? `<p><strong>Validación segura:</strong></p><ul>${f.reproduction.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '') +
        (f.remediation.length > 0 ? `<p><strong>Corrección:</strong></p><ul>${f.remediation.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '') +
        (f.references.length > 0 ? `<p><strong>Referencias:</strong> ${f.references.map((r) => esc(r)).join(', ')}</p>` : '') +
        `</section>`,
    )
    .join('\n');
  const topRisks = top.length === 0
    ? '<p class="muted">Sin hallazgos accionables para priorizar.</p>'
    : `<ol class="top-risks">${top.map((f) => `<li><span class="sev sev-${esc(f.severity)}">${esc(SEV_LABEL[f.severity] ?? f.severity)}</span> ${esc(f.title)}</li>`).join('')}</ol>`;
  const sevCards = ['critical', 'high', 'medium', 'low', 'info']
    .map((s) => `<div class="stat"><span class="stat-num">${sev[s] ?? 0}</span><span class="stat-label">${SEV_LABEL[s]}</span></div>`)
    .join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Informe de auditoría · ${esc(report.audit.target)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; margin: 0; background: #f4f6fa; color: #1c2430; line-height: 1.5; }
  .page { max-width: 980px; margin: 0 auto; background: #fff; }
  header.cover { background: #0f1622; color: #e8eef8; padding: 40px 44px 30px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: .02em; font-size: 14px; }
  .mark { width: 30px; height: 30px; border-radius: 9px; background: #5b9dff; display: inline-grid; place-items: center; color: #07101f; font-weight: 800; }
  header.cover h1 { margin: 22px 0 6px; font-size: 30px; letter-spacing: -.02em; }
  header.cover p { margin: 0; color: #9fb0c7; font-size: 13px; }
  .cover-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 26px; }
  .cover-grid div span { display: block; color: #7f93ad; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
  .cover-grid div strong { font-size: 13px; font-weight: 600; word-break: break-word; }
  main { padding: 32px 44px 40px; }
  h2 { font-size: 17px; margin: 30px 0 12px; letter-spacing: -.01em; }
  h3 { font-size: 14px; margin: 18px 0 8px; }
  p { margin: 0 0 10px; }
  .muted { color: #64748b; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .stat, .kpi { border: 1px solid #dde4ee; border-radius: 10px; padding: 12px 14px; background: #f9fbfe; }
  .stat-num, .kpi strong { display: block; font-size: 24px; font-weight: 700; }
  .stat-label, .kpi span { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
  .top-risks { margin: 0; padding-left: 20px; }
  .top-risks li { margin-bottom: 7px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border-bottom: 1px solid #e3e8f0; padding: 8px 9px; text-align: left; vertical-align: top; }
  th { background: #f4f7fb; color: #5b6b80; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
  .sev { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; border: 1px solid; }
  .sev-critical { color: #b3123a; border-color: #f3a6b8; background: #fff0f4; }
  .sev-high { color: #a63a12; border-color: #f3c2a6; background: #fff5ef; }
  .sev-medium { color: #8a6100; border-color: #ecd49b; background: #fffaf0; }
  .sev-low { color: #0d6b4f; border-color: #a7dccb; background: #effaf6; }
  .sev-info { color: #2458a8; border-color: #b3cdf2; background: #f0f6ff; }
  .finding { border-top: 1px solid #e3e8f0; padding-top: 6px; break-inside: avoid; }
  .finding .meta { color: #5b6b80; font-size: 12px; }
  code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: Consolas, monospace; white-space: pre-wrap; word-break: break-word; font-size: 11px; }
  .warn { background: #fff8e6; border: 1px solid #e8c56b; padding: 10px 12px; border-radius: 8px; font-size: 12px; margin: 18px 0; }
  .coverage { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .coverage ul { margin: 0; padding-left: 18px; font-size: 12px; }
  footer { border-top: 1px solid #dde4ee; padding-top: 14px; margin-top: 28px; color: #7b8a9e; font-size: 11px; }
  @media print {
    body { background: #fff; }
    .page { max-width: none; }
    header.cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .finding { break-inside: avoid; }
  }
</style>
</head><body>
<div class="page">
<header class="cover">
  <div class="brand"><span class="mark">C</span> CuyoCode Security</div>
  <h1>Informe de auditoría de seguridad</h1>
  <p>Documento técnico generado localmente · Sin puntuación global ni certificación</p>
  <div class="cover-grid">
    <div><span>Objetivo</span><strong>${esc(report.audit.target)}</strong></div>
    <div><span>Perfil</span><strong>${esc(report.audit.profileTitle)}</strong></div>
    <div><span>Estado</span><strong>${esc(report.audit.status)}</strong></div>
    <div><span>Inicio</span><strong>${fmtDate(report.audit.startedAt)}</strong></div>
    <div><span>Fin</span><strong>${fmtDate(report.audit.finishedAt)}</strong></div>
    <div><span>Duración</span><strong>${fmtDuration(report.audit.durationMs)}</strong></div>
  </div>
</header>
<main>
  <h2>Resumen ejecutivo</h2>
  <div class="kpis">
    <div class="kpi"><strong>${report.summary.actionable}</strong><span>Hallazgos accionables</span></div>
    <div class="kpi"><strong>${report.summary.confirmed}</strong><span>Confirmados</span></div>
    <div class="kpi"><strong>${report.summary.pending}</strong><span>Pendientes de validación</span></div>
  </div>
  <div class="stats">${sevCards}</div>
  <div class="warn">La ausencia de hallazgos no implica que el objetivo sea seguro. Los resultados reflejan únicamente el alcance y los motores ejecutados.</div>

  <h2>Riesgos prioritarios</h2>
  ${topRisks}

  <h2>Hallazgos</h2>
  <table><thead><tr><th>Severidad</th><th>Título</th><th>Categoría</th><th>Verificación</th><th>Estado</th><th>Ubicación</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" class="muted">Sin hallazgos registrados.</td></tr>'}</tbody></table>

  <h2>Detalle</h2>
  ${details || '<p class="muted">Sin hallazgos registrados.</p>'}

  <h2>Cobertura y limitaciones</h2>
  <div class="coverage">
    <div>
      <h3>Motores</h3>
      <ul>
        <li>Planificados: ${report.coverage.plannedEngines.map((e) => esc(e)).join(', ') || 'no registrados'}</li>
        <li>Con hallazgos: ${report.coverage.enginesWithFindings.map((e) => esc(e)).join(', ') || 'ninguno'}</li>
        ${report.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
      </ul>
    </div>
    <div>
      <h3>Limitaciones</h3>
      <ul>${report.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>
  </div>

  <footer>
    Generado por ${esc(report.generator)} v${esc(report.version)} el ${fmtDate(report.generatedAt)} ·
    Auditoría ${esc(report.audit.id)} · Documento confidencial del propietario del objetivo.
  </footer>
</main>
</div>
</body></html>`;
}
