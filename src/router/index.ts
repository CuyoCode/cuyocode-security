import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import ProjectsView from '../views/ProjectsView.vue';
import FindingsView from '../views/FindingsView.vue';
import ReportsView from '../views/ReportsView.vue';
import ToolsView from '../views/ToolsView.vue';
import SettingsView from '../views/SettingsView.vue';
import AuditWizardView from '../views/AuditWizardView.vue';
import AuditRunView from '../views/AuditRunView.vue';
import AuditsView from '../views/AuditsView.vue';
import SshView from '../views/SshView.vue';
import LabView from '../views/LabView.vue';

const router = createRouter({
  // Hash history: la app empaquetada se sirve por file://, sin servidor.
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: DashboardView },
    { path: '/wizard', component: AuditWizardView },
    { path: '/run/:id', component: AuditRunView, props: true },
    { path: '/audits', component: AuditsView },
    { path: '/projects', component: ProjectsView },
    { path: '/findings', component: FindingsView },
    { path: '/reports', component: ReportsView },
    { path: '/ssh', component: SshView },
    { path: '/lab', component: LabView },
    { path: '/tools', component: ToolsView },
    { path: '/settings', component: SettingsView },
  ],
});

export default router;
