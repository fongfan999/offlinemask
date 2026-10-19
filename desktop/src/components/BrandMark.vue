<script setup lang="ts">
// The product mark, drawn from the generated brush paths (brand/make_mark.py).
// "mask": a swipe with two eye holes, cut with the even-odd rule so on a cobalt
// tile the eyes show the tile through. "restore": the same mask with a slash
// through it, the way an eye-off icon says "off": the gap around the slash is
// cut from the band in currentColor, the slash itself is ink.
import { computed } from "vue";
import { markBand, markEyes, restoreBand, restoreEyes, restoreSlash } from "./brand-paths.ts";

const props = defineProps<{ size?: number; variant?: "mask" | "restore" }>();
const restore = computed(() => props.variant === "restore");
const d = computed(() =>
  restore.value ? `${restoreBand} ${restoreEyes.join(" ")}` : `${markBand} ${markEyes.join(" ")}`,
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
    <path v-if="restore" :d="restoreSlash" class="mark-slash" />
  </svg>
</template>
<style scoped>
.mark-slash {
  fill: var(--ink);
}
</style>
