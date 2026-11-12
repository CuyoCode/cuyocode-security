<template>
  <div>
    <PageHeader
      eyebrow="Entregables"
      title="Informes"
      subtitle="Resumen ejecutivo con cobertura real, hallazgos redactados y exportación JSON/HTML/PDF."
    >
      <template #actions>
        <BaseButton icon="refresh" :disabled="!auditId || loading" @click="generate">Regenerar</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <PanelCard>
      <div class="selector">
        <FormField label="Auditoría" field-id="report-audit">
          <select id="report-audit" v-model="auditId" @change="onSelect">
            <option value="">Seleccionar una auditoría…</option>
            <option v-for="a in audits" :key="a.id" :value="a.id">
              {{ profileLabel(a.profile) }} · {{ shortTarget(a.target, 40) }} · {{ formatDateShort(a.startedAt) }}
            </option>
          </select>
        </FormField>
        <BaseButton variant="primary" :disabled="!auditId" :loading="loading" @click="generate">Generar vista previa</BaseButton>
      </div>
    </PanelCard>

    <LoadingState v-if="loading" label="Generando informe…" />

    <template v-else-if="report">
      <div class="report-head">
        <div>
          <p class="eyebrow">Informe de auditoría</p>
          <h2>{{ report.audit.profileTitle }}</h2>
          <p class="target mono">{{ displayTarget(report.audit.target) }}</p>
        </div>
        <div class="report-meta">
          <span>Inicio <strong>{{ formatDate(report.audit.startedAt) }}</strong></span>
          <span>Duración <strong>{{ durationText }}</strong></span>
          <StatusBadge :status="report.audit.status" kind="audit" />
        </div>
      </div>

      <div class="kpi-grid">
        <KpiCard label="Accionables" :value="report.summary.actionable" icon="alert" tone="danger" hint="Abiertos o revisados" />
        <KpiCard label="Confirmados" :value="report.summary.confirmed" icon="check" tone="ok" hint="Verificación confirmada" />
        <KpiCard label="Pendientes" :value="report.summary.pending" icon="clock" tone="warn" hint="Requieren validación manual" />
        <KpiCard label="Total registrado" :value="report.summary.total" icon="report" hint="Incluye resueltos y FP" />
      </div>

      <div class="two-col">
        <PanelCard title="Severidad" subtitle="Todos los hallazgos registrados">
          <div class="sev-list">
            <div v-for="s in severityRows" :key="s.label" class="sev-row">
              <span class="sev-name"><SeverityBadge :severity="s.key" /></span>
              <div class="sev-bar"><span :style="{ width: s.pct + '%', background: s.color }"></span></div>
              <strong>{{ s.value }}</strong>
            </div>
          </div>
        </PanelCard>
        <PanelCard title="Cobertura" subtitle="Motores planificados y observaciones">
          <div class="coverage-block">
            <p class="coverage-label">Planificados</p>
            <div class="chips"><span v-for="e in report.coverage.plannedEngines" :key="e" class="chip">{{ engineLabel(e) }}</span><span v-if="report.coverage.plannedEngines.length === 0" class="hint">No registrados</span></div>
            <p class="coverage-label">Con hallazgos</p>
            <div class="chips"><span v-for="e in report.coverage.enginesWithFindings" :key="e" class="chip">{{ engineLabel(e) }}</span><span v-if="report.coverage.enginesWithFindings.length === 0" class="hint">Ninguno</span></div>
            <ul v-if="report.notes.length > 0" class="notes">
              <li v-for="(n, i) in report.notes" :key="i">{{ n }}</li>
            </ul>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Hallazgos" :subtitle="`${report.findings.length} registro(s) en el informe`">
        <DataTable
          :columns="findingColumns"
          :rows="report.findings as unknown as Array<Record<string, unknown>>"
          row-key="id"
          empty-title="Sin hallazgos registrados"
          empty-description="El informe se genera igualmente con la cobertura y las limitaciones."
        >
          <template #cell-severity="{ row }"><SeverityBadge :severity="String(row['severity'])" /></template>
          <template #cell-title="{ row }"><span class="finding-title">{{ row['title'] }}</span></template>
          <template #cell-verificationStatus="{ row }">{{ verificationLabel(String(row['verificationStatus'])) }}</template>
          <template #cell-status="{ row }"><StatusBadge :status="String(row['status'])" kind="finding" /></template>
        </DataTable>
      </PanelCard>

      <PanelCard title="Exportar" subtitle="El HTML y el PDF incluyen portada, resumen ejecutivo, cobertura y limitaciones.">
        <div class="exports">
          <BaseButton icon="report" :loading="exporting === 'json'" @click="save('json')">JSON</BaseButton>
          <BaseButton icon="report" :loading="exporting === 'html'" @click="save('html')">HTML</BaseButton>
          <BaseButton variant="primary" icon="report" :loading="exporting === 'pdf'" @click="save('pdf')">PDF</BaseButton>
          <span v-if="savedPath" class="saved">Guardado en <span class="mono">{{ savedPath }}</span></span>
        </div>
      </PanelCard>

      <div class="limitations">
        <AppIcon name="info" :size="16" />
        <ul>
          <li v-for="(l, i) in report.limitations" :key="i">{{ l }}</li>
        </ul>
      </div>
    </template>

    <EmptyState
      v-else
      icon="report"
      title="Seleccioná una auditoría"
      description="Vas a ver un resumen ejecutivo y podrás exportar el informe en JSON, HTML o PDF."
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { Finding } from '@shared/finding-schema';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import SeverityBadge from '../components/ui/SeverityBadge.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import FormField from '../components/ui/FormField.vue';
import KpiCard from '../components/ui/KpiCard.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { toast } from '../composables/useToast';
import {
  displayTarget,
  engineLabel,
  formatDate,
  formatDateShort,
  profileLabel,
  shortTarget,
  verificationLabel,
} from '../lib/labels';

interface AuditRow {
  id: string;
  target: string;
  profile: string;
  status: string;
  startedAt: string;
}

interface ReportView {
  version: string;
  generatedAt: string;
  audit: {
    id: string;
    profile: string;
    profileTitle: string;
    target: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    error: string | null;
  };
  summary: {
    total: number;
    actionable: number;
    confirmed: number;
    pending: number;
    bySeverity: Record<string, number>;
  };
  coverage: { plannedEngines: string[]; enginesWithFindings: string[]; notes: string[] };
  findings: Finding[];
  notes: string[];
  limitations: string[];
}

const route = useRoute();
const audits = ref<AuditRow[]>([]);
const auditId = ref('');
const report = ref<ReportView | null>(null);
const loading = ref(false);
const error = ref('');
const exporting = ref('');
const savedPath = ref('');

const findingColumns = [
  { key: 'severity', label: 'Severidad', width: '120px' },
  { key: 'title', label: 'Título' },
  { key: 'category', label: 'Categoría', width: '150px' },
  { key: 'verificationStatus', label: 'Verificación', width: '150px' },
  { key: 'status', label: 'Estado', width: '130px' },
];

const durationText = computed(() => {
  const ms = report.value?.audit.durationMs;
  if (ms === null || ms === undefined) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return '<1 s';
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
});

const severityRows = computed(() => {
  const map = report.value?.summary.bySeverity ?? {};
  const total = Math.max(1, Object.values(map).reduce((a, b) => a + b, 0));
  return [
    { key: 'critical', label: 'Crítico', value: map['critical'] ?? 0, color: 'var(--sev-critical)' },
    { key: 'high', label: 'Alto', value: map['high'] ?? 0, color: 'var(--sev-high)' },
    { key: 'medium', label: 'Medio', value: map['medium'] ?? 0, color: 'var(--sev-medium)' },
    { key: 'low', label: 'Bajo', value: map['low'] ?? 0, color: 'var(--sev-low)' },
    { key: 'info', label: 'Informativo', value: map['info'] ?? 0, color: 'var(--sev-info)' },
  ].map((row) => ({ ...row, pct: Math.round((row.value / total) * 100) }));
});

async function generate(): Promise<void> {
  if (!auditId.value) return;
  loading.value = true;
  error.value = '';
  savedPath.value = '';
  try {
    const r = await window.api.reports.generate(auditId.value);
    report.value = JSON.parse(r.json) as ReportView;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo generar el informe';
    report.value = null;
  } finally {
    loading.value = false;
  }
}

function onSelect(): void {
  report.value = null;
  savedPath.value = '';
  void generate();
}

async function save(format: 'json' | 'html' | 'pdf'): Promise<void> {
  if (!auditId.value) return;
  exporting.value = format;
  error.value = '';
  savedPath.value = '';
  try {
    const r = await window.api.reports.save(auditId.value, format);
    if (r.saved) {
      savedPath.value = r.path ?? '';
      toast.success(`Informe ${format.toUpperCase()} exportado`);
    }
  } catch (e) {
    toast.error('No se pudo exportar', e instanceof Error ? e.message : undefined);
  } finally {
    exporting.value = '';
  }
}

watch(
  () => route.query.audit,
  (value) => {
    const id = typeof value === 'string' ? value : '';
    if (id && id !== auditId.value) {
      auditId.value = id;
      void generate();
    }
  },
);

onMounted(async () => {
  const queryAudit = typeof route.query.audit === 'string' ? route.query.audit : '';
  if (queryAudit) auditId.value = queryAudit;
  try {
    audits.value = (await window.api.audits.list()) as AuditRow[];
    if (auditId.value) await generate();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar las auditorías';
  }
});
</script>

<style scoped>
.selector { display: flex; gap: var(--space-3); align-items: flex-end; }
.selector :deep(.field) { flex: 1; margin-bottom: 0; }
.report-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); margin: var(--space-2) 0 var(--space-4); }
.eyebrow { margin: 0 0 2px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.report-head h2 { font-size: 24px; }
.target { margin: 4px 0 0; color: var(--text-dim); overflow-wrap: anywhere; }
.report-meta { display: flex; align-items: center; gap: var(--space-4); color: var(--text-faint); font-size: 11px; flex-wrap: wrap; }
.report-meta span { display: flex; flex-direction: column; gap: 1px; }
.report-meta strong { color: var(--text); font-size: 12px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.sev-list { display: flex; flex-direction: column; gap: 10px; }
.sev-row { display: grid; grid-template-columns: 110px 1fr 32px; align-items: center; gap: 10px; }
.sev-bar { height: 7px; border-radius: 999px; background: var(--bg-soft); overflow: hidden; }
.sev-bar span { display: block; height: 100%; border-radius: 999px; }
.sev-row strong { text-align: right; font-variant-numeric: tabular-nums; }
.coverage-label { margin: 0 0 4px; color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: var(--space-3); }
.chip { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-soft); font-size: 11px; color: var(--text-dim); }
.notes { margin: var(--space-2) 0 0; padding-left: 18px; color: var(--text-dim); font-size: 11px; max-height: 120px; overflow-y: auto; }
.finding-title { font-size: 12px; }
.exports { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.saved { color: var(--text-dim); font-size: 11px; overflow-wrap: anywhere; }
.limitations { display: flex; gap: 10px; align-items: flex-start; padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-dim); font-size: 11px; }
.limitations :deep(svg) { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
.limitations ul { margin: 0; padding-left: 16px; }
@media (max-width: 1000px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; }
  .report-head { flex-direction: column; align-items: flex-start; }
  .selector { flex-direction: column; align-items: stretch; }
}
</style>
