// Informes JSON y HTML a partir de datos persistidos. Sin secretos completos:
// toda evidencia se redacta de nuevo antes de exportar (defensa en profundidad).

import type { Db } from '../../electron/main/database/connection';
import type { Finding } from '../../shared/finding-schema';
import { redact, redactCode } from '../finding/redact';
import { getAudit, getAuditNotes, listFindings } from '../../electron/main/database/audit-store';

export const REPORT_GENERATOR = 'cuyocode-security/0.2.3';

export interface ReportSummary {
  total: number;
  bySeverity: Record<string, number>;
  confirmed: number;
  pending: number;
}

export interface Report {
  generator: string;
  generatedAt: string;
  audit: {
    id: string;
    profile: string;
    target: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  };
  scope: Record<string, unknown>;
  engines: string[];
  summary: ReportSummary;
  findings: Finding[];
  notes: string[];
  limitations: string[];
}

function summarize(findings: Finding[]): ReportSummary {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let confirmed = 0;
  let pending = 0;
  for (const f of findings) {
    if (f.status !== 'open' && f.status !== 'reviewed') continue;
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    if (f.verificationStatus === 'confirmed') confirmed += 1;
    else pending += 1;
  }
  return { total: findings.length, bySeverity, confirmed, pending };
}

export function buildReport(db: Db, auditId: string): Report {
  const audit = getAudit(db, auditId);
  if (!audit) throw new Error('Auditoría inexistente');
  const raw = listFindings(db, { auditId }, 5000);
  const findings = raw.map((f) => ({
    ...f,
    evidence: f.evidence.map((e) => ({ ...e, snippet: redactCode(e.snippet), detail: redact(e.detail) })),
    target: redact(f.target),
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
  return {
    generator: REPORT_GENERATOR,
    generatedAt: new Date().toISOString(),
    audit: {
      id: audit.id,
      profile: audit.profile,
      target: redact(audit.target),
      status: audit.status,
      startedAt: audit.startedAt,
      finishedAt: audit.finishedAt,
      error: audit.error ? redact(audit.error) : null,
    },
    scope,
    engines: [...new Set(findings.map((f) => f.source))],
    summary: summarize(findings),
    findings,
    notes: getAuditNotes(db, auditId).map((n) => redact(n)),
    limitations: [
      'La ausencia de hallazgos no implica que el objetivo sea seguro.',
      'Los hallazgos con verificación distinta de "confirmed" requieren validación manual.',
      'El alcance cubierto es exclusivamente el declarado en el perfil ejecutado.',
    ],
  };
}

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderHtml(report: Report): string {
  const rows = report.findings
    .map(
      (f) => `<tr><td>${esc(f.severity)}</td><td>${esc(f.title)}</td><td>${esc(f.category)}</td>` +
        `<td>${esc(f.verificationStatus)}</td><td>${esc(f.status)}</td>` +
        `<td>${esc(f.location.file ?? '—')}${f.location.lineStart ? `:${f.location.lineStart}` : ''}</td></tr>`,
    )
    .join('\n');
  const details = report.findings
    .map(
      (f) => `<section><h3>${esc(f.title)}</h3>` +
        `<p><strong>Severidad:</strong> ${esc(f.severity)} · <strong>Confianza:</strong> ${esc(f.confidence)} · ` +
        `<strong>Verificación:</strong> ${esc(f.verificationStatus)} · <strong>Motor:</strong> ${esc(f.source)} ` +
        `(${esc(f.ruleId)})</p>` +
        `<p><strong>Impacto:</strong> ${esc(f.impact)}</p>` +
        `<ul>${f.evidence.map((e) => `<li><em>${esc(e.kind)}:</em> ${esc(e.detail)}<br><code>${esc(e.snippet)}</code></li>`).join('')}</ul>` +
        (f.remediation.length > 0 ? `<p><strong>Corrección:</strong></p><ul>${f.remediation.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '') +
        (f.references.length > 0 ? `<p><strong>Referencias:</strong> ${f.references.map((r) => esc(r)).join(', ')}</p>` : '') +
        `</section>`,
    )
    .join('\n');
  const sev = report.summary.bySeverity;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Informe de auditoría ${esc(report.audit.id)}</title>
<style>body{font-family:sans-serif;max-width:960px;margin:2em auto;color:#222}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;text-align:left}
code{background:#f2f2f2;padding:2px 4px;white-space:pre-wrap;word-break:break-word}
.warn{background:#fff4d6;border:1px solid #c90;padding:10px}</style>
</head><body>
<h1>Informe de auditoría</h1>
<p><strong>Objetivo:</strong> ${esc(report.audit.target)} · <strong>Perfil:</strong> ${esc(report.audit.profile)}</p>
<p><strong>Inicio:</strong> ${esc(report.audit.startedAt)} · <strong>Fin:</strong> ${esc(report.audit.finishedAt ?? '—')} · <strong>Estado:</strong> ${esc(report.audit.status)}</p>
<h2>Resumen</h2>
<p>Total: ${report.summary.total} · Confirmados: ${report.summary.confirmed} · Pendientes: ${report.summary.pending}</p>
<p>Críticos: ${sev['critical'] ?? 0} · Altos: ${sev['high'] ?? 0} · Medios: ${sev['medium'] ?? 0} · Bajos: ${sev['low'] ?? 0} · Info: ${sev['info'] ?? 0}</p>
<div class="warn">La ausencia de hallazgos no implica que el objetivo sea seguro. Sin puntuación global de seguridad.</div>
<h2>Hallazgos</h2>
<table><thead><tr><th>Sev.</th><th>Título</th><th>Categoría</th><th>Verificación</th><th>Estado</th><th>Ubicación</th></tr></thead>
<tbody>${rows}</tbody></table>
${details}
<h2>Cobertura y limitaciones</h2>
<ul><li>Motores: ${report.engines.map((e) => esc(e)).join(', ') || 'ninguno produjo hallazgos'}</li>
${report.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
${report.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<p><small>Generado por ${esc(report.generator)} el ${esc(report.generatedAt)}</small></p>
</body></html>`;
}
