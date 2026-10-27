<template>
  <div>
    <h1>Dashboard</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="loading" class="empty">Cargando estado…</div>
    <div v-else>
      <div class="cards">
        <div class="panel card">
          <div class="card-num">{{ counts ? counts.projects : 0 }}</div>
          <div class="card-label">Proyectos</div>
          <router-link to="/projects">Gestionar</router-link>
        </div>
        <div class="panel card">
          <div class="card-num">{{ counts ? counts.audits : 0 }}</div>
          <div class="card-label">Auditorías</div>
          <router-link to="/audits">Historial</router-link>
        </div>
        <div class="panel card">
          <div class="card-num">{{ totalFindings }}</div>
          <div class="card-label">Hallazgos abiertos</div>
          <router-link to="/findings">Ver hallazgos</router-link>
        </div>
        <div class="panel card">
          <div class="card-num">{{ toolsOk }} / {{ toolsTotal }}</div>
          <div class="card-label">Herramientas detectadas</div>
          <router-link to="/tools">Ver herramientas</router-link>
        </div>
      </div>
      <div v-if="isEmpty" class="empty">
        Sin auditorías registradas. Iniciá una desde el asistente.
        <br /><br />
        <router-link to="/wizard"><button class="primary">Nueva auditoría</button></router-link>
      </div>
      <div v-else class="panel">
        <h2>Últimas auditorías</h2>
        <table>
          <thead><tr><th>Inicio</th><th>Objetivo</th><th>Perfil</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="a in recent" :key="a.id">
              <td class="mono">{{ shortDate(a.startedAt) }}</td>
              <td class="mono">{{ a.target }}</td>
              <td>{{ a.profile }}</td>
              <td><span class="badge" :class="cls(a.status)">{{ a.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="missingRequired.length > 0" class="panel">
        <strong>Herramientas base faltantes:</strong>
        <ul>
          <li v-for="t in missingRequired" :key="t.id">{{ t.name }} — {{ t.hint }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { useAppStore } from '../stores/app';

export default {
  name: 'DashboardView',
  data() {
    return { loading: true, error: '', recent: [] };
  },
  computed: {
    ...mapState(useAppStore, ['counts', 'projects', 'tools', 'toolsLoaded']),
    totalFindings() {
      if (!this.counts) return 0;
      const f = this.counts.findingsBySeverity;
      return f.critical + f.high + f.medium + f.low + f.info;
    },
    toolsOk() {
      return this.tools.filter((t) => t.detected).length;
    },
    toolsTotal() {
      return this.tools.length;
    },
    isEmpty() {
      return (this.counts ? this.counts.audits : 0) === 0;
    },
    missingRequired() {
      return this.tools.filter((t) => t.required && !t.detected);
    },
  },
  async mounted() {
    const store = useAppStore();
    try {
      await Promise.all([store.refreshDashboard(), store.refreshProjects(), store.refreshTools()]);
      this.recent = (await window.api.audits.list()).slice(0, 5);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al cargar el estado';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    cls(s) {
      if (s === 'done') return 'ok';
      if (s === 'failed') return 'bad';
      return 'warn';
    },
    shortDate(iso) {
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { font-size: 15px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.card-num { font-size: 28px; font-weight: 700; }
.card-label { color: var(--text-dim); font-size: 12px; margin: 4px 0 8px; }
</style>
