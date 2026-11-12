<template>
  <div class="code-block">
    <pre><code>{{ code }}</code></pre>
    <button class="copy" :aria-label="'Copiar ' + (label || 'contenido')" @click="copy">
      <AppIcon name="copy" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { toast } from '../../composables/useToast';

withDefaults(defineProps<{ code: string; label?: string }>(), { label: '' });

async function copy(event: MouseEvent): Promise<void> {
  const host = (event.currentTarget as HTMLElement).closest('.code-block');
  const text = host?.querySelector('code')?.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  } catch {
    toast.error('No se pudo copiar');
  }
}
</script>

<style scoped>
.code-block { position: relative; }
pre {
  margin: 0;
  padding: 12px 40px 12px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: auto;
  max-height: 260px;
}
code { background: none; border: none; padding: 0; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.copy {
  position: absolute;
  top: 7px;
  right: 7px;
  padding: 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
.copy:hover { color: var(--text); }
</style>
