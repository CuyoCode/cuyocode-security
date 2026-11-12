import { defineStore } from 'pinia';
import type { AppInfo, DashboardCounts, ToolStatus } from '@shared/ipc-contracts/system.contracts';
import type { Project } from '@shared/ipc-contracts/project.contracts';

interface AppState {
  tools: ToolStatus[];
  toolsLoaded: boolean;
  projects: Project[];
  counts: DashboardCounts | null;
  appInfo: AppInfo | null;
  lastError: string;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    tools: [],
    toolsLoaded: false,
    projects: [],
    counts: null,
    appInfo: null,
    lastError: '',
  }),
  actions: {
    async refreshTools(): Promise<void> {
      try {
        this.tools = await window.api.system.toolStatus();
        this.lastError = '';
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : 'No se pudieron detectar herramientas';
      } finally {
        this.toolsLoaded = true;
      }
    },
    async refreshProjects(): Promise<void> {
      this.projects = await window.api.projects.list();
    },
    async refreshDashboard(): Promise<void> {
      this.counts = await window.api.system.dashboard();
    },
    async refreshAppInfo(): Promise<void> {
      try {
        this.appInfo = await window.api.system.appInfo();
      } catch {
        this.appInfo = null;
      }
    },
  },
});
