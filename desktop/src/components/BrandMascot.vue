<script setup lang="ts">
// The mascot, drawn from the generated brush paths (brand/make_mark.py): the ninja who wears
// the mask. The head and eyes are ink, the band and its tails cobalt, so it follows the theme.
import { mascotBand, mascotEyes, mascotHead } from "./brand-paths.ts";

defineProps<{ size?: number }>();
</script>
<template>
  <svg :width="size ?? 64" :height="size ?? 64" viewBox="0 0 100 100" aria-hidden="true">
    <path :d="mascotHead" class="mascot-ink" />
    <path :d="mascotBand" class="mascot-band" />
    <path :d="mascotEyes.join(' ')" class="mascot-ink" />
  </svg>
</template>
<style scoped>
.mascot-ink {
  fill: var(--ink);
}
.mascot-band {
  fill: var(--accent);
}
</style>
