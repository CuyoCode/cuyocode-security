<template>
  <AppModal :open="open" title="Bienvenido a CuyoCode Security" subtitle="Auditoría de seguridad asistida, local y trazable." @close="$emit('close')">
    <p class="lead">
      Revisá código, respuestas HTTP y servidores con reglas propias. Todo queda en tu equipo:
      sin telemetría, sin nube obligatoria y sin ejecutar el código del objetivo.
    </p>
    <div class="choices">
      <button class="choice" :disabled="demoLoading" @click="$emit('demo')">
        <span class="choice-icon accent"><AppIcon name="spark" :size="18" /></span>
        <span class="choice-body">
          <strong>{{ demoLoading ? 'Preparando demo…' : 'Probar demo segura' }}</strong>
          <span>Audita un fixture vulnerable sintético y un laboratorio Node. Sin dependencias externas.</span>
        </span>
      </button>
      <button class="choice" @click="$emit('wizard')">
        <span class="choice-icon"><AppIcon name="shield" :size="18" /></span>
        <span class="choice-body">
          <strong>Auditar un proyecto</strong>
          <span>Asistente de 6 pasos: objetivo, perfil, alcance, IA, resumen y ejecución.</span>
        </span>
      </button>
      <button class="choice" @click="$emit('tools')">
        <span class="choice-icon"><AppIcon name="wrench" :size="18" /></span>
        <span class="choice-body">
          <strong>Revisar herramientas</strong>
          <span>Git, Node, Docker y adaptadores opcionales. La app te dice qué falta y cómo instalarlo.</span>
        </span>
      </button>
    </div>
    <div class="notice">
      <AppIcon name="lock" :size="15" />
      <span>Solo usá esta herramienta sobre objetivos expresamente autorizados. La ausencia de hallazgos no implica seguridad.</span>
    </div>
    <template #actions>
      <BaseButton variant="ghost" @click="$emit('close')">Explorar por mi cuenta</BaseButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue';
import AppModal from '../ui/AppModal.vue';
import BaseButton from '../ui/BaseButton.vue';

withDefaults(defineProps<{ open: boolean; demoLoading?: boolean }>(), { demoLoading: false });
defineEmits<{ close: []; demo: []; wizard: []; tools: [] }>();
</script>

<style scoped>
.lead { color: var(--text-dim); font-size: 13px; margin: 0 0 var(--space-4); }
.choices { display: flex; flex-direction: column; gap: 10px; }
.choice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  text-align: left;
  padding: 13px 14px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  white-space: normal;
}
.choice:hover:not(:disabled) { border-color: var(--accent); background: var(--bg-elevated); }
.choice-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--bg-elevated);
  color: var(--text-dim);
  flex-shrink: 0;
}
.choice-icon.accent { background: var(--accent-soft); color: var(--accent); }
.choice-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.choice-body strong { font-size: 13px; color: var(--text); }
.choice-body span { font-size: 12px; color: var(--text-dim); line-height: 1.45; }
.notice {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: var(--space-4);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  border: 1px solid color-mix(in srgb, var(--warn) 35%, var(--border));
  color: var(--warn);
  font-size: 11px;
}
</style>
