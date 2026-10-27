<template>
  <div>
    <h1>Ajustes</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="info" class="panel">
      <h2>Aplicación</h2>
      <table>
        <tbody>
          <tr><th>Versión</th><td class="mono">{{ info.version }}</td></tr>
          <tr><th>Electron</th><td class="mono">{{ info.electron }}</td></tr>
          <tr><th>Node (empaquetado)</th><td class="mono">{{ info.node }}</td></tr>
          <tr><th>Chromium</th><td class="mono">{{ info.chrome }}</td></tr>
          <tr><th>Plataforma</th><td class="mono">{{ info.platform }}</td></tr>
          <tr><th>Carpeta de datos</th><td class="mono">{{ info.dataDir }}</td></tr>
          <tr v-if="db"><th>Base local</th><td class="mono">{{ db.path }} (esquema v{{ db.userVersion }})</td></tr>
        </tbody>
      </table>
      <p><button @click="openDir">Abrir carpeta de datos</button></p>
    </div>
    <div class="panel">
      <h2>Proveedor de IA</h2>
      <p v-if="ai" class="hint">
        Modo: {{ ai.mode }} · Ollama: {{ ai.ollamaModel || '—' }} ({{ ai.ollamaOk === null ? '?' : ai.ollamaOk ? 'OK' : 'no' }}) ·
        Externa: {{ ai.externalEndpoint || '—' }} · Clave en memoria: {{ ai.hasKey ? 'sí' : 'no' }}
      </p>
      <label>Modo</label>
      <select v-model="aiForm.mode">
        <option value="off">Desactivada</option>
        <option value="local">Local (Ollama)</option>
        <option value="external">API externa (con consentimiento por auditoría)</option>
      </select>
      <div v-if="aiForm.mode === 'local'">
        <label>Modelo Ollama</label>
        <input v-model="aiForm.ollamaModel" placeholder="llama3.1" />
      </div>
      <div v-if="aiForm.mode === 'external'">
        <label>Endpoint https (compatible OpenAI)</label>
        <input v-model="aiForm.endpoint" placeholder="https://api.proveedor.com/v1" />
        <label>Modelo</label>
        <input v-model="aiForm.model" />
        <label>API key (solo memoria de sesión)</label>
        <input v-model="aiForm.apiKey" type="password" autocomplete="off" placeholder="Vacío = conservar la guardada" />
        <label class="check">
          <input type="checkbox" v-model="aiForm.remember" />
          Recordar clave cifrada en este equipo (DPAPI)
        </label>
      </div>
      <p class="row">
        <button class="primary" @click="saveAi">Guardar</button>
        <button @click="testAi">Probar conexión</button>
        <button class="danger" @click="forgetAi">Olvidar clave y desactivar</button>
      </p>
      <p v-if="aiMsg" class="hint">{{ aiMsg }}</p>
    </div>
    <div class="panel">
      <h2>Privacidad</h2>
      <p class="hint">
        Sin telemetría ni envíos externos. La IA está desactivada por defecto.
        Los secretos nunca se guardan en texto plano ni se registran en logs.
      </p>
      <button class="danger" :disabled="clearing" @click="clear">
        {{ clearing ? 'Borrando…' : 'Vaciar historial de auditorías' }}
      </button>
      <p v-if="cleared" class="hint">Historial vaciado. Los proyectos registrados se conservan.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SettingsView',
  data() {
    return {
      info: null,
      db: null,
      error: '',
      clearing: false,
      cleared: false,
      ai: null,
      aiMsg: '',
      aiForm: { mode: 'off', ollamaModel: 'llama3.1', endpoint: '', model: '', apiKey: '', remember: true },
    };
  },
  async mounted() {
    try {
      this.info = await window.api.system.appInfo();
      this.db = await window.api.system.dbHealth();
      await this.refreshAi();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo cargar la información';
    }
  },
  methods: {
    async refreshAi() {
      this.ai = await window.api.ai.status();
      this.aiForm.mode = this.ai.mode;
      if (this.ai.ollamaModel) this.aiForm.ollamaModel = this.ai.ollamaModel;
      if (this.ai.externalEndpoint) this.aiForm.endpoint = this.ai.externalEndpoint;
    },
    async openDir() {
      this.error = '';
      try {
        await window.api.system.openDataDir();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo abrir la carpeta';
      }
    },
    async clear() {
      this.error = '';
      this.cleared = false;
      this.clearing = true;
      try {
        await window.api.system.clearHistory();
        this.cleared = true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo vaciar el historial';
      } finally {
        this.clearing = false;
      }
    },
    async saveAi() {
      this.error = '';
      this.aiMsg = '';
      try {
        const input = { mode: this.aiForm.mode };
        if (this.aiForm.mode === 'local') input.ollamaModel = this.aiForm.ollamaModel;
        if (this.aiForm.mode === 'external') {
          input.endpoint = this.aiForm.endpoint;
          input.model = this.aiForm.model;
          input.apiKey = this.aiForm.apiKey;
          input.remember = this.aiForm.remember;
        }
        await window.api.ai.configure(input);
        this.aiForm.apiKey = '';
        await this.refreshAi();
        this.aiMsg = 'Configuración guardada (la clave queda cifrada con el almacén del SO).';
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo guardar';
      }
    },
    async testAi() {
      this.aiMsg = 'Probando…';
      try {
        const r = await window.api.ai.test();
        this.aiMsg = r.ok ? `OK: ${r.detail}` : `Fallo: ${r.detail}`;
        await this.refreshAi();
      } catch (e) {
        this.aiMsg = e instanceof Error ? e.message : 'Error al probar';
      }
    },
    async forgetAi() {
      await window.api.ai.forget();
      this.aiForm.apiKey = '';
      await this.refreshAi();
      this.aiMsg = 'Clave olvidada, IA desactivada.';
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { margin: 0 0 8px; font-size: 15px; }
.hint { color: var(--text-dim); font-size: 12px; }
.row { display: flex; gap: 8px; }
.check { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; font-size: 13px; }
.check input { width: auto; margin-top: 3px; }
</style>
