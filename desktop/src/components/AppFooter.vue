<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import ReportDialog from "./ReportDialog.vue";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";
import type { Page } from "../composables/context.ts";

/** The foot of every page: the website and the version, which sat at the sidebar's foot
 * until the sidebar could fold away (decision 0172), and "Góp ý", a raised button at its
 * right end that every page shows without covering the page's own buttons (decision 0197). */
defineProps<{ version: string; page: Page }>();
/** What the report says the user was looking at. */
const screens: Record<Page, string> = {
  home: "Trang chủ",
  settings: "Cài đặt",
  folder: "Thư mục",
  text: "Văn bản",
  excel: "Bảng tính",
  word: "Tài liệu",
};
const report = useTemplateRef<InstanceType<typeof ReportDialog>>("report");
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
    <button class="feedback-button" aria-label="Báo lỗi / Góp ý" @click="report?.open()">
      <AppIcon name="message" :size="15" /><span>Báo lỗi / Góp ý</span>
    </button>
    <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
    <ReportDialog ref="report" :version="version" :screen="screens[page]" />
  </footer>
</template>
