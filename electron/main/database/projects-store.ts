import type { Db } from './connection';
import type { CreateProjectInput, Project, ProjectKind } from '../../../shared/ipc-contracts/project.contracts';

interface ProjectRow {
  id: unknown;
  name: unknown;
  kind: unknown;
  target: unknown;
  createdAt: unknown;
}

function toProject(row: ProjectRow): Project {
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.target !== 'string' ||
    typeof row.createdAt !== 'string' ||
    (row.kind !== 'folder' && row.kind !== 'url' && row.kind !== 'server')
  ) {
    throw new Error('Fila de proyecto inválida');
  }
  const kind: ProjectKind = row.kind;
  return { id: row.id, name: row.name, kind, target: row.target, createdAt: row.createdAt };
}

export function listProjects(db: Db): Project[] {
  const rows = db
    .prepare('SELECT id, name, kind, target, created_at AS createdAt FROM projects ORDER BY created_at DESC')
    .all() as unknown as ProjectRow[];
  return rows.map(toProject);
}

export function insertProject(db: Db, id: string, input: CreateProjectInput): Project {
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, kind, target, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.name, input.kind, input.target, createdAt);
  return { id, name: input.name, kind: input.kind, target: input.target, createdAt };
}

export function deleteProject(db: Db, id: string): boolean {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return Number(result.changes ?? 0) > 0;
}

export function countAudits(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM audits').get() as { n: unknown };
  return typeof row.n === 'number' ? row.n : 0;
}

export function countFindings(db: Db): { critical: number; high: number; medium: number; low: number; info: number; pending: number } {
  const rows = db
    .prepare(`SELECT severity AS severity, COUNT(*) AS n FROM findings WHERE status = 'open' GROUP BY severity`)
    .all() as Array<{ severity: unknown; n: unknown }>;
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0, pending: 0 };
  for (const r of rows) {
    if (typeof r.n === 'number' && typeof r.severity === 'string' && r.severity in out) {
      out[r.severity as keyof typeof out] = r.n;
    }
  }
  const p = db
    .prepare(`SELECT COUNT(*) AS n FROM findings WHERE status = 'open' AND verification_status <> 'confirmed'`)
    .get() as { n: unknown };
  out.pending = typeof p.n === 'number' ? p.n : 0;
  return out;
}

export function clearHistory(db: Db): void {
  db.exec('BEGIN;');
  try {
    db.exec(`DELETE FROM audit_findings; DELETE FROM ai_analyses; DELETE FROM finding_history; DELETE FROM findings; DELETE FROM audits;`);
    db.exec('COMMIT;');
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* rollback defensivo */
    }
    throw err;
  }
}
