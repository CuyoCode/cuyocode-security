<template>
  <div class="empty-state">
    <div class="icon"><AppIcon :name="icon ?? 'spark'" :size="24" /></div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="action"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), {
  description: '',
  icon: 'spark',
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
}
.icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: var(--space-3);
}
h3 { color: var(--text); font-size: 15px; margin: 0 0 4px; }
p { margin: 0; font-size: 13px; max-width: 46ch; }
.action { margin-top: var(--space-4); display: flex; gap: var(--space-2); }
</style>
