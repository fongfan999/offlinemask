<script setup lang="ts">
import { computed, watch } from "vue";

/** One steady line while a file or a long text is masked (decisions 0076, 0078, 0082):
 * the same words, a percentage that only goes up, and a time estimate only once it is
 * stable. Stages are not named: with the native engine they change many times a second.
 * Counts of distinct texts are not shown either; they mean nothing to people. */
const props = defineProps<{
  progress: {
    stage: "loading" | "reading" | "masking";
    done: number;
    total: number;
    startedAt: number;
  };
}>();

let shownPercent = 0;
watch(
  () => props.progress.startedAt,
  () => (shownPercent = 0),
);
function duration(seconds: number) {
  if (seconds < 60) return `${Math.max(5, Math.round(seconds / 5) * 5)} giây`;
  return `${Math.round(seconds / 60)} phút`;
}
const view = computed(() => {
  const progress = props.progress;
  const reading = progress.total ? Math.floor((progress.done * 100) / progress.total) : 0;
  const percent = (shownPercent = Math.max(
    shownPercent,
    progress.stage === "masking" ? 100 : Math.min(reading, 99),
  ));
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  // Once an estimate shows, it stays until the end ("Sắp xong…" for the last stretch).
  const detail =
    elapsed <= 5 || percent < 5
      ? ""
      : percent >= 95 || progress.stage === "masking"
        ? "Sắp xong…"
        : `Còn khoảng ${duration((elapsed * (progress.total - progress.done)) / Math.max(1, progress.done))}`;
  return { title: `Đang ẩn thông tin… ${percent} %`, percent, detail };
});
</script>

<template>
  <div class="sheet-progress" role="status" aria-live="polite">
    <p class="sheet-progress-title">
      <span class="spinner" aria-hidden="true"></span>{{ view.title }}
    </p>
    <progress
      class="pack-progress"
      :value="view.percent"
      max="100"
      :aria-label="view.title"
    ></progress>
    <p v-if="view.detail" class="sheet-progress-detail">{{ view.detail }}</p>
  </div>
</template>
