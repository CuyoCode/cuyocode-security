<template>
  <section class="card">
    <header v-if="title || $slots.header || $slots.actions" class="card-head">
      <div>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
        <slot name="header" />
      </div>
      <div v-if="$slots.actions" class="actions"><slot name="actions" /></div>
    </header>
    <div class="card-body"><slot /></div>
    <footer v-if="$slots.footer" class="card-foot"><slot name="footer" /></footer>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>();
</script>

<style scoped>
.card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space-4);
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) 0;
}
.card-head h2 { font-size: 15px; }
.subtitle { margin: 4px 0 0; color: var(--text-dim); font-size: 12px; }
.actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
.card-body { padding: var(--space-4); }
.card-foot {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
}
</style>
