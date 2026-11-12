<template>
  <div>
    <PageHeader
      eyebrow="Asistente"
      title="Nueva auditoría"
      subtitle="Definí el objetivo, el perfil y el alcance. Nada se ejecuta hasta la confirmación final."
    >
      <template #actions>
        <BaseButton variant="ghost" icon="history" @click="router.push('/audits')">Historial</BaseButton>
      </template>
    </PageHeader>

    <div v-if="error" class="error-box" role="alert">{{ error }}</div>

    <ol class="stepper" aria-label="Pasos del asistente">
      <li v-for="(s, i) in steps" :key="s.title" :class="{ active: step === i + 1, done: step > i + 1 }">
        <span class="num"><AppIcon v-if="step > i + 1" name="check" :size="13" /><template v-else>{{ i + 1 }}</template></span>
        <span class="step-label">{{ s.title }}</span>
      </li>
    </ol>

    <PanelCard v-if="step === 1" title="1. Objetivo" subtitle="El alcance se limita al objetivo declarado">
      <div class="two-fields">
        <FormField label="Tipo de objetivo" field-id="w-kind">
          <select id="w-kind" v-model="form.kind" @change="onKindChange">
            <option value="folder">Carpeta local</option>
            <option value="url">URL autorizada</option>
            <option value="server">Servidor</option>
          </select>
        </FormField>
        <FormField label="Proyecto (opcional)" field-id="w-project">
          <select id="w-project" v-model="form.projectId">
            <option :value="null">Sin proyecto permanente</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }} ({{ kindLabel(p.kind) }})</option>
          </select>
        </FormField>
      </div>
      <FormField label="Objetivo" field-id="w-target" required :hint="kindHint" :error="targetError">
        <div class="target-row">
          <input id="w-target" v-model="form.target" :placeholder="kindPlaceholder" @blur="touchedTarget = true" />
          <BaseButton v-if="form.kind === 'folder'" icon="folder" @click="browse">Examinar…</BaseButton>
        </div>
      </FormField>
    </PanelCard>

    <PanelCard v-if="step === 2" title="2. Perfil de auditoría" subtitle="Determina motores, límites y si requiere laboratorio">
      <div class="profiles">
        <button
          v-for="p in profiles"
          :key="p.id"
          class="profile"
          :class="{ selected: form.profileId === p.id, disabled: !p.targetKinds.includes(form.kind) }"
          :disabled="!p.targetKinds.includes(form.kind)"
          @click="selectProfile(p.id)"
        >
          <span class="profile-top">
            <strong>{{ p.title }}</strong>
            <span v-if="form.profileId === p.id" class="badge ok">seleccionado</span>
          </span>
          <span class="profile-desc">{{ p.description }}</span>
          <span class="engines">
            <span v-for="e in p.engines" :key="e" class="chip">{{ engineLabel(e) }}</span>
          </span>
          <span v-if="p.requiresLab" class="profile-warn"><AppIcon name="flask" :size="12" /> Exige laboratorio verificado</span>
        </button>
      </div>
      <p v-if="availableProfiles.length === 0" class="hint">No hay perfiles para este tipo de objetivo.</p>
    </PanelCard>

    <PanelCard v-if="step === 3" title="3. Alcance y permisos" subtitle="Confirmá exactamente qué se va a inspeccionar">
      <dl class="summary-list">
        <div><dt>Objetivo</dt><dd class="mono">{{ form.target || '—' }}</dd></div>
        <div><dt>Perfil</dt><dd>{{ profileTitle }}</dd></div>
        <div><dt>Motores</dt><dd>{{ profileEngines }}</dd></div>
      </dl>

      <label class="check">
        <input type="checkbox" v-model="form.allowPrivate" />
        <span>Autorizo destinos en red privada/local (solo laboratorio o red propia).</span>
      </label>

      <div v-if="needsSsh" class="sub-block">
        <FormField label="Perfil SSH (solo lectura)" field-id="w-ssh" required>
          <select id="w-ssh" v-model="form.sshProfileId">
            <option :value="null">Seleccionar…</option>
            <option v-for="s in sshProfiles" :key="s.id" :value="s.id">{{ s.name }} ({{ s.user }}@{{ s.host }}:{{ s.port }})</option>
          </select>
        </FormField>
        <p class="hint">Gestioná perfiles en <RouterLink to="/ssh">Servidores SSH</RouterLink>.</p>
      </div>

      <div v-if="needsLab" class="sub-block">
        <FormField label="Laboratorio en ejecución" field-id="w-lab-select">
          <select id="w-lab-select" v-model="selectedNodeLab" @change="useNodeLab">
            <option value="">Elegir laboratorio Node…</option>
            <option v-for="l in nodeLabs" :key="l.id" :value="l.id">{{ l.id }} · {{ l.target }}</option>
          </select>
        </FormField>
        <FormField label="ID de laboratorio verificado" field-id="w-lab" hint="Forma node-nombre o ID Docker.">
          <input id="w-lab" v-model="form.labId" placeholder="node-demo" @input="labVerified = false" />
        </FormField>
        <div class="verify-row">
          <BaseButton :loading="checkingLab" icon="check" @click="checkLab">Verificar aislamiento</BaseButton>
          <span v-if="labCheck" class="lab-check" :class="{ ok: labVerified }">{{ labCheck }}</span>
        </div>
      </div>
    </PanelCard>

    <PanelCard v-if="step === 4" title="4. Análisis asistido por IA" subtitle="Opcional. La IA interpreta; nunca ejecuta ni cambia el alcance">
      <div class="ai-options">
        <label class="radio-card" :class="{ selected: form.aiMode === 'off' }">
          <input v-model="form.aiMode" type="radio" value="off" />
          <span><strong>Desactivada</strong><small>Análisis determinista, sin envíos externos.</small></span>
        </label>
        <label class="radio-card" :class="{ selected: form.aiMode === 'local' }">
          <input v-model="form.aiMode" type="radio" value="local" />
          <span><strong>Local (Ollama)</strong><small>Modelo en tu equipo; no sale información.</small></span>
        </label>
        <label class="radio-card" :class="{ selected: form.aiMode === 'external' }">
          <input v-model="form.aiMode" type="radio" value="external" />
          <span><strong>API externa</strong><small>Requiere consentimiento explícito por auditoría.</small></span>
        </label>
      </div>
      <div v-if="form.aiMode === 'external'" class="consent">
        <p class="hint">
          Se enviarán el resumen de hallazgos y hasta 12 fragmentos redactados. Nunca .env, claves,
          historial git ni secretos. El proveedor se configura en <RouterLink to="/settings">Ajustes → IA</RouterLink>.
        </p>
        <p v-if="ai && !ai.hasKey" class="consent-warning">
          No hay una API key configurada. La revisión IA se omitirá al finalizar; los hallazgos deterministas no se ven afectados.
        </p>
        <label class="check">
          <input v-model="aiConsentGiven" type="checkbox" />
          <span>Autorizo el envío descrito al proveedor configurado para esta auditoría.</span>
        </label>
      </div>
    </PanelCard>

    <PanelCard v-if="step === 5" title="5. Resumen y confirmación" subtitle="Revisá el alcance antes de ejecutar">
      <dl class="summary-list">
        <div><dt>Objetivo</dt><dd class="mono">{{ form.target }} ({{ kindLabel(form.kind) }})</dd></div>
        <div><dt>Proyecto</dt><dd>{{ projectName }}</dd></div>
        <div><dt>Perfil</dt><dd>{{ profileTitle }}</dd></div>
        <div><dt>Red privada</dt><dd>{{ form.allowPrivate ? 'Autorizada' : 'Bloqueada' }}</dd></div>
        <div><dt>Laboratorio</dt><dd>{{ needsLab ? (form.labId || '—') : 'No requerido' }}</dd></div>
        <div><dt>IA</dt><dd>{{ aiModeLabel(form.aiMode) }}</dd></div>
      </dl>
      <div class="notice">
        <AppIcon name="lock" :size="16" />
        <span>Las pruebas remotas solo consultan el objetivo declarado. El perfil de laboratorio es el único que admite métodos potencialmente destructivos y exige aislamiento verificado.</span>
      </div>
    </PanelCard>

    <PanelCard v-if="step === 6" title="6. Auditoría iniciada" subtitle="El progreso se actualiza en vivo">
      <div class="result">
        <div class="result-icon"><AppIcon name="check" :size="22" /></div>
        <div>
          <strong>Corrida creada</strong>
          <p class="mono">{{ startedId }}</p>
          <p class="hint">Podés seguir el progreso y cancelar desde la pantalla de ejecución.</p>
        </div>
      </div>
      <div class="nav-row">
        <BaseButton variant="primary" icon="activity" @click="router.push(`/run/${startedId}`)">Ver ejecución</BaseButton>
        <BaseButton icon="alert" @click="router.push(`/findings?audit=${startedId}`)">Ver hallazgos</BaseButton>
      </div>
    </PanelCard>

    <div v-if="step < 6" class="wizard-nav">
      <BaseButton v-if="step > 1" variant="ghost" @click="step -= 1">Atrás</BaseButton>
      <span class="spacer"></span>
      <BaseButton v-if="step < 5" variant="primary" :disabled="!canNext" icon="arrow" @click="next">Siguiente</BaseButton>
      <BaseButton v-if="step === 5" variant="primary" :loading="starting" :disabled="!canStart" icon="play" @click="start">
        Confirmar e iniciar
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Project } from '@shared/ipc-contracts/project.contracts';
import type { SshProfileDto } from '@shared/ipc-contracts/ai-lab-ssh.contracts';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PanelCard from '../components/ui/PanelCard.vue';
import FormField from '../components/ui/FormField.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { toast } from '../composables/useToast';
import { aiModeLabel, engineLabel, kindLabel } from '../lib/labels';

interface ProfileOption {
  id: string;
  title: string;
  description: string;
  engines: string[];
  targetKinds: Array<'folder' | 'url' | 'server'>;
  requiresLab: boolean;
}

interface NodeLab {
  id: string;
  port: number;
  target: string;
}

const steps = [
  { title: 'Objetivo' },
  { title: 'Perfil' },
  { title: 'Alcance' },
  { title: 'IA' },
  { title: 'Resumen' },
  { title: 'Inicio' },
];

const PROFILES: ProfileOption[] = [
  {
    id: 'local-code',
    title: 'Código local',
    description: 'Análisis estático del repositorio: recon, secretos, dependencias y patrones JS/NestJS/Vue. No ejecuta el código del objetivo.',
    engines: ['recon', 'secrets-builtin', 'deps-npm-audit', 'patterns-builtin'],
    targetKinds: ['folder'],
    requiresLab: false,
  },
  {
    id: 'local-code-deep',
    title: 'Código local profundo',
    description: 'Como Código local, más adaptadores opcionales Gitleaks, Semgrep y Trivy. Si no están instalados, se omiten con motivo visible.',
    engines: ['recon', 'secrets-builtin', 'deps-npm-audit', 'patterns-builtin', 'gitleaks', 'semgrep', 'trivy'],
    targetKinds: ['folder'],
    requiresLab: false,
  },
  {
    id: 'web-passive',
    title: 'Web pasiva',
    description: 'Cabeceras, TLS y cookies sin fuzzing ni explotación. No envía formularios ni credenciales.',
    engines: ['http-passive', 'tls-check', 'cookies-review'],
    targetKinds: ['url'],
    requiresLab: false,
  },
  {
    id: 'web-active',
    title: 'Web activa controlada',
    description: 'ZAP baseline y Nuclei seleccionado con límites. Sin métodos mutantes en producción.',
    engines: ['http-passive', 'tls-check', 'cookies-review', 'zap-baseline', 'nuclei-selected'],
    targetKinds: ['url'],
    requiresLab: false,
  },
  {
    id: 'server-readonly',
    title: 'Servidor solo-lectura',
    description: 'Puertos externos, Nmap opcional y SSH con operaciones permitidas versionadas. No modifica el servidor.',
    engines: ['ports-tcp', 'nmap', 'ssh-readonly'],
    targetKinds: ['server'],
    requiresLab: false,
  },
  {
    id: 'lab-advanced',
    title: 'Laboratorio avanzado',
    description: 'Pruebas profundas solo contra un laboratorio aislado verificado. Bloqueado si el aislamiento no se confirma.',
    engines: ['http-passive', 'tls-check', 'cookies-review', 'zap-full', 'nuclei-selected', 'ports-tcp'],
    targetKinds: ['url', 'server'],
    requiresLab: true,
  },
];

const router = useRouter();
const profiles = PROFILES;
const step = ref(1);
const error = ref('');
const starting = ref(false);
const startedId = ref('');
const labCheck = ref('');
const labVerified = ref(false);
const checkingLab = ref(false);
const aiConsentGiven = ref(false);
const touchedTarget = ref(false);
const projects = ref<Project[]>([]);
const sshProfiles = ref<SshProfileDto[]>([]);
const nodeLabs = ref<NodeLab[]>([]);
const selectedNodeLab = ref('');
const ai = ref<{ mode: string; hasKey: boolean; externalEndpoint: string | null } | null>(null);
const form = reactive({
  kind: 'folder' as 'folder' | 'url' | 'server',
  target: '',
  projectId: null as string | null,
  profileId: 'local-code',
  allowPrivate: false,
  sshProfileId: null as string | null,
  labId: '',
  aiMode: 'off' as 'off' | 'local' | 'external',
});

const profile = computed(() => PROFILES.find((p) => p.id === form.profileId) ?? PROFILES[0]!);
const profileTitle = computed(() => profile.value.title);
const profileEngines = computed(() => profile.value.engines.map((e) => engineLabel(e)).join(', '));
const availableProfiles = computed(() => PROFILES.filter((p) => p.targetKinds.includes(form.kind)));
const needsSsh = computed(() => profile.value.engines.includes('ssh-readonly'));
const needsLab = computed(() => profile.value.requiresLab);
const projectName = computed(() => projects.value.find((p) => p.id === form.projectId)?.name ?? 'Sin proyecto');
const targetError = computed(() =>
  touchedTarget.value && form.target.trim().length === 0 ? 'Ingresá el objetivo de la auditoría.' : '',
);
const kindHint = computed(() => {
  if (form.kind === 'folder') return 'Ruta absoluta a una carpeta existente. No se ejecuta su código.';
  if (form.kind === 'url') return 'URL http(s) autorizada, sin credenciales.';
  return 'Host o host:puerto del servidor autorizado.';
});
const kindPlaceholder = computed(() => {
  if (form.kind === 'folder') return 'C:\\ruta\\al\\proyecto';
  if (form.kind === 'url') return 'https://app.ejemplo.com';
  return 'servidor.ejemplo.com:22';
});
const canNext = computed(() => {
  if (step.value === 1) return form.target.trim().length > 0;
  if (step.value === 2) return availableProfiles.value.some((p) => p.id === form.profileId);
  if (step.value === 3) {
    if (needsSsh.value && !form.sshProfileId) return false;
    if (needsLab.value && (!form.labId.trim() || !labVerified.value)) return false;
    return true;
  }
  if (step.value === 4 && form.aiMode === 'external' && !aiConsentGiven.value) return false;
  return true;
});
const canStart = computed(() => form.target.trim().length > 0 && !targetError.value);

watch(
  () => form.kind,
  () => {
    if (!availableProfiles.value.some((p) => p.id === form.profileId)) {
      form.profileId = availableProfiles.value[0]?.id ?? '';
    }
    labVerified.value = false;
    labCheck.value = '';
  },
);

watch(
  () => form.profileId,
  () => {
    labVerified.value = false;
    labCheck.value = '';
  },
);

function onKindChange(): void {
  touchedTarget.value = false;
}

function selectProfile(id: string): void {
  form.profileId = id;
}

async function browse(): Promise<void> {
  try {
    const r = await window.api.system.pickFolder();
    if (r.folder) form.target = r.folder;
  } catch (e) {
    toast.error('No se pudo abrir el selector', e instanceof Error ? e.message : undefined);
  }
}

function next(): void {
  if (!canNext.value) return;
  error.value = '';
  step.value += 1;
}

function useNodeLab(): void {
  const lab = nodeLabs.value.find((l) => l.id === selectedNodeLab.value);
  if (!lab) return;
  form.labId = lab.id;
  form.kind = 'url';
  form.target = lab.target;
  form.allowPrivate = true;
  labVerified.value = false;
  labCheck.value = '';
}

async function checkLab(): Promise<void> {
  checkingLab.value = true;
  labCheck.value = 'Verificando…';
  try {
    const r = await window.api.lab.check(form.labId.trim(), form.target.trim());
    labVerified.value = r.ok;
    labCheck.value = r.ok ? `Aislamiento OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
  } catch (e) {
    labVerified.value = false;
    labCheck.value = e instanceof Error ? e.message : 'Error al verificar';
  } finally {
    checkingLab.value = false;
  }
}

async function start(): Promise<void> {
  starting.value = true;
  error.value = '';
  try {
    const r = await window.api.audits.start({
      projectId: form.projectId,
      target: form.target.trim(),
      kind: form.kind,
      profileId: form.profileId,
      aiMode: form.aiMode,
      aiConsent:
        form.aiMode === 'external'
          ? { provider: 'external', model: 'configurado', scope: form.target.trim() }
          : null,
      allowPrivate: form.allowPrivate,
      labId: needsLab.value ? form.labId.trim() : undefined,
      sshProfileId: needsSsh.value ? (form.sshProfileId ?? undefined) : undefined,
    });
    startedId.value = r.auditId;
    step.value = 6;
    toast.success('Auditoría iniciada');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo iniciar la auditoría';
  } finally {
    starting.value = false;
  }
}

onMounted(async () => {
  try {
    const [projectList, sshList, labs, aiStatus] = await Promise.all([
      window.api.projects.list(),
      window.api.ssh.list(),
      window.api.lab.nodeList(),
      window.api.ai.status(),
    ]);
    projects.value = projectList;
    sshProfiles.value = sshList;
    nodeLabs.value = labs;
    ai.value = aiStatus;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los datos del asistente';
  }
});
</script>

<style scoped>
.stepper { list-style: none; display: flex; gap: var(--space-2); margin: 0 0 var(--space-4); padding: 0; flex-wrap: wrap; }
.stepper li { display: flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-soft); color: var(--text-faint); font-size: 11px; }
.stepper li.active { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }
.stepper li.done { border-color: color-mix(in srgb, var(--ok) 40%, var(--border)); color: var(--ok); }
.num { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--bg-elevated); font-size: 10px; font-weight: 700; }
.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.target-row { display: flex; gap: var(--space-2); }
.target-row button { white-space: nowrap; }
.profiles { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.profile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  padding: 13px 14px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  white-space: normal;
}
.profile:hover:not(:disabled) { border-color: var(--border-strong); }
.profile.selected { border-color: var(--accent); background: var(--accent-soft); }
.profile.disabled { opacity: 0.45; }
.profile-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.profile-desc { color: var(--text-dim); font-size: 12px; }
.engines { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-faint); font-size: 10px; }
.profile-warn { display: inline-flex; align-items: center; gap: 4px; color: var(--warn); font-size: 11px; }
.summary-list { margin: 0 0 var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.summary-list dt { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.summary-list dd { margin: 2px 0 0; font-size: 13px; overflow-wrap: anywhere; }
.check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--text-dim); margin: var(--space-3) 0; }
.check input { margin-top: 2px; }
.sub-block { margin-top: var(--space-3); padding: var(--space-3); background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.verify-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.lab-check { font-size: 12px; color: var(--warn); }
.lab-check.ok { color: var(--ok); }
.ai-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.radio-card { display: flex; gap: 8px; align-items: flex-start; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-soft); cursor: pointer; margin: 0; }
.radio-card.selected { border-color: var(--accent); background: var(--accent-soft); }
.radio-card input { margin-top: 2px; }
.radio-card span { display: flex; flex-direction: column; gap: 2px; }
.radio-card strong { font-size: 12px; color: var(--text); }
.radio-card small { color: var(--text-faint); font-size: 11px; line-height: 1.35; }
.consent { margin-top: var(--space-3); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--warn) 40%, var(--border)); background: var(--warn-soft); border-radius: var(--radius-sm); }
.consent-warning { margin: 0 0 var(--space-2); color: var(--warn); font-size: 12px; }
.notice { display: flex; gap: 8px; align-items: flex-start; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-dim); font-size: 12px; }
.notice :deep(svg) { color: var(--accent); flex-shrink: 0; margin-top: 1px; }
.wizard-nav { display: flex; align-items: center; gap: var(--space-2); }
.spacer { flex: 1; }
.result { display: flex; gap: var(--space-3); align-items: flex-start; }
.result-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--ok-soft); color: var(--ok); flex-shrink: 0; }
.result strong { font-size: 14px; }
.result p { margin: 3px 0 0; font-size: 12px; }
.nav-row { display: flex; gap: var(--space-2); margin-top: var(--space-4); }
@media (max-width: 1000px) {
  .profiles, .ai-options, .two-fields, .summary-list { grid-template-columns: 1fr; }
}
</style>
