<template>
  <AppModal :open="state.open" :title="state.title" @close="resolveConfirm(false)">
    <p class="message">{{ state.message }}</p>
    <template #actions>
      <BaseButton @click="resolveConfirm(false)">{{ state.cancelLabel }}</BaseButton>
      <BaseButton :variant="state.danger ? 'danger' : 'primary'" @click="resolveConfirm(true)">
        {{ state.confirmLabel }}
      </BaseButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import AppModal from './AppModal.vue';
import BaseButton from './BaseButton.vue';
import { useConfirm } from '../../composables/useConfirm';

const { state, resolveConfirm } = useConfirm();
</script>

<style scoped>
.message { margin: 0; color: var(--text-dim); font-size: 13px; white-space: pre-line; }
</style>
