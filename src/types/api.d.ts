import type {
  AppInfo,
  DashboardCounts,
  DbHealth,
  ToolStatus,
} from '@shared/ipc-contracts/system.contracts';
import type { CreateProjectInput, Project } from '@shared/ipc-contracts/project.contracts';
import type { Finding } from '@shared/finding-schema';
import type { StartAuditInput } from '@shared/ipc-contracts/audit.contracts';
import type { AiConfigureInput, AiStatus, SshProfileDto, SshProfileInput } from '@shared/ipc-contracts/ai-lab-ssh.contracts';

export interface PingResult {
  at: string;
}

export interface AuditRowDto {
  id: string;
  projectId: string | null;
  profile: string;
  target: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  progress: { done: number; total: number; currentEngine: string };
}

export interface CuyoApi {
  system: {
    ping: () => Promise<PingResult>;
    appInfo: () => Promise<AppInfo>;
    toolStatus: () => Promise<ToolStatus[]>;
    dbHealth: () => Promise<DbHealth>;
    dashboard: () => Promise<DashboardCounts>;
    openDataDir: () => Promise<{ opened: boolean }>;
    clearHistory: () => Promise<{ cleared: boolean }>;
    pickFolder: () => Promise<{ folder: string | null }>;
    openInstallPage: (url: string) => Promise<{ opened: boolean }>;
  };
  projects: {
    list: () => Promise<Project[]>;
    create: (input: CreateProjectInput) => Promise<Project>;
    remove: (id: string) => Promise<{ removed: boolean }>;
  };
  audits: {
    start: (input: StartAuditInput) => Promise<{ auditId: string }>;
    cancel: (auditId: string) => Promise<{ cancelled: boolean }>;
    list: () => Promise<AuditRowDto[]>;
    get: (auditId: string) => Promise<AuditRowDto>;
    findings: (filter: Record<string, string>) => Promise<Finding[]>;
    updateFinding: (input: { id: string; status: string; note: string }) => Promise<{ updated: boolean }>;
    history: (findingId: string) => Promise<Array<{ at: string; change: string; note: string }>>;
    compare: (baseId: string, otherId: string) => Promise<{ onlyBase: Finding[]; onlyOther: Finding[]; bothCount: number }>;
    aiReview: (auditId: string) => Promise<Array<{ provider: string; model: string; summary: string; annotations: Array<{ findingId: string; opinion: string; rationale: string }>; suggestedNextSteps: string[] }>>;
    onProgress: (cb: (e: { auditId: string; done: number; total: number; currentEngine: string }) => void) => void;
    onFinished: (cb: (e: { auditId: string; status: string; errors: string[] }) => void) => void;
    clearListeners: () => void;
  };
  reports: {
    generate: (auditId: string) => Promise<{ json: string; html: string }>;
    save: (auditId: string, format: string) => Promise<{ saved: boolean; path?: string }>;
  };
  ai: {
    status: () => Promise<AiStatus & { ollamaOk: boolean | null; externalOk: boolean | null }>;
    configure: (input: AiConfigureInput) => Promise<{ mode: string }>;
    test: () => Promise<{ ok: boolean; detail: string }>;
    forget: () => Promise<{ forgotten: boolean }>;
  };
  lab: {
    docker: () => Promise<{ binary: boolean; daemon: boolean; version: string | null }>;
    status: (id: string) => Promise<{ id: string; image: string; container: string; network: string; status: string; ports: string[] } | null>;
    create: (input: { id: string; image: string; port: number }) => Promise<unknown>;
    remove: (id: string) => Promise<{ removed: boolean }>;
    check: (labId: string, target: string) => Promise<{ ok: boolean; reasons: string[] }>;
    nodeCreate: (input: { id: string; port: number }) => Promise<{ id: string; port: number; pid: number | null; startedAt: string; target: string }>;
    nodeStop: (id: string) => Promise<{ stopped: boolean }>;
    nodeList: () => Promise<Array<{ id: string; port: number; pid: number | null; startedAt: string; target: string }>>;
  };
  ssh: {
    list: () => Promise<SshProfileDto[]>;
    create: (input: SshProfileInput) => Promise<SshProfileDto>;
    remove: (id: string) => Promise<{ removed: boolean }>;
    fetchKey: (id: string) => Promise<{ keys: string }>;
    pinKey: (profileId: string, line: string) => Promise<{ pinned: boolean }>;
    exec: (profileId: string, op: string) => Promise<{ op: string; stdout: string; exitCode: number | null; timedOut: boolean }>;
  };
}

declare global {
  interface Window {
    api: CuyoApi;
  }
}

export {};
