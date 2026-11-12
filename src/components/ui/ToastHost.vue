<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div v-for="item in toasts" :key="item.id" class="toast" :class="item.kind" role="status">
          <AppIcon :name="iconFor(item.kind)" :size="17" class="toast-icon" />
          <div class="toast-body">
            <strong>{{ item.title }}</strong>
            <p v-if="item.detail">{{ item.detail }}</p>
          </div>
          <button class="close" aria-label="Cerrar notificación" @click="dismiss(item.id)">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { useToast, type ToastKind } from '../../composables/useToast';

const { toasts, dismiss } = useToast();

function iconFor(kind: ToastKind): string {
  if (kind === 'success') return 'check';
  if (kind === 'error') return 'alert';
  if (kind === 'warning') return 'warning';
  return 'info';
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
  max-width: 380px;
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 12px 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  box-shadow: var(--shadow-2);
}
.toast.success { border-left-color: var(--ok); }
.toast.error { border-left-color: var(--danger); }
.toast.warning { border-left-color: var(--warn); }
.toast-icon { color: var(--accent); flex-shrink: 0; margin-top: 1px; }
.toast.success .toast-icon { color: var(--ok); }
.toast.error .toast-icon { color: var(--danger); }
.toast.warning .toast-icon { color: var(--warn); }
.toast-body { min-width: 0; flex: 1; }
.toast-body strong { font-size: 13px; }
.toast-body p { margin: 3px 0 0; color: var(--text-dim); font-size: 12px; overflow-wrap: anywhere; }
.close {
  background: transparent;
  border: none;
  color: var(--text-faint);
  padding: 2px;
  border-radius: 4px;
}
.close:hover { color: var(--text); background: var(--bg-hover); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
