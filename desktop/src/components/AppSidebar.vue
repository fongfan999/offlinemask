<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import ReportDialog from "./ReportDialog.vue";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";
import type { Page } from "../composables/context.ts";
import { sessionPreview } from "../core/session-preview.ts";
import { isPrivate, sessionTitle, type Session } from "../core/sessions.ts";

const props = defineProps<{
  sessions: readonly Session[];
  activeId: string | null;
  page: Page;
  open: boolean;
  preparing: boolean;
  /** With a passcode the list is history; without one it is what is open now, in RAM. */
  history: boolean;
  /** A folder being masked or reviewed, which is no session (decision 0171). */
  folder: { name: string; status: string } | null;
  version: string;
}>();
const emit = defineEmits<{ navigate: [destination: Page, id?: string | null]; close: [] }>();

/** One way in (decision 0172): home holds both halves of the job, hiding and getting the
 * full reply back. Which page a file opens on is the app's business, not a choice. */
const hiding = computed(
  () =>
    props.page === "home" ||
    ((props.page === "text" || props.page === "excel" || props.page === "word") &&
      !props.activeId) ||
    (props.page === "folder" && !props.folder),
);
/** What the report says the user was looking at. */
const screens: Record<Page, string> = {
  home: "Trang chủ",
  settings: "Cài đặt",
  folder: "Thư mục",
  text: "Văn bản",
  excel: "Bảng tính",
  word: "Tài liệu",
};
const start = useTemplateRef<HTMLButtonElement>("start");
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
function dateLabel(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
defineExpose({
  focusStart() {
    start.value?.focus();
  },
});
</script>

<template>
  <aside
    id="sidebar"
    class="sidebar glass"
    :class="{ 'is-open': open }"
    aria-label="Điều hướng và lịch sử"
    @keydown.esc="emit('close')"
  >
    <button
      ref="start"
      class="brand"
      aria-label="OfflineMask — Trang chủ"
      @click="emit('navigate', 'home')"
    >
      <span class="brand-mark"><BrandMark :size="28" /></span
      ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
    </button>
    <!-- The pattern AI users know from their chat apps (decision 0172): start something new
         at the top, what is open or kept below. -->
    <button
      class="sidebar-new"
      :aria-current="hiding ? 'page' : undefined"
      @click="emit('navigate', 'home')"
    >
      <AppIcon name="plus" :size="16" />Ẩn thông tin mới
    </button>
    <div class="history-heading">
      {{ history ? "Lịch sử" : "Đang mở" }}
    </div>
    <div class="history-list">
      <button
        v-if="folder"
        class="history-item"
        :aria-current="page === 'folder' ? 'page' : undefined"
        @click="emit('navigate', 'folder')"
      >
        <AppIcon name="folder" :size="16" /><span
          ><strong>{{ folder.name }}</strong
          ><small>{{ folder.status }}</small></span
        >
      </button>
      <p v-if="!sessions.length && !folder" class="empty-history">
        {{ history ? "Chưa có mục nào." : "Việc bạn đang làm sẽ hiện ở đây." }}
      </p>
      <button
        v-for="session in sessions"
        :key="session.id"
        class="history-item"
        :aria-current="activeId === session.id ? 'page' : undefined"
        @click="emit('navigate', session.format, session.id)"
      >
        <AppIcon
          :name="session.format === 'text' ? 'text' : session.format === 'word' ? 'file' : 'table'"
          :size="16"
        /><span
          ><strong>{{ sessionPreview(session) }}</strong
          ><small
            >{{ isPrivate(session) ? `${sessionTitle(session)} · ` : ""
            }}{{ dateLabel(session.createdAt) }}{{ isPrivate(session) ? "" : " · Mẫu" }}</small
          ></span
        >
      </button>
    </div>
    <nav class="settings-nav" aria-label="Cài đặt ứng dụng">
      <button
        :aria-current="page === 'settings' ? 'page' : undefined"
        @click="emit('navigate', 'settings')"
      >
        <AppIcon name="settings" />Cài đặt<span
          v-if="preparing"
          class="settings-dot"
          aria-label="Đang chuẩn bị gói nhận diện"
        ></span>
      </button>
      <button @click="report?.open()"><AppIcon name="help" />Báo lỗi hoặc góp ý</button>
    </nav>
    <ReportDialog ref="report" :version="version" :screen="screens[page]" />
    <footer class="sidebar-footer">
      <a :href="productWebsite" target="_blank" rel="noopener noreferrer" @click="visitWebsite">
        OfflineMask.com<AppIcon name="external" :size="12" />
      </a>
      <span class="app-version" :aria-label="`Phiên bản ${version}`">{{ version }}</span>
      <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
    </footer>
  </aside>
</template>
