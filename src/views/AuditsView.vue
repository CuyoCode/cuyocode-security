<template>
  <div>
    <PageHeader
      eyebrow="Historial"
      title="Auditorías"
      subtitle="Cada corrida conserva objetivo, perfil, cobertura y hallazgos comparables."
    >
      <template #actions>
        <BaseButton icon="refresh" :loading="loading" @click="load">Actualizar</BaseButton>
        <BaseButton variant="primary" icon="plus" @click="router.push('/wizard')">Nueva auditoría</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <PanelCard>
      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        empty-title="Todavía no hay auditorías"
        empty-description="Ejecutá la demo segura o creá tu primera auditoría guiada."
        empty-icon="history"
      >
        <template #cell-startedAt="{ row }">
          <div class="date-cell">
            <span>{{ relativeDate(String(row['startedAt'])) }}</span>
            <span class="faint">{{ formatDateShort(String(row['startedAt'])) }}</span>
          </div>
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

    <PanelCard
      v-if="audits.length >= 2"
      title="Comparar auditorías"
      subtitle="Diff por identidad estable de hallazgo: nuevos, resueltos y persistentes."
    >
      <div class="compare-controls">
        <FormField label="Base (anterior)" field-id="cmp-base">
          <select id="cmp-base" v-model="baseId" @change="cmp = null">
            <option v-for="a in audits" :key="a.id" :value="a.id">
              {{ profileLabel(a.profile) }} · {{ shortTarget(a.target, 28) }} · {{ formatDateShort(a.startedAt) }}
            </option>
          </select>
        </FormField>
        <FormField label="Comparada (nueva)" field-id="cmp-other">
          <select id="cmp-other" v-model="otherId" @change="cmp = null">
            <option v-for="a in audits" :key="a.id" :value="a.id">
              {{ profileLabel(a.profile) }} · {{ shortTarget(a.target, 28) }} · {{ formatDateShort(a.startedAt) }}
            </option>
          </select>
        </FormField>
        <div class="compare-actions">
          <BaseButton variant="primary" :loading="comparing" :disabled="!canCompare" @click="compare">Comparar</BaseButton>
        </div>
      </div>

      <div v-if="cmp" class="compare-result">
        <div class="diff-kpis">
          <div class="diff-kpi new"><strong>{{ cmp.onlyOther.length }}</strong><span>Nuevos</span></div>
          <div class="diff-kpi resolved"><strong>{{ cmp.onlyBase.length }}</strong><span>Resueltos</span></div>
          <div class="diff-kpi persistent"><strong>{{ cmp.bothCount }}</strong><span>Persistentes</span></div>
          <BaseButton size="sm" icon="copy" @click="copySummary">Copiar resumen</BaseButton>
        </div>
        <div class="diff-columns">
          <div>
            <h3>Nuevos</h3>
            <p v-if="cmp.onlyOther.length === 0" class="hint">Ninguno.</p>
            <ul v-else class="diff-list">
              <li v-for="f in cmp.onlyOther" :key="f.id">
                <SeverityBadge :severity="f.severity" />
                <span>{{ f.title }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3>Resueltos</h3>
            <p v-if="cmp.onlyBase.length === 0" class="hint">Ninguno.</p>
            <ul v-else class="diff-list">
              <li v-for="f in cmp.onlyBase" :key="f.id">
                <SeverityBadge :severity="f.severity" />
                <span>{{ f.title }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PanelCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Finding } from '@shared/finding-schema';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import SeverityBadge from '../components/ui/SeverityBadge.vue';
import FormField from '../components/ui/FormField.vue';
import { toast } from '../composables/useToast';
import { formatDateShort, profileLabel, relativeDate, shortTarget } from '../lib/labels';

interface AuditRow {
  id: string;
  target: string;
  profile: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
}

interface CompareResult {
  onlyBase: Finding[];
  onlyOther: Finding[];
  bothCount: number;
}

const router = useRouter();
const audits = ref<AuditRow[]>([]);
const loading = ref(true);
const demoLoading = ref(false);
const error = ref('');
const baseId = ref('');
const otherId = ref('');
const cmp = ref<CompareResult | null>(null);
const comparing = ref(false);

const rows = computed(() => audits.value as unknown as Array<Record<string, unknown>>);
const canCompare = computed(() => Boolean(baseId.value && otherId.value && baseId.value !== otherId.value));

const columns = [
  { key: 'startedAt', label: 'Inicio', width: '140px' },
  { key: 'target', label: 'Objetivo' },
  { key: 'profile', label: 'Perfil', width: '170px' },
  { key: 'status', label: 'Estado', width: '130px' },
  { key: 'actions', label: '', width: '210px' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    audits.value = (await window.api.audits.list()) as AuditRow[];
    if (audits.value.length >= 2 && !baseId.value) {
      baseId.value = audits.value[1]!.id;
      otherId.value = audits.value[0]!.id;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar las auditorías';
  } finally {
    loading.value = false;
  }
}

async function compare(): Promise<void> {
  if (!canCompare.value) return;
  comparing.value = true;
  error.value = '';
  try {
    cmp.value = await window.api.audits.compare(baseId.value, otherId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo comparar';
  } finally {
    comparing.value = false;
  }
}

async function copySummary(): Promise<void> {
  if (!cmp.value) return;
  const lines = [
    `Comparación de auditorías`,
    `Nuevos: ${cmp.value.onlyOther.length}`,
    `Resueltos: ${cmp.value.onlyBase.length}`,
    `Persistentes: ${cmp.value.bothCount}`,
    '',
    ...cmp.value.onlyOther.map((f) => `[NUEVO][${f.severity}] ${f.title}`),
    ...cmp.value.onlyBase.map((f) => `[RESUELTO][${f.severity}] ${f.title}`),
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Resumen copiado');
  } catch {
    toast.error('No se pudo copiar');
  }
}

async function runDemo(): Promise<void> {
  if (demoLoading.value) return;
  demoLoading.value = true;
  try {
    const result = await window.api.system.demo();
    toast.success('Demo preparada', `${result.findings} hallazgos sintéticos.`);
    await load();
  } catch (e) {
    toast.error('No se pudo preparar la demo', e instanceof Error ? e.message : 'Error desconocido');
  } finally {
    demoLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.date-cell { display: flex; flex-direction: column; }
.date-cell .faint { font-size: 11px; }
.row-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.link { font-size: 12px; }
.compare-controls { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-3); align-items: end; }
.compare-actions { padding-bottom: 2px; }
.compare-result { margin-top: var(--space-3); border-top: 1px solid var(--border); padding-top: var(--space-4); }
.diff-kpis { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.diff-kpi { display: flex; flex-direction: column; gap: 1px; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-soft); min-width: 90px; }
.diff-kpi strong { font-size: 20px; }
.diff-kpi span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); }
.diff-kpi.new { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); }
.diff-kpi.resolved { border-color: color-mix(in srgb, var(--ok) 35%, var(--border)); }
.diff-kpi.persistent { border-color: color-mix(in srgb, var(--warn) 35%, var(--border)); }
.diff-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-4); }
.diff-columns h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: var(--space-2); }
.diff-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.diff-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; }
@media (max-width: 960px) {
  .compare-controls { grid-template-columns: 1fr; }
  .diff-columns { grid-template-columns: 1fr; }
}
</style>
