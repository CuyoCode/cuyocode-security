<template>
  <div>
    <h1>Auditorías</h1>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="audits.length === 0" class="empty">
      Sin auditorías. Creá una desde el asistente.
      <br /><br />
      <router-link to="/wizard"><button class="primary">Nueva auditoría</button></router-link>
    </div>
    <div v-else class="panel">
      <table>
        <thead><tr><th>Inicio</th><th>Objetivo</th><th>Perfil</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in audits" :key="a.id">
            <td class="mono">{{ shortDate(a.startedAt) }}</td>
            <td class="mono">{{ a.target }}</td>
            <td>{{ a.profile }}</td>
            <td><span class="badge" :class="cls(a.status)">{{ a.status }}</span></td>
            <td class="row">
              <router-link :to="'/findings?audit=' + a.id"><button>Hallazgos</button></router-link>
              <router-link :to="'/reports?audit=' + a.id"><button>Informe</button></router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="audits.length >= 2" class="panel">
      <h2>Comparar auditorías</h2>
      <label>Base</label>
      <select v-model="baseId"><option v-for="a in audits" :key="a.id" :value="a.id">{{ a.profile }} · {{ a.target }} · {{ shortDate(a.startedAt) }}</option></select>
      <label>Otra</label>
      <select v-model="otherId"><option v-for="a in audits" :key="a.id" :value="a.id">{{ a.profile }} · {{ a.target }} · {{ shortDate(a.startedAt) }}</option></select>
      <p><button class="primary" :disabled="!baseId || !otherId || comparing" @click="compare">Comparar</button></p>
      <div v-if="cmp">
        <p>Nuevos en la otra: {{ cmp.onlyOther.length }} · Resueltos respecto a base: {{ cmp.onlyBase.length }} · Persistentes: {{ cmp.bothCount }}</p>
        <h3>Nuevos</h3>
        <ul><li v-for="f in cmp.onlyOther" :key="f.id">[{{ f.severity }}] {{ f.title }}</li></ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuditsView',
  data() {
    return { audits: [], error: '', baseId: '', otherId: '', cmp: null, comparing: false };
  },
  async mounted() {
    try {
      this.audits = await window.api.audits.list();
      if (this.audits.length >= 2) {
        this.baseId = this.audits[1].id;
        this.otherId = this.audits[0].id;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo listar';
    }
  },
  methods: {
    cls(s) {
      if (s === 'done') return 'ok';
      if (s === 'failed') return 'bad';
      if (s === 'cancelled') return 'missing';
      return 'warn';
    },
    shortDate(iso) {
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
    async compare() {
      this.error = '';
      this.comparing = true;
      try {
        this.cmp = await window.api.audits.compare(this.baseId, this.otherId);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo comparar';
      } finally {
        this.comparing = false;
      }
    },
  },
};
</script>

<style scoped>
h1 { margin: 0 0 16px; font-size: 20px; }
h2, h3 { font-size: 15px; }
.row { display: flex; gap: 6px; }
</style>
