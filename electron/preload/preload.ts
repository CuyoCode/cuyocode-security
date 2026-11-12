// Preload: única exposición del renderer al sistema.
// Solo métodos concretos con canales fijos; jamás ipcRenderer crudo.
import { contextBridge, ipcRenderer } from 'electron';
import { PROJECT_CHANNELS } from '../../shared/ipc-contracts/project.contracts';
import type { CreateProjectInput } from '../../shared/ipc-contracts/project.contracts';
import { SYSTEM_CHANNELS } from '../../shared/ipc-contracts/system.contracts';
import { AUDIT_CHANNELS, REPORT_CHANNELS } from '../../shared/ipc-contracts/audit.contracts';
import type { StartAuditInput } from '../../shared/ipc-contracts/audit.contracts';
import { AI_CHANNELS, LAB_CHANNELS, SSH_CHANNELS } from '../../shared/ipc-contracts/ai-lab-ssh.contracts';
import type { AiConfigureInput, SshProfileInput } from '../../shared/ipc-contracts/ai-lab-ssh.contracts';

function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return promise.then((res) => {
    const r = res as { ok: boolean; data?: T; error?: { message: string } };
    if (r.ok) return r.data as T;
    throw new Error(r.error?.message ?? 'Error interno');
  });
}

contextBridge.exposeInMainWorld('api', {
  system: {
    ping: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.ping)),
    appInfo: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.appInfo)),
    toolStatus: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.toolStatus)),
    dbHealth: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.dbHealth)),
    dashboard: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.dashboard)),
    openDataDir: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.openDataDir)),
    clearHistory: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.clearHistory)),
    pickFolder: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.pickFolder)),
    openInstallPage: (url: string) => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.openInstallPage, { url })),
    demo: () => unwrap(ipcRenderer.invoke(SYSTEM_CHANNELS.demo)),
  },
  projects: {
    list: () => unwrap(ipcRenderer.invoke(PROJECT_CHANNELS.list)),
    create: (input: CreateProjectInput) => unwrap(ipcRenderer.invoke(PROJECT_CHANNELS.create, input)),
    remove: (id: string) => unwrap(ipcRenderer.invoke(PROJECT_CHANNELS.remove, id)),
  },
  audits: {
    start: (input: StartAuditInput) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.start, input)),
    cancel: (auditId: string) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.cancel, auditId)),
    list: () => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.list)),
    get: (auditId: string) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.get, auditId)),
    findings: (filter: Record<string, string>) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.findings, filter)),
    updateFinding: (input: { id: string; status: string; note: string }) =>
      unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.updateFinding, input)),
    history: (findingId: string) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.findingHistory, findingId)),
    compare: (baseId: string, otherId: string) =>
      unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.compare, { baseId, otherId })),
    aiReview: (auditId: string) => unwrap(ipcRenderer.invoke(AUDIT_CHANNELS.aiReview, auditId)),
    onProgress: (cb: (e: { auditId: string; done: number; total: number; currentEngine: string }) => void) => {
      ipcRenderer.on('audits:progress', (_event, payload) => cb(payload));
    },
    onFinished: (cb: (e: { auditId: string; status: string; errors: string[] }) => void) => {
      ipcRenderer.on('audits:finished', (_event, payload) => cb(payload));
    },
    clearListeners: () => {
      ipcRenderer.removeAllListeners('audits:progress');
      ipcRenderer.removeAllListeners('audits:finished');
    },
  },
  reports: {
    generate: (auditId: string) => unwrap(ipcRenderer.invoke(REPORT_CHANNELS.generate, { auditId })),
    save: (auditId: string, format: string) =>
      unwrap(ipcRenderer.invoke(REPORT_CHANNELS.save, { auditId, format })),
  },
  ai: {
    status: () => unwrap(ipcRenderer.invoke(AI_CHANNELS.status)),
    configure: (input: AiConfigureInput) => unwrap(ipcRenderer.invoke(AI_CHANNELS.configure, input)),
    test: () => unwrap(ipcRenderer.invoke(AI_CHANNELS.test)),
    forget: () => unwrap(ipcRenderer.invoke(AI_CHANNELS.forget)),
  },
  lab: {
    docker: () => unwrap(ipcRenderer.invoke(LAB_CHANNELS.docker)),
    status: (id: string) => unwrap(ipcRenderer.invoke(LAB_CHANNELS.status, id)),
    create: (input: { id: string; image: string; port: number }) =>
      unwrap(ipcRenderer.invoke(LAB_CHANNELS.create, input)),
    remove: (id: string) => unwrap(ipcRenderer.invoke(LAB_CHANNELS.remove, id)),
    check: (labId: string, target: string) => unwrap(ipcRenderer.invoke(LAB_CHANNELS.check, { labId, target })),
    nodeCreate: (input: { id: string; port: number }) =>
      unwrap(ipcRenderer.invoke(LAB_CHANNELS.nodeCreate, input)),
    nodeStop: (id: string) => unwrap(ipcRenderer.invoke(LAB_CHANNELS.nodeStop, id)),
    nodeList: () => unwrap(ipcRenderer.invoke(LAB_CHANNELS.nodeList)),
  },
  ssh: {
    list: () => unwrap(ipcRenderer.invoke(SSH_CHANNELS.list)),
    create: (input: SshProfileInput) => unwrap(ipcRenderer.invoke(SSH_CHANNELS.create, input)),
    remove: (id: string) => unwrap(ipcRenderer.invoke(SSH_CHANNELS.remove, id)),
    fetchKey: (id: string) => unwrap(ipcRenderer.invoke(SSH_CHANNELS.fetchKey, id)),
    pinKey: (profileId: string, line: string) => unwrap(ipcRenderer.invoke(SSH_CHANNELS.pinKey, { profileId, line })),
    exec: (profileId: string, op: string) => unwrap(ipcRenderer.invoke(SSH_CHANNELS.exec, { profileId, op })),
  },
});
