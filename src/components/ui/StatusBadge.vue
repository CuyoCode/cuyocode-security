<template>
  <span class="status" :class="tone">
    <span class="dot" aria-hidden="true"></span>{{ text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { auditStatusLabel, findingStatusLabel } from '../../lib/labels';

const props = withDefaults(
  defineProps<{ status: string; kind?: 'audit' | 'finding' | 'tool' }>(),
  { kind: 'audit' },
);

const text = computed(() => {
  if (props.kind === 'finding') return findingStatusLabel(props.status);
  if (props.kind === 'tool') return props.status === 'detected' ? 'Detectada' : 'No detectada';
  return auditStatusLabel(props.status);
});

const tone = computed(() => {
  const s = props.status;
  if (['done', 'reviewed', 'resolved', 'detected'].includes(s)) return 'ok';
  if (['failed', 'false-positive'].includes(s)) return 'bad';
  if (['running', 'queued', 'accepted-risk'].includes(s)) return 'warn';
  return 'neutral';
});
</script>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.02);
  white-space: nowrap;
}
.dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, var(--border)); }
.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, var(--border)); }
.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, var(--border)); }
</style>
