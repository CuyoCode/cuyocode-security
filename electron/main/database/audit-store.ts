// Persistencia de auditorías y hallazgos completos (esquema v2).
// Upsert por id estable: conserva firstSeen, actualiza lastSeen.

import { randomUUID } from 'node:crypto';
import type { Db } from './connection';
import type { Finding } from '../../../shared/finding-schema';
import { validateFinding } from '../../../shared/finding-schema';
import type { AuditRequest, AuditProfile, AuditStatus } from '../../../engine/orchestrator/types';

export interface AuditRow {
  id: string;
  projectId: string | null;
  profile: string;
  target: string;
  status: AuditStatus;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  progress: { done: number; total: number; currentEngine: string };
}

interface RawAudit {
  id: string;
  project_id: string | null;
  profile: string;
  target: string;
  status: AuditStatus;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  progress_json: string;
}

function toAuditRow(r: RawAudit): AuditRow {
  let progress = { done: 0, total: 0, currentEngine: '' };
  try {
    const p = JSON.parse(r.progress_json) as Partial<typeof progress>;
    if (typeof p.done === 'number' && typeof p.total === 'number') {
      progress = { done: p.done, total: p.total, currentEngine: typeof p.currentEngine === 'string' ? p.currentEngine : '' };
    }
  } catch {
    /* progreso corrupto → ceros */
  }
  return {
    id: r.id,
    projectId: r.project_id,
    profile: r.profile,
    target: r.target,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    error: r.error,
    progress,
  };
}

export function createAudit(db: Db, auditId: string, request: AuditRequest, profile: AuditProfile): void {
  db.prepare(
    `INSERT INTO audits (id, project_id, profile, target, scope_json, status, started_at, finished_at, progress_json, error)
     VALUES (?, ?, ?, ?, ?, 'running', ?, NULL, ?, NULL)`,
  ).run(
    auditId,
    request.projectId,
    profile.id,
    request.target,
    JSON.stringify({ kind: request.kind, aiMode: request.aiMode, allowPrivate: request.allowPrivate }),
    new Date().toISOString(),
    JSON.stringify({ done: 0, total: profile.engines.length, currentEngine: '' }),
  );
}

export function updateAuditProgress(db: Db, auditId: string, done: number, total: number, currentEngine: string): void {
  db.prepare('UPDATE audits SET progress_json = ? WHERE id = ?').run(
    JSON.stringify({ done, total, currentEngine }),
    auditId,
  );
}

export function finishAudit(db: Db, auditId: string, status: 'done' | 'cancelled' | 'failed', error?: string): void {
  db.prepare('UPDATE audits SET status = ?, finished_at = ?, error = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    error ?? null,
    auditId,
  );
}

export function listAudits(db: Db, limit = 50): AuditRow[] {
  const rows = db
    .prepare('SELECT * FROM audits ORDER BY started_at DESC LIMIT ?')
    .all(limit) as unknown as RawAudit[];
  return rows.map(toAuditRow);
}

export function getAudit(db: Db, auditId: string): AuditRow | null {
  const row = db.prepare('SELECT * FROM audits WHERE id = ?').get(auditId) as unknown as RawAudit | undefined;
  return row ? toAuditRow(row) : null;
}

function rowToFinding(r: Record<string, unknown>): Finding {
  const get = (k: string, fb: string): string => (typeof r[k] === 'string' ? (r[k] as string) : fb);
  const arr = (k: string): string[] => {
    try {
      const v = JSON.parse(get(k, '[]')) as unknown;
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  };
  let location = { file: null as string | null, lineStart: null as number | null, lineEnd: null as number | null };
  try {
    const l = JSON.parse(get('location_json', '{}')) as Record<string, unknown>;
    location = {
      file: typeof l['file'] === 'string' ? l['file'] : null,
      lineStart: typeof l['lineStart'] === 'number' ? l['lineStart'] : null,
      lineEnd: typeof l['lineEnd'] === 'number' ? l['lineEnd'] : null,
    };
  } catch {
    /* ubicación por defecto */
  }
  let evidence: Finding['evidence'] = [];
  try {
    evidence = JSON.parse(get('evidence_json', '[]')) as Finding['evidence'];
  } catch {
    evidence = [];
  }
  return validateFinding({
    id: get('id', ''),
    title: get('title', ''),
    category: get('category', 'general'),
    severity: get('severity', 'info'),
    confidence: get('confidence', 'low'),
    verificationStatus: get('verification_status', 'unverified'),
    source: get('source', 'unknown'),
    ruleId: get('rule_id', 'unknown'),
    target: get('target', ''),
    location,
    evidence,
    impact: get('impact', ''),
    reproduction: arr('reproduction_json'),
    remediation: arr('remediation_json'),
    references: arr('references_json'),
    firstSeen: get('first_seen', new Date(0).toISOString()),
    lastSeen: get('last_seen', new Date(0).toISOString()),
    status: get('status', 'open'),
  });
}

export function saveFindings(db: Db, auditId: string, findings: Finding[]): void {
  const now = new Date().toISOString();
  const getFirst = db.prepare('SELECT first_seen FROM findings WHERE id = ?');
  const insert = db.prepare(
    `INSERT INTO findings (id, audit_id, title, severity, verification_status, status, created_at,
      category, confidence, source, rule_id, target, location_json, evidence_json, impact,
      reproduction_json, remediation_json, references_json, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // La atribución a la auditoría vive en audit_findings: un hallazgo canónico
  // puede pertenecer a varias corridas sin perder su first_seen.
  const touch = db.prepare(
    `UPDATE findings SET title = ?, severity = ?, verification_status = ?,
      category = ?, confidence = ?, source = ?, rule_id = ?, target = ?, location_json = ?,
      evidence_json = ?, impact = ?, reproduction_json = ?, remediation_json = ?,
      references_json = ?, last_seen = ? WHERE id = ?`,
  );
  const link = db.prepare(
    'INSERT OR IGNORE INTO audit_findings (audit_id, finding_id, seen_at) VALUES (?, ?, ?)',
  );
  for (const f of findings) {
    const existing = getFirst.get(f.id) as unknown as { first_seen: string } | undefined;
    if (!existing) {
      insert.run(
        f.id, auditId, f.title, f.severity, f.verificationStatus, now,
        f.category, f.confidence, f.source, f.ruleId, f.target,
        JSON.stringify(f.location), JSON.stringify(f.evidence), f.impact,
        JSON.stringify(f.reproduction), JSON.stringify(f.remediation),
        JSON.stringify(f.references), f.firstSeen, now,
      );
    } else {
      touch.run(
        f.title, f.severity, f.verificationStatus, f.category, f.confidence,
        f.source, f.ruleId, f.target, JSON.stringify(f.location), JSON.stringify(f.evidence),
        f.impact, JSON.stringify(f.reproduction), JSON.stringify(f.remediation),
        JSON.stringify(f.references), now, f.id,
      );
    }
    link.run(auditId, f.id, now);
  }
}

export interface FindingFilter {
  auditId?: string;
  severity?: string;
  status?: string;
  search?: string;
}

export function listFindings(db: Db, filter: FindingFilter, limit = 500): Finding[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const from = filter.auditId
    ? 'findings f JOIN audit_findings af ON af.finding_id = f.id'
    : 'findings f';
  if (filter.auditId) {
    where.push('af.audit_id = ?');
    params.push(filter.auditId);
  }
  if (filter.severity) {
    where.push('f.severity = ?');
    params.push(filter.severity);
  }
  if (filter.status) {
    where.push('f.status = ?');
    params.push(filter.status);
  }
  if (filter.search) {
    where.push('(f.title LIKE ? ESCAPE \'\\\' OR f.target LIKE ? ESCAPE \'\\\')');
    const esc = filter.search.replace(/[\\%_]/g, (c) => `\\${c}`);
    params.push(`%${esc}%`, `%${esc}%`);
  }
  const sql = `SELECT f.* FROM ${from}${where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY f.created_at DESC LIMIT ${Number(limit) || 500}`;
  const rows = db.prepare(sql).all(...(params as [])) as unknown as Record<string, unknown>[];
  const out: Finding[] = [];
  for (const r of rows) {
    try {
      out.push(rowToFinding(r));
    } catch {
      /* fila corrupta: se omite y se registra en informe, no se inventa */
    }
  }
  return out;
}

export function getFinding(db: Db, findingId: string): Finding | null {
  const row = db.prepare('SELECT * FROM findings WHERE id = ?').get(findingId) as unknown as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  try {
    return rowToFinding(row);
  } catch {
    return null;
  }
}

const REVIEW_STATUSES = ['reviewed', 'false-positive', 'resolved', 'accepted-risk', 'open'] as const;

export function updateFindingStatus(
  db: Db,
  findingId: string,
  status: string,
  note: string,
): void {
  if (!REVIEW_STATUSES.includes(status as (typeof REVIEW_STATUSES)[number])) {
    throw new Error('Estado de revisión inválido');
  }
  if (status === 'false-positive' && note.trim().length < 10) {
    throw new Error('Un falso positivo exige justificación (mínimo 10 caracteres)');
  }
  const clean = note.trim().slice(0, 2000);
  db.exec('BEGIN;');
  try {
    const r = db.prepare('UPDATE findings SET status = ? WHERE id = ?').run(status, findingId);
    if (Number(r.changes ?? 0) === 0) throw new Error('Hallazgo inexistente');
    db.prepare('INSERT INTO finding_history (id, finding_id, changed_at, change, note) VALUES (?, ?, ?, ?, ?)').run(
      randomUUID(),
      findingId,
      new Date().toISOString(),
      status,
      clean,
    );
    db.exec('COMMIT;');
  } catch (e) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* rollback defensivo */
    }
    throw e;
  }
}

export function findingHistory(db: Db, findingId: string): Array<{ at: string; change: string; note: string }> {  const rows = db
    .prepare('SELECT changed_at AS at, change, note FROM finding_history WHERE finding_id = ? ORDER BY changed_at ASC')
    .all(findingId) as unknown as Array<{ at: string; change: string; note: string }>;
  return rows;
}

/** Notas de cobertura: errores y omisiones de motores (visibles en el informe). */
export function setAuditNotes(db: Db, auditId: string, notes: string[]): void {
  const clean = notes.map((n) => n.slice(0, 2000));
  db.prepare('UPDATE audits SET notes_json = ? WHERE id = ?').run(JSON.stringify(clean), auditId);
}

export function getAuditNotes(db: Db, auditId: string): string[] {
  const row = db.prepare('SELECT notes_json FROM audits WHERE id = ?').get(auditId) as unknown as
    | { notes_json: string }
    | undefined;
  if (!row) return [];
  try {
    const v = JSON.parse(row.notes_json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Compara dos auditorías por id de hallazgo: nuevos, resueltos, persistentes. */
export function compareAudits(db: Db, baseId: string, otherId: string): { onlyBase: string[]; onlyOther: string[]; both: string[] } {
  const ids = (auditId: string): Set<string> => {
    let rows: Array<{ id: string }>;
    try {
      rows = db.prepare('SELECT finding_id AS id FROM audit_findings WHERE audit_id = ?').all(auditId) as unknown as Array<{ id: string }>;
    } catch {
      rows = db.prepare('SELECT id FROM findings WHERE audit_id = ?').all(auditId) as unknown as Array<{ id: string }>;
    }
    return new Set(rows.map((r) => r.id));
  };
  const a = ids(baseId);
  const b = ids(otherId);
  return {
    onlyBase: [...a].filter((x) => !b.has(x)),
    onlyOther: [...b].filter((x) => !a.has(x)),
    both: [...a].filter((x) => b.has(x)),
  };
}
