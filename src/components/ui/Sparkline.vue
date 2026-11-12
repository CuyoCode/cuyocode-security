<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="ariaLabel" preserveAspectRatio="none">
    <polyline
      :points="linePoints"
      fill="none"
      stroke="var(--accent)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <polygon :points="areaPoints" fill="var(--accent-soft)" stroke="none" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ values: number[]; width?: number; height?: number; ariaLabel?: string }>(),
  { width: 160, height: 44, ariaLabel: 'Tendencia' },
);

const points = computed(() => {
  const values = props.values;
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? props.width / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length === 1 ? props.width / 2 : i * step,
    y: props.height - 4 - (v / max) * (props.height - 8),
  }));
});

const linePoints = computed(() => points.value.map((p) => `${p.x},${p.y}`).join(' '));
const areaPoints = computed(() => {
  if (points.value.length === 0) return '';
  const first = points.value[0];
  const last = points.value[points.value.length - 1];
  if (!first || !last) return '';
  return `${first.x},${props.height} ${linePoints.value} ${last.x},${props.height}`;
});
</script>
