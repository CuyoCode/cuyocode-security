<template>
  <div>
    <PageHeader
      eyebrow="Sistema"
      title="Ajustes"
      subtitle="Información de la instalación, datos locales, privacidad y proveedor de IA."
    />

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <div class="grid">
      <PanelCard title="Aplicación" subtitle="Versión y entorno de ejecución">
        <dl v-if="info" class="info-list">
          <div><dt>Versión</dt><dd class="mono">{{ info.version }}</dd></div>
          <div><dt>Electron</dt><dd class="mono">{{ info.electron }}</dd></div>
          <div><dt>Node empaquetado</dt><dd class="mono">{{ info.node }}</dd></div>
          <div><dt>Chromium</dt><dd class="mono">{{ info.chrome }}</dd></div>
          <div><dt>Plataforma</dt><dd class="mono">{{ info.platform }}</dd></div>
        </dl>
        <div class="data-dir">
          <span class="faint">Carpeta de datos</span>
          <span class="mono">{{ info ? 'Base local de la aplicación' : '—' }}</span>
        </div>
        <div class="health-row">
          <StatusBadge :status="db?.ok ? 'done' : 'failed'" kind="audit" />
          <span class="hint">Base local: esquema v{{ db?.userVersion ?? '—' }} {{ db?.ok ? '· íntegra' : '· revisar' }}</span>
        </div>
        <template #footer>
          <div class="row">
            <BaseButton size="sm" icon="folder" @click="openDir">Abrir carpeta de datos</BaseButton>
            <BaseButton size="sm" variant="ghost" icon="spark" @click="resetOnboarding">Ver bienvenida</BaseButton>
          </div>
        </template>
      </PanelCard>

      <PanelCard title="Proveedor de IA" subtitle="Opcional, desactivado por defecto. Sin consentimiento no se envía nada.">
        <div class="ai-status" v-if="ai">
          <span class="dot" :class="ai.mode"></span>
          {{ aiModeLabel(ai.mode) }}
          <span v-if="ai.hasKey" class="badge ok">clave cargada</span>
          <span v-if="ai.ollamaOk !== null" class="badge" :class="ai.ollamaOk ? 'ok' : 'bad'">
            Ollama {{ ai.ollamaOk ? 'OK' : 'no disponible' }}
          </span>
        </div>

        <FormField label="Modo" field-id="ai-mode">
          <select id="ai-mode" v-model="aiForm.mode">
            <option value="off">Desactivada</option>
            <option value="local">Local (Ollama)</option>
            <option value="external">API externa (consentimiento por auditoría)</option>
          </select>
        </FormField>

        <FormField v-if="aiForm.mode === 'local'" label="Modelo Ollama" field-id="ai-model">
          <input id="ai-model" v-model="aiForm.ollamaModel" placeholder="llama3.1" />
        </FormField>

        <template v-if="aiForm.mode === 'external'">
          <FormField label="Endpoint https (compatible OpenAI)" field-id="ai-endpoint" hint="Solo HTTPS público. No se permiten loopback ni IPs privadas.">
            <input id="ai-endpoint" v-model="aiForm.endpoint" placeholder="https://api.proveedor.com/v1" />
          </FormField>
          <FormField label="Modelo" field-id="ai-ext-model">
            <input id="ai-ext-model" v-model="aiForm.model" placeholder="modelo-del-proveedor" />
          </FormField>
          <FormField
            label="API key"
            field-id="ai-key"
            hint="Si dejás el campo vacío se conserva la clave guardada, pero solo si el endpoint no cambió."
          >
            <input id="ai-key" v-model="aiForm.apiKey" type="password" autocomplete="off" :placeholder="ai?.hasKey ? 'Vacío = conservar la clave guardada' : 'Ingresá la API key'" />
          </FormField>
          <label class="check">
            <input type="checkbox" v-model="aiForm.remember" />
            <span>Recordar clave cifrada en este equipo (DPAPI). Si se desactiva, la clave vive solo en memoria de la sesión.</span>
          </label>
        </template>

        <template #footer>
          <div class="row">
            <BaseButton variant="primary" size="sm" :loading="savingAi" @click="saveAi">Guardar</BaseButton>
            <BaseButton size="sm" :disabled="aiForm.mode === 'off'" @click="testAi">Probar conexión</BaseButton>
            <BaseButton variant="danger" size="sm" @click="forgetAi">Olvidar clave</BaseButton>
          </div>
        </template>
      </PanelCard>
    </div>

    <PanelCard title="Privacidad y datos" subtitle="Todo queda en este equipo. Sin telemetría ni envíos automáticos.">
      <ul class="privacy">
        <li>Los secretos se redactan en logs, evidencias e informes.</li>
        <li>La IA está desactivada por defecto y requiere consentimiento por auditoría cuando es externa.</li>
        <li>Los análisis, hallazgos e historial se guardan en la base SQLite local.</li>
      </ul>
      <template #footer>
        <BaseButton variant="danger" size="sm" :loading="clearing" icon="close" @click="clearHistory">
          Vaciar historial de auditorías
        </BaseButton>
      </template>
    </PanelCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { AppInfo, DbHealth } from '@shared/ipc-contracts/system.contracts';
import type { AiConfigureInput, AiStatus } from '@shared/ipc-contracts/ai-lab-ssh.contracts';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import FormField from '../components/ui/FormField.vue';
import { toast } from '../composables/useToast';
import { confirmAction } from '../composables/useConfirm';
import { aiModeLabel } from '../lib/labels';

const info = ref<AppInfo | null>(null);
const db = ref<(DbHealth & { detail?: string }) | null>(null);
const ai = ref<(AiStatus & { ollamaOk: boolean | null; externalOk: boolean | null }) | null>(null);
const error = ref('');
const savingAi = ref(false);
const clearing = ref(false);
const aiForm = reactive({
  mode: 'off' as 'off' | 'local' | 'external',
  ollamaModel: 'llama3.1',
  endpoint: '',
  model: '',
  apiKey: '',
  remember: true,
});

async function refreshAi(): Promise<void> {
  ai.value = await window.api.ai.status();
  aiForm.mode = ai.value.mode;
  if (ai.value.ollamaModel) aiForm.ollamaModel = ai.value.ollamaModel;
  if (ai.value.externalEndpoint) aiForm.endpoint = ai.value.externalEndpoint;
}

async function openDir(): Promise<void> {
  try {
    await window.api.system.openDataDir();
  } catch (e) {
    toast.error('No se pudo abrir la carpeta', e instanceof Error ? e.message : undefined);
  }
}

function resetOnboarding(): void {
  localStorage.removeItem('cuyocode:onboarded');
  toast.info('La bienvenida se mostrará al reiniciar la app');
}

async function saveAi(): Promise<void> {
  savingAi.value = true;
  error.value = '';
  try {
    const input: AiConfigureInput = { mode: aiForm.mode };
    if (aiForm.mode === 'local') input.ollamaModel = aiForm.ollamaModel;
    if (aiForm.mode === 'external') {
      input.endpoint = aiForm.endpoint;
      input.model = aiForm.model;
      input.apiKey = aiForm.apiKey;
      input.remember = aiForm.remember;
    }
    await window.api.ai.configure(input);
    aiForm.apiKey = '';
    await refreshAi();
    const detail =
      aiForm.mode === 'external'
        ? aiForm.remember
          ? 'Configuración guardada. La clave queda cifrada con DPAPI.'
          : 'Configuración guardada. La clave solo vive en memoria de esta sesión.'
        : 'Configuración de IA guardada.';
    toast.success(detail);
  } catch (e) {
    toast.error('No se pudo guardar la IA', e instanceof Error ? e.message : undefined);
  } finally {
    savingAi.value = false;
  }
}

async function testAi(): Promise<void> {
  try {
    const r = await window.api.ai.test();
    if (r.ok) toast.success('Conexión correcta', r.detail);
    else toast.error('La prueba falló', r.detail);
    await refreshAi();
  } catch (e) {
    toast.error('No se pudo probar la conexión', e instanceof Error ? e.message : undefined);
  }
}

async function forgetAi(): Promise<void> {
  const ok = await confirmAction({
    title: 'Olvidar clave de IA',
    message: 'Se elimina la clave cifrada y la IA vuelve a estar desactivada. Las auditorías no se modifican.',
    confirmLabel: 'Olvidar clave',
    danger: true,
  });
  if (!ok) return;
  try {
    await window.api.ai.forget();
    aiForm.apiKey = '';
    await refreshAi();
    toast.success('Clave olvidada e IA desactivada');
  } catch (e) {
    toast.error('No se pudo olvidar la clave', e instanceof Error ? e.message : undefined);
  }
}

async function clearHistory(): Promise<void> {
  const ok = await confirmAction({
    title: 'Vaciar historial',
    message: 'Se eliminarán auditorías, hallazgos, historial de revisión y análisis de IA. Los proyectos registrados se conservan. Esta acción no se puede deshacer.',
    confirmLabel: 'Vaciar historial',
    danger: true,
  });
  if (!ok) return;
  clearing.value = true;
  try {
    await window.api.system.clearHistory();
    await window.api.system.dashboard();
    toast.success('Historial vaciado', 'Los proyectos registrados se conservan.');
  } catch (e) {
    toast.error('No se pudo vaciar el historial', e instanceof Error ? e.message : undefined);
  } finally {
    clearing.value = false;
  }
}

onMounted(async () => {
  try {
    info.value = await window.api.system.appInfo();
    db.value = await window.api.system.dbHealth();
    await refreshAi();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la información';
  }
});
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); align-items: start; }
.info-list { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.info-list dt { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.info-list dd { margin: 2px 0 0; font-size: 12px; }
.data-dir { margin-top: var(--space-4); padding: var(--space-3); background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 3px; }
.data-dir .faint { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.data-dir .mono { font-size: 11px; overflow-wrap: anywhere; }
.health-row { display: flex; align-items: center; gap: 8px; margin-top: var(--space-3); }
.row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.ai-status { display: flex; align-items: center; gap: 7px; margin-bottom: var(--space-3); font-size: 12px; color: var(--text-dim); }
.ai-status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); }
.ai-status .dot.local { background: var(--accent); }
.ai-status .dot.external { background: var(--warn); }
.check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--text-dim); margin-top: var(--space-2); }
.check input { margin-top: 2px; }
.privacy { margin: 0; padding-left: 18px; color: var(--text-dim); font-size: 12px; display: flex; flex-direction: column; gap: 5px; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>
