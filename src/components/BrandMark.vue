<script setup lang="ts">
// The product mark, drawn from the generated brush paths (brand/make_mark.py):
// a swipe with two eye holes. Everything is currentColor and the holes are cut
// with the even-odd rule, so on a cobalt tile the eyes show the tile through.
import { markBand, markEyes } from "./brand-paths.ts";

defineProps<{ size?: number }>();
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
    <path :d="`${markBand} ${markEyes.join(' ')}`" />
  </svg>
</template>
