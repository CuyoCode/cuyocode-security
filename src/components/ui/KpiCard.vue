<template>
  <div class="kpi" :class="`tone-${tone}`">
    <div class="kpi-top">
      <span class="kpi-label">{{ label }}</span>
      <span class="kpi-icon"><AppIcon :name="icon ?? 'activity'" :size="16" /></span>
    </div>
    <div class="kpi-value">{{ value }}</div>
    <div class="kpi-foot">
      <slot><span class="kpi-hint">{{ hint }}</span></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    icon?: string;
    tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'neutral';
  }>(),
  { icon: 'activity', tone: 'neutral', hint: '' },
);
</script>

<style scoped>
.kpi {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-4);
  min-width: 0;
}
.kpi-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.kpi-label { color: var(--text-dim); font-size: 12px; font-weight: 550; }
.kpi-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--text-dim);
}
.kpi-value { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; margin: 10px 0 6px; }
.kpi-hint { color: var(--text-faint); font-size: 12px; }
.tone-accent .kpi-icon { color: var(--accent); }
.tone-ok .kpi-icon { color: var(--ok); }
.tone-warn .kpi-icon { color: var(--warn); }
.tone-danger .kpi-icon { color: var(--danger); }
</style>
