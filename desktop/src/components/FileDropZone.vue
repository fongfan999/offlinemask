<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";
import { droppedFolder, inputFolder, isFolderDrop, type PickedFolder } from "../adapters/folder.ts";
import AppIcon from "./AppIcon.vue";

/** Drop a file or click to pick one (spreadsheets, Word). The whole zone is one
 * button; the real file input stays hidden. Window drops reach the page because
 * Tauri's own drag-and-drop is off (decision 0076). */
const props = defineProps<{
  icon: "table" | "file" | "undo" | "upload";
  title: string;
  hint: string;
  accept: string;
  busy?: boolean;
  /** A dropped folder, or several files, opens the folder page (decision 0171). */
  folders?: boolean;
  /** Clicking picks a folder rather than one file (the folder page). */
  directory?: boolean;
}>();
const emit = defineEmits<{ file: [file: File]; folder: [folder: PickedFolder] }>();
const picker = useTemplateRef<HTMLInputElement>("picker");
const dragging = ref(false);

// Set as a property: the attribute is not in Vue's typed list of input attributes.
onMounted(() => {
  if (props.directory && picker.value) picker.value.webkitdirectory = true;
});
function take(files: FileList | null | undefined) {
  if (props.directory) {
    if (files?.length) emit("folder", inputFolder(files));
    return;
  }
  const file = files?.[0];
  if (file) emit("file", file);
}
function drop(transfer: DataTransfer | null) {
  dragging.value = false;
  if (props.folders && transfer && isFolderDrop(transfer))
    void droppedFolder(transfer).then((folder) => emit("folder", folder));
  else take(transfer?.files);
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
    @drop.prevent="drop($event.dataTransfer)"
  >
    <span class="drop-icon"><AppIcon :name="icon" :size="26" /></span>
    <span class="drop-words"
      ><strong>{{ busy ? "Đang mở tệp…" : title }}</strong>
      <span
        >hoặc <u>{{ directory ? "chọn thư mục" : "chọn tệp" }}</u> · {{ hint }}</span
      ></span
    >
  </button>
  <input
    ref="picker"
    class="sr-only"
    type="file"
    :accept="accept"
    :multiple="directory"
    tabindex="-1"
    aria-hidden="true"
    @change="
      take(($event.target as HTMLInputElement).files);
      ($event.target as HTMLInputElement).value = '';
    "
  />
</template>
