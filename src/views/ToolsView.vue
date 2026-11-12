<template>
  <div>
    <PageHeader
      eyebrow="Entorno"
      title="Herramientas externas"
      subtitle="La app no instala nada por su cuenta: detecta binarios y te guía para instalarlos."
    >
      <template #actions>
        <BaseButton icon="refresh" :loading="checking" @click="check">Volver a comprobar</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <div class="summary-row">
      <KpiCard label="Detectadas" :value="`${detectedCount} / ${tools.length}`" icon="wrench" tone="accent" hint="Herramientas integradas" />
      <KpiCard label="Requeridas" :value="`${requiredOk} / ${requiredTotal}`" icon="check" :tone="requiredOk === requiredTotal ? 'ok' : 'warn'" hint="Base de la aplicación" />
      <div class="tip-card">
        <AppIcon name="info" :size="18" />
        <p>Después de instalar una herramienta, volvé a comprobar. Las funciones que dependen de ella se habilitan automáticamente.</p>
      </div>
    </div>

    <PanelCard title="Catálogo" subtitle="Detectadas y ausentes, con web oficial y comando sugerido">
      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="checking && !toolsLoaded"
        empty-title="Sin herramientas para mostrar"
        empty-description="Volvé a comprobar la detección."
        empty-icon="wrench"
      >
        <template #cell-name="{ row }">
          <div class="tool-name">
            <strong>{{ row['name'] }}</strong>
            <span v-if="row['required']" class="req">base</span>
          </div>
        </template>
        <template #cell-detected="{ row }">
          <StatusBadge :status="row['detected'] ? 'detected' : 'missing'" kind="tool" />
        </template>
        <template #cell-version="{ row }">
          <span class="mono">{{ row['version'] ?? '—' }}</span>
        </template>
        <template #cell-install="{ row }">
          <div class="install">
            <template v-if="row['detected']">
              <span class="path mono">{{ row['path'] }}</span>
            </template>
            <template v-else>
              <BaseButton size="sm" @click="openPage(row)">Web oficial</BaseButton>
              <button v-if="row['installCommand']" class="cmd mono" @click="copyCmd(row)" :title="'Copiar ' + row['installCommand']">
                {{ row['installCommand'] }}
                <AppIcon name="copy" :size="12" />
              </button>
              <span v-else class="hint">{{ row['hint'] }}</span>
            </template>
          </div>
        </template>
      </DataTable>
    </PanelCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import KpiCard from '../components/ui/KpiCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useAppStore } from '../stores/app';
import { toast } from '../composables/useToast';

const store = useAppStore();
const checking = ref(false);
const error = ref('');

const tools = computed(() => store.tools);
const toolsLoaded = computed(() => store.toolsLoaded);
const detectedCount = computed(() => tools.value.filter((t) => t.detected).length);
const requiredTotal = computed(() => tools.value.filter((t) => t.required).length);
const requiredOk = computed(() => tools.value.filter((t) => t.required && t.detected).length);
const rows = computed(() => tools.value as unknown as Array<Record<string, unknown>>);

const columns = [
  { key: 'name', label: 'Herramienta', width: '180px' },
  { key: 'detected', label: 'Estado', width: '130px' },
  { key: 'version', label: 'Versión', width: '130px' },
  { key: 'install', label: 'Instalación' },
];

async function check(): Promise<void> {
  checking.value = true;
  error.value = '';
  try {
    await store.refreshTools();
    if (store.lastError) error.value = store.lastError;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo comprobar';
  } finally {
    checking.value = false;
  }
}

async function openPage(row: Record<string, unknown>): Promise<void> {
  try {
    await window.api.system.openInstallPage(String(row['installUrl']));
  } catch (e) {
    toast.error('No se pudo abrir la web', e instanceof Error ? e.message : undefined);
  }
}

async function copyCmd(row: Record<string, unknown>): Promise<void> {
  try {
    await navigator.clipboard.writeText(String(row['installCommand']));
    toast.success('Comando copiado');
  } catch {
    toast.error('No se pudo copiar');
  }
}

onMounted(async () => {
  if (!store.toolsLoaded) await check();
});
</script>

<style scoped>
.summary-row { display: grid; grid-template-columns: 220px 220px 1fr; gap: var(--space-3); margin-bottom: var(--space-4); }
.tip-card { display: flex; gap: 10px; align-items: flex-start; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-panel); color: var(--accent); }
.tip-card p { margin: 0; color: var(--text-dim); font-size: 12px; }
.tool-name { display: flex; align-items: center; gap: 7px; }
.req { padding: 1px 6px; border-radius: 999px; background: var(--warn-soft); color: var(--warn); font-size: 10px; font-weight: 700; }
.install { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.path { color: var(--text-faint); font-size: 11px; }
.cmd { display: inline-flex; align-items: center; gap: 6px; background: var(--bg-soft); border: 1px dashed var(--border-strong); color: var(--text-dim); font-size: 11px; padding: 5px 9px; }
.cmd:hover { border-color: var(--accent); color: var(--text); }
@media (max-width: 1100px) {
  .summary-row { grid-template-columns: 1fr 1fr; }
  .tip-card { grid-column: 1 / -1; }
}
</style>
