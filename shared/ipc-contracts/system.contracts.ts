// Contratos del canal system:* — única superficie IPC de solo lectura/estado en Fase 1.
// El preload expone estos canales con firmas fijas; el main valida que no lleguen argumentos.

export const SYSTEM_CHANNELS = {
  ping: 'system:ping',
  appInfo: 'system:app-info',
  toolStatus: 'system:tool-status',
  dbHealth: 'system:db-health',
  dashboard: 'system:dashboard',
  openDataDir: 'system:open-data-dir',
  clearHistory: 'system:clear-history',
  pickFolder: 'system:pick-folder',
  openInstallPage: 'system:open-install-page',
} as const;

export type SystemChannel = (typeof SYSTEM_CHANNELS)[keyof typeof SYSTEM_CHANNELS];

export interface IpcOk<T> {
  ok: true;
  data: T;
}

export interface IpcErr {
  ok: false;
  error: { code: string; message: string };
}

export type IpcResult<T> = IpcOk<T> | IpcErr;

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  dataDir: string;
}

export interface ToolStatus {
  /** Clave estable, p. ej. "git". */
  id: string;
  /** Nombre visible, p. ej. "Git". */
  name: string;
  detected: boolean;
  version: string | null;
  path: string | null;
  /** Cómo instalarlo en Windows si falta. */
  hint: string;
  /** Web oficial de instalación (solo https de la lista curada). */
  installUrl: string;
  /** Comando winget sugerido, o '' si es instalación manual. */
  installCommand: string;
  /** Si el MVP lo necesita para su función base. Solo git/node lo son en Fase 1. */
  required: boolean;
}

export interface DbHealth {
  path: string;
  userVersion: number;
  ok: boolean;
}

export interface DashboardCounts {
  projects: number;
  audits: number;
  findingsBySeverity: { critical: number; high: number; medium: number; low: number; info: number };
  pendingReview: number;
}
