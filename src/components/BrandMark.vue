<script setup lang="ts">
// The product mark, drawn from the generated brush paths (brand/make_mark.py).
// "mask": a swipe with two eye holes, cut with the even-odd rule so on a cobalt
// tile the eyes show the tile through. "restore": the same two eyes, open and
// calm, with lids; nothing overlaps, so the same rule simply fills them.
// Everything is currentColor.
import { computed } from "vue";
import { markBand, markEyes, restoreBand, restoreEyes } from "./brand-paths.ts";

const props = defineProps<{ size?: number; variant?: "mask" | "restore" }>();
const d = computed(() =>
  props.variant === "restore"
    ? `${restoreBand} ${restoreEyes.join(" ")}`
    : `${markBand} ${markEyes.join(" ")}`,
);
</script>
<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 100 100"
    fill="currentColor"
    fill-rule="evenodd"
    aria-hidden="true"
  >
    <path :d="d" />
  </svg>
</template>
