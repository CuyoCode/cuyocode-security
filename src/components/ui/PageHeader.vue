<template>
  <header class="page-header">
    <div class="titles">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>();
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.titles { min-width: 0; }
.eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
h1 { font-size: 26px; }
.subtitle {
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: 13px;
  max-width: 70ch;
}
.actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
</style>
