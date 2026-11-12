import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  // Hash history: la app empaquetada se sirve por file://, sin servidor.
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: 'Panel', subtitle: 'Estado general de tus auditorías' },
    },
    {
      path: '/wizard',
      name: 'wizard',
      component: () => import('../views/AuditWizardView.vue'),
      meta: { title: 'Nueva auditoría', subtitle: 'Objetivo, perfil y alcance en seis pasos' },
    },
    {
      path: '/run/:id',
      name: 'audit-run',
      component: () => import('../views/AuditRunView.vue'),
      props: true,
      meta: { title: 'Ejecución', subtitle: 'Progreso y cobertura de la auditoría' },
    },
    {
      path: '/audits',
      name: 'audits',
      component: () => import('../views/AuditsView.vue'),
      meta: { title: 'Auditorías', subtitle: 'Historial y comparación entre corridas' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
      meta: { title: 'Proyectos', subtitle: 'Objetivos registrados para auditar' },
    },
    {
      path: '/findings',
      name: 'findings',
      component: () => import('../views/FindingsView.vue'),
      meta: { title: 'Hallazgos', subtitle: 'Evidencia, revisión y corrección propuesta' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportsView.vue'),
      meta: { title: 'Informes', subtitle: 'Resumen ejecutivo y exportación' },
    },
    {
      path: '/ssh',
      name: 'ssh',
      component: () => import('../views/SshView.vue'),
      meta: { title: 'Servidores SSH', subtitle: 'Inspección de solo lectura con operaciones versionadas' },
    },
    {
      path: '/lab',
      name: 'lab',
      component: () => import('../views/LabView.vue'),
      meta: { title: 'Laboratorio', subtitle: 'Objetivos aislados para pruebas controladas' },
    },
    {
      path: '/tools',
      name: 'tools',
      component: () => import('../views/ToolsView.vue'),
      meta: { title: 'Herramientas', subtitle: 'Detección de binarios y guías de instalación' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { title: 'Ajustes', subtitle: 'Privacidad, datos locales e IA' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '';
  document.title = title ? `${title} · CuyoCode Security` : 'CuyoCode Security';
});

export default router;
