<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";
import type { Page } from "../composables/context.ts";
import { sessionPreview } from "../core/session-preview.ts";
import { sessionTitle, type Session } from "../core/sessions.ts";

defineProps<{
  sessions: readonly Session[];
  activeId: string | null;
  page: Page;
  open: boolean;
  preparing: boolean;
  version: string;
}>();
const emit = defineEmits<{ navigate: [destination: Page, id?: string | null]; close: [] }>();

const start = useTemplateRef<HTMLButtonElement>("start");
const websiteError = ref("");
async function visitWebsite(event: MouseEvent) {
  websiteError.value = "";
  try {
    await openProductWebsite(event);
  } catch {
    websiteError.value = "Chưa mở được trình duyệt. Bạn có thể truy cập offlinemask.com.";
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
      <span class="brand-mark"><AppIcon name="mask" :size="20" /></span
      ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
    </button>
    <nav aria-label="Định dạng">
      <button
        :aria-current="page === 'home' ? 'page' : undefined"
        @click="emit('navigate', 'home')"
      >
        <AppIcon name="home" />Trang chủ
      </button>
      <button
        :aria-current="page === 'text' && !activeId ? 'page' : undefined"
        @click="emit('navigate', 'text')"
      >
        <AppIcon name="text" />Văn bản
      </button>
      <button
        :aria-current="page === 'excel' && !activeId ? 'page' : undefined"
        @click="emit('navigate', 'excel')"
      >
        <AppIcon name="table" />Bảng tính
      </button>
    </nav>
    <div class="history-heading">
      CÁC PHIÊN CỦA BẠN <span>{{ sessions.length || "" }}</span>
    </div>
    <div class="history-list">
      <p v-if="!sessions.length" class="empty-history">Chưa có phiên nào.</p>
      <button
        v-for="session in sessions"
        :key="session.id"
        class="history-item"
        :aria-current="activeId === session.id ? 'page' : undefined"
        @click="emit('navigate', session.format, session.id)"
      >
        <AppIcon :name="session.format === 'text' ? 'file' : 'table'" :size="16" /><span
          ><strong>{{ sessionPreview(session) }}</strong
          ><small
            >{{ session.fixture === "private-text-v1" ? `${sessionTitle(session)} · ` : ""
            }}{{ dateLabel(session.createdAt)
            }}{{ session.fixture === "private-text-v1" ? " · Tạm thời" : " · Mẫu" }}</small
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
    </nav>
    <footer class="sidebar-footer">
      <a :href="productWebsite" target="_blank" rel="noopener noreferrer" @click="visitWebsite">
        offlinemask.com<AppIcon name="external" :size="12" />
      </a>
      <span class="app-version" :aria-label="`Phiên bản ${version}`">{{ version }}</span>
      <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
    </footer>
  </aside>
</template>
