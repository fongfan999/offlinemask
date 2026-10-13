<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";

/** Drop a file or click to pick one (spreadsheets, Word). The whole zone is one
 * button; the real file input stays hidden. Window drops reach the page because
 * Tauri's own drag-and-drop is off (decision 0076). */
defineProps<{
  icon: "table" | "file" | "undo";
  title: string;
  hint: string;
  accept: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ file: [file: File] }>();
const picker = useTemplateRef<HTMLInputElement>("picker");
const dragging = ref(false);

function take(files: FileList | null | undefined) {
  const file = files?.[0];
  if (file) emit("file", file);
}
</script>

<template>
  <button
    type="button"
    class="drop-zone"
    :class="{ 'is-dragging': dragging, 'is-busy': busy }"
    :disabled="busy"
    @click="picker?.click()"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="
      dragging = false;
      take($event.dataTransfer?.files);
    "
  >
    <span class="drop-icon"><AppIcon :name="icon" :size="26" /></span>
    <strong>{{ busy ? "Đang mở tệp…" : title }}</strong>
    <span>hoặc <u>chọn tệp</u> · {{ hint }}</span>
  </button>
  <input
    ref="picker"
    class="sr-only"
    type="file"
    :accept="accept"
    tabindex="-1"
    aria-hidden="true"
    @change="
      take(($event.target as HTMLInputElement).files);
      ($event.target as HTMLInputElement).value = '';
    "
  />
</template>
