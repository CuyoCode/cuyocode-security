// Esquema inicial (v1). Tablas mínimas para Fase 1; el esquema de
// hallazgos completo llega en Fase 2 como migración v2.

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'base-projects-audits-findings',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('folder','url','server')),
        target TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        project_id TEXT NULL REFERENCES projects(id) ON DELETE SET NULL,
        profile TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        audit_id TEXT NULL REFERENCES audits(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
        verification_status TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'audit-scope-findings-full',
    sql: `
      ALTER TABLE audits ADD COLUMN target TEXT NOT NULL DEFAULT '';
      ALTER TABLE audits ADD COLUMN scope_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE audits ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE audits ADD COLUMN error TEXT NULL;
      ALTER TABLE findings ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
      ALTER TABLE findings ADD COLUMN confidence TEXT NOT NULL DEFAULT 'low';
      ALTER TABLE findings ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE findings ADD COLUMN rule_id TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE findings ADD COLUMN target TEXT NOT NULL DEFAULT '';
      ALTER TABLE findings ADD COLUMN location_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE findings ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE findings ADD COLUMN impact TEXT NOT NULL DEFAULT '';
      ALTER TABLE findings ADD COLUMN reproduction_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE findings ADD COLUMN remediation_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE findings ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE findings ADD COLUMN first_seen TEXT NOT NULL DEFAULT '';
      ALTER TABLE findings ADD COLUMN last_seen TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS finding_history (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
        changed_at TEXT NOT NULL,
        change TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      );
    `,
  },
  {
    version: 3,
    name: 'audit-notes',
    sql: `
      ALTER TABLE audits ADD COLUMN notes_json TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    version: 4,
    name: 'ssh-profiles-ai-analyses',
    sql: `
      CREATE TABLE IF NOT EXISTS ssh_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        user TEXT NOT NULL,
        key_path TEXT NOT NULL DEFAULT '',
        known_hosts_path TEXT NOT NULL,
        ops_version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id TEXT PRIMARY KEY,
        audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        summary TEXT NOT NULL,
        analysis_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: 'audit-findings-join',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_findings (
        audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
        seen_at TEXT NOT NULL,
        PRIMARY KEY (audit_id, finding_id)
      );
      INSERT OR IGNORE INTO audit_findings (audit_id, finding_id, seen_at)
        SELECT audit_id, id, COALESCE(NULLIF(last_seen, ''), created_at) FROM findings WHERE audit_id IS NOT NULL;
    `,
  },
  {
    version: 6,
    name: 'repair-finding-dates-and-indexes',
    sql: `
      UPDATE findings SET first_seen = created_at WHERE first_seen = '' OR first_seen IS NULL;
      UPDATE findings SET last_seen = COALESCE(NULLIF(last_seen, ''), first_seen, created_at) WHERE last_seen = '' OR last_seen IS NULL;
      UPDATE audit_findings SET seen_at = COALESCE((SELECT last_seen FROM findings WHERE findings.id = audit_findings.finding_id), seen_at)
        WHERE seen_at = '';
      CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
      CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
      CREATE INDEX IF NOT EXISTS idx_findings_last_seen ON findings(last_seen);
      CREATE INDEX IF NOT EXISTS idx_audit_findings_finding ON audit_findings(finding_id);
      CREATE INDEX IF NOT EXISTS idx_finding_history_finding ON finding_history(finding_id);
      CREATE INDEX IF NOT EXISTS idx_audits_started_at ON audits(started_at DESC);
    `,
  },
];
