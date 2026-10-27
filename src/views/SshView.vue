<template>
  <div>
    <h1>Servidores SSH</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="panel">
      <h2>Registrar perfil (solo lectura)</h2>
      <p class="hint">Autenticación por clave o ssh-agent. Sin contraseñas: nunca se piden ni se guardan.</p>
      <label>Nombre</label><input v-model="form.name" placeholder="VPS Contabo" />
      <label>Host</label><input v-model="form.host" placeholder="servidor.ejemplo.com" />
      <label>Puerto</label><input v-model.number="form.port" type="number" />
      <label>Usuario</label><input v-model="form.user" placeholder="auditor" />
      <label>Ruta de clave privada (opcional, absoluta)</label><input v-model="form.keyPath" placeholder="C:\Users\yo\.ssh\audit_ed25519" />
      <p><button class="primary" @click="create">Registrar</button></p>
    </div>
    <div class="panel">
      <h2>Perfiles ({{ profiles.length }})</h2>
      <div v-if="profiles.length === 0" class="empty">Sin perfiles SSH.</div>
      <div v-for="p in profiles" :key="p.id" class="profile">
        <strong>{{ p.name }}</strong> <span class="mono">{{ p.user }}@{{ p.host }}:{{ p.port }}</span>
        <span class="badge">ops v{{ p.opsVersion }}</span>
        <div class="row">
          <button @click="fetchKey(p)">1. Obtener clave del servidor</button>
          <button class="danger" @click="remove(p.id)">Eliminar</button>
        </div>
        <div v-if="keys[p.id]">
          <p class="hint">Verificá la huella por un canal confiable y fijá UNA línea:</p>
          <ul>
            <li v-for="(k, i) in keys[p.id]" :key="i" class="mono keyline">
              {{ k }} <button @click="pin(p.id, k)">Fijar</button>
            </li>
          </ul>
        </div>
        <div class="row">
          <select v-model="ops[p.id]">
            <option v-for="op in allowedOps" :key="op" :value="op">{{ op }}</option>
          </select>
          <button @click="exec(p)">Ejecutar inspección</button>
        </div>
        <pre v-if="outputs[p.id]" class="output">{{ outputs[p.id] }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
const OPS = ['sys.uname', 'net.sockets', 'fw.ufw', 'fw.iptables', 'ssh.config', 'svc.enabled', 'pkg.updates', 'docker.ps', 'proxy.nginx', 'certs.live', 'perms.shadow', 'users.login', 'logs.auth'];

export default {
  name: 'SshView',
  data() {
    return {
      profiles: [],
      error: '',
      form: { name: '', host: '', port: 22, user: '', keyPath: '' },
      keys: {},
      ops: {},
      outputs: {},
      allowedOps: OPS,
    };
  },
  async mounted() {
    await this.reload();
  },
  methods: {
    async reload() {
      this.error = '';
      try {
        this.profiles = await window.api.ssh.list();
        for (const p of this.profiles) {
          if (!this.ops[p.id]) this.ops[p.id] = 'sys.uname';
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo listar';
      }
    },
    async create() {
      this.error = '';
      try {
        await window.api.ssh.create({ ...this.form, port: Number(this.form.port) });
        this.form = { name: '', host: '', port: 22, user: '', keyPath: '' };
        await this.reload();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo registrar';
      }
    },
    async remove(id) {
      this.error = '';
      try {
        await window.api.ssh.remove(id);
        await this.reload();
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo eliminar';
      }
    },
    async fetchKey(p) {
      this.error = '';
      try {
        const r = await window.api.ssh.fetchKey(p.id);
        this.keys[p.id] = r.keys.split('\n').map((l) => l.trim()).filter(Boolean);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo obtener la clave';
      }
    },
    async pin(profileId, line) {
      this.error = '';
      try {
        await window.api.ssh.pinKey(profileId, line);
        this.keys[profileId] = [];
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo fijar';
      }
    },
    async exec(p) {
      this.error = '';
      this.outputs[p.id] = 'Ejecutando…';
      try {
        const r = await window.api.ssh.exec(p.id, this.ops[p.id]);
        this.outputs[p.id] = r.stdout || '(sin salida)';
      } catch (e) {
        this.outputs[p.id] = '';
        this.error = e instanceof Error ? e.message : 'Falló la inspección';
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2 { font-size: 15px; }
.hint { color: var(--text-dim); font-size: 12px; }
.profile { border-top: 1px solid var(--border); padding: 12px 0; }
.row { display: flex; gap: 8px; margin: 8px 0; }
.row select { width: auto; }
.keyline { font-size: 11px; word-break: break-all; }
.output { background: #0a0e14; padding: 10px; border-radius: var(--radius); max-height: 300px; overflow: auto; font-size: 12px; white-space: pre-wrap; }
</style>
