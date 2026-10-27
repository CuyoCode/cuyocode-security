<template>
  <div>
    <h1>Hallazgos</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel filters">
      <select v-model="filter.auditId" @change="reload">
        <option value="">Todas las auditorías</option>
        <option v-for="a in audits" :key="a.id" :value="a.id">{{ a.profile }} · {{ shortTarget(a.target) }}</option>
      </select>
      <select v-model="filter.severity" @change="reload">
        <option value="">Todas las severidades</option>
        <option>critical</option><option>high</option><option>medium</option><option>low</option><option>info</option>
      </select>
      <select v-model="filter.status" @change="reload">
        <option value="">Todos los estados</option>
        <option>open</option><option>reviewed</option><option>false-positive</option><option>resolved</option><option>accepted-risk</option>
      </select>
      <input v-model="filter.search" placeholder="Buscar…" @keyup.enter="reload" />
      <button class="primary" @click="reload">Filtrar</button>
    </div>
    <div v-if="findings.length === 0" class="empty">
      Sin hallazgos para el filtro actual. La ausencia de hallazgos no implica seguridad.
    </div>
    <div v-else class="split">
      <div class="panel list">
        <div
          v-for="f in findings"
          :key="f.id"
          class="item"
          :class="{ selected: selected && selected.id === f.id }"
          @click="select(f)"
        >
          <span class="badge" :class="sevClass(f.severity)">{{ f.severity }}</span>
          <strong>{{ f.title }}</strong>
          <div class="meta">{{ f.verificationStatus }} · {{ f.status }} · {{ f.source }}</div>
        </div>
      </div>
      <div v-if="selected" class="panel detail">
        <h2>{{ selected.title }}</h2>
        <p>
          <span class="badge" :class="sevClass(selected.severity)">{{ selected.severity }}</span>
          Confianza: {{ selected.confidence }} · Verificación: {{ selected.verificationStatus }} ·
          Estado: {{ selected.status }}
        </p>
        <p><strong>Categoría:</strong> {{ selected.category }} · <strong>Regla:</strong> <span class="mono">{{ selected.ruleId }}</span></p>
        <p><strong>Objetivo:</strong> <span class="mono">{{ selected.target }}</span></p>
        <p v-if="selected.location.file"><strong>Ubicación:</strong> <span class="mono">{{ selected.location.file }}:{{ selected.location.lineStart }}</span></p>
        <h3>Evidencia</h3>
        <ul>
          <li v-for="(e, i) in selected.evidence" :key="i">
            <em>{{ e.kind }}:</em> {{ e.detail }}<br /><code>{{ e.snippet }}</code>
          </li>
        </ul>
        <h3>Impacto</h3>
        <p>{{ selected.impact }}</p>
        <h3>Validación segura</h3>
        <ul><li v-for="(r, i) in selected.reproduction" :key="i">{{ r }}</li></ul>
        <h3>Corrección propuesta</h3>
        <ul><li v-for="(r, i) in selected.remediation" :key="i">{{ r }}</li></ul>
        <p><button @click="copyFix">Copiar corrección</button></p>
        <p v-if="selected.references.length > 0"><strong>Referencias:</strong> {{ selected.references.join(', ') }}</p>
        <h3>Revisión</h3>
        <label>Estado</label>
        <select v-model="review.status">
          <option>open</option><option>reviewed</option><option>false-positive</option><option>resolved</option><option>accepted-risk</option>
        </select>
        <label>Nota / justificación (obligatoria para falso positivo)</label>
        <input v-model="review.note" placeholder="Qué se verificó y por qué" />
        <p><button class="primary" @click="saveReview">Guardar revisión</button></p>
        <h3>Historial</h3>
        <ul>
          <li v-for="(h, i) in history" :key="i">{{ h.at }} — {{ h.change }} — {{ h.note }}</li>
        </ul>
        <div v-if="aiNotes.length > 0">
          <h3>Opinión IA (no concluyente)</h3>
          <ul><li v-for="(a, i) in aiNotes" :key="i"><strong>{{ a.opinion }}:</strong> {{ a.rationale }}</li></ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FindingsView',
  data() {
    return {
      audits: [],
      findings: [],
      selected: null,
      history: [],
      aiNotes: [],
      error: '',
      filter: { auditId: '', severity: '', status: '', search: '' },
      review: { status: 'reviewed', note: '' },
    };
  },
  async mounted() {
    if (this.$route.query.audit) this.filter.auditId = String(this.$route.query.audit);
    try {
      this.audits = await window.api.audits.list();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo listar auditorías';
    }
    await this.reload();
  },
  methods: {
    sevClass(s) {
      if (s === 'critical' || s === 'high') return 'bad';
      if (s === 'medium') return 'warn';
      if (s === 'low') return 'ok';
      return 'missing';
    },
    shortTarget(t) {
      return t.length > 40 ? t.slice(0, 40) + '…' : t;
    },
    cleanFilter() {
      const out = {};
      for (const [k, v] of Object.entries(this.filter)) {
        if (v) out[k] = v;
      }
      return out;
    },
    async reload() {
      this.error = '';
      try {
        this.findings = await window.api.audits.findings(this.cleanFilter());
        this.selected = null;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudieron cargar hallazgos';
      }
    },
    async select(f) {
      this.selected = f;
      this.review = { status: f.status === 'open' ? 'reviewed' : f.status, note: '' };
      this.history = [];
      this.aiNotes = [];
      try {
        this.history = await window.api.audits.history(f.id);
        if (this.filter.auditId) {
          const reviews = await window.api.audits.aiReview(this.filter.auditId);
          for (const r of reviews) {
            for (const a of r.annotations || []) {
              if (a.findingId === f.id) this.aiNotes.push(a);
            }
          }
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo cargar el detalle';
      }
    },
    async saveReview() {
      if (!this.selected) return;
      this.error = '';
      try {
        await window.api.audits.updateFinding({ id: this.selected.id, status: this.review.status, note: this.review.note });
        await this.reload();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo guardar';
      }
    },
    async copyFix() {
      if (!this.selected) return;
      const text = `${this.selected.title}\n\nCorrección propuesta:\n${this.selected.remediation.map((r) => `- ${r}`).join('\n')}\n\nVerificar con: ${(this.selected.reproduction || []).join(' ')}`;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo copiar';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { font-size: 16px; } h3 { font-size: 14px; margin-top: 16px; }
.filters { display: flex; gap: 8px; }
.filters input, .filters select { width: auto; flex: 1; }
.split { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; align-items: start; }
.item { border-bottom: 1px solid var(--border); padding: 8px 4px; cursor: pointer; }
.item.selected { background: var(--bg-panel); }
.item .meta { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
</style>
