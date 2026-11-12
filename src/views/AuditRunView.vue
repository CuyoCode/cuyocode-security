<template>
  <div>
    <PageHeader eyebrow="Ejecución" title="Auditoría en curso" :subtitle="audit ? shortTarget(audit.target, 80) : 'Cargando datos de la corrida'">
      <template #actions>
        <BaseButton icon="history" @click="router.push('/audits')">Historial</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>
    <LoadingState v-if="loading && !audit" label="Cargando ejecución…" />

    <template v-else-if="audit">
      <PanelCard>
        <p class="run-target"><strong>Objetivo:</strong> <span class="mono">{{ displayTarget(audit.target) }}</span></p>
        <div class="run-head">
          <div class="run-meta">
            <span class="label">Perfil</span>
            <strong>{{ profileLabel(audit.profile) }}</strong>
          </div>
          <div class="run-meta">
            <span class="label">Estado</span>
            <StatusBadge :status="audit.status" kind="audit" />
          </div>
          <div class="run-meta">
            <span class="label">Inicio</span>
            <strong>{{ formatDate(audit.startedAt) }}</strong>
          </div>
          <div class="run-meta">
            <span class="label">Duración</span>
            <strong>{{ duration }}</strong>
          </div>
        </div>

        <div class="progress-block">
          <div class="progress-head">
            <span v-if="running">Motor actual: <strong>{{ engineLabel(audit.progress.currentEngine) || 'Preparando…' }}</strong></span>
            <span v-else>{{ doneLabel }}</span>
            <span class="mono">{{ audit.progress.done }}/{{ audit.progress.total }}</span>
          </div>
          <ProgressBar :value="audit.progress.done" :max="audit.progress.total" label="Progreso de la auditoría" />
        </div>

        <p v-if="audit.error" class="run-error">{{ audit.error }}</p>

        <div class="run-actions">
          <BaseButton v-if="running" variant="danger" :loading="cancelling" icon="close" @click="cancel">
            Cancelar auditoría
          </BaseButton>
          <template v-else>
            <BaseButton variant="primary" icon="alert" @click="router.push(`/findings?audit=${audit.id}`)">Ver hallazgos</BaseButton>
            <BaseButton icon="report" @click="router.push(`/reports?audit=${audit.id}`)">Generar informe</BaseButton>
          </template>
        </div>
      </PanelCard>

      <PanelCard v-if="errors.length > 0" title="Cobertura y advertencias" subtitle="Un motor omitido no invalida el resto, pero reduce el alcance verificado.">
        <ul class="notes">
          <li v-for="(e, i) in errors" :key="i"><AppIcon name="info" :size="14" /><span class="mono">{{ e }}</span></li>
        </ul>
      </PanelCard>

      <PanelCard v-if="!running && audit.status === 'done'" title="Próximo paso" subtitle="La ausencia de hallazgos no implica que el objetivo sea seguro.">
        <div class="next-row">
          <div class="next-icon"><AppIcon name="check" :size="20" /></div>
          <div>
            <strong>Auditoría completada</strong>
            <p>Revisá la evidencia, descartá falsos positivos con justificación y exportá el informe con su cobertura real.</p>
          </div>
        </div>
      </PanelCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import ProgressBar from '../components/ui/ProgressBar.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { toast } from '../composables/useToast';
import { confirmAction } from '../composables/useConfirm';
import { displayTarget, durationLabel, engineLabel, formatDate, profileLabel, shortTarget } from '../lib/labels';

interface AuditRow {
  id: string;
  target: string;
  profile: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  progress: { done: number; total: number; currentEngine: string };
  notes: string[];
}

const props = defineProps<{ id: string }>();
const router = useRouter();
const audit = ref<AuditRow | null>(null);
const error = ref('');
const errors = ref<string[]>([]);
const cancelling = ref(false);
const loading = ref(true);
let timer: ReturnType<typeof setInterval> | null = null;

const running = computed(() => audit.value?.status === 'running' || audit.value?.status === 'queued');
const duration = computed(() => (audit.value ? durationLabel(audit.value.startedAt, audit.value.finishedAt) : '—'));
const doneLabel = computed(() => {
  const status = audit.value?.status;
  if (status === 'failed') return 'La auditoría terminó con errores.';
  if (status === 'cancelled') return 'Cancelada por el usuario.';
  return 'Auditoría completada.';
});

async function refresh(): Promise<void> {
  try {
    audit.value = (await window.api.audits.get(props.id)) as AuditRow;
    if (errors.value.length === 0 && audit.value.notes.length > 0) errors.value = audit.value.notes;
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la auditoría';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  } finally {
    loading.value = false;
  }
}

async function cancel(): Promise<void> {
  const ok = await confirmAction({
    title: 'Cancelar auditoría',
    message: 'Se detendrán los motores en curso y la corrida quedará como cancelada. Los hallazgos ya guardados se conservan.',
    confirmLabel: 'Cancelar auditoría',
    cancelLabel: 'Seguir ejecutando',
    danger: true,
  });
  if (!ok) return;
  cancelling.value = true;
  try {
    await window.api.audits.cancel(props.id);
    toast.info('Cancelación solicitada');
    await refresh();
  } catch (e) {
    toast.error('No se pudo cancelar', e instanceof Error ? e.message : undefined);
  } finally {
    cancelling.value = false;
  }
}

watch(
  () => props.id,
  () => {
    errors.value = [];
    void refresh();
  },
);

onMounted(async () => {
  window.api.audits.clearListeners();
  window.api.audits.onProgress((e) => {
    if (e.auditId === props.id && audit.value) {
      audit.value.progress = { done: e.done, total: e.total, currentEngine: e.currentEngine };
    }
  });
  window.api.audits.onFinished((e) => {
    if (e.auditId === props.id) {
      errors.value = e.errors;
      if (e.status === 'done') toast.success('Auditoría completada');
      else if (e.status === 'failed') toast.error('La auditoría falló');
      void refresh();
    }
  });
  await refresh();
  timer = setInterval(() => {
    if (running.value) void refresh();
  }, 1500);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  window.api.audits.clearListeners();
});
</script>

<style scoped>
.run-target { margin: 0 0 var(--space-3); font-size: 12px; color: var(--text-dim); overflow-wrap: anywhere; }
.run-head { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
.run-meta { display: flex; flex-direction: column; gap: 4px; }
.run-meta .label { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.run-meta strong { font-size: 13px; font-weight: 600; }
.progress-block { margin-top: var(--space-4); }
.progress-head { display: flex; justify-content: space-between; gap: var(--space-2); margin-bottom: 8px; font-size: 12px; color: var(--text-dim); }
.run-error { margin-top: var(--space-3); color: var(--danger); font-size: 12px; }
.run-actions { display: flex; gap: var(--space-2); margin-top: var(--space-4); }
.notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.notes li { display: flex; align-items: flex-start; gap: 8px; color: var(--text-dim); font-size: 12px; }
.notes li :deep(svg) { color: var(--warn); flex-shrink: 0; margin-top: 2px; }
.next-row { display: flex; gap: var(--space-3); align-items: flex-start; }
.next-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--ok-soft); color: var(--ok); flex-shrink: 0; }
.next-row strong { font-size: 13px; }
.next-row p { margin: 3px 0 0; color: var(--text-dim); font-size: 12px; }
@media (max-width: 900px) { .run-head { grid-template-columns: 1fr 1fr; } }
</style>
