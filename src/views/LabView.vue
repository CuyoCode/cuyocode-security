<template>
  <div>
    <PageHeader
      eyebrow="Entorno"
      title="Laboratorio"
      subtitle="Objetivos aislados para pruebas controladas. Sin aislamiento verificado, la app bloquea el perfil avanzado."
    >
      <template #actions>
        <BaseButton icon="spark" @click="createDemoLab">Crear laboratorio demo</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <div class="grid">
      <PanelCard title="Docker" subtitle="Requerido para laboratorios con imágenes">
        <div v-if="docker === null" class="hint">Comprobando Docker…</div>
        <div v-else class="docker-status">
          <StatusBadge :status="docker.daemon ? 'done' : 'failed'" kind="audit" />
          <span class="mono">{{ docker.version ?? 'sin versión' }}</span>
          <span class="hint">{{ docker.daemon ? 'Daemon accesible' : 'Daemon no accesible o Docker ausente' }}</span>
        </div>
        <p v-if="docker && !docker.daemon" class="hint">
          Sin Docker podés usar el laboratorio Node de abajo. No se simula disponibilidad.
        </p>
      </PanelCard>

      <PanelCard title="Laboratorio Node" subtitle="App vulnerable propia, solo loopback y datos sintéticos">
        <div class="inline-form">
          <FormField label="ID" field-id="node-id" hint="Forma node-nombre">
            <input id="node-id" v-model="nodeForm.id" placeholder="node-demo" />
          </FormField>
          <FormField label="Puerto" field-id="node-port">
            <input id="node-port" v-model.number="nodeForm.port" type="number" min="1024" max="65535" />
          </FormField>
          <BaseButton variant="primary" :loading="creatingNode" @click="createNode">Crear y arrancar</BaseButton>
        </div>
        <p class="hint">Aislamiento más débil que Docker: mismo SO. Usalo solo con datos sintéticos.</p>
      </PanelCard>
    </div>

    <PanelCard title="Laboratorios Node en ejecución" subtitle="El puerto y el host se verifican antes de permitir pruebas">
      <DataTable
        :columns="nodeColumns"
        :rows="nodeLabs as unknown as Array<Record<string, unknown>>"
        row-key="id"
        empty-title="Sin laboratorios Node activos"
        empty-description="Creá uno con el formulario de arriba o usá el laboratorio demo."
        empty-icon="flask"
      >
        <template #cell-id="{ row }"><span class="mono">{{ row['id'] }}</span></template>
        <template #cell-target="{ row }"><span class="mono">{{ row['target'] }}</span></template>
        <template #cell-pid="{ row }"><span class="mono">{{ row['pid'] ?? '—' }}</span></template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <BaseButton size="sm" @click="checkNode(row)">Verificar</BaseButton>
            <BaseButton size="sm" variant="danger" @click="stopNode(String(row['id']))">Detener</BaseButton>
          </div>
        </template>
      </DataTable>
      <p v-if="nodeCheckText" class="check-text">{{ nodeCheckText }}</p>
    </PanelCard>

    <div class="grid">
      <PanelCard title="Crear laboratorio Docker" subtitle="Imagen con versión fija; red interna y límites de CPU/memoria">
        <FormField label="ID" field-id="lab-id" hint="a-z, 0-9 y guiones">
          <input id="lab-id" v-model="form.id" placeholder="lab-demo" />
        </FormField>
        <FormField label="Imagen con versión" field-id="lab-image">
          <input id="lab-image" v-model="form.image" placeholder="bkimminich/juice-shop:v17.4.0" />
        </FormField>
        <FormField label="Puerto local" field-id="lab-port">
          <input id="lab-port" v-model.number="form.port" type="number" min="1024" max="65535" />
        </FormField>
        <BaseButton variant="primary" :disabled="!canCreate" :loading="creating" @click="createLab">Crear y arrancar</BaseButton>
      </PanelCard>

      <PanelCard title="Estado de un laboratorio" subtitle="Consultá, verificá aislamiento o eliminá solo recursos etiquetados">
        <FormField label="ID" field-id="lab-status-id">
          <input id="lab-status-id" v-model="statusId" placeholder="lab-demo" />
        </FormField>
        <div class="row">
          <BaseButton :loading="checking" @click="status">Consultar</BaseButton>
          <BaseButton :loading="checking" @click="checkLab">Verificar aislamiento</BaseButton>
          <BaseButton variant="danger" @click="removeLab">Eliminar</BaseButton>
        </div>
        <div v-if="statusLab" class="status-box">
          <dl>
            <div><dt>Estado</dt><dd>{{ statusLab.status }}</dd></div>
            <div><dt>Imagen</dt><dd class="mono">{{ statusLab.image }}</dd></div>
            <div><dt>Puertos publicados</dt><dd class="mono">{{ statusLab.ports.join(', ') || '—' }}</dd></div>
          </dl>
        </div>
        <p v-if="checkText" class="check-text">{{ checkText }}</p>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import DataTable from '../components/ui/DataTable.vue';
import FormField from '../components/ui/FormField.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import { toast } from '../composables/useToast';
import { confirmAction } from '../composables/useConfirm';

interface NodeLab {
  id: string;
  port: number;
  pid: number | null;
  startedAt: string;
  target: string;
}

interface LabStatus {
  id: string;
  image: string;
  container: string;
  network: string;
  status: string;
  ports: string[];
}

const docker = ref<{ binary: boolean; daemon: boolean; version: string | null } | null>(null);
const error = ref('');
const nodeLabs = ref<NodeLab[]>([]);
const nodeCheckText = ref('');
const creatingNode = ref(false);
const creating = ref(false);
const checking = ref(false);
const statusId = ref('');
const statusLab = ref<LabStatus | null>(null);
const checkText = ref('');
const form = reactive({ id: '', image: '', port: 3001 });
const nodeForm = reactive({ id: 'node-demo', port: 3117 });

const canCreate = computed(() => Boolean(docker.value?.daemon && form.id.trim() && form.image.trim()));

const nodeColumns = [
  { key: 'id', label: 'ID', width: '140px' },
  { key: 'target', label: 'Objetivo' },
  { key: 'pid', label: 'PID', width: '90px' },
  { key: 'actions', label: '', width: '190px' },
];

async function refreshNodeLabs(): Promise<void> {
  try {
    nodeLabs.value = await window.api.lab.nodeList();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar los laboratorios Node';
  }
}

async function createNode(): Promise<void> {
  creatingNode.value = true;
  try {
    await window.api.lab.nodeCreate({ id: nodeForm.id.trim(), port: Number(nodeForm.port) });
    await refreshNodeLabs();
    toast.success('Laboratorio Node iniciado');
  } catch (e) {
    toast.error('No se pudo crear el laboratorio Node', e instanceof Error ? e.message : undefined);
  } finally {
    creatingNode.value = false;
  }
}

async function createDemoLab(): Promise<void> {
  nodeForm.id = 'node-demo';
  nodeForm.port = 3117;
  await createNode();
}

async function stopNode(id: string): Promise<void> {
  const ok = await confirmAction({
    title: 'Detener laboratorio Node',
    message: `Se detendrá el proceso "${id}". Los hallazgos y auditorías ya guardados no se modifican.`,
    confirmLabel: 'Detener',
    danger: true,
  });
  if (!ok) return;
  try {
    await window.api.lab.nodeStop(id);
    await refreshNodeLabs();
    toast.success('Laboratorio detenido');
  } catch (e) {
    toast.error('No se pudo detener', e instanceof Error ? e.message : undefined);
  }
}

async function checkNode(row: Record<string, unknown>): Promise<void> {
  try {
    const r = await window.api.lab.check(String(row['id']), String(row['target']));
    nodeCheckText.value = r.ok ? `OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
    if (r.ok) toast.success('Aislamiento verificado');
    else toast.warning('Aislamiento bloqueado', r.reasons.join('; '));
  } catch (e) {
    nodeCheckText.value = e instanceof Error ? e.message : 'No se pudo verificar';
    toast.error('No se pudo verificar', nodeCheckText.value);
  }
}

async function createLab(): Promise<void> {
  creating.value = true;
  try {
    await window.api.lab.create({
      id: form.id.trim(),
      image: form.image.trim(),
      port: Number(form.port),
    });
    statusId.value = form.id.trim();
    await status();
    toast.success('Laboratorio Docker iniciado');
  } catch (e) {
    toast.error('No se pudo crear el laboratorio', e instanceof Error ? e.message : undefined);
  } finally {
    creating.value = false;
  }
}

async function status(): Promise<void> {
  checking.value = true;
  checkText.value = '';
  try {
    statusLab.value = await window.api.lab.status(statusId.value.trim());
    if (!statusLab.value) toast.info('Laboratorio inexistente o detenido');
  } catch (e) {
    toast.error('No se pudo consultar', e instanceof Error ? e.message : undefined);
  } finally {
    checking.value = false;
  }
}

async function checkLab(): Promise<void> {
  if (!statusId.value.trim()) return;
  checking.value = true;
  checkText.value = '';
  try {
    if (!statusLab.value || statusLab.value.id !== statusId.value.trim()) {
      statusLab.value = await window.api.lab.status(statusId.value.trim());
    }
    const port = statusLab.value?.ports[0];
    if (!port) {
      checkText.value = 'BLOQUEADO: no hay puerto publicado verificable para este laboratorio.';
      toast.warning('No se pudo verificar el puerto');
      return;
    }
    const r = await window.api.lab.check(statusId.value.trim(), `http://127.0.0.1:${port}/`);
    checkText.value = r.ok ? `OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
    if (r.ok) toast.success('Aislamiento verificado');
    else toast.warning('Aislamiento bloqueado', r.reasons.join('; '));
  } catch (e) {
    checkText.value = e instanceof Error ? e.message : 'No se pudo verificar';
    toast.error('No se pudo verificar', checkText.value);
  } finally {
    checking.value = false;
  }
}

async function removeLab(): Promise<void> {
  const id = statusId.value.trim();
  if (!id) return;
  const ok = await confirmAction({
    title: 'Eliminar laboratorio Docker',
    message: `Se eliminarán el contenedor y la red del laboratorio "${id}". Solo se tocan recursos con la etiqueta de CuyoCode.`,
    confirmLabel: 'Eliminar laboratorio',
    danger: true,
  });
  if (!ok) return;
  try {
    await window.api.lab.remove(id);
    statusLab.value = null;
    checkText.value = '';
    toast.success('Laboratorio eliminado');
  } catch (e) {
    toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined);
  }
}

onMounted(async () => {
  try {
    docker.value = await window.api.lab.docker();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo comprobar Docker';
  }
  await refreshNodeLabs();
});
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); align-items: start; }
.docker-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.inline-form { display: grid; grid-template-columns: 1fr 120px auto; gap: var(--space-2); align-items: end; }
.inline-form :deep(.field) { margin-bottom: 0; }
.row { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); }
.row-actions { display: flex; gap: var(--space-2); }
.check-text { margin: var(--space-3) 0 0; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px; color: var(--text-dim); }
.status-box { margin-top: var(--space-3); padding: var(--space-3); background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.status-box dl { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.status-box div { display: flex; justify-content: space-between; gap: var(--space-3); font-size: 12px; }
.status-box dt { color: var(--text-faint); }
.status-box dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } .inline-form { grid-template-columns: 1fr; } }
</style>
