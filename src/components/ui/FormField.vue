<template>
  <div class="field">
    <label :for="fieldId">
      {{ label }}<span v-if="required" class="req" aria-hidden="true">*</span>
    </label>
    <slot />
    <p v-if="error" :id="`${fieldId}-error`" class="error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${fieldId}-hint`" class="hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; fieldId: string; hint?: string; error?: string; required?: boolean }>(),
  { hint: '', error: '', required: false },
);
</script>

<style scoped>
.field { margin-bottom: var(--space-3); }
label { margin-top: 0; }
.req { color: var(--danger); margin-left: 3px; }
.hint { margin: 4px 0 0; color: var(--text-faint); font-size: 11px; }
.error { margin: 4px 0 0; color: var(--danger); font-size: 11px; }
</style>
