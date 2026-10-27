<template>
  <div>
    <h1>Laboratorio</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel">
      <h2>Docker</h2>
      <p v-if="docker">
        Binario: {{ docker.binary ? 'sí' : 'no' }} · Daemon: {{ docker.daemon ? 'sí' : 'no' }} ·
        Versión: <span class="mono">{{ docker.version || '—' }}</span>
      </p>
      <p v-else class="hint">Comprobando…</p>
      <p v-if="docker && (!docker.binary || !docker.daemon)" class="hint">
        Sin Docker no hay laboratorio Docker: las pruebas avanzadas con imágenes
        quedan bloqueadas. Alternativa sin Docker: el Laboratorio Node de abajo.
      </p>
    </div>
    <div class="panel">
      <h2>Laboratorio Node (sin Docker)</h2>
      <p class="hint">
        App vulnerable propia en Node puro, solo loopback, solo datos sintéticos.
        Sin RCE a propósito. Aislamiento más débil que Docker: no usar datos reales.
      </p>
      <label>ID (forma node-nombre)</label><input v-model="nodeForm.id" placeholder="node-01" />
      <label>Puerto local (127.0.0.1)</label><input v-model.number="nodeForm.port" type="number" />
      <p><button class="primary" @click="nodeCreate">Crear y arrancar</button></p>
      <div v-if="nodeLabs.length > 0">
        <table>
          <thead><tr><th>ID</th><th>Objetivo</th><th>PID</th><th></th></tr></thead>
          <tbody>
            <tr v-for="l in nodeLabs" :key="l.id">
              <td class="mono">{{ l.id }}</td>
              <td class="mono">{{ l.target }}</td>
              <td class="mono">{{ l.pid }}</td>
              <td class="row">
                <button @click="nodeCheck(l)">Verificar</button>
                <button class="danger" @click="nodeStop(l.id)">Detener</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="nodeCheckText" class="hint">{{ nodeCheckText }}</p>
      </div>
      <div v-else class="empty">Sin laboratorios node en ejecución.</div>
    </div>
    <div class="panel">
      <h2>Crear laboratorio</h2>
      <p class="hint">Red Docker dedicada interna, límites de CPU/memoria, sin credenciales reales. Usá imágenes educativas con versión fija (p. ej. bkimminich/juice-shop:v17.4.0).</p>
      <label>ID (a-z, 0-9, guiones)</label><input v-model="form.id" placeholder="lab-01" />
      <label>Imagen con versión</label><input v-model="form.image" placeholder="bkimminich/juice-shop:v17.4.0" />
      <label>Puerto local (127.0.0.1)</label><input v-model.number="form.port" type="number" />
      <p><button class="primary" :disabled="!canCreate" @click="create">Crear y arrancar</button></p>
    </div>
    <div class="panel">
      <h2>Estado</h2>
      <label>ID</label><input v-model="statusId" placeholder="lab-01" />
      <p>
        <button @click="status">Consultar</button>
        <button @click="check">Verificar aislamiento</button>
        <button class="danger" @click="remove">Eliminar (solo recursos del lab)</button>
      </p>
      <p v-if="statusText" class="mono">{{ statusText }}</p>
      <p v-if="checkText" class="hint">{{ checkText }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LabView',
  data() {
    return {
      docker: null,
      error: '',
      form: { id: '', image: '', port: 3001 },
      nodeForm: { id: 'node-01', port: 3101 },
      nodeLabs: [],
      nodeCheckText: '',
      statusId: '',
      statusText: '',
      checkText: '',
    };
  },
  computed: {
    canCreate() {
      return this.docker && this.docker.daemon && this.form.id && this.form.image;
    },
  },
  async mounted() {
    try {
      this.docker = await window.api.lab.docker();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo comprobar Docker';
    }
    await this.nodeRefresh();
  },
  methods: {
    async create() {
      this.error = '';
      try {
        await window.api.lab.create({ id: this.form.id.trim(), image: this.form.image.trim(), port: Number(this.form.port) });
        this.statusId = this.form.id.trim();
        await this.status();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo crear';
      }
    },
    async status() {
      this.error = '';
      this.statusText = '';
      try {
        const s = await window.api.lab.status(this.statusId.trim());
        this.statusText = s ? JSON.stringify(s) : 'Inexistente o detenido';
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo consultar';
      }
    },
    async check() {
      this.error = '';
      this.checkText = '';
      try {
        const r = await window.api.lab.check(this.statusId.trim(), `http://127.0.0.1:${this.form.port}/`);
        this.checkText = r.ok ? `OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo verificar';
      }
    },
    async remove() {
      this.error = '';
      try {
        await window.api.lab.remove(this.statusId.trim());
        this.statusText = 'Eliminado';
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo eliminar';
      }
    },
    async nodeRefresh() {
      try {
        this.nodeLabs = await window.api.lab.nodeList();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo listar labs node';
      }
    },
    async nodeCreate() {
      this.error = '';
      try {
        await window.api.lab.nodeCreate({ id: this.nodeForm.id.trim(), port: Number(this.nodeForm.port) });
        await this.nodeRefresh();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo crear';
      }
    },
    async nodeStop(id) {
      this.error = '';
      try {
        await window.api.lab.nodeStop(id);
        await this.nodeRefresh();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo detener';
      }
    },
    async nodeCheck(l) {
      this.error = '';
      this.nodeCheckText = '';
      try {
        const r = await window.api.lab.check(l.id, l.target);
        this.nodeCheckText = r.ok ? `OK: ${r.reasons.join('; ')}` : `BLOQUEADO: ${r.reasons.join('; ')}`;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo verificar';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { font-size: 15px; }
.hint { color: var(--text-dim); font-size: 12px; }
</style>
