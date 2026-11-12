<template>
  <div class="donut" :style="{ width: `${diameter}px`, height: `${diameter}px` }">
    <svg :viewBox="`0 0 ${diameter} ${diameter}`" role="img" :aria-label="ariaLabel">
      <circle
        :cx="diameter / 2"
        :cy="diameter / 2"
        :r="radius"
        fill="none"
        stroke="var(--bg-soft)"
        :stroke-width="thickness"
      />
      <circle
        v-for="(segment, i) in arcs"
        :key="i"
        :cx="diameter / 2"
        :cy="diameter / 2"
        :r="radius"
        fill="none"
        :stroke="segment.color"
        :stroke-width="thickness"
        stroke-linecap="butt"
        :stroke-dasharray="`${segment.length} ${circumference}`"
        :stroke-dashoffset="-segment.offset"
        :transform="`rotate(-90 ${diameter / 2} ${diameter / 2})`"
      >
        <title>{{ segment.label }}: {{ segment.value }}</title>
      </circle>
    </svg>
    <div class="center">
      <strong>{{ total }}</strong>
      <span>{{ centerLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Segment {
  label: string;
  value: number;
  color: string;
}

const props = withDefaults(
  defineProps<{ segments: Segment[]; size?: number; thickness?: number; centerLabel?: string }>(),
  { size: 140, thickness: 14, centerLabel: 'hallazgos' },
);

const diameter = computed(() => props.size ?? 140);
const radius = computed(() => (diameter.value - (props.thickness ?? 14)) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0));
const ariaLabel = computed(() =>
  props.segments.map((s) => `${s.label}: ${s.value}`).join(', ') || 'Sin datos',
);

const arcs = computed(() => {
  let offset = 0;
  const sum = total.value || 1;
  return props.segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / sum) * circumference.value;
      const arc = { ...s, length, offset };
      offset += length;
      return arc;
    });
});
</script>

<style scoped>
.donut { position: relative; display: inline-grid; place-items: center; }
svg { width: 100%; height: 100%; }
.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.center strong { font-size: 26px; letter-spacing: -0.03em; }
.center span { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
