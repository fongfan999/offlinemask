<script setup lang="ts">
import { onMounted, useTemplateRef } from "vue";
import { inputFolder, type PickedFolder } from "../adapters/folder.ts";

/** "Chọn cả thư mục": the system folder picker, through the web view's folder input, which
 * hands the page that folder's files and nothing else (decision 0171). */
const emit = defineEmits<{ folder: [folder: PickedFolder] }>();
const picker = useTemplateRef<HTMLInputElement>("picker");
// Set as a property: the attribute is not in Vue's typed list of input attributes.
onMounted(() => {
  if (picker.value) picker.value.webkitdirectory = true;
});
function take(input: HTMLInputElement) {
  if (input.files?.length) emit("folder", inputFolder(input.files));
  input.value = "";
}
</script>

<template>
  <button type="button" class="sample-link" @click="picker?.click()">Chọn cả thư mục</button>
  <input
    ref="picker"
    class="sr-only"
    type="file"
    multiple
    tabindex="-1"
    aria-hidden="true"
    @change="take($event.target as HTMLInputElement)"
  />
</template>
