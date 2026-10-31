<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";

/** The foot of every page: the website and the version, which sat at the sidebar's foot
 * until the sidebar could fold away (decision 0172). */
defineProps<{ version: string }>();
const websiteError = ref("");
async function visitWebsite(event: MouseEvent) {
  websiteError.value = "";
  try {
    await openProductWebsite(event);
  } catch {
    websiteError.value = "Chưa mở được trình duyệt. Bạn có thể truy cập OfflineMask.com.";
  }
}
</script>

<template>
  <footer class="app-footer">
    <a :href="productWebsite" target="_blank" rel="noopener noreferrer" @click="visitWebsite">
      OfflineMask.com<AppIcon name="external" :size="11" />
    </a>
    <span class="app-version" :aria-label="`Phiên bản ${version}`">v{{ version }}</span>
    <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
  </footer>
</template>
