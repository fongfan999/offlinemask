<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
const paths: Record<string, string> = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  plus: "M12 5v14 M5 12h14",
  compose: "M14 5l5 5 M4 20l5-1L21 7l-4-4L5 15l-1 5Z",
  text: "M4 5h16 M12 5v15 M8 20h8",
  table: "M3 3h18v18H3Z M3 9h18 M9 9v12 M3 15h18",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M8.5 12l2.5 2.5 4.5-5",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h5",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  lock: "M5 10h14v11H5Z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3",
  undo: "M3 10h11a7 7 0 0 1 0 14 M3 10l6-6 M3 10l6 6",
  reset: "M3 10a9 9 0 1 1 2 8 M3 4v6h6",
  info: "M12 8h.01 M12 11v6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  help: "M9.5 8a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2 M12 16h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  close: "m6 6 12 12 M6 18 18 6",
  copy: "M9 9h12v12H9Z M5 15H3V3h12v2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
};
</script>
<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] ?? paths.file" />
  </svg>
</template>
