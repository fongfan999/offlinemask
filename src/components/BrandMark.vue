<script setup lang="ts">
// The product mark, drawn from the generated brush paths (brand/make_mark.py).
// "mask": a swipe with two eye holes, cut with the even-odd rule so on a cobalt
// tile the eyes show the tile through. "restore": the mask coming off, one eye
// still a hole in the band and the other a dot below it; the same rule fills
// the free eye and cuts the covered one. Everything is currentColor.
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
