<template>
  <div>
    <PageHeader
      eyebrow="Objetivos"
      title="Proyectos"
      subtitle="Registrá carpetas, URLs o servidores autorizados para reutilizarlos en auditorías."
    >
      <template #actions>
        <BaseButton variant="primary" icon="plus" @click="router.push('/wizard')">Nueva auditoría</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <div class="grid">
      <PanelCard title="Registrar objetivo" subtitle="El registro no ejecuta ni modifica el objetivo">
        <FormField label="Nombre" field-id="p-name" required :error="nameError">
          <input id="p-name" v-model="form.name" maxlength="80" placeholder="Mi aplicación" @blur="touched.name = true" />
        </FormField>
        <FormField label="Tipo" field-id="p-kind">
          <select id="p-kind" v-model="form.kind">
            <option value="folder">Carpeta local</option>
            <option value="url">URL autorizada</option>
            <option value="server">Servidor SSH</option>
          </select>
        </FormField>
        <FormField label="Objetivo" field-id="p-target" required :hint="targetHelp" :error="targetError">
          <div class="target-row">
            <input id="p-target" v-model="form.target" :placeholder="targetHint" @blur="touched.target = true" />
            <BaseButton v-if="form.kind === 'folder'" @click="browse">Examinar…</BaseButton>
          </div>
        </FormField>
        <BaseButton variant="primary" :disabled="!canCreate" :loading="saving" @click="create">Registrar</BaseButton>
      </PanelCard>

      <PanelCard title="Buenas prácticas" subtitle="El alcance siempre es explícito">
        <ul class="tips">
          <li><AppIcon name="check" :size="14" /> Usá rutas absolutas y URLs sin credenciales.</li>
          <li><AppIcon name="check" :size="14" /> Un proyecto puede auditarse varias veces sin duplicar objetivos.</li>
          <li><AppIcon name="check" :size="14" /> Los servidores requieren un perfil SSH de solo lectura.</li>
        </ul>
      </PanelCard>
    </div>

    <PanelCard :title="`Objetivos registrados (${projects.length})`" subtitle="Eliminar un proyecto no borra las auditorías ya realizadas">
      <DataTable
        :columns="columns"
        :rows="projects as unknown as Array<Record<string, unknown>>"
        row-key="id"
        empty-title="Sin proyectos registrados"
        empty-description="Podés auditar una carpeta sin registrar un proyecto, pero registrarlo te permite comparar corridas."
        empty-icon="folder"
      >
        <template #cell-name="{ row }"><strong>{{ row['name'] }}</strong></template>
        <template #cell-kind="{ row }"><span class="badge">{{ kindLabel(String(row['kind'])) }}</span></template>
        <template #cell-target="{ row }"><span class="mono">{{ shortTarget(String(row['target']), 64) }}</span></template>
        <template #cell-createdAt="{ row }"><span class="muted">{{ formatDate(String(row['createdAt'])) }}</span></template>
        <template #cell-actions="{ row }">
          <BaseButton size="sm" variant="danger" @click="remove(row)">Eliminar</BaseButton>
        </template>
      </DataTable>
    </PanelCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import FormField from '../components/ui/FormField.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useAppStore } from '../stores/app';
import { toast } from '../composables/useToast';
import { confirmAction } from '../composables/useConfirm';
import { formatDate, kindLabel, shortTarget } from '../lib/labels';

const router = useRouter();
const store = useAppStore();
const saving = ref(false);
const error = ref('');
const form = reactive({ name: '', kind: 'folder' as 'folder' | 'url' | 'server', target: '' });
const touched = reactive({ name: false, target: false });

const projects = computed(() => store.projects);
const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'kind', label: 'Tipo', width: '140px' },
  { key: 'target', label: 'Objetivo' },
  { key: 'createdAt', label: 'Alta', width: '140px' },
  { key: 'actions', label: '', width: '110px' },
];

const targetHint = computed(() => {
  if (form.kind === 'folder') return 'C:\\ruta\\al\\proyecto';
  if (form.kind === 'url') return 'https://app.ejemplo.com';
  return 'host o host:puerto';
});
const targetHelp = computed(() => {
  if (form.kind === 'folder') return 'Ruta absoluta a una carpeta existente. No se ejecuta su código.';
  if (form.kind === 'url') return 'Solo URLs http(s) expresamente autorizadas, sin credenciales.';
  return 'Host y puerto del servidor autorizado. Las operaciones se configuran en Servidores SSH.';
});
const nameError = computed(() => (touched.name && form.name.trim().length === 0 ? 'Ingresá un nombre.' : ''));
const targetError = computed(() => (touched.target && form.target.trim().length === 0 ? 'Ingresá un objetivo.' : ''));
const canCreate = computed(() => form.name.trim().length > 0 && form.target.trim().length > 0);

async function browse(): Promise<void> {
  try {
    const r = await window.api.system.pickFolder();
    if (r.folder) form.target = r.folder;
  } catch (e) {
    toast.error('No se pudo abrir el selector', e instanceof Error ? e.message : undefined);
  }
}

async function create(): Promise<void> {
  if (!canCreate.value) return;
  saving.value = true;
  error.value = '';
  try {
    await window.api.projects.create({ ...form, name: form.name.trim(), target: form.target.trim() });
    form.name = '';
    form.target = '';
    await Promise.all([store.refreshProjects(), store.refreshDashboard()]);
    toast.success('Proyecto registrado');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo registrar el proyecto';
  } finally {
    saving.value = false;
  }
}

async function remove(row: Record<string, unknown>): Promise<void> {
  const ok = await confirmAction({
    title: 'Eliminar proyecto',
    message: `Se eliminará "${String(row['name'])}" del listado. Las auditorías y hallazgos ya guardados se conservan.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await window.api.projects.remove(String(row['id']));
    await Promise.all([store.refreshProjects(), store.refreshDashboard()]);
    toast.success('Proyecto eliminado');
  } catch (e) {
    toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined);
  }
}

onMounted(async () => {
  try {
    await store.refreshProjects();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar los proyectos';
  }
});
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: var(--space-3); align-items: start; }
.target-row { display: flex; gap: var(--space-2); }
.target-row button { white-space: nowrap; }
.tips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; color: var(--text-dim); font-size: 12px; }
.tips li { display: flex; gap: 8px; align-items: flex-start; }
.tips :deep(svg) { color: var(--ok); flex-shrink: 0; margin-top: 1px; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>
