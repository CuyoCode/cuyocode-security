<template>
  <button
    :type="type"
    :class="['btn', `btn-${variant}`, `btn-${size}`, { block, loading }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="spinner" aria-hidden="true"></span>
    <AppIcon v-else-if="icon" :name="icon" :size="size === 'sm' ? 14 : 16" />
    <span class="label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    icon?: string;
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
    type?: 'button' | 'submit';
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', icon: '', loading: false, disabled: false, block: false },
);

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-md { padding: 8px 14px; }
.block { width: 100%; }
.btn-secondary { background: var(--bg-elevated); }
.btn-ghost { background: transparent; border-color: transparent; color: var(--text-dim); }
.btn-ghost:hover:not(:disabled) { color: var(--text); background: var(--bg-hover); border-color: var(--border); }
.btn-danger { background: transparent; border-color: color-mix(in srgb, var(--danger) 55%, var(--border)); color: var(--danger); }
.btn-danger:hover:not(:disabled) { background: var(--danger-soft); }
.label { display: inline-flex; align-items: center; gap: 6px; }
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
