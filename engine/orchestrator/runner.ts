// Orquestador: valida alcance y perfil, ejecuta motores en secuencia con
// cancelación y timeout global, persiste resultados y emite progreso.
// Un motor que falla no aborta la auditoría: se registra el error y la
// cobertura perdida queda visible en el informe.

import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../../shared/finding-schema';
import { validateFinding } from '../../shared/finding-schema';
import type { AuditRequest, AuditProfile, EngineFn, EngineJob, EngineResult } from './types';
import { ValidationError } from '../scope/targets';
import { validateFolderTarget, validateServerTarget, validateUrlTarget } from '../scope/targets';
import { findRepoRoot } from '../paths';

const PROFILE_IDS = ['local-code', 'local-code-deep', 'demo-code', 'web-passive', 'web-active', 'server-readonly', 'lab-advanced'] as const;

function repoRoot(): string {
  return findRepoRoot();
}

export function loadProfile(profileId: string): AuditProfile {
  if (!PROFILE_IDS.includes(profileId as (typeof PROFILE_IDS)[number])) {
    throw new ValidationError('BAD_PROFILE', 'Perfil desconocido');
  }
  const file = path.join(repoRoot(), 'profiles', `${profileId}.json`);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new ValidationError('PROFILE_MISSING', `Perfil no disponible: ${profileId}`);
  }
  const p = JSON.parse(raw) as AuditProfile;
  if (p.id !== profileId || !Array.isArray(p.engines) || typeof p.limits?.timeoutMs !== 'number') {
    throw new ValidationError('PROFILE_INVALID', `Perfil corrupto: ${profileId}`);
  }
  return p;
}

/** Revalida el objetivo contra el tipo que el perfil admite. */
export function assertTargetForProfile(request: AuditRequest, profile: AuditProfile): string {
  if (!profile.targetKinds.includes(request.kind)) {
    throw new ValidationError('PROFILE_MISMATCH', `El perfil "${profile.id}" no admite objetivos ${request.kind}`);
  }
  if (request.profileId === 'lab-advanced' || profile.requiresLab) {
    if (!request.labId) {
      throw new ValidationError('LAB_REQUIRED', 'Este perfil exige un laboratorio aislado verificado');
    }
  }
  if (request.aiMode === 'external' && !request.aiConsent) {
    throw new ValidationError('AI_CONSENT', 'El análisis externo exige consentimiento explícito');
  }
  return request.kind === 'folder'
    ? validateFolderTarget(request.target)
    : request.kind === 'url'
      ? validateUrlTarget(request.target)
      : validateServerTarget(request.target);
}

export interface RunCallbacks {
  onProgress: (done: number, total: number, currentEngine: string) => void;
  createAudit: (auditId: string, request: AuditRequest, profile: AuditProfile) => void;
  finishAudit: (auditId: string, status: 'done' | 'cancelled' | 'failed', error?: string) => void;
  saveFindings: (auditId: string, findings: Finding[]) => void;
}

export async function runAudit(
  auditId: string,
  request: AuditRequest,
  engines: Record<string, EngineFn>,
  callbacks: RunCallbacks,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ status: 'done' | 'cancelled' | 'failed'; errors: string[] }> {
  const profile = loadProfile(request.profileId);
  const target = assertTargetForProfile(request, profile);
  callbacks.createAudit(auditId, { ...request, target }, profile);

  const total = profile.engines.length;
  let done = 0;
  const errors: string[] = [];
  const report = (d: number, t: number, currentEngine: string): void => {
    callbacks.onProgress(d, t, currentEngine);
  };

  // El timeout debe cancelar de verdad: un flag no detiene motores en curso.
  const timeoutController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort(new Error(`Tiempo máximo excedido (${timeoutMs} ms)`));
  }, timeoutMs);
  timer.unref?.();
  const onExternalAbort = (): void => timeoutController.abort(signal.reason);
  if (signal.aborted) timeoutController.abort(signal.reason);
  else signal.addEventListener('abort', onExternalAbort, { once: true });
  const effectiveSignal = timeoutController.signal;

  const job: EngineJob = {
    auditId,
    target,
    kind: request.kind,
    profile,
    limits: profile.limits,
    signal: effectiveSignal,
    allowPrivate: request.allowPrivate,
    aiMode: request.aiMode,
    report,
  };

  try {
    for (const name of profile.engines) {
      if (timedOut) {
        errors.push(`Tiempo máximo excedido (${timeoutMs} ms)`);
        callbacks.finishAudit(auditId, 'failed', errors[errors.length - 1]);
        return { status: 'failed', errors };
      }
      if (effectiveSignal.aborted) {
        callbacks.finishAudit(auditId, 'cancelled', 'Cancelada por el usuario');
        return { status: 'cancelled', errors };
      }
      const fn = engines[name];
      if (!fn) {
        errors.push(`Motor no implementado: ${name}`);
        done += 1;
        report(done, total, name);
        continue;
      }
      const started = Date.now();
      try {
        const result: EngineResult = await fn(job);
        const valid: Finding[] = [];
        for (const f of result.findings) {
          try {
            valid.push(validateFinding({ ...f, lastSeen: new Date().toISOString() }));
          } catch (e) {
            errors.push(`Hallazgo inválido de ${name}: ${e instanceof Error ? e.message : 'desconocido'}`);
          }
        }
        callbacks.saveFindings(auditId, valid);
        for (const e of result.errors) errors.push(`${e.engine}: ${e.message}`);
        for (const s of result.skipped) errors.push(`${s.engine} omitido: ${s.reason}`);
        void started;
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : 'fallo desconocido'}`);
      }
      done += 1;
      report(done, total, name);
    }
    if (timedOut) {
      errors.push(`Tiempo máximo excedido (${timeoutMs} ms)`);
      callbacks.finishAudit(auditId, 'failed', errors[errors.length - 1]);
      return { status: 'failed', errors };
    }
    if (effectiveSignal.aborted) {
      callbacks.finishAudit(auditId, 'cancelled', 'Cancelada por el usuario');
      return { status: 'cancelled', errors };
    }
    callbacks.finishAudit(auditId, 'done');
    return { status: 'done', errors };
  } catch (e) {
    const message = timedOut
      ? `Tiempo máximo excedido (${timeoutMs} ms)`
      : e instanceof Error ? e.message : 'fallo desconocido';
    callbacks.finishAudit(auditId, 'failed', message);
    return { status: 'failed', errors: [...errors, message] };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onExternalAbort);
  }
}
