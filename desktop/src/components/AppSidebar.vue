<script setup lang="ts">
import { useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import ReportDialog from "./ReportDialog.vue";
import type { Page } from "../composables/context.ts";
import { sessionPreview } from "../core/session-preview.ts";
import { isPrivate, sessionTitle, type Session } from "../core/sessions.ts";

defineProps<{
  sessions: readonly Session[];
  activeId: string | null;
  page: Page;
  open: boolean;
  preparing: boolean;
  /** With a passcode the list is history; without one it is what is open now, in RAM. */
  history: boolean;
  /** A folder being masked or reviewed, which is no session (decision 0171). */
  folder: { name: string; status: string } | null;
  /** For the report only; home shows it (decision 0172). */
  version: string;
}>();
const emit = defineEmits<{
  navigate: [destination: Page, id?: string | null];
  close: [];
  /** Wide windows: fold the sidebar away; the logo moves to the top bar (decision 0172). */
  collapse: [];
  /** "+ Ẩn thông tin mới": home, on its first tab, from anywhere (home included). */
  start: [];
}>();

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
    <div class="sidebar-head">
      <button
        ref="start"
        class="brand"
        aria-label="OfflineMask — Trang chủ"
        @click="emit('navigate', 'home')"
      >
        <span class="brand-mark"><BrandMark :size="28" /></span
        ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
      </button>
      <button
        class="sidebar-collapse"
        aria-label="Thu gọn thanh bên"
        title="Thu gọn thanh bên"
        @click="emit('collapse')"
      >
        <AppIcon name="sidebar" :size="18" />
      </button>
    </div>
    <!-- The pattern AI users know from their chat apps (decision 0172): start something new
         at the top, what is open or kept below. -->
    <!-- An action, never "current": it looked selected, and so not clickable. -->
    <button class="sidebar-new" @click="emit('start')">
      <AppIcon name="plus" :size="16" />Ẩn thông tin mới
    </button>
    <div class="history-heading">
      {{ history ? "Lịch sử" : "Đã ẩn" }}
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
        {{ history ? "Chưa có mục nào." : "Văn bản và tệp bạn ẩn sẽ nằm ở đây." }}
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
  </aside>
</template>
