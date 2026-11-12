<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @mousedown.self="closeOnBackdrop && close()">
        <div
          ref="dialog"
          class="modal"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          @keydown.esc.prevent="close"
        >
          <header class="modal-head">
            <div>
              <h2>{{ title }}</h2>
              <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
            </div>
            <button class="close" aria-label="Cerrar" @click="close">
              <AppIcon name="close" :size="16" />
            </button>
          </header>
          <div class="modal-body"><slot /></div>
          <footer v-if="$slots.actions" class="modal-actions"><slot name="actions" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = withDefaults(
  defineProps<{ open: boolean; title: string; subtitle?: string; closeOnBackdrop?: boolean }>(),
  { subtitle: '', closeOnBackdrop: true },
);
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);

function close(): void {
  emit('close');
}

watch(
  () => props.open,
  async (value) => {
    if (value) {
      await nextTick();
      dialog.value?.focus();
    }
  },
);
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: grid;
  place-items: center;
  padding: var(--space-5);
  z-index: 900;
}
.modal {
  width: min(560px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  outline: none;
}
.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-5) 0;
}
.modal-head h2 { font-size: 18px; }
.subtitle { margin: 4px 0 0; color: var(--text-dim); font-size: 12px; }
.close {
  background: transparent;
  border: none;
  color: var(--text-faint);
  padding: 4px;
  border-radius: 6px;
}
.close:hover { color: var(--text); background: var(--bg-hover); }
.modal-body { padding: var(--space-4) var(--space-5); }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: 0 var(--space-5) var(--space-5);
}
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: translateY(6px) scale(0.99); }
</style>
