import { defineStore } from 'pinia';
import type { DashboardCounts, ToolStatus } from '@shared/ipc-contracts/system.contracts';
import type { Project } from '@shared/ipc-contracts/project.contracts';

interface AppState {
  tools: ToolStatus[];
  toolsLoaded: boolean;
  projects: Project[];
  counts: DashboardCounts | null;
  lastError: string;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    tools: [],
    toolsLoaded: false,
    projects: [],
    counts: null,
    lastError: '',
  }),
  actions: {
    async refreshTools(): Promise<void> {
      this.tools = await window.api.system.toolStatus();
      this.toolsLoaded = true;
    },
    async refreshProjects(): Promise<void> {
      this.projects = await window.api.projects.list();
    },
    async refreshDashboard(): Promise<void> {
      this.counts = await window.api.system.dashboard();
    },
  },
});
