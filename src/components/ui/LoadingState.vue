<template>
  <div class="loading" role="status" aria-live="polite">
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Cargando…' });
</script>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: var(--space-6);
  color: var(--text-dim);
  font-size: 13px;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
