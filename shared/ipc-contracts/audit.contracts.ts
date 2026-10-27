// Contratos audits:*/findings:/reports: — ejecución, seguimiento y resultados.

export const AUDIT_CHANNELS = {
  start: 'audits:start',
  cancel: 'audits:cancel',
  list: 'audits:list',
  get: 'audits:get',
  findings: 'audits:findings',
  updateFinding: 'audits:update-finding',
  findingHistory: 'audits:finding-history',
  compare: 'audits:compare',
  aiReview: 'audits:ai-review',
} as const;

export const REPORT_CHANNELS = {
  generate: 'reports:generate',
  save: 'reports:save',
} as const;

export type AiMode = 'off' | 'local' | 'external';

export interface StartAuditInput {
  projectId: string | null;
  target: string;
  kind: 'folder' | 'url' | 'server';
  profileId: string;
  aiMode: AiMode;
  /** Consentimiento explícito ya otorgado en el asistente (solo external). */
  aiConsent: { provider: string; model: string; scope: string } | null;
  allowPrivate: boolean;
  labId?: string | undefined;
  sshProfileId?: string | undefined;
}

export interface AuditProgressEvent {
  auditId: string;
  done: number;
  total: number;
  currentEngine: string;
}

export interface AuditFinishedEvent {
  auditId: string;
  status: 'done' | 'cancelled' | 'failed';
  errors: string[];
}
