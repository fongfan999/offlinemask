<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import ComingSoonBadge from "./ComingSoonBadge.vue";
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
  /** History is a passcode feature: the list stays hidden until one is set. */
  history: boolean;
  /** This machine reads text in pictures, so images open on Tài liệu (decision 0171). */
  images: boolean;
  version: string;
}>();
const emit = defineEmits<{ navigate: [destination: Page, id?: string | null]; close: [] }>();

/** Each content type with the files it opens (decision 0088). */
const formats = computed(
  () =>
    [
      { page: "text", icon: "text", label: "Văn bản", types: "TXT, MD" },
      { page: "excel", icon: "table", label: "Bảng tính", types: "XLSX, XLS, ODS, CSV" },
      {
        page: "word",
        icon: "file",
        label: "Tài liệu",
        types: props.images ? "DOCX, ODT, PDF, PNG, JPG" : "DOCX, ODT, PDF",
      },
    ] as const,
);
/** Planned but not built on this machine: pictures where no text recognition runs. */
const upcomingFormats = computed(() =>
  props.images ? [] : [{ label: "Hình ảnh", icon: "image", types: "JPG, PNG" }],
);
/** What the report says the user was looking at. */
const screens: Record<Page, string> = {
  home: "Trang chủ",
  settings: "Cài đặt",
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
    <nav aria-label="Định dạng">
      <button
        :aria-current="page === 'home' ? 'page' : undefined"
        @click="emit('navigate', 'home')"
      >
        <AppIcon name="home" />Trang chủ
      </button>
      <button
        v-for="format in formats"
        :key="format.page"
        :aria-current="page === format.page && (!activeId || !history) ? 'page' : undefined"
        @click="emit('navigate', format.page)"
      >
        <AppIcon :name="format.icon" /><span class="nav-text"
          >{{ format.label }}<small>{{ format.types }}</small></span
        >
      </button>
      <!-- Formats that are planned but not built: visible, not clickable. -->
      <button
        v-for="upcoming in upcomingFormats"
        :key="upcoming.label"
        class="nav-upcoming"
        :aria-label="`${upcoming.label}, sắp có`"
        disabled
      >
        <AppIcon :name="upcoming.icon" /><span class="nav-text nav-label"
          >{{ upcoming.label }}<small v-if="upcoming.types">{{ upcoming.types }}</small></span
        ><ComingSoonBadge />
      </button>
    </nav>
    <template v-if="history">
      <div class="history-heading">
        LỊCH SỬ <span>{{ sessions.length || "" }}</span>
      </div>
      <div class="history-list">
        <p v-if="!sessions.length" class="empty-history">Chưa có mục nào.</p>
        <button
          v-for="session in sessions"
          :key="session.id"
          class="history-item"
          :aria-current="activeId === session.id ? 'page' : undefined"
          @click="emit('navigate', session.format, session.id)"
        >
          <AppIcon
            :name="
              session.format === 'text' ? 'text' : session.format === 'word' ? 'file' : 'table'
            "
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
    </template>
    <div v-else class="sidebar-spacer"></div>
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
      <button @click="report?.open()"><AppIcon name="help" />Báo lỗi</button>
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
