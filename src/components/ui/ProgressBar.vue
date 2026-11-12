<template>
  <div
    class="progress"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div class="fill" :style="{ width: clamped + '%' }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ value: number; max?: number; label?: string }>(), {
  max: 100,
  label: 'Progreso',
});

const clamped = computed(() => {
  if (!Number.isFinite(props.value) || props.max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((props.value / props.max) * 100)));
});
</script>

<style scoped>
.progress {
  height: 8px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}
</style>
