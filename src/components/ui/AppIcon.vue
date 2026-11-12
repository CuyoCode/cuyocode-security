<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ name: string; size?: number; strokeWidth?: number }>(),
  { size: 18, strokeWidth: 1.8 },
);

const ICONS: Record<string, string[]> = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v4h-7z', 'M14 11h7v10h-7z', 'M3 14h7v7H3z'],
  shield: ['M12 3l7 3v5c0 4.5-2.9 8.2-7 10-4.1-1.8-7-5.5-7-10V6z', 'M9 12l2 2 4-4'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  folder: ['M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  alert: ['M12 3l9 16H3z', 'M12 9v5', 'M12 17h.01'],
  report: ['M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 12h6', 'M9 16h6'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  flask: ['M9 3h6', 'M10 3v6l-6 10a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3', 'M7 15h10'],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.3-2.3z'],
  settings: ['M4 6h10', 'M18 6h2', 'M4 12h2', 'M10 12h10', 'M4 18h8', 'M16 18h4', 'M14 4v4', 'M6 10v4', 'M12 16v4'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  chevron: ['M9 6l6 6-6 6'],
  check: ['M5 12l4 4L19 6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  play: ['M8 5l11 7-11 7z'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5'],
  spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
  database: ['M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4l3 2'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  info: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 11v5', 'M12 8h.01'],
  warning: ['M12 3l9 16H3z', 'M12 9v5', 'M12 17h.01'],
  lock: ['M6 11h12v10H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  activity: ['M3 12h4l2-7 4 14 2-7h6'],
  target: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3.5 3 14.5 0 18', 'M12 3c-3 3.5-3 14.5 0 18'],
  cpu: ['M7 7h10v10H7z', 'M9 3v4', 'M15 3v4', 'M9 17v4', 'M15 17v4', 'M3 9h4', 'M3 15h4', 'M17 9h4', 'M17 15h4'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  key: ['M14 7a4 4 0 1 0 3.5 6H21l-2-2 2-2h-3.5A4 4 0 0 0 14 7z', 'M4 20l6-6'],
};
const paths = computed(() => ICONS[props.name] ?? ICONS.info ?? []);
</script>
