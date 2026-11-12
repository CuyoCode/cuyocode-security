<template>
  <div class="fallback">
    <div class="card">
      <div class="brand">
        <span class="brand-logo"><img :src="logo" alt="CuyoCode" /></span>
        <span class="brand-text"><strong>CuyoCode</strong><small>Security</small></span>
      </div>
      <h1>Esta vista necesita la app de escritorio</h1>
      <p>
        La interfaz usa el puente seguro de Electron para acceder a los datos locales.
        Si abriste esta URL en un navegador, volvé a la ventana de
        <strong>CuyoCode Security</strong>.
      </p>
      <p class="hint">
        Si ya estás dentro de Electron, reiniciá la app y revisá
        <span class="mono">logs\app.log</span> en la carpeta de datos.
      </p>
      <div class="actions">
        <button class="primary" @click="reload">Reintentar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import logo from '../assets/brand/simbolo-color.png';

function reload(): void {
  window.location.reload();
}
</script>

<style scoped>
.fallback {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: var(--space-5);
  background: var(--bg);
}
.card {
  width: min(480px, 100%);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-4); }
.brand-logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 4px;
  border-radius: 8px;
  background: #f2f6f9;
}
.brand-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-text strong { font-size: 14px; }
.brand-text small { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; }
h1 { font-size: 20px; margin-bottom: var(--space-3); }
p { color: var(--text-dim); font-size: 13px; }
.hint { font-size: 12px; color: var(--text-faint); }
.actions { margin-top: var(--space-4); }
</style>
