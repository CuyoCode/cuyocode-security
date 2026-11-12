<template>
  <div>
    <PageHeader
      eyebrow="Resultados"
      title="Hallazgos"
      :subtitle="`${findings.length} hallazgo(s) para el filtro actual. La ausencia de hallazgos no implica seguridad.`"
    >
      <template #actions>
        <BaseButton icon="refresh" :loading="loading" @click="reload()">Actualizar</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <PanelCard>
      <div class="filters">
        <div class="filter">
          <label for="f-audit">Auditoría</label>
          <select id="f-audit" v-model="filter.auditId" @change="reload()">
            <option value="">Todas</option>
            <option v-for="a in audits" :key="a.id" :value="a.id">
              {{ profileLabel(a.profile) }} · {{ shortTarget(a.target, 34) }}
            </option>
          </select>
        </div>
        <div class="filter">
          <label for="f-sev">Severidad</label>
          <select id="f-sev" v-model="filter.severity" @change="reload()">
            <option value="">Todas</option>
            <option v-for="s in SEVERITIES" :key="s" :value="s">{{ severityLabel(s) }}</option>
          </select>
        </div>
        <div class="filter">
          <label for="f-status">Estado</label>
          <select id="f-status" v-model="filter.status" @change="reload()">
            <option value="">Todos</option>
            <option v-for="s in REVIEW_STATUSES" :key="s" :value="s">{{ findingStatusLabel(s) }}</option>
          </select>
        </div>
        <div class="filter grow">
          <label for="f-search">Buscar</label>
          <input id="f-search" v-model="filter.search" placeholder="Título u objetivo…" @keyup.enter="reload()" />
        </div>
      </div>
    </PanelCard>

    <div v-if="loading" class="empty">Cargando hallazgos…</div>
    <EmptyState
      v-else-if="findings.length === 0"
      icon="shield"
      title="Sin hallazgos para este filtro"
      description="Probá ampliar severidad, estado o auditoría. La ausencia de hallazgos no demuestra que el objetivo sea seguro."
    />
    <div v-else class="split">
      <PanelCard class="list-card">
        <ul class="list" role="listbox" aria-label="Hallazgos">
          <li v-for="f in findings" :key="f.id">
            <button
              class="item"
              :class="{ selected: selected?.id === f.id }"
              role="option"
              :aria-selected="selected?.id === f.id"
              @click="select(f)"
            >
              <span class="item-top">
                <SeverityBadge :severity="f.severity" />
                <span class="item-status">{{ findingStatusLabel(f.status) }}</span>
              </span>
              <strong>{{ f.title }}</strong>
              <span class="item-meta">{{ engineLabel(f.source.split('/')[0] ?? f.source) }} · {{ verificationLabel(f.verificationStatus) }}</span>
            </button>
          </li>
        </ul>
      </PanelCard>

      <PanelCard v-if="selected" class="detail-card">
        <div class="detail-head">
          <div>
            <div class="badges">
              <SeverityBadge :severity="selected.severity" />
              <StatusBadge :status="selected.status" kind="finding" />
            </div>
            <h2>{{ selected.title }}</h2>
          </div>
          <BaseButton size="sm" icon="copy" @click="copyFix">Copiar corrección</BaseButton>
        </div>

        <dl class="meta-grid">
          <div><dt>Confianza</dt><dd>{{ confidenceLabel(selected.confidence) }}</dd></div>
          <div><dt>Verificación</dt><dd>{{ verificationLabel(selected.verificationStatus) }}</dd></div>
          <div><dt>Categoría</dt><dd>{{ selected.category }}</dd></div>
          <div><dt>Regla</dt><dd class="mono">{{ selected.ruleId }}</dd></div>
        </dl>
        <p class="target-line"><strong>Objetivo:</strong> <span class="mono">{{ displayTarget(selected.target) }}</span></p>
        <p v-if="selected.location.file" class="target-line">
          <strong>Ubicación:</strong>
          <span class="mono">{{ selected.location.file }}<template v-if="selected.location.lineStart">:{{ selected.location.lineStart }}</template></span>
        </p>

        <section>
          <h3>Evidencia</h3>
          <div v-for="(e, i) in selected.evidence" :key="i" class="evidence">
            <span class="evidence-kind">{{ e.kind }}</span>
            <p>{{ e.detail }}</p>
            <CodeBlock :code="e.snippet" label="evidencia" />
          </div>
        </section>

        <section>
          <h3>Impacto</h3>
          <p>{{ selected.impact }}</p>
        </section>

        <section v-if="selected.reproduction.length > 0">
          <h3>Validación segura</h3>
          <ul><li v-for="(r, i) in selected.reproduction" :key="i">{{ r }}</li></ul>
        </section>

        <section v-if="selected.remediation.length > 0">
          <h3>Corrección propuesta</h3>
          <ul><li v-for="(r, i) in selected.remediation" :key="i">{{ r }}</li></ul>
        </section>

        <section v-if="selected.references.length > 0">
          <h3>Referencias</h3>
          <ul><li v-for="(r, i) in selected.references" :key="i"><span class="mono">{{ r }}</span></li></ul>
        </section>

        <section class="review">
          <h3>Revisión</h3>
          <div class="review-grid">
            <FormField label="Estado" field-id="review-status">
              <select id="review-status" v-model="review.status">
                <option v-for="s in REVIEW_STATUSES" :key="s" :value="s">{{ findingStatusLabel(s) }}</option>
              </select>
            </FormField>
            <FormField
              label="Nota / justificación"
              field-id="review-note"
              :error="noteError"
              hint="Obligatoria para marcar un falso positivo (mínimo 10 caracteres)."
            >
              <textarea id="review-note" v-model="review.note" rows="3" placeholder="Qué se verificó y por qué"></textarea>
            </FormField>
          </div>
          <BaseButton variant="primary" :loading="saving" @click="saveReview">Guardar revisión</BaseButton>
        </section>

        <section>
          <h3>Historial</h3>
          <p v-if="history.length === 0" class="hint">Sin cambios de revisión registrados.</p>
          <ul v-else class="history">
            <li v-for="(h, i) in history" :key="i">
              <span class="faint">{{ formatDate(h.at) }}</span>
              <StatusBadge :status="h.change" kind="finding" />
              <span class="muted">{{ h.note }}</span>
            </li>
          </ul>
        </section>

        <section v-if="aiNotes.length > 0">
          <h3>Opinión IA <span class="badge">No concluyente</span></h3>
          <ul class="history">
            <li v-for="(a, i) in aiNotes" :key="i">
              <strong>{{ a.opinion }}</strong>
              <span class="muted">{{ a.rationale }}</span>
            </li>
          </ul>
        </section>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { Finding } from '@shared/finding-schema';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SeverityBadge from '../components/ui/SeverityBadge.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import FormField from '../components/ui/FormField.vue';
import CodeBlock from '../components/ui/CodeBlock.vue';
import { toast } from '../composables/useToast';
import {
  SEVERITIES,
  confidenceLabel,
  engineLabel,
  findingStatusLabel,
  formatDate,
  profileLabel,
  displayTarget,
  severityLabel,
  shortTarget,
  verificationLabel,
} from '../lib/labels';

interface AuditRow {
  id: string;
  target: string;
  profile: string;
}

const REVIEW_STATUSES = ['open', 'reviewed', 'false-positive', 'resolved', 'accepted-risk'];
const route = useRoute();

const audits = ref<AuditRow[]>([]);
const findings = ref<Finding[]>([]);
const selected = ref<Finding | null>(null);
const history = ref<Array<{ at: string; change: string; note: string }>>([]);
const aiNotes = ref<Array<{ opinion: string; rationale: string }>>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const filter = reactive({ auditId: '', severity: '', status: '', search: '' });
const review = reactive({ status: 'open', note: '' });

const noteError = computed(() =>
  review.status === 'false-positive' && review.note.trim().length < 10
    ? 'La justificación debe tener al menos 10 caracteres.'
    : '',
);

function cleanFilter(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filter)) if (v) out[k] = v;
  return out;
}

async function reload(keepId?: string): Promise<void> {
  error.value = '';
  loading.value = true;
  try {
    findings.value = await window.api.audits.findings(cleanFilter());
    const targetId = keepId ?? selected.value?.id;
    const match = targetId ? findings.value.find((f) => f.id === targetId) : undefined;
    if (match) await select(match, false);
    else {
      selected.value = null;
      history.value = [];
      aiNotes.value = [];
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los hallazgos';
  } finally {
    loading.value = false;
  }
}

async function select(finding: Finding, loadAi = true): Promise<void> {
  selected.value = finding;
  review.status = finding.status;
  review.note = '';
  history.value = [];
  aiNotes.value = [];
  try {
    history.value = await window.api.audits.history(finding.id);
    if (loadAi && filter.auditId) {
      const reviews = await window.api.audits.aiReview(filter.auditId);
      for (const r of reviews) {
        for (const a of r.annotations ?? []) {
          if (a.findingId === finding.id) aiNotes.value.push(a);
        }
      }
    }
  } catch (e) {
    toast.error('No se pudo cargar el detalle', e instanceof Error ? e.message : undefined);
  }
}

async function saveReview(): Promise<void> {
  if (!selected.value || noteError.value) return;
  saving.value = true;
  try {
    await window.api.audits.updateFinding({
      id: selected.value.id,
      status: review.status,
      note: review.note,
    });
    toast.success('Revisión guardada');
    await reload(selected.value.id);
    if (findings.value.length > 0) {
      const updated = findings.value.find((f) => f.id === selected.value?.id);
      if (updated) await select(updated, false);
    }
  } catch (e) {
    toast.error('No se pudo guardar', e instanceof Error ? e.message : undefined);
  } finally {
    saving.value = false;
  }
}

async function copyFix(): Promise<void> {
  if (!selected.value) return;
  const text = `${selected.value.title}\n\nCorrección propuesta:\n${selected.value.remediation
    .map((r) => `- ${r}`)
    .join('\n')}\n\nVerificar con: ${(selected.value.reproduction || []).join(' ')}`;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Corrección copiada');
  } catch {
    toast.error('No se pudo copiar');
  }
}

watch(
  () => route.query.audit,
  (value) => {
    const auditId = typeof value === 'string' ? value : '';
    if (auditId && auditId !== filter.auditId) {
      filter.auditId = auditId;
      void reload();
    }
  },
);

onMounted(async () => {
  const queryAudit = typeof route.query.audit === 'string' ? route.query.audit : '';
  if (queryAudit) filter.auditId = queryAudit;
  try {
    audits.value = (await window.api.audits.list()) as AuditRow[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar auditorías';
  }
  await reload();
});
</script>

<style scoped>
.filters { display: grid; grid-template-columns: repeat(3, minmax(140px, 0.8fr)) minmax(220px, 1.4fr); gap: var(--space-3); align-items: end; }
.filter label { margin-top: 0; }
.split { display: grid; grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.4fr); gap: var(--space-3); align-items: start; }
.list-card { margin-bottom: 0; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: calc(100vh - 330px); overflow-y: auto; }
.item {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 11px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  white-space: normal;
}
.item:hover { background: var(--bg-soft); border-color: var(--border); }
.item.selected { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
.item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.item-status { font-size: 10px; color: var(--text-faint); }
.item strong { font-size: 13px; font-weight: 600; line-height: 1.35; }
.item-meta { font-size: 11px; color: var(--text-faint); }
.detail-card { margin-bottom: 0; }
.detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.detail-head h2 { font-size: 19px; margin-top: 6px; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin: var(--space-3) 0; padding: var(--space-3); background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.meta-grid dt { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.meta-grid dd { margin: 2px 0 0; font-size: 12px; }
.target-line { font-size: 12px; margin-bottom: 6px; overflow-wrap: anywhere; }
section { margin-top: var(--space-4); }
section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: var(--space-2); }
.evidence { margin-bottom: var(--space-3); }
.evidence-kind { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.evidence p { margin: 3px 0 6px; color: var(--text-dim); font-size: 12px; }
.review { padding-top: var(--space-3); border-top: 1px solid var(--border); }
.review-grid { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: var(--space-3); }
.history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.history li { display: flex; align-items: center; gap: 8px; font-size: 12px; flex-wrap: wrap; }
@media (max-width: 1100px) {
  .filters { grid-template-columns: 1fr 1fr; }
  .split { grid-template-columns: 1fr; }
  .list { max-height: 340px; }
  .meta-grid { grid-template-columns: 1fr 1fr; }
}
</style>
