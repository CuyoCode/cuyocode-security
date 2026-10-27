<template>
  <div>
    <h1>Informes</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel">
      <label>Auditoría</label>
      <select v-model="auditId">
        <option value="">Seleccionar…</option>
        <option v-for="a in audits" :key="a.id" :value="a.id">{{ a.profile }} · {{ a.target }} · {{ a.status }}</option>
      </select>
      <p><button class="primary" :disabled="!auditId || loading" @click="generate">Generar vista previa</button></p>
    </div>
    <div v-if="report" class="panel">
      <h2>Resumen</h2>
      <p>Total: {{ report.summary.total }} · Confirmados: {{ report.summary.confirmed }} · Pendientes: {{ report.summary.pending }}</p>
      <p>Motores: <span class="mono">{{ report.engines.join(', ') || '—' }}</span></p>
      <h3>Cobertura</h3>
      <ul>
        <li v-for="(n, i) in report.notes" :key="i">{{ n }}</li>
        <li v-for="(l, i) in report.limitations" :key="'l' + i">{{ l }}</li>
      </ul>
      <p class="hint">Secretos y datos sensibles redactados también en esta vista previa.</p>
      <button @click="save('json')">Exportar JSON</button>
      <button @click="save('html')">Exportar HTML</button>
      <button @click="save('pdf')">Exportar PDF</button>
      <p v-if="savedPath" class="hint">Guardado en: <span class="mono">{{ savedPath }}</span></p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReportsView',
  data() {
    return { audits: [], auditId: '', report: null, error: '', loading: false, savedPath: '' };
  },
  async mounted() {
    if (this.$route.query.audit) this.auditId = String(this.$route.query.audit);
    try {
      this.audits = await window.api.audits.list();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo listar';
    }
    if (this.auditId) await this.generate();
  },
  methods: {
    async generate() {
      this.error = '';
      this.loading = true;
      try {
        const r = await window.api.reports.generate(this.auditId);
        this.report = JSON.parse(r.json);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo generar';
      } finally {
        this.loading = false;
      }
    },
    async save(format) {
      this.error = '';
      this.savedPath = '';
      try {
        const r = await window.api.reports.save(this.auditId, format);
        if (r.saved) this.savedPath = r.path || '';
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo exportar';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2, h3 { font-size: 15px; }
.hint { color: var(--text-dim); font-size: 12px; }
button { margin-right: 8px; }
</style>
