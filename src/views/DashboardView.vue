<template>
  <div>
    <PageHeader
      eyebrow="Resumen"
      title="Panel de seguridad"
      subtitle="Estado de tus objetivos, hallazgos abiertos y cobertura de herramientas."
    >
      <template #actions>
        <BaseButton icon="spark" :loading="demoLoading" @click="runDemo">Probar demo</BaseButton>
        <BaseButton variant="primary" icon="plus" @click="router.push('/wizard')">Nueva auditoría</BaseButton>
      </template>
    </PageHeader>

    <div v-if="loading" class="kpi-grid">
      <div v-for="n in 4" :key="n" class="skeleton-card"></div>
    </div>
    <template v-else>
      <div v-if="error" class="error-box" role="alert">{{ error }}</div>

      <div class="kpi-grid">
        <KpiCard label="Proyectos" :value="counts?.projects ?? 0" icon="folder" tone="accent" hint="Objetivos registrados">
          <RouterLink to="/projects" class="kpi-link">Gestionar <AppIcon name="arrow" :size="12" /></RouterLink>
        </KpiCard>
        <KpiCard label="Auditorías" :value="counts?.audits ?? 0" icon="history" hint="Corridas registradas">
          <RouterLink to="/audits" class="kpi-link">Historial <AppIcon name="arrow" :size="12" /></RouterLink>
        </KpiCard>
        <KpiCard label="Hallazgos abiertos" :value="totalFindings" icon="alert" :tone="totalFindings > 0 ? 'danger' : 'ok'" hint="Requieren revisión">
          <RouterLink to="/findings" class="kpi-link">Ver hallazgos <AppIcon name="arrow" :size="12" /></RouterLink>
        </KpiCard>
        <KpiCard label="Pendientes de revisión" :value="counts?.pendingReview ?? 0" icon="clock" :tone="(counts?.pendingReview ?? 0) > 0 ? 'warn' : 'ok'" hint="Sin verificación confirmada">
          <RouterLink to="/findings" class="kpi-link">Revisar <AppIcon name="arrow" :size="12" /></RouterLink>
        </KpiCard>
      </div>

      <div v-if="showChecklist" class="checklist">
        <div class="checklist-head">
          <div>
            <h2>Primeros pasos</h2>
            <p class="hint">Completá el recorrido para sacar el máximo provecho de la herramienta.</p>
          </div>
          <span class="badge warn">{{ completedSteps }}/4 completados</span>
        </div>
        <div class="steps">
          <button v-for="step in checklist" :key="step.title" class="step" :class="{ done: step.done }" @click="step.action">
            <span class="step-check"><AppIcon :name="step.done ? 'check' : step.icon" :size="14" /></span>
            <span class="step-text">
              <strong>{{ step.title }}</strong>
              <span>{{ step.description }}</span>
            </span>
            <AppIcon name="chevron" :size="14" class="step-arrow" />
          </button>
        </div>
      </div>

      <div class="two-col">
        <PanelCard title="Hallazgos por severidad" subtitle="Solo estados abierto y revisado">
          <div v-if="totalFindings === 0" class="inline-empty">
            <AppIcon name="shield" :size="18" /> Sin hallazgos abiertos por ahora.
          </div>
          <div v-else class="severity-block">
            <DonutChart :segments="severitySegments" center-label="abiertos" />
            <ul class="legend">
              <li v-for="s in severitySegments" :key="s.label">
                <span class="legend-dot" :style="{ background: s.color }"></span>
                <span class="legend-label">{{ s.label }}</span>
                <strong>{{ s.value }}</strong>
              </li>
            </ul>
          </div>
        </PanelCard>

        <PanelCard title="Actividad reciente" subtitle="Auditorías de los últimos 14 días">
          <div class="activity">
            <div class="activity-chart">
              <Sparkline :values="activity" :width="260" :height="56" aria-label="Auditorías por día" />
              <div class="activity-foot">
                <span>{{ activityTotal }} en 14 días</span>
                <span>{{ doneCount }} completadas · {{ failedCount }} fallidas</span>
              </div>
            </div>
            <dl class="mini-stats">
              <div><dt>Duración media</dt><dd>{{ avgDuration }}</dd></div>
              <div><dt>Herramientas</dt><dd>{{ toolsOk }}/{{ tools.length }}</dd></div>
              <div><dt>Hallazgos / auditoría</dt><dd>{{ findingsPerAudit }}</dd></div>
            </dl>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Últimas auditorías" subtitle="Accedé al progreso, hallazgos e informe">
        <DataTable
          :columns="auditColumns"
          :rows="recentAudits"
          row-key="id"
          empty-title="Todavía no hay auditorías"
          empty-description="Ejecutá la demo segura o creá tu primera auditoría guiada."
          empty-icon="history"
        >
          <template #cell-startedAt="{ row }">
            <span class="muted">{{ relativeDate(String(row['startedAt'])) }}</span>
          </template>
          <template #cell-target="{ row }">
            <span class="mono">{{ shortTarget(String(row['target'])) }}</span>
          </template>
          <template #cell-profile="{ row }">
            {{ profileLabel(String(row['profile'])) }}
          </template>
          <template #cell-status="{ row }">
            <StatusBadge :status="String(row['status'])" kind="audit" />
          </template>
          <template #cell-actions="{ row }">
            <div class="row-actions">
              <RouterLink class="link" :to="`/run/${row['id']}`">Ejecución</RouterLink>
              <RouterLink class="link" :to="`/findings?audit=${row['id']}`">Hallazgos</RouterLink>
              <RouterLink class="link" :to="`/reports?audit=${row['id']}`">Informe</RouterLink>
            </div>
          </template>
          <template #empty>
            <BaseButton variant="primary" icon="spark" :loading="demoLoading" @click="runDemo">Probar demo segura</BaseButton>
          </template>
        </DataTable>
      </PanelCard>

      <div v-if="missingRequired.length > 0" class="notice-card">
        <AppIcon name="warning" :size="18" />
        <div>
          <strong>Herramientas base faltantes</strong>
          <p>{{ missingRequired.map((t) => t.name).join(', ') }}. La app funciona igual; algunas funciones quedan limitadas.</p>
        </div>
        <BaseButton size="sm" @click="router.push('/tools')">Ver herramientas</BaseButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import KpiCard from '../components/ui/KpiCard.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import DonutChart from '../components/ui/DonutChart.vue';
import Sparkline from '../components/ui/Sparkline.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useAppStore } from '../stores/app';
import { toast } from '../composables/useToast';
import { profileLabel, relativeDate, shortTarget } from '../lib/labels';

interface AuditRow {
  id: string;
  target: string;
  profile: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  progress: { done: number; total: number; currentEngine: string };
}

const router = useRouter();
const store = useAppStore();
const loading = ref(true);
const demoLoading = ref(false);
const error = ref('');
const audits = ref<AuditRow[]>([]);

const counts = computed(() => store.counts);
const tools = computed(() => store.tools);
const recentAudits = computed(() => audits.value.slice(0, 5) as unknown as Array<Record<string, unknown>>);
const totalFindings = computed(() => {
  const f = counts.value?.findingsBySeverity;
  if (!f) return 0;
  return f.critical + f.high + f.medium + f.low + f.info;
});
const toolsOk = computed(() => tools.value.filter((t) => t.detected).length);
const missingRequired = computed(() => tools.value.filter((t) => t.required && !t.detected));

const severitySegments = computed(() => [
  { label: 'Crítico', value: counts.value?.findingsBySeverity.critical ?? 0, color: 'var(--sev-critical)' },
  { label: 'Alto', value: counts.value?.findingsBySeverity.high ?? 0, color: 'var(--sev-high)' },
  { label: 'Medio', value: counts.value?.findingsBySeverity.medium ?? 0, color: 'var(--sev-medium)' },
  { label: 'Bajo', value: counts.value?.findingsBySeverity.low ?? 0, color: 'var(--sev-low)' },
  { label: 'Informativo', value: counts.value?.findingsBySeverity.info ?? 0, color: 'var(--sev-info)' },
]);

const activity = computed(() => {
  const days = 14;
  const buckets = new Array<number>(days).fill(0);
  const now = new Date();
  for (const audit of audits.value) {
    const d = new Date(audit.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < days) {
      const index = days - 1 - diff;
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
  }
  return buckets;
});
const activityTotal = computed(() => activity.value.reduce((a, b) => a + b, 0));
const doneCount = computed(() => audits.value.filter((a) => a.status === 'done').length);
const failedCount = computed(() => audits.value.filter((a) => a.status === 'failed').length);
const avgDuration = computed(() => {
  const done = audits.value.filter((a) => a.status === 'done' && a.finishedAt);
  if (done.length === 0) return '—';
  const total = done.reduce((sum, a) => {
    const start = new Date(a.startedAt).getTime();
    const end = a.finishedAt ? new Date(a.finishedAt).getTime() : start;
    return sum + Math.max(0, end - start);
  }, 0);
  const avg = total / done.length;
  const seconds = Math.round(avg / 1000);
  if (seconds < 1) return '<1 s';
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
});
const findingsPerAudit = computed(() => {
  if (audits.value.length === 0) return '—';
  return (totalFindings.value / audits.value.length).toFixed(1);
});

const showChecklist = computed(
  () => (counts.value?.audits ?? 0) === 0 || missingRequired.value.length > 0,
);
const checklist = computed(() => [
  {
    title: 'Registrar un objetivo',
    description: 'Guardá una carpeta, URL o servidor autorizado.',
    done: (counts.value?.projects ?? 0) > 0,
    icon: 'folder',
    action: () => void router.push('/wizard'),
  },
  {
    title: 'Ejecutar una auditoría',
    description: 'Usá la demo segura o el asistente de 6 pasos.',
    done: (counts.value?.audits ?? 0) > 0,
    icon: 'shield',
    action: () => void router.push('/wizard'),
  },
  {
    title: 'Revisar hallazgos',
    description: 'Validá, descartá falsos positivos y dejá trazabilidad.',
    done: (counts.value?.audits ?? 0) > 0 && totalFindings.value > 0,
    icon: 'alert',
    action: () => void router.push('/findings'),
  },
  {
    title: 'Exportar un informe',
    description: 'Generá JSON, HTML o PDF con cobertura y limitaciones.',
    done: false,
    icon: 'report',
    action: () => void router.push('/reports'),
  },
]);
const completedSteps = computed(() => checklist.value.filter((s) => s.done).length);

const auditColumns = [
  { key: 'startedAt', label: 'Inicio', width: '110px' },
  { key: 'target', label: 'Objetivo' },
  { key: 'profile', label: 'Perfil', width: '170px' },
  { key: 'status', label: 'Estado', width: '140px' },
  { key: 'actions', label: '', width: '230px' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([
      store.refreshDashboard(),
      store.refreshProjects(),
      store.toolsLoaded ? Promise.resolve() : store.refreshTools(),
    ]);
    audits.value = (await window.api.audits.list()) as AuditRow[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el panel';
  } finally {
    loading.value = false;
  }
}

async function runDemo(): Promise<void> {
  if (demoLoading.value) return;
  demoLoading.value = true;
  try {
    const result = await window.api.system.demo();
    toast.success('Demo preparada', `${result.findings} hallazgos sobre objetivos sintéticos.`);
    await load();
    await router.push('/audits');
  } catch (e) {
    toast.error('No se pudo preparar la demo', e instanceof Error ? e.message : 'Error desconocido');
  } finally {
    demoLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
.skeleton-card { height: 130px; border-radius: var(--radius); background: var(--bg-panel); border: 1px solid var(--border); animation: pulse 1.4s infinite; }
@keyframes pulse { 50% { opacity: 0.55; } }
.kpi-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--accent); }

.checklist {
  border: 1px solid var(--border);
  background: var(--bg-panel);
  border-radius: var(--radius);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}
.checklist-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.checklist-head h2 { font-size: 15px; }
.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
.step {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  text-align: left;
  padding: 10px 11px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  white-space: normal;
}
.step:hover { border-color: var(--accent); }
.step.done { opacity: 0.72; }
.step-check { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--bg-elevated); color: var(--text-dim); flex-shrink: 0; }
.step.done .step-check { background: var(--ok-soft); color: var(--ok); }
.step-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step-text strong { font-size: 12px; }
.step-text span { font-size: 11px; color: var(--text-faint); }
.step-arrow { margin-left: auto; color: var(--text-faint); flex-shrink: 0; }

.two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: var(--space-3); }
.severity-block { display: flex; align-items: center; gap: var(--space-5); }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.legend li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { flex: 1; color: var(--text-dim); }
.legend strong { font-variant-numeric: tabular-nums; }
.inline-empty { display: flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: 13px; padding: var(--space-4) 0; }

.activity { display: flex; gap: var(--space-4); align-items: stretch; }
.activity-chart { flex: 1; min-width: 0; }
.activity-foot { display: flex; justify-content: space-between; gap: var(--space-2); margin-top: 6px; color: var(--text-faint); font-size: 11px; }
.mini-stats { margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 120px; }
.mini-stats dt { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.mini-stats dd { margin: 1px 0 0; font-size: 14px; font-weight: 650; }

.row-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.link { font-size: 12px; }
.notice-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--warn) 35%, var(--border));
  background: var(--warn-soft);
  border-radius: var(--radius);
  color: var(--warn);
}
.notice-card div { flex: 1; }
.notice-card strong { font-size: 13px; }
.notice-card p { margin: 2px 0 0; font-size: 12px; color: var(--text-dim); }

@media (max-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .two-col { grid-template-columns: 1fr; }
  .activity { flex-direction: column; }
}
</style>
