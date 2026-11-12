// Registro central de canales IPC. Cada handler valida argumentos,
// responde con sobre {ok} y nunca propaga detalles internos al renderer.

import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { dialog, shell } from 'electron';
import fs from 'node:fs';
import { PROJECT_CHANNELS } from '../../../shared/ipc-contracts/project.contracts';
import { SYSTEM_CHANNELS } from '../../../shared/ipc-contracts/system.contracts';
import type { IpcResult } from '../../../shared/ipc-contracts/system.contracts';
import { AUDIT_CHANNELS, REPORT_CHANNELS } from '../../../shared/ipc-contracts/audit.contracts';
import { AI_CHANNELS, LAB_CHANNELS, SSH_CHANNELS } from '../../../shared/ipc-contracts/ai-lab-ssh.contracts';
import { ValidationError, assertNoArgs, assertSafeObject, assertSingleArg, cleanText, newId, validateCreateProject, validateId } from './validation';
import { detectTools, isAllowedInstallUrl } from './tool-detection';
import { clearHistory, countAudits, countFindings, deleteProject, insertProject, listProjects } from '../database/projects-store';
import {
  compareAudits, findingHistory, getFinding, listFindings, updateFindingStatus,
} from '../database/audit-store';
import { createSshProfile, deleteSshProfile, getSshProfile, listSshProfiles, pinHostKey } from '../database/ssh-store';
import { ALLOWED_OPS, execAllowedOp, fetchHostKey } from '../../../engine/server/ssh';
import { assertLabIsolation, assertNodeLabIsolation } from '../../../engine/lab/verify';
import { createLab, dockerAvailable, labStatus, removeLab } from '../../../engine/lab/docker';
import { createNodeLab, listNodeLabs, stopNodeLab } from '../../../engine/lab/node-manager';
import { redact } from '../../../engine/finding/redact';
import {
  activeAuditCount, aiStatus, cancelAudit, configureAi, forgetAi, generateReport, getAiReview,
  getAudit, listAudits, runDemo, startAudit, testAi,
} from '../services/audit-service';
import { getUserVersion, type Db } from '../database/connection';
import { logger } from '../logging/logger';

export interface HandlerContext {
  db: Db;
  dbPath: string;
  dataDir: string;
  appName: string;
  appVersion: string;
}

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown;

function wrap(channel: string, fn: Handler): Handler {
  return async (event, ...args) => {
    try {
      const data = await fn(event, ...args);
      return { ok: true, data } satisfies IpcResult<unknown>;
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.warn(`IPC rechazado [${channel}] ${err.code}`);
        return { ok: false, error: { code: err.code, message: err.message } } satisfies IpcResult<unknown>;
      }
      logger.error(`IPC fallido [${channel}]`, err);
      return { ok: false, error: { code: 'INTERNAL', message: 'Error interno' } } satisfies IpcResult<unknown>;
    }
  };
}

function strField(o: Record<string, unknown>, key: string, max: number, what: string): string {
  return cleanText(o[key], max, what);
}

export function registerAllHandlers(ipcMain: IpcMain, ctx: HandlerContext): void {
  ipcMain.handle(SYSTEM_CHANNELS.ping, wrap(SYSTEM_CHANNELS.ping, (_e, ...args) => {
    assertNoArgs(args);
    return { at: new Date().toISOString() };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.appInfo, wrap(SYSTEM_CHANNELS.appInfo, (_e, ...args) => {
    assertNoArgs(args);
    return {
      name: ctx.appName,
      version: ctx.appVersion,
      electron: process.versions.electron ?? 'desconocido',
      node: process.versions.node ?? 'desconocido',
      chrome: process.versions.chrome ?? 'desconocido',
      platform: process.platform,
      dataDir: ctx.dataDir,
    };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.toolStatus, wrap(SYSTEM_CHANNELS.toolStatus, async (_e, ...args) => {
    assertNoArgs(args);
    return detectTools();
  }));

  ipcMain.handle(SYSTEM_CHANNELS.dbHealth, wrap(SYSTEM_CHANNELS.dbHealth, (_e, ...args) => {
    assertNoArgs(args);
    const row = ctx.db.prepare('PRAGMA quick_check(1)').get() as unknown as { quick_check: string } | undefined;
    const ok = row?.quick_check === 'ok';
    return { path: ctx.dbPath, userVersion: getUserVersion(ctx.db), ok, detail: row?.quick_check ?? 'sin respuesta' };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.dashboard, wrap(SYSTEM_CHANNELS.dashboard, (_e, ...args) => {
    assertNoArgs(args);
    const sev = countFindings(ctx.db);
    return {
      projects: listProjects(ctx.db).length,
      audits: countAudits(ctx.db),
      findingsBySeverity: {
        critical: sev.critical,
        high: sev.high,
        medium: sev.medium,
        low: sev.low,
        info: sev.info,
      },
      pendingReview: sev.pending,
    };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.openDataDir, wrap(SYSTEM_CHANNELS.openDataDir, async (_e, ...args) => {
    assertNoArgs(args);
    const error = await shell.openPath(ctx.dataDir);
    if (error) throw new ValidationError('OPEN_FAILED', error.slice(0, 200));
    return { opened: true };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.clearHistory, wrap(SYSTEM_CHANNELS.clearHistory, (_e, ...args) => {
    assertNoArgs(args);
    if (activeAuditCount() > 0) throw new ValidationError('BUSY', 'Hay auditorías en curso');
    clearHistory(ctx.db);
    return { cleared: true };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.pickFolder, wrap(SYSTEM_CHANNELS.pickFolder, async (_e, ...args) => {
    assertNoArgs(args);
    const chosen = await dialog.showOpenDialog({ properties: ['openDirectory', 'dontAddToRecent'] });
    if (chosen.canceled || chosen.filePaths.length === 0) return { folder: null };
    return { folder: chosen.filePaths[0] as string };
  }));

  ipcMain.handle(SYSTEM_CHANNELS.demo, wrap(SYSTEM_CHANNELS.demo, async (e, ...args) => {
    assertNoArgs(args);
    return runDemo(ctx.db, e.sender);
  }));

  ipcMain.handle(SYSTEM_CHANNELS.openInstallPage, wrap(SYSTEM_CHANNELS.openInstallPage, async (_e, ...args) => {
    const raw = assertSingleArg(args);
    const url = typeof raw === 'string' ? raw : (raw as Record<string, unknown>)['url'];
    if (typeof url !== 'string' || !isAllowedInstallUrl(url)) {
      throw new ValidationError('FORBIDDEN_URL', 'URL de instalación no permitida');
    }
    await shell.openExternal(url);
    return { opened: true };
  }));

  ipcMain.handle(PROJECT_CHANNELS.list, wrap(PROJECT_CHANNELS.list, (_e, ...args) => {
    assertNoArgs(args);
    return listProjects(ctx.db);
  }));

  ipcMain.handle(PROJECT_CHANNELS.create, wrap(PROJECT_CHANNELS.create, (_e, ...args) => {
    const input = validateCreateProject(assertSingleArg(args));
    return insertProject(ctx.db, newId(), input);
  }));

  ipcMain.handle(PROJECT_CHANNELS.remove, wrap(PROJECT_CHANNELS.remove, (_e, ...args) => {
    const id = validateId(assertSingleArg(args));
    const removed = deleteProject(ctx.db, id);
    if (!removed) throw new ValidationError('NOT_FOUND', 'Proyecto inexistente');
    return { removed: true };
  }));

  // --- Auditorías ---
  ipcMain.handle(AUDIT_CHANNELS.start, wrap(AUDIT_CHANNELS.start, (e, ...args) => {
    return startAudit(ctx.db, e.sender, assertSingleArg(args));
  }));

  ipcMain.handle(AUDIT_CHANNELS.cancel, wrap(AUDIT_CHANNELS.cancel, (_e, ...args) => {
    return cancelAudit(assertSingleArg(args) as string);
  }));

  ipcMain.handle(AUDIT_CHANNELS.list, wrap(AUDIT_CHANNELS.list, (_e, ...args) => {
    assertNoArgs(args);
    return listAudits(ctx.db);
  }));

  ipcMain.handle(AUDIT_CHANNELS.get, wrap(AUDIT_CHANNELS.get, (_e, ...args) => {
    const audit = getAudit(ctx.db, validateId(assertSingleArg(args)));
    if (!audit) throw new ValidationError('NOT_FOUND', 'Auditoría inexistente');
    return audit;
  }));

  ipcMain.handle(AUDIT_CHANNELS.findings, wrap(AUDIT_CHANNELS.findings, (_e, ...args) => {
    const raw = assertSingleArg(args);
    if (raw !== undefined && (typeof raw !== 'object' || raw === null || Array.isArray(raw))) {
      throw new ValidationError('INVALID_SHAPE', 'Filtro inválido');
    }
    const f = (raw ?? {}) as Record<string, unknown>;
    const filter: { auditId?: string; severity?: string; status?: string; search?: string } = {};
    if (f['auditId'] !== undefined) filter.auditId = validateId(f['auditId']);
    for (const k of ['severity', 'status'] as const) {
      if (f[k] !== undefined) filter[k] = cleanText(f[k], 32, k);
    }
    if (f['search'] !== undefined) filter.search = cleanText(f['search'], 200, 'Búsqueda');
    return listFindings(ctx.db, filter);
  }));

  ipcMain.handle(AUDIT_CHANNELS.updateFinding, wrap(AUDIT_CHANNELS.updateFinding, (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Revisión');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const status = cleanText(o['status'], 32, 'Estado');
    const allowed = ['reviewed', 'false-positive', 'resolved', 'accepted-risk', 'open'];
    if (!allowed.includes(status)) throw new ValidationError('BAD_STATUS', 'Estado de revisión inválido');
    const note = typeof o['note'] === 'string' ? o['note'].slice(0, 2000) : '';
    if (status === 'false-positive' && note.trim().length < 10) {
      throw new ValidationError('FP_NOTE_REQUIRED', 'Un falso positivo exige justificación (mínimo 10 caracteres)');
    }
    updateFindingStatus(ctx.db, validateId(o['id']), status, note);
    return { updated: true };
  }));

  ipcMain.handle(AUDIT_CHANNELS.findingHistory, wrap(AUDIT_CHANNELS.findingHistory, (_e, ...args) => {
    return findingHistory(ctx.db, validateId(assertSingleArg(args)));
  }));

  ipcMain.handle(AUDIT_CHANNELS.compare, wrap(AUDIT_CHANNELS.compare, (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Comparación');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const base = compareAudits(ctx.db, validateId(o['baseId']), validateId(o['otherId']));
    const pick = (ids: string[]): unknown[] => ids.map((id) => getFinding(ctx.db, id)).filter(Boolean);
    return { onlyBase: pick(base.onlyBase), onlyOther: pick(base.onlyOther), bothCount: base.both.length };
  }));

  ipcMain.handle(AUDIT_CHANNELS.aiReview, wrap(AUDIT_CHANNELS.aiReview, (_e, ...args) => {
    return getAiReview(ctx.db, validateId(assertSingleArg(args)));
  }));

  // --- Informes ---
  ipcMain.handle(REPORT_CHANNELS.generate, wrap(REPORT_CHANNELS.generate, (_e, ...args) => {
    const raw = assertSingleArg(args);
    const id = typeof raw === 'string' ? raw : (raw as Record<string, unknown>)['auditId'];
    return generateReport(ctx.db, validateId(id), ctx.appVersion);
  }));

  ipcMain.handle(REPORT_CHANNELS.save, wrap(REPORT_CHANNELS.save, async (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Exportación');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const format = o['format'];
    if (format !== 'json' && format !== 'html' && format !== 'pdf') {
      throw new ValidationError('BAD_FORMAT', 'Formato: json, html o pdf');
    }
    const { json, html } = generateReport(ctx.db, validateId(o['auditId']), ctx.appVersion);
    const defPath = `auditoria-${String(o['auditId']).slice(0, 8)}.${format}`;
    const chosen = await dialog.showSaveDialog({ defaultPath: defPath, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
    if (chosen.canceled || !chosen.filePath) return { saved: false };
    if (format === 'pdf') {
      const { exportPdf } = await import('../services/pdf-service');
      fs.writeFileSync(chosen.filePath, await exportPdf(html));
    } else {
      fs.writeFileSync(chosen.filePath, format === 'json' ? json : html, 'utf8');
    }
    return { saved: true, path: chosen.filePath };
  }));

  // --- IA (sesión; la clave jamás se persiste) ---
  ipcMain.handle(AI_CHANNELS.status, wrap(AI_CHANNELS.status, async (_e, ...args) => {
    assertNoArgs(args);
    const s = aiStatus();
    if (s.mode === 'local') {
      const { OllamaProvider } = await import('../../../engine/ai/ollama');
      const t = await new OllamaProvider(s.ollamaModel ?? 'llama3.1').test();
      return { ...s, ollamaOk: t.ok, externalOk: null };
    }
    return { ...s, ollamaOk: null, externalOk: null };
  }));

  ipcMain.handle(AI_CHANNELS.configure, wrap(AI_CHANNELS.configure, (_e, ...args) => {
    return configureAi(assertSingleArg(args));
  }));

  ipcMain.handle(AI_CHANNELS.test, wrap(AI_CHANNELS.test, async (_e, ...args) => {
    assertNoArgs(args);
    return testAi();
  }));

  ipcMain.handle(AI_CHANNELS.forget, wrap(AI_CHANNELS.forget, (_e, ...args) => {
    assertNoArgs(args);
    return forgetAi();
  }));

  // --- Laboratorio ---
  ipcMain.handle(LAB_CHANNELS.docker, wrap(LAB_CHANNELS.docker, async (_e, ...args) => {
    assertNoArgs(args);
    return dockerAvailable();
  }));

  ipcMain.handle(LAB_CHANNELS.status, wrap(LAB_CHANNELS.status, async (_e, ...args) => {
    return labStatus(cleanText(assertSingleArg(args), 32, 'Laboratorio'));
  }));

  ipcMain.handle(LAB_CHANNELS.create, wrap(LAB_CHANNELS.create, async (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Laboratorio');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const image = strField(o, 'image', 200, 'Imagen');
    if (!/^[A-Za-z0-9][A-Za-z0-9_./:-]{1,200}$/.test(image)) throw new ValidationError('BAD_IMAGE', 'Imagen inválida');
    const port = typeof o['port'] === 'number' ? o['port'] : Number(o['port']);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new ValidationError('BAD_PORT', 'Puerto 1024-65535');
    return createLab(strField(o, 'id', 32, 'ID'), image, port);
  }));

  ipcMain.handle(LAB_CHANNELS.remove, wrap(LAB_CHANNELS.remove, async (_e, ...args) => {
    await removeLab(cleanText(assertSingleArg(args), 32, 'Laboratorio'));
    return { removed: true };
  }));

  ipcMain.handle(LAB_CHANNELS.check, wrap(LAB_CHANNELS.check, async (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Verificación');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const labId = strField(o, 'labId', 32, 'Laboratorio');
    const target = strField(o, 'target', 2048, 'Objetivo');
    if (labId.startsWith('node-')) return assertNodeLabIsolation(labId, target);
    return assertLabIsolation(labId, target);
  }));

  ipcMain.handle(LAB_CHANNELS.nodeCreate, wrap(LAB_CHANNELS.nodeCreate, async (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Laboratorio node');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const port = typeof o['port'] === 'number' ? o['port'] : Number(o['port']);
    return createNodeLab(strField(o, 'id', 32, 'ID'), port);
  }));

  ipcMain.handle(LAB_CHANNELS.nodeStop, wrap(LAB_CHANNELS.nodeStop, async (_e, ...args) => {
    const raw = assertSingleArg(args);
    const id = typeof raw === 'string' ? raw : (raw as Record<string, unknown>)['id'];
    const stopped = await stopNodeLab(cleanText(id, 32, 'ID'));
    return { stopped };
  }));

  ipcMain.handle(LAB_CHANNELS.nodeList, wrap(LAB_CHANNELS.nodeList, (_e, ...args) => {
    assertNoArgs(args);
    return listNodeLabs();
  }));

  // --- SSH (solo lectura, operaciones permitidas) ---
  ipcMain.handle(SSH_CHANNELS.list, wrap(SSH_CHANNELS.list, (_e, ...args) => {
    assertNoArgs(args);
    return listSshProfiles(ctx.db);
  }));

  ipcMain.handle(SSH_CHANNELS.create, wrap(SSH_CHANNELS.create, (_e, ...args) => {
    return createSshProfile(ctx.db, ctx.dataDir, assertSingleArg(args));
  }));

  ipcMain.handle(SSH_CHANNELS.remove, wrap(SSH_CHANNELS.remove, (_e, ...args) => {
    deleteSshProfile(ctx.db, validateId(assertSingleArg(args)));
    return { removed: true };
  }));

  ipcMain.handle(SSH_CHANNELS.fetchKey, wrap(SSH_CHANNELS.fetchKey, async (_e, ...args) => {
    const p = getSshProfile(ctx.db, validateId(assertSingleArg(args)));
    if (!p) throw new ValidationError('NOT_FOUND', 'Perfil SSH inexistente');
    return { keys: await fetchHostKey(p.host, p.port) };
  }));

  ipcMain.handle(SSH_CHANNELS.pinKey, wrap(SSH_CHANNELS.pinKey, (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Pin');
    const o = assertSingleArg(args) as Record<string, unknown>;
    pinHostKey(ctx.db, validateId(o['profileId']), strField(o, 'line', 4096, 'Clave'));
    return { pinned: true };
  }));

  ipcMain.handle(SSH_CHANNELS.exec, wrap(SSH_CHANNELS.exec, async (_e, ...args) => {
    assertSafeObject(assertSingleArg(args), 'Ejecución SSH');
    const o = assertSingleArg(args) as Record<string, unknown>;
    const op = strField(o, 'op', 64, 'Operación');
    if (!Object.hasOwn(ALLOWED_OPS, op)) throw new ValidationError('FORBIDDEN_OP', 'Operación no permitida');
    const p = getSshProfile(ctx.db, validateId(o['profileId']));
    if (!p) throw new ValidationError('NOT_FOUND', 'Perfil SSH inexistente');
    const r = await execAllowedOp(p, op, 30000);
    return { op, stdout: redact(r.stdout).slice(0, 20000), exitCode: r.exitCode, timedOut: r.timedOut };
  }));
}
