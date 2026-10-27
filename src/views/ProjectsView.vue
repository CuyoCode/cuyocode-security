<template>
  <div>
    <h1>Proyectos</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel">
      <h2>Registrar objetivo</h2>
      <label for="p-name">Nombre</label>
      <input id="p-name" v-model="form.name" maxlength="80" placeholder="Ej. sistema-podo-back" />
      <label for="p-kind">Tipo</label>
      <select id="p-kind" v-model="form.kind">
        <option value="folder">Carpeta local</option>
        <option value="url">URL autorizada</option>
        <option value="server">Servidor (SSH, Fase 5)</option>
      </select>
      <label for="p-target">Objetivo</label>
      <div class="target-row">
        <input
          id="p-target"
          v-model="form.target"
          :placeholder="targetHint"
        />
        <button v-if="form.kind === 'folder'" @click="browse">Examinar…</button>
      </div>
      <p class="hint">{{ targetHelp }}</p>
      <button class="primary" :disabled="saving" @click="create">
        {{ saving ? 'Guardando…' : 'Registrar' }}
      </button>
    </div>
    <div class="panel">
      <h2>Registrados ({{ projects.length }})</h2>
      <div v-if="projects.length === 0" class="empty">
        Sin proyectos. La herramienta también puede auditar sin registro permanente (Fase 2).
      </div>
      <table v-else>
        <thead>
          <tr><th>Nombre</th><th>Tipo</th><th>Objetivo</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td>{{ p.name }}</td>
            <td><span class="badge">{{ p.kind }}</span></td>
            <td class="mono">{{ p.target }}</td>
            <td><button class="danger" @click="remove(p.id)">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { useAppStore } from '../stores/app';

export default {
  name: 'ProjectsView',
  data() {
    return {
      form: { name: '', kind: 'folder', target: '' },
      saving: false,
      error: '',
    };
  },
  computed: {
    ...mapState(useAppStore, ['projects']),
    targetHint() {
      if (this.form.kind === 'folder') return 'C:\\ruta\\al\\proyecto';
      if (this.form.kind === 'url') return 'https://app.ejemplo.com';
      return 'host o host:puerto';
    },
    targetHelp() {
      if (this.form.kind === 'folder') return 'Ruta absoluta a una carpeta existente. No se ejecuta su código.';
      if (this.form.kind === 'url') return 'Solo URLs http(s) expresamente autorizadas, sin credenciales.';
      return 'El acceso SSH por solo-lectura se implementa en Fase 5; el registro solo guarda el objetivo.';
    },
  },
  async mounted() {
    await this.reload();
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
    async reload() {
      this.error = '';
      try {
        await useAppStore().refreshProjects();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al listar proyectos';
      }
    },
    async create() {
      this.error = '';
      this.saving = true;
      try {
        await window.api.projects.create({ ...this.form });
        this.form.name = '';
        this.form.target = '';
        await this.reload();
        await useAppStore().refreshDashboard();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo registrar';
      } finally {
        this.saving = false;
      }
    },
    async remove(id) {
      this.error = '';
      try {
        await window.api.projects.remove(id);
        await this.reload();
        await useAppStore().refreshDashboard();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo eliminar';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { margin: 0 0 8px; font-size: 15px; }
.hint { color: var(--text-dim); font-size: 12px; }
.target-row { display: flex; gap: 8px; }
.target-row button { white-space: nowrap; }
</style>
