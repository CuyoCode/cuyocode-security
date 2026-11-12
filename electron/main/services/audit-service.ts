// Servicio de auditorías del proceso principal: valida solicitudes, aplica la
// puerta de laboratorio, ejecuta el orquestador en segundo plano con
// cancelación, persiste resultados y emite progreso al renderer.

import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import type { Db } from '../database/connection';
import { ValidationError, assertSafeObject, cleanText, newId, validateId } from '../ipc/validation';
import { assertTargetForProfile, loadProfile, runAudit } from '../../../engine/orchestrator/runner';
import type { AuditRequest, EngineFn } from '../../../engine/orchestrator/types';
import {
  createAudit, finishAudit, getAudit, listAudits, saveFindings, setAuditConsent, setAuditNotes,
  updateAuditProgress, updateFindingStatus,
} from '../database/audit-store';
import { getSshProfile } from '../database/ssh-store';
import { insertProject, listProjects } from '../database/projects-store';
import { createNodeLab, listNodeLabs } from '../../../engine/lab/node-manager';
import { findRepoRoot } from '../../../engine/paths';
import { BASE_ENGINES } from '../../../engine/orchestrator/registry';
import { sshAuditEngine } from '../../../engine/server/linux';
import { assertLabIsolation, assertNodeLabIsolation } from '../../../engine/lab/verify';
import { buildReport, renderHtml, renderJson } from '../../../engine/reporting/report';
import { listFindings } from '../database/audit-store';
import { buildReviewRequest, readExcerpt } from '../../../engine/ai/consent';
import { OllamaProvider } from '../../../engine/ai/ollama';
import { ExternalProvider, validateExternalConfig } from '../../../engine/ai/external';
import type { AiAnalysis } from '../../../engine/ai/providers';
import { redact, redactCode } from '../../../engine/finding/redact';
import { logger } from '../logging/logger';
import { Vault, electronStorage } from '../security/vault';
import type { StartAuditInput } from '../../../shared/ipc-contracts/audit.contracts';
import fs from 'node:fs';
import path from 'node:path';

const PROFILE_IDS = ['local-code', 'local-code-deep', 'demo-code', 'web-passive', 'web-active', 'server-readonly', 'lab-advanced'];

interface AiSession {
  mode: 'off' | 'local' | 'external';
  ollamaModel: string;
  externalEndpoint: string | null;
  externalModel: string | null;
  externalMaxTokens: number;
  key: string;
}

const aiSession: AiSession = {
  mode: 'off',
  ollamaModel: 'llama3.1',
  externalEndpoint: null,
  externalModel: null,
  externalMaxTokens: 2000,
  key: '',
};

/** Bóveda y config IA en disco (init al arrancar; la clave solo cifrada). */
let aiVault: Vault | null = null;
let aiConfigFile = '';

interface AiDiskConfig {
  mode: 'off' | 'local' | 'external';
  ollamaModel: string;
  externalEndpoint: string | null;
  externalModel: string | null;
  externalMaxTokens: number;
}

function readAiDiskConfig(): AiDiskConfig | null {
  try {
    const raw = fs.readFileSync(aiConfigFile, 'utf8');
    const c = JSON.parse(raw) as Partial<AiDiskConfig>;
    if (c.mode !== 'off' && c.mode !== 'local' && c.mode !== 'external') return null;
    return {
      mode: c.mode,
      ollamaModel: typeof c.ollamaModel === 'string' ? c.ollamaModel.slice(0, 100) : 'llama3.1',
      externalEndpoint: typeof c.externalEndpoint === 'string' ? c.externalEndpoint.slice(0, 500) : null,
      externalModel: typeof c.externalModel === 'string' ? c.externalModel.slice(0, 100) : null,
      externalMaxTokens: typeof c.externalMaxTokens === 'number' ? c.externalMaxTokens : 2000,
    };
  } catch {
    return null;
  }
}

/** Restaura la sesión IA (config en claro + clave solo desde la bóveda). */
export function initAiStore(dataDir: string): void {
  aiConfigFile = path.join(dataDir, 'ai-config.json');
  try {
    aiVault = new Vault(dataDir, electronStorage());
  } catch {
    aiVault = null;
  }
  const disk = readAiDiskConfig();
  if (!disk || disk.mode === 'off') return;
  aiSession.mode = disk.mode;
  aiSession.ollamaModel = disk.ollamaModel;
  aiSession.externalEndpoint = disk.externalEndpoint;
  aiSession.externalModel = disk.externalModel;
  aiSession.externalMaxTokens = disk.externalMaxTokens;
  aiSession.key = aiVault?.get('ai-external-key') ?? '';
  if (disk.mode === 'external' && !aiSession.key) {
    aiSession.mode = 'off';
  }
}

const running = new Map<string, AbortController>();

function validateStartInput(input: unknown): StartAuditInput {
  assertSafeObject(input, 'Auditoría');
  const kind = input['kind'];
  if (kind !== 'folder' && kind !== 'url' && kind !== 'server') {
    throw new ValidationError('BAD_KIND', 'Tipo: folder, url o server');
  }
  const profileId = cleanText(input['profileId'], 64, 'Perfil');
  if (!PROFILE_IDS.includes(profileId)) throw new ValidationError('BAD_PROFILE', 'Perfil desconocido');
  const target = cleanText(input['target'], 2048, 'Objetivo');
  const aiMode = input['aiMode'];
  if (aiMode !== 'off' && aiMode !== 'local' && aiMode !== 'external') {
    throw new ValidationError('BAD_AI', 'Modo IA inválido');
  }
  let aiConsent: StartAuditInput['aiConsent'] = null;
  if (aiMode === 'external') {
    if (typeof input['aiConsent'] !== 'object' || input['aiConsent'] === null) {
      throw new ValidationError('AI_CONSENT', 'El análisis externo exige consentimiento explícito');
    }
    const c = input['aiConsent'] as Record<string, unknown>;
    try {
      aiConsent = {
        provider: cleanText(c['provider'], 50, 'Proveedor IA'),
        model: cleanText(c['model'], 100, 'Modelo IA'),
        scope: cleanText(c['scope'], 2048, 'Alcance IA'),
      };
    } catch {
      throw new ValidationError('AI_CONSENT', 'Consentimiento incompleto');
    }
  }
  const projectId = input['projectId'];
  if (projectId !== null && projectId !== undefined) validateId(projectId);
  return {
    projectId: typeof projectId === 'string' ? projectId : null,
    target,
    kind,
    profileId,
    aiMode,
    aiConsent,
    allowPrivate: input['allowPrivate'] === true,
    labId: typeof input['labId'] === 'string' ? cleanText(input['labId'], 32, 'Laboratorio') : undefined,
    sshProfileId: typeof input['sshProfileId'] === 'string' ? validateId(input['sshProfileId']) : undefined,
  };
}

export function activeAuditCount(): number {
  return running.size;
}

async function launchAudit(
  db: Db,
  sender: WebContents,
  request: AuditRequest,
  profile: ReturnType<typeof loadProfile>,
): Promise<string> {
  // Puerta de laboratorio ANTES de ejecutar nada.
  if (profile.requiresLab) {
    if (!request.labId) throw new ValidationError('LAB_REQUIRED', 'Este perfil exige laboratorio');
    if (request.labId.startsWith('node-')) {
      const nodeCheck = await assertNodeLabIsolation(request.labId, request.target);
      if (!nodeCheck.ok) {
        throw new ValidationError('LAB_BLOCKED', `Aislamiento no verificado: ${nodeCheck.reasons.join('; ')}`);
      }
    } else {
      const check = await assertLabIsolation(request.labId, request.target);
      if (!check.ok) {
        throw new ValidationError('LAB_BLOCKED', `Aislamiento no verificado: ${check.reasons.join('; ')}`);
      }
    }
  }
  // El objetivo se valida ya (falla rápido, sin crear corrida fantasma).
  assertTargetForProfile(request, profile);

  const engines: Record<string, EngineFn> = { ...BASE_ENGINES };
  if (profile.engines.includes('ssh-readonly')) {
    if (!request.sshProfileId) throw new ValidationError('SSH_REQUIRED', 'Falta el perfil SSH');
    const sshProfile = getSshProfile(db, request.sshProfileId);
    if (!sshProfile) throw new ValidationError('SSH_REQUIRED', 'Perfil SSH inexistente');
    if (sshProfile.host !== request.target.split(':')[0]) {
      throw new ValidationError('SSH_MISMATCH', 'El perfil SSH no corresponde al objetivo');
    }
    engines['ssh-readonly'] = (job) => sshAuditEngine(job, { profile: sshProfile });
  }

  const auditId = newId();
  const controller = new AbortController();
  running.set(auditId, controller);
  const emit = (channel: string, payload: unknown): void => {
    try {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    } catch {
      /* renderer cerrado */
    }
  };

  void (async () => {
    const notes: string[] = [];
    try {
      const result = await runAudit(
        auditId,
        request,
        engines,
        {
          onProgress: (done, total, currentEngine) => {
            try {
              updateAuditProgress(db, auditId, done, total, currentEngine);
            } catch (e) {
              logger.error('No se pudo persistir el progreso', e);
            }
            emit('audits:progress', { auditId, done, total, currentEngine });
          },
          createAudit: (id, req, prof) => createAudit(db, id, req, prof),
          finishAudit: (id, status, error) => finishAudit(db, id, status, error),
          saveFindings: (id, findings) => saveFindings(db, id, findings),
        },
        controller.signal,
        profile.limits.timeoutMs,
      );
      notes.push(...result.errors);
      if (request.aiMode !== 'off' && result.status === 'done') {
        notes.push(await runAiReview(db, request, auditId));
      }
      try {
        setAuditNotes(db, auditId, notes);
      } catch (e) {
        logger.error('No se pudieron persistir las notas', e);
      }
      emit('audits:finished', { auditId, status: result.status, errors: result.errors });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'fallo desconocido';
      try {
        finishAudit(db, auditId, 'failed', message);
      } catch {
        /* ya finalizada */
      }
      emit('audits:finished', { auditId, status: 'failed', errors: [message] });
    } finally {
      running.delete(auditId);
    }
  })();

  return auditId;
}

export async function startAudit(db: Db, sender: WebContents, raw: unknown): Promise<{ auditId: string }> {
  const input = validateStartInput(raw);
  const profile = loadProfile(input.profileId);
  const request: AuditRequest = {
    projectId: input.projectId,
    target: input.target,
    kind: input.kind,
    profileId: input.profileId,
    aiMode: input.aiMode,
    aiConsent: input.aiConsent ? { ...input.aiConsent, at: new Date().toISOString() } : null,
    allowPrivate: input.allowPrivate,
    labId: input.labId,
    sshProfileId: input.sshProfileId,
  };
  return { auditId: await launchAudit(db, sender, request, profile) };
}

export interface DemoResult {
  projectId: string;
  auditId: string;
  localAuditId: string;
  labId: string;
  labTarget: string;
  findings: number;
}

const DEMO_PROJECT_NAME = 'Demo — tienda vulnerable';
const DEMO_FIXTURE = ['tests', 'fixtures', 'vuln-app'] as const;

async function waitForAudit(db: Db, auditId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const audit = getAudit(db, auditId);
    if (!audit || audit.status !== 'running') return;
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Deja la demo con estados de revisión variados, como una corrida real. */
function seedDemoReviews(db: Db, auditId: string): void {
  const findings = listFindings(db, { auditId }, 40).filter((f) => f.status === 'open');
  const picks: Array<[string, string]> = [
    ['reviewed', 'Revisado en la demo: hallazgo confirmado por lectura del código.'],
    ['accepted-risk', 'Riesgo aceptado en la demo: el objetivo es sintético y no procesa datos reales.'],
    ['false-positive', 'Falso positivo de demo: el valor coincide con un placeholder del fixture.'],
  ];
  for (let i = 0; i < picks.length && i < findings.length; i++) {
    const [status, note] = picks[i] as [string, string];
    try {
      updateFindingStatus(db, findings[i]!.id, status, note);
    } catch (e) {
      logger.warn('No se pudo sembrar la revisión de demo', e);
    }
  }
}

/**
 * Demo reproducible de un clic: auditoría estática sobre el fixture sintético
 * + auditoría web pasiva contra el laboratorio Node. Sin Docker, sin IA y sin
 * herramientas externas, para que funcione igual en cualquier máquina.
 */
export async function runDemo(db: Db, sender: WebContents): Promise<DemoResult> {
  const fixture = path.join(findRepoRoot(), ...DEMO_FIXTURE);
  if (!fs.existsSync(path.join(fixture, 'package.json'))) {
    throw new ValidationError('DEMO_MISSING', 'No se encontró el fixture de demo en esta instalación');
  }
  let project = listProjects(db).find((p) => p.name === DEMO_PROJECT_NAME);
  if (!project) {
    project = insertProject(db, newId(), { name: DEMO_PROJECT_NAME, kind: 'folder', target: fixture });
  }
  const projectId = project.id;

  const localRequest: AuditRequest = {
    projectId,
    target: fixture,
    kind: 'folder',
    profileId: 'demo-code',
    aiMode: 'off',
    aiConsent: null,
    allowPrivate: false,
  };
  const localAuditId = await launchAudit(db, sender, localRequest, loadProfile('demo-code'));
  await waitForAudit(db, localAuditId, 120000);
  seedDemoReviews(db, localAuditId);

  let labId = '';
  let labTarget = '';
  const existing = listNodeLabs().find((l) => l.id === 'node-demo');
  if (existing) {
    labId = existing.id;
    labTarget = existing.target;
  } else {
    for (let port = 3117; port <= 3126 && !labTarget; port++) {
      try {
        const lab = await createNodeLab('node-demo', port);
        labId = lab.id;
        labTarget = lab.target;
      } catch (e) {
        if (e instanceof ValidationError && e.code === 'LAB_EXISTS') {
          const found = listNodeLabs().find((l) => l.id === 'node-demo');
          if (found) {
            labId = found.id;
            labTarget = found.target;
          }
          break;
        }
      }
    }
  }

  let webAuditId = '';
  if (labTarget) {
    const webRequest: AuditRequest = {
      projectId,
      target: labTarget,
      kind: 'url',
      profileId: 'web-passive',
      aiMode: 'off',
      aiConsent: null,
      allowPrivate: true,
      labId,
    };
    webAuditId = await launchAudit(db, sender, webRequest, loadProfile('web-passive'));
    await waitForAudit(db, webAuditId, 120000);
    seedDemoReviews(db, webAuditId);
  }

  const total = [localAuditId, webAuditId]
    .filter(Boolean)
    .reduce((sum, id) => sum + listFindings(db, { auditId: id }, 500).length, 0);
  return {
    projectId,
    auditId: webAuditId || localAuditId,
    localAuditId,
    labId,
    labTarget,
    findings: total,
  };
}

export function cancelAudit(auditId: string): { cancelled: boolean } {
  const c = running.get(validateId(auditId));
  if (!c) return { cancelled: false };
  c.abort();
  return { cancelled: true };
}

/** Cancelación de cierre: evita escrituras sobre una DB ya cerrada. */
export function cancelAllAudits(): void {
  for (const controller of running.values()) {
    try {
      controller.abort(new Error('La aplicación se está cerrando'));
    } catch {
      /* ya abortada */
    }
  }
}

async function runAiReview(db: Db, request: AuditRequest, auditId: string): Promise<string> {
  try {
    const findings = listFindings(db, { auditId }, 40);
    if (findings.length === 0) return 'IA: sin hallazgos para revisar.';
    const rules = [...new Set(findings.map((f) => f.ruleId))];
    const { request: reviewReq, consent } = buildReviewRequest(
      `Auditoría ${auditId} (${request.profileId}) sobre ${request.target}`,
      [],
      request.target,
      rules,
      findings,
      request.kind === 'folder'
        ? (file, line) => readExcerpt(request.target, file, line)
        : () => null,
    );
    let analysis: AiAnalysis;
    // El modo elegido en el asistente manda: nunca se usa el proveedor global
    // si la auditoría pidió otro modo (evita enviar datos sin consentimiento).
    if (request.aiMode === 'local') {
      const provider = new OllamaProvider(aiSession.ollamaModel);
      const t = await provider.test();
      if (!t.ok) return `IA local no disponible: ${t.detail}. Revisión omitida.`;
      consent.provider = 'ollama';
      consent.model = aiSession.ollamaModel;
      setAuditConsent(db, auditId, consent);
      analysis = await provider.analyze(reviewReq, { timeoutMs: 180000 });
    } else if (request.aiMode === 'external') {
      if (!aiSession.externalEndpoint || !aiSession.externalModel || !aiSession.key) {
        return 'IA externa: no hay proveedor configurado en Ajustes. Revisión omitida.';
      }
      const provider = new ExternalProvider(
        validateExternalConfig({ endpoint: aiSession.externalEndpoint, model: aiSession.externalModel, maxTokens: aiSession.externalMaxTokens }),
        aiSession.key,
      );
      consent.provider = 'external';
      consent.model = aiSession.externalModel;
      setAuditConsent(db, auditId, consent);
      analysis = await provider.analyze(reviewReq, { timeoutMs: 120000 });
    } else {
      return 'IA: revisión omitida (modo desactivado).';
    }
    db.prepare('INSERT INTO ai_analyses (id, audit_id, provider, model, summary, analysis_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      randomUUID(),
      auditId,
      analysis.provider,
      analysis.model,
      redact(analysis.summary).slice(0, 4000),
      redactCode(JSON.stringify(analysis)).slice(0, 20000),
      new Date().toISOString(),
    );
    const disputes = analysis.annotations.filter((a) => a.opinion === 'disputes').length;
    return `IA (${analysis.provider}/${analysis.model}): ${analysis.summary.slice(0, 300)} [${analysis.annotations.length} opiniones, ${disputes} en desacuerdo]`;
  } catch (e) {
    return `IA: revisión fallida (${e instanceof Error ? e.message : 'error'}). Los hallazgos deterministas no se ven afectados.`;
  }
}

export function getAiReview(db: Db, auditId: string): AiAnalysis[] {
  validateId(auditId);
  const rows = db.prepare('SELECT provider, model, summary, analysis_json FROM ai_analyses WHERE audit_id = ? ORDER BY created_at ASC').all(auditId) as unknown as Array<{
    provider: string; model: string; summary: string; analysis_json: string;
  }>;
  const out: AiAnalysis[] = [];
  for (const r of rows) {
    try {
      const a = JSON.parse(r.analysis_json) as AiAnalysis;
      out.push({
        ...a,
        summary: redact(a.summary),
        annotations: a.annotations.map((x) => ({ ...x, rationale: redact(x.rationale) })),
        suggestedNextSteps: a.suggestedNextSteps.map((x) => redact(x)),
      });
    } catch {
      out.push({ provider: r.provider, model: r.model, summary: redact(r.summary), annotations: [], suggestedNextSteps: [] });
    }
  }
  return out;
}

// --- Sesión IA (memoria del proceso principal; la clave jamás se persiste) ---

export function aiStatus(): { mode: 'off' | 'local' | 'external'; ollamaModel: string | null; externalEndpoint: string | null; hasKey: boolean } {
  return {
    mode: aiSession.mode,
    ollamaModel: aiSession.mode === 'local' ? aiSession.ollamaModel : null,
    externalEndpoint: aiSession.mode === 'external' ? aiSession.externalEndpoint : null,
    hasKey: aiSession.key.length > 0,
  };
}

export function configureAi(input: unknown): { mode: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError('INVALID_SHAPE', 'Configuración IA inválida');
  }
  const o = input as Record<string, unknown>;
  const mode = o['mode'];
  const persist = (cfg: { mode: 'off' | 'local' | 'external' }): void => {
    try {
      if (aiConfigFile) {
        fs.mkdirSync(path.dirname(aiConfigFile), { recursive: true });
        fs.writeFileSync(aiConfigFile, JSON.stringify({
          mode: cfg.mode,
          ollamaModel: aiSession.ollamaModel,
          externalEndpoint: aiSession.externalEndpoint,
          externalModel: aiSession.externalModel,
          externalMaxTokens: aiSession.externalMaxTokens,
        }), 'utf8');
      }
    } catch (e) {
      logger.error('No se pudo persistir la configuración IA', e);
    }
  };
  if (mode === 'off') {
    aiSession.mode = 'off';
    aiSession.key = '';
    persist({ mode: 'off' });
    return { mode: 'off' };
  }
  if (mode === 'local') {
    const model = typeof o['ollamaModel'] === 'string' ? o['ollamaModel'] : 'llama3.1';
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(model)) throw new ValidationError('BAD_MODEL', 'Modelo inválido');
    aiSession.mode = 'local';
    aiSession.ollamaModel = model;
    aiSession.key = '';
    persist({ mode: 'local' });
    return { mode: 'local' };
  }
  if (mode === 'external') {
    const cfg = validateExternalConfig({ endpoint: o['endpoint'], model: o['model'], maxTokens: o['maxTokens'] });
    const key = typeof o['apiKey'] === 'string' ? o['apiKey'].trim() : '';
    const remember = o['remember'] !== false;
    const hasNewKey = key.length >= 8 && key.length <= 500;
    if (key.length > 0 && !hasNewKey) throw new ValidationError('BAD_KEY', 'API key inválida');
    const endpointChanged =
      aiSession.externalEndpoint !== null && aiSession.externalEndpoint !== cfg.endpoint;
    if (!hasNewKey) {
      // Sin clave nueva: solo se conserva la existente si el endpoint no cambió.
      if (!aiSession.key || aiSession.key.length < 8) {
        throw new ValidationError('BAD_KEY', 'Ingresá la API key para el proveedor externo');
      }
      if (endpointChanged) {
        throw new ValidationError('KEY_REBIND', 'Cambió el endpoint: ingresá la API key de nuevo');
      }
    }
    aiSession.mode = 'external';
    aiSession.externalEndpoint = cfg.endpoint;
    aiSession.externalModel = cfg.model;
    aiSession.externalMaxTokens = cfg.maxTokens;
    if (hasNewKey) aiSession.key = key;
    // Persistir config (sin secretos) y clave (solo cifrada en bóveda).
    try {
      if (aiConfigFile) {
        fs.mkdirSync(path.dirname(aiConfigFile), { recursive: true });
        fs.writeFileSync(aiConfigFile, JSON.stringify({
          mode: 'external',
          ollamaModel: aiSession.ollamaModel,
          externalEndpoint: cfg.endpoint,
          externalModel: cfg.model,
          externalMaxTokens: cfg.maxTokens,
        }), 'utf8');
      }
      if (remember && aiVault?.available && aiSession.key) {
        aiVault.set('ai-external-key', aiSession.key);
      } else if (!remember) {
        aiVault?.delete('ai-external-key');
      }
    } catch (e) {
      logger.error('No se pudo persistir la configuración IA', e);
    }
    return { mode: 'external' };
  }
  throw new ValidationError('BAD_AI', 'Modo IA inválido');
}

export async function testAi(): Promise<{ ok: boolean; detail: string }> {
  if (aiSession.mode === 'local') {
    return new OllamaProvider(aiSession.ollamaModel).test();
  }
  if (aiSession.mode === 'external' && aiSession.externalEndpoint && aiSession.externalModel && aiSession.key) {
    return new ExternalProvider(
      { endpoint: aiSession.externalEndpoint, model: aiSession.externalModel, maxTokens: aiSession.externalMaxTokens },
      aiSession.key,
    ).test();
  }
  return { ok: false, detail: 'IA desactivada o sin proveedor configurado' };
}

export function forgetAi(): { forgotten: boolean } {
  aiSession.mode = 'off';
  aiSession.key = '';
  aiSession.externalEndpoint = null;
  aiSession.externalModel = null;
  try {
    aiVault?.delete('ai-external-key');
    if (aiConfigFile) fs.rmSync(aiConfigFile, { force: true });
  } catch (e) {
    logger.error('No se pudo borrar la clave IA', e);
  }
  return { forgotten: true };
}

export function generateReport(db: Db, auditId: string, version?: string): { json: string; html: string } {
  validateId(auditId);
  const report = buildReport(db, auditId, version);
  return { json: renderJson(report), html: renderHtml(report) };
}

export { getAudit, listAudits };
