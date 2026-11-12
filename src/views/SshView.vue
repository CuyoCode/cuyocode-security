<template>
  <div>
    <PageHeader
      eyebrow="Entorno"
      title="Servidores SSH"
      subtitle="Inspección de solo lectura con operaciones permitidas y host key fijada manualmente."
    />

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <div class="grid">
      <PanelCard title="Registrar perfil" subtitle="Autenticación por clave o ssh-agent. Nunca se piden contraseñas.">
        <FormField label="Nombre" field-id="ssh-name" required>
          <input id="ssh-name" v-model="form.name" placeholder="Servidor de producción" />
        </FormField>
        <div class="form-row">
          <FormField label="Host" field-id="ssh-host" required>
            <input id="ssh-host" v-model="form.host" placeholder="servidor.ejemplo.com" />
          </FormField>
          <FormField label="Puerto" field-id="ssh-port" required>
            <input id="ssh-port" v-model.number="form.port" type="number" min="1" max="65535" />
          </FormField>
        </div>
        <FormField label="Usuario" field-id="ssh-user" required>
          <input id="ssh-user" v-model="form.user" placeholder="auditor" />
        </FormField>
        <FormField label="Ruta de clave privada (opcional, absoluta)" field-id="ssh-key" hint="La clave nunca se lee ni se guarda: solo se usa la ruta.">
          <input id="ssh-key" v-model="form.keyPath" placeholder="C:\Users\yo\.ssh\audit_ed25519" />
        </FormField>
        <BaseButton variant="primary" icon="plus" :loading="creating" @click="create">Registrar perfil</BaseButton>
      </PanelCard>

      <PanelCard title="Buenas prácticas" subtitle="El perfil queda atado al host y a operaciones versionadas.">
        <ul class="tips">
          <li><AppIcon name="lock" :size="14" /> Usá una cuenta dedicada de privilegios mínimos.</li>
          <li><AppIcon name="key" :size="14" /> Verificá la huella del servidor por un canal confiable antes de fijarla.</li>
          <li><AppIcon name="info" :size="14" /> Sin host key fijada, OpenSSH rechaza la conexión: es intencional.</li>
        </ul>
      </PanelCard>
    </div>

    <PanelCard :title="`Perfiles (${profiles.length})`" subtitle="Cada operación se ejecuta con timeout y salida redactada">
      <EmptyState
        v-if="profiles.length === 0"
        icon="server"
        title="Sin perfiles SSH"
        description="Registrá un servidor autorizado para inspeccionar configuración, firewall, servicios y accesos."
      />
      <div v-else class="profiles">
        <article v-for="p in profiles" :key="p.id" class="profile">
          <header class="profile-head">
            <div>
              <strong>{{ p.name }}</strong>
              <span class="mono target">{{ p.user }}@{{ p.host }}:{{ p.port }}</span>
            </div>
            <div class="profile-actions">
              <span class="badge">ops v{{ p.opsVersion }}</span>
              <BaseButton size="sm" @click="fetchKey(p)">Obtener host key</BaseButton>
              <BaseButton size="sm" variant="danger" @click="remove(p)">Eliminar</BaseButton>
            </div>
          </header>

          <div v-if="keys[p.id]" class="keys">
            <p class="hint">Verificá la huella por un canal confiable y fijá una sola línea.</p>
            <ul>
              <li v-for="(k, i) in keys[p.id]" :key="i">
                <span class="mono keyline">{{ k }}</span>
                <BaseButton size="sm" @click="pin(p.id, k)">Fijar</BaseButton>
              </li>
            </ul>
          </div>

          <div class="exec-row">
            <select v-model="ops[p.id]" :aria-label="`Operación para ${p.name}`">
              <option v-for="op in SSH_OPS" :key="op" :value="op">{{ sshOpLabel(op) }}</option>
            </select>
            <BaseButton :loading="Boolean(running[p.id])" icon="play" @click="exec(p)">Ejecutar inspección</BaseButton>
          </div>
          <CodeBlock v-if="outputs[p.id]" :code="outputs[p.id] ?? ''" label="salida SSH" />
        </article>
      </div>
    </PanelCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { SshProfileDto } from '@shared/ipc-contracts/ai-lab-ssh.contracts';
import { SSH_OPS } from '@shared/ipc-contracts/ai-lab-ssh.contracts';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import FormField from '../components/ui/FormField.vue';
import CodeBlock from '../components/ui/CodeBlock.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { toast } from '../composables/useToast';
import { confirmAction } from '../composables/useConfirm';
import { sshOpLabel } from '../lib/labels';

const profiles = ref<SshProfileDto[]>([]);
const error = ref('');
const creating = ref(false);
const keys = reactive<Record<string, string[]>>({});
const ops = reactive<Record<string, string>>({});
const outputs = reactive<Record<string, string>>({});
const running = reactive<Record<string, boolean>>({});
const form = reactive({ name: '', host: '', port: 22, user: '', keyPath: '' });

async function reload(): Promise<void> {
  try {
    profiles.value = await window.api.ssh.list();
    for (const p of profiles.value) {
      if (!ops[p.id]) ops[p.id] = 'sys.uname';
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron listar los perfiles';
  }
}

async function create(): Promise<void> {
  creating.value = true;
  error.value = '';
  try {
    await window.api.ssh.create({ ...form, port: Number(form.port) });
    form.name = '';
    form.host = '';
    form.port = 22;
    form.user = '';
    form.keyPath = '';
    await reload();
    toast.success('Perfil SSH registrado');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo registrar el perfil';
  } finally {
    creating.value = false;
  }
}

async function remove(profile: SshProfileDto): Promise<void> {
  const ok = await confirmAction({
    title: 'Eliminar perfil SSH',
    message: `Se eliminará el perfil "${profile.name}" y su archivo known_hosts dedicado. No se modifica el servidor.`,
    confirmLabel: 'Eliminar perfil',
    danger: true,
  });
  if (!ok) return;
  try {
    await window.api.ssh.remove(profile.id);
    await reload();
    toast.success('Perfil eliminado');
  } catch (e) {
    toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined);
  }
}

async function fetchKey(profile: SshProfileDto): Promise<void> {
  try {
    const r = await window.api.ssh.fetchKey(profile.id);
    keys[profile.id] = r.keys.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    toast.error('No se pudo obtener la host key', e instanceof Error ? e.message : undefined);
  }
}

async function pin(profileId: string, line: string): Promise<void> {
  try {
    await window.api.ssh.pinKey(profileId, line);
    keys[profileId] = [];
    toast.success('Host key fijada', 'Las próximas conexiones validarán esa huella.');
  } catch (e) {
    toast.error('No se pudo fijar la host key', e instanceof Error ? e.message : undefined);
  }
}

async function exec(profile: SshProfileDto): Promise<void> {
  const op = ops[profile.id] ?? 'sys.uname';
  running[profile.id] = true;
  outputs[profile.id] = '';
  try {
    const r = await window.api.ssh.exec(profile.id, op);
    outputs[profile.id] = r.stdout || '(sin salida)';
    if (r.timedOut) toast.warning('La operación agotó el tiempo de espera');
  } catch (e) {
    toast.error('Falló la inspección', e instanceof Error ? e.message : undefined);
  } finally {
    running[profile.id] = false;
  }
}

onMounted(reload);
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--space-3); align-items: start; }
.form-row { display: grid; grid-template-columns: 1fr 110px; gap: var(--space-2); }
.tips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; color: var(--text-dim); font-size: 12px; }
.tips li { display: flex; gap: 8px; align-items: flex-start; }
.tips :deep(svg) { color: var(--accent); flex-shrink: 0; margin-top: 1px; }
.profiles { display: flex; flex-direction: column; }
.profile { padding: var(--space-4) 0; border-top: 1px solid var(--border); }
.profile:first-child { border-top: none; padding-top: 0; }
.profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.profile-head strong { display: block; font-size: 14px; }
.target { color: var(--text-dim); font-size: 11px; }
.profile-actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.keys { margin-top: var(--space-3); padding: var(--space-3); background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.keys ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.keys li { display: flex; align-items: center; gap: 8px; }
.keyline { font-size: 10px; word-break: break-all; flex: 1; }
.exec-row { display: flex; gap: var(--space-2); margin: var(--space-3) 0; }
.exec-row select { max-width: 320px; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } .exec-row { flex-wrap: wrap; } }
</style>
