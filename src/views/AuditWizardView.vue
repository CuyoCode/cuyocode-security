<template>
  <div>
    <h1>Nueva auditoría</h1>
    <div class="steps">
      <span v-for="s in 6" :key="s" :class="{ active: step === s, done: step > s }">{{ s }}</span>
    </div>
    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="step === 1" class="panel">
      <h2>1. Objetivo</h2>
      <label>Tipo</label>
      <select v-model="form.kind">
        <option value="folder">Carpeta local</option>
        <option value="url">URL autorizada</option>
        <option value="server">Servidor</option>
      </select>
      <label>Objetivo {{ kindHint }}</label>
      <div class="target-row">
        <input v-model="form.target" :placeholder="kindPlaceholder" />
        <button v-if="form.kind === 'folder'" @click="browse">Examinar…</button>
      </div>
      <label>Proyecto (opcional)</label>
      <select v-model="form.projectId">
        <option :value="null">Sin proyecto permanente</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }} ({{ p.kind }})</option>
      </select>
    </div>

    <div v-if="step === 2" class="panel">
      <h2>2. Perfil de auditoría</h2>
      <div
        v-for="p in profiles"
        :key="p.id"
        class="profile"
        :class="{ selected: form.profileId === p.id }"
        @click="form.profileId = p.id"
      >
        <strong>{{ p.title }}</strong>
        <p>{{ p.description }}</p>
        <span v-if="p.destructive" class="badge warn">Destructivo potencial</span>
        <span v-if="p.requiresLab" class="badge warn">Exige laboratorio</span>
      </div>
    </div>

    <div v-if="step === 3" class="panel">
      <h2>3. Alcance y permisos</h2>
      <p><strong>Objetivo:</strong> <span class="mono">{{ form.target }}</span></p>
      <p><strong>Perfil:</strong> {{ profileTitle }} — motores: <span class="mono">{{ profileEngines }}</span></p>
      <label class="check">
        <input type="checkbox" v-model="form.allowPrivate" />
        Autorizo destinos en red privada/local (solo laboratorio o red propia)
      </label>
      <div v-if="needsSsh">
        <label>Perfil SSH (solo lectura)</label>
        <select v-model="form.sshProfileId">
          <option :value="null">Seleccionar…</option>
          <option v-for="s in sshProfiles" :key="s.id" :value="s.id">{{ s.name }} ({{ s.user }}@{{ s.host }}:{{ s.port }})</option>
        </select>
        <p class="hint">Gestionar en <router-link to="/ssh">Servidores SSH</router-link>.</p>
      </div>
      <div v-if="needsLab">
        <label>ID de laboratorio verificado (node-… o Docker)</label>
        <input v-model="form.labId" placeholder="node-01" />
        <button @click="checkLab">Verificar aislamiento</button>
        <p v-if="labCheck" class="hint">{{ labCheck }}</p>
      </div>
    </div>

    <div v-if="step === 4" class="panel">
      <h2>4. Análisis asistido por IA (opcional)</h2>
      <label><input type="radio" value="off" v-model="form.aiMode" /> Desactivada (determinista)</label>
      <label><input type="radio" value="local" v-model="form.aiMode" /> Local (Ollama)</label>
      <label><input type="radio" value="external" v-model="form.aiMode" /> API externa (con consentimiento)</label>
      <div v-if="form.aiMode === 'external'" class="consent">
        <p class="hint">
          Se enviarán: resumen de hallazgos y hasta 12 fragmentos redactados.
          Nunca: .env, claves, historial git ni secretos. La clave vive solo en
          memoria de esta sesión.
        </p>
        <p class="hint">Configurá el proveedor en <router-link to="/settings">Ajustes → IA</router-link> antes de continuar.</p>
        <label class="check">
          <input type="checkbox" v-model="aiConsentGiven" />
          Autorizo el envío descrito al proveedor configurado
        </label>
      </div>
    </div>

    <div v-if="step === 5" class="panel">
      <h2>5. Resumen y confirmación</h2>
      <table>
        <tbody>
          <tr><th>Objetivo</th><td class="mono">{{ form.target }} ({{ form.kind }})</td></tr>
          <tr><th>Perfil</th><td>{{ profileTitle }}</td></tr>
          <tr><th>Red privada</th><td>{{ form.allowPrivate ? 'Autorizada' : 'Bloqueada' }}</td></tr>
          <tr><th>IA</th><td>{{ form.aiMode }}</td></tr>
        </tbody>
      </table>
      <p class="hint">
        Las pruebas remotas solo consultan el objetivo declarado. Ningún checkbox
        habilita pruebas destructivas: el perfil laboratorio es el único que las
        admite y exige aislamiento verificado.
      </p>
    </div>

    <div v-if="step === 6" class="panel">
      <h2>6. Resultado</h2>
      <p v-if="startedId">Auditoría iniciada: <span class="mono">{{ startedId }}</span></p>
      <router-link v-if="startedId" :to="'/run/' + startedId"><button class="primary">Ver ejecución</button></router-link>
    </div>

    <div class="nav-row">
      <button v-if="step > 1 && step < 6" @click="step -= 1">Atrás</button>
      <button v-if="step < 5" class="primary" :disabled="!canNext" @click="next">Siguiente</button>
      <button v-if="step === 5" class="primary" :disabled="starting" @click="start">
        {{ starting ? 'Iniciando…' : 'Confirmar e iniciar' }}
      </button>
    </div>
  </div>
</template>

<script>
const PROFILES = [
  { id: 'local-code', title: 'Código local (estático)', description: 'Repositorio local. No ejecuta código ni requiere red ni IA.', engines: 'recon, secrets-builtin, deps-npm-audit, patterns-builtin', destructive: false, requiresLab: false, kinds: ['folder'] },
  { id: 'web-passive', title: 'Web pasiva', description: 'Cabeceras, TLS y cookies sin fuzzing.', engines: 'http-passive, tls-check, cookies-review', destructive: false, requiresLab: false, kinds: ['url'] },
  { id: 'web-active', title: 'Web activa controlada', description: 'ZAP baseline + Nuclei con límites. Sin métodos mutantes en producción.', engines: 'http-passive, tls-check, cookies-review, zap-baseline, nuclei-selected', destructive: false, requiresLab: false, kinds: ['url'] },
  { id: 'server-readonly', title: 'Servidor solo-lectura', description: 'Puertos externos + SSH con comandos permitidos. No modifica.', engines: 'ports-tcp, tls-check, ssh-readonly', destructive: false, requiresLab: false, kinds: ['server'] },
  { id: 'lab-advanced', title: 'Laboratorio avanzado', description: 'Pruebas profundas solo en laboratorio aislado verificado.', engines: 'zap-full, nuclei-selected, ports-tcp…', destructive: true, requiresLab: true, kinds: ['url', 'server'] },
];

export default {
  name: 'AuditWizardView',
  data() {
    return {
      step: 1,
      error: '',
      starting: false,
      startedId: '',
      labCheck: '',
      aiConsentGiven: false,
      profiles: PROFILES,
      projects: [],
      sshProfiles: [],
      form: {
        kind: 'folder',
        target: '',
        projectId: null,
        profileId: 'local-code',
        allowPrivate: false,
        sshProfileId: null,
        labId: '',
        aiMode: 'off',
      },
    };
  },
  computed: {
    profile() {
      return this.profiles.find((p) => p.id === this.form.profileId) || this.profiles[0];
    },
    profileTitle() {
      return this.profile.title;
    },
    profileEngines() {
      return this.profile.engines;
    },
    needsSsh() {
      return this.form.profileId === 'server-readonly';
    },
    needsLab() {
      return this.profile.requiresLab;
    },
    kindHint() {
      if (this.form.kind === 'folder') return '(ruta absoluta)';
      if (this.form.kind === 'url') return '(https://… autorizada)';
      return '(host o host:puerto)';
    },
    kindPlaceholder() {
      if (this.form.kind === 'folder') return 'C:\\ruta\\al\\proyecto';
      if (this.form.kind === 'url') return 'https://app.ejemplo.com';
      return 'servidor.ejemplo.com:22';
    },
    canNext() {
      if (this.step === 1) return this.form.target.trim().length > 0;
      if (this.step === 3) {
        if (this.needsSsh && !this.form.sshProfileId) return false;
        if (this.needsLab && !this.form.labId.trim()) return false;
        return true;
      }
      if (this.step === 4 && this.form.aiMode === 'external' && !this.aiConsentGiven) return false;
      return true;
    },
  },
  async mounted() {
    try {
      this.projects = await window.api.projects.list();
      this.sshProfiles = await window.api.ssh.list();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al cargar';
    }
  },
  methods: {
    async browse() {
      this.error = '';
      try {
        const r = await window.api.system.pickFolder();
        if (r.folder) this.form.target = r.folder;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo abrir el selector';
      }
    },
    next() {
      this.error = '';
      if (this.step === 1) {
        const match = this.profiles.find((p) => p.kinds.includes(this.form.kind));
        if (match) this.form.profileId = match.id;
      }
      this.step += 1;
    },
    async checkLab() {
      this.error = '';
      this.labCheck = 'Verificando…';
      try {
        const r = await window.api.lab.check(this.form.labId.trim(), this.form.target.trim());
        this.labCheck = r.ok ? `Aislamiento OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
      } catch (e) {
        this.labCheck = e instanceof Error ? e.message : 'Error al verificar';
      }
    },
    async start() {
      this.error = '';
      this.starting = true;
      try {
        const r = await window.api.audits.start({
          projectId: this.form.projectId,
          target: this.form.target.trim(),
          kind: this.form.kind,
          profileId: this.form.profileId,
          aiMode: this.form.aiMode,
          aiConsent: this.form.aiMode === 'external'
            ? { provider: 'external', model: 'configurado', scope: this.form.target.trim() }
            : null,
          allowPrivate: this.form.allowPrivate,
          labId: this.needsLab ? this.form.labId.trim() : undefined,
          sshProfileId: this.needsSsh ? this.form.sshProfileId : undefined,
        });
        this.startedId = r.auditId;
        this.step = 6;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo iniciar';
      } finally {
        this.starting = false;
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { margin: 0 0 8px; font-size: 15px; }
.steps { display: flex; gap: 8px; margin-bottom: 16px; }
.steps span {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--border); display: flex;
  align-items: center; justify-content: center; color: var(--text-dim);
}
.steps span.active { border-color: var(--accent); color: var(--accent); }
.steps span.done { border-color: var(--ok); color: var(--ok); }
.profile { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; margin-bottom: 8px; cursor: pointer; }
.profile.selected { border-color: var(--accent); }
.profile p { margin: 4px 0; color: var(--text-dim); font-size: 12px; }
.check { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; }
.check input { width: auto; margin-top: 3px; }
.hint { color: var(--text-dim); font-size: 12px; }
.consent { border: 1px solid var(--warn); border-radius: var(--radius); padding: 10px 12px; margin-top: 10px; }
.nav-row { display: flex; gap: 8px; margin-top: 12px; }
.target-row { display: flex; gap: 8px; }
.target-row button { white-space: nowrap; }
</style>
