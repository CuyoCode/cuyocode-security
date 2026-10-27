<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">◈</span>
        <span class="brand-text">CuyoCode Security</span>
      </div>
      <nav>
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/wizard">Nueva auditoría</router-link>
        <router-link to="/audits">Auditorías</router-link>
        <router-link to="/projects">Proyectos</router-link>
        <router-link to="/findings">Hallazgos</router-link>
        <router-link to="/reports">Informes</router-link>
        <router-link to="/ssh">Servidores SSH</router-link>
        <router-link to="/lab">Laboratorio</router-link>
        <router-link to="/tools">Herramientas</router-link>
        <router-link to="/settings">Ajustes</router-link>
      </nav>
      <div class="side-foot">v0.2.3</div>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
};
</script>

<style scoped>
.shell { display: flex; height: 100%; }
.sidebar {
  width: 210px;
  flex-shrink: 0;
  background: var(--bg-soft);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.brand { padding: 16px; font-weight: 700; font-size: 15px; border-bottom: 1px solid var(--border); }
.brand-mark { color: var(--accent); margin-right: 8px; }
nav { display: flex; flex-direction: column; padding: 8px; gap: 2px; flex: 1; overflow-y: auto; }
nav a {
  color: var(--text-dim);
  text-decoration: none;
  padding: 9px 12px;
  border-radius: var(--radius);
  font-size: 13px;
}
nav a:hover { background: var(--bg-panel); color: var(--text); }
nav a.router-link-active { background: var(--bg-panel); color: var(--accent); }
.side-foot { padding: 12px 16px; font-size: 11px; color: var(--text-dim); border-top: 1px solid var(--border); }
.content { flex: 1; overflow-y: auto; padding: 24px 28px; }
</style>
