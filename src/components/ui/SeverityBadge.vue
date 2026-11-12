<template>
  <span class="sev" :class="`sev-${severity}`">
    <span class="dot" aria-hidden="true"></span>{{ severityLabel(severity) }}
  </span>
</template>

<script setup lang="ts">
import { severityLabel } from '../../lib/labels';

defineProps<{ severity: string }>();
</script>

<style scoped>
.sev {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  border: 1px solid;
  white-space: nowrap;
}
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.sev-critical { color: var(--sev-critical); border-color: color-mix(in srgb, var(--sev-critical) 40%, var(--border)); }
.sev-high { color: var(--sev-high); border-color: color-mix(in srgb, var(--sev-high) 40%, var(--border)); }
.sev-medium { color: var(--sev-medium); border-color: color-mix(in srgb, var(--sev-medium) 40%, var(--border)); }
.sev-low { color: var(--sev-low); border-color: color-mix(in srgb, var(--sev-low) 40%, var(--border)); }
.sev-info { color: var(--sev-info); border-color: color-mix(in srgb, var(--sev-info) 40%, var(--border)); }
</style>
