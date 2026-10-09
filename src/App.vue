<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useTemplateRef } from "vue";
import { version } from "../package.json";
import { createTextDetector } from "./adapters/text-detection.ts";
import AppIcon from "./components/AppIcon.vue";
import AppSidebar from "./components/AppSidebar.vue";
import { packKey, runKey, sessionsKey, type Page, type PageHandle } from "./composables/context.ts";
import { useMaskingRun } from "./composables/useMaskingRun.ts";
import { useRecognitionPack } from "./composables/useRecognitionPack.ts";
import { useSessions } from "./composables/useSessions.ts";
import type { Format, Session } from "./core/sessions.ts";
import HomePage from "./pages/HomePage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import WorkspacePage from "./pages/WorkspacePage.vue";

// The shell owns navigation and wires the three shared stores for its pages.
const pack = useRecognitionPack();
const store = useSessions();
const { sessions, storageError } = store;
const detector = createTextDetector();
const run = useMaskingRun({ detector, pack, sessions, onSession: adoptSession });
provide(packKey, pack);
provide(sessionsKey, store);
provide(runKey, run);

const page = ref<Page>("home");
const activeId = ref<string | null>(null);
const sidebarOpen = ref(false);
const active = computed(() => store.find(activeId.value));
const format = computed<Format>(
  () => active.value?.format ?? (page.value === "excel" ? "excel" : "text"),
);
const topbarLabel = computed(() =>
  page.value === "settings" ? "Cài đặt" : format.value === "text" ? "Văn bản" : "Bảng tính",
);

const pageRef = useTemplateRef<PageHandle>("pageRef");
const sidebar = useTemplateRef<InstanceType<typeof AppSidebar>>("sidebar");
const sidebarToggle = useTemplateRef<HTMLButtonElement>("sidebarToggle");

onMounted(() => {
  void pack.start();
});
onBeforeUnmount(() => {
  pack.stop();
  run.destroy();
});

function adoptSession(session: Session) {
  store.add(session);
  // A finished text run only takes the screen while the user still waits on the text page.
  const waiting = session.format === "excel" || (page.value === "text" && !activeId.value);
  if (!waiting) return;
  activeId.value = session.id;
  void nextTick(() => pageRef.value?.focusResult?.());
}
async function navigate(destination: Page, id: string | null = null) {
  page.value = destination;
  activeId.value = id;
  sidebarOpen.value = false;
  run.processingError.value = "";
  await nextTick();
  window.scrollTo({ top: 0, left: 0 });
  pageRef.value?.focusHeading();
}
async function startMasking() {
  await run.mask(format.value);
}
function removeSession(id: string) {
  const target = active.value?.id === id ? format.value : null;
  store.remove(id);
  if (target) void navigate(target);
}
async function openSidebar() {
  sidebarOpen.value = true;
  await nextTick();
  sidebar.value?.focusStart();
}
async function closeSidebar() {
  sidebarOpen.value = false;
  await nextTick();
  sidebarToggle.value?.focus();
}
</script>

<template>
  <div class="ambient" aria-hidden="true"></div>
  <div class="app-shell">
    <button
      v-if="sidebarOpen"
      class="sidebar-scrim"
      aria-label="Đóng thanh bên"
      @click="closeSidebar"
    ></button>
    <AppSidebar
      ref="sidebar"
      :sessions="sessions"
      :active-id="activeId"
      :page="page"
      :open="sidebarOpen"
      :preparing="pack.preparing.value"
      :version="version"
      @navigate="navigate"
      @close="closeSidebar"
    />
    <div class="workspace" :inert="sidebarOpen">
      <header class="topbar" :class="{ 'home-topbar': page === 'home' }">
        <div>
          <button
            ref="sidebarToggle"
            class="sidebar-toggle"
            aria-label="Mở thanh bên"
            :aria-expanded="sidebarOpen"
            aria-controls="sidebar"
            @click="openSidebar"
          >
            <AppIcon name="list" /></button
          ><span v-if="page !== 'home'">{{ topbarLabel }}</span>
        </div>
      </header>
      <main :class="{ 'home-page': page === 'home' }">
        <HomePage v-if="page === 'home'" ref="pageRef" @navigate="navigate" />
        <SettingsPage v-else-if="page === 'settings'" ref="pageRef" />
        <WorkspacePage
          v-else
          ref="pageRef"
          :key="page"
          :format="format"
          :session="active"
          @navigate="navigate"
          @mask="startMasking"
          @remove="removeSession"
        />
        <p v-if="storageError" class="storage-error" role="alert">
          {{ storageError }}
        </p>
      </main>
    </div>
  </div>
</template>
