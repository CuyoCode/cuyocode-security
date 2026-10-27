<template>
  <div>
    <h1>Herramientas externas</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel summary">
      <span v-if="toolsLoaded"><strong>{{ detectedCount }} de {{ tools.length }}</strong> integradas.</span>
      <span v-else>Comprobando…</span>
      <button class="primary" :disabled="checking" @click="check">
        {{ checking ? 'Comprobando…' : 'Volver a comprobar' }}
      </button>
    </div>
    <div class="panel">
      <p class="hint">
        La app nunca instala nada por su cuenta. Para cada herramienta ausente
        tenés la web oficial y, cuando existe, el comando <span class="mono">winget</span>
        para instalarla vos. Después de instalar, volvé a comprobar.
      </p>
      <table v-if="toolsLoaded">
        <thead>
          <tr><th>Herramienta</th><th>Estado</th><th>Versión</th><th>Instalar</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tools" :key="t.id">
            <td>{{ t.name }}<span v-if="t.required" class="badge warn">base</span></td>
            <td>
              <span v-if="t.detected" class="badge ok">integrada</span>
              <span v-else class="badge missing">ausente</span>
            </td>
            <td class="mono">{{ t.version ?? '—' }}</td>
            <td>
              <span v-if="t.detected" class="hint">{{ t.path }}</span>
              <span v-else class="install-cell">
                <button @click="openPage(t)">Web oficial</button>
                <code v-if="t.installCommand" class="mono cmd" @click="copyCmd(t)" :title="'Clic para copiar'">{{ t.installCommand }}</code>
                <span v-else class="hint">{{ t.hint }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Comprobando herramientas…</div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { useAppStore } from '../stores/app';

export default {
  name: 'ToolsView',
  data() {
    return { checking: false, error: '' };
  },
  computed: {
    ...mapState(useAppStore, ['tools', 'toolsLoaded']),
    detectedCount() {
      return this.tools.filter((t) => t.detected).length;
    },
  },
  async mounted() {
    if (!this.toolsLoaded) await this.check();
  },
  methods: {
    async check() {
      this.error = '';
      this.checking = true;
      try {
        await useAppStore().refreshTools();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo comprobar';
      } finally {
        this.checking = false;
      }
    },
    async openPage(t) {
      this.error = '';
      try {
        await window.api.system.openInstallPage(t.installUrl);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo abrir la web';
      }
    },
    async copyCmd(t) {
      this.error = '';
      try {
        await navigator.clipboard.writeText(t.installCommand);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo copiar';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
.hint { color: var(--text-dim); font-size: 12px; }
.badge { margin-left: 8px; }
.summary { display: flex; gap: 12px; align-items: center; }
.install-cell { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cmd { cursor: pointer; background: var(--bg-panel); padding: 4px 8px; border-radius: var(--radius); border: 1px dashed var(--border); }
.cmd:hover { border-color: var(--accent); }
</style>
