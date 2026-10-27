// Tipos del orquestador: una auditoría es una corrida perfilada, cancelable,
// con progreso y resultados normalizados. Nada destructivo sin perfil que lo
// declare y laboratorio verificado cuando corresponda.

import type { Finding } from '../../shared/finding-schema';
import type { ProjectKind } from '../../shared/ipc-contracts/project.contracts';

export type AuditStatus = 'queued' | 'running' | 'done' | 'cancelled' | 'failed';

export interface AuditLimits {
  maxRequests?: number;
  maxPorts?: number;
  maxFiles?: number;
  maxFileBytes?: number;
  maxRedirects?: number;
  timeoutMs: number;
  concurrency?: number;
}

export interface AuditProfile {
  id: string;
  version: number;
  title: string;
  description: string;
  targetKinds: ProjectKind[];
  engines: string[];
  destructive: boolean;
  requiresLab: boolean;
  allowMutatingMethods?: boolean;
  limits: AuditLimits;
}

export interface AiConsent {
  provider: string;
  model: string;
  scope: string;
  at: string;
}

export interface AuditRequest {
  projectId: string | null;
  target: string;
  kind: ProjectKind;
  profileId: string;
  /** IA desactivada por defecto; 'external' exige consentimiento explícito. */
  aiMode: 'off' | 'local' | 'external';
  aiConsent: AiConsent | null;
  /** Solo true para laboratorio aislado o red local autorizada. */
  allowPrivate: boolean;
  labId?: string | undefined;
  /** Perfil SSH para el motor ssh-readonly (Fase 5). */
  sshProfileId?: string | undefined;
}

export interface EngineError {
  engine: string;
  message: string;
}

export interface EngineSkipped {
  engine: string;
  reason: string;
}

export interface EngineResult {
  engine: string;
  version: string;
  findings: Finding[];
  errors: EngineError[];
  skipped: EngineSkipped[];
  durationMs: number;
}

export interface AuditProgress {
  done: number;
  total: number;
  currentEngine: string;
}

export interface EngineJob {
  auditId: string;
  target: string;
  kind: ProjectKind;
  profile: AuditProfile;
  limits: AuditLimits;
  signal: AbortSignal;
  allowPrivate: boolean;
  aiMode: 'off' | 'local' | 'external';
  report: (done: number, total: number, currentEngine: string) => void;
}

export type EngineFn = (job: EngineJob) => Promise<EngineResult>;
