<template>
  <div>
    <h1>Ejecución de auditoría</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="!audit" class="empty">Cargando…</div>
    <div v-else>
      <div class="panel">
        <p><strong>Objetivo:</strong> <span class="mono">{{ audit.target }}</span> · <strong>Perfil:</strong> {{ audit.profile }}</p>
        <p><strong>Estado:</strong> <span class="badge" :class="statusClass">{{ audit.status }}</span>
          <span class="mono">{{ audit.progress.done }}/{{ audit.progress.total }} · {{ audit.progress.currentEngine }}</span></p>
        <div class="bar"><div class="fill" :style="{ width: pct + '%' }"></div></div>
        <p v-if="audit.error" class="hint">Error: {{ audit.error }}</p>
        <button v-if="running" class="danger" :disabled="cancelling" @click="cancel">
          {{ cancelling ? 'Cancelando…' : 'Cancelar auditoría' }}
        </button>
        <span v-if="!running" class="row-btns">
          <router-link :to="'/findings?audit=' + audit.id"><button class="primary">Ver hallazgos</button></router-link>
          <router-link :to="'/reports?audit=' + audit.id"><button>Ver informe</button></router-link>
        </span>
      </div>
      <div v-if="errors.length > 0" class="panel">
        <h2>Errores y cobertura</h2>
        <ul>
          <li v-for="(e, i) in errors" :key="i" class="mono">{{ e }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuditRunView',
  props: ['id'],
  data() {
    return { audit: null, error: '', errors: [], cancelling: false, timer: null };
  },
  computed: {
    running() {
      return this.audit && (this.audit.status === 'running' || this.audit.status === 'queued');
    },
    statusClass() {
      if (!this.audit) return '';
      if (this.audit.status === 'done') return 'ok';
      if (this.audit.status === 'failed') return 'bad';
      return 'warn';
    },
    pct() {
      if (!this.audit || this.audit.progress.total === 0) return 0;
      return Math.round((this.audit.progress.done / this.audit.progress.total) * 100);
    },
  },
  async mounted() {
    window.api.audits.clearListeners();
    window.api.audits.onProgress((e) => {
      if (e.auditId === this.id && this.audit) {
        this.audit.progress = { done: e.done, total: e.total, currentEngine: e.currentEngine };
      }
    });
    window.api.audits.onFinished((e) => {
      if (e.auditId === this.id) {
        this.errors = e.errors;
        this.refresh();
      }
    });
    await this.refresh();
    this.timer = setInterval(() => {
      if (this.running) this.refresh();
    }, 2000);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
    window.api.audits.clearListeners();
  },
  methods: {
    async refresh() {
      try {
        this.audit = await window.api.audits.get(this.id);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo cargar';
      }
    },
    async cancel() {
      this.cancelling = true;
      try {
        await window.api.audits.cancel(this.id);
        await this.refresh();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo cancelar';
      } finally {
        this.cancelling = false;
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { margin: 0 0 8px; font-size: 15px; }
.bar { height: 10px; background: var(--bg-panel); border-radius: 5px; overflow: hidden; margin: 10px 0; }
.fill { height: 100%; background: var(--accent); transition: width 0.3s; }
.row-btns { display: inline-flex; gap: 8px; margin-left: 8px; }
.hint { color: var(--text-dim); font-size: 12px; }
</style>
