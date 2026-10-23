<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { version } from "../package.json";
import { nativeQuickActions } from "./adapters/quick-actions.ts";
import { createSheetFiles } from "./adapters/sheet-files.ts";
import { createTextDetector, queueDetections } from "./adapters/text-detection.ts";
import AppIcon from "./components/AppIcon.vue";
import AppSidebar from "./components/AppSidebar.vue";
import LockPage from "./components/LockPage.vue";
import {
  packKey,
  docKey,
  quickKey,
  runKey,
  sessionsKey,
  sheetKey,
  vaultKey,
  type Page,
  type PageHandle,
} from "./composables/context.ts";
import { useMaskingRun } from "./composables/useMaskingRun.ts";
import { useQuickActions } from "./composables/useQuickActions.ts";
import { useRecognitionPack } from "./composables/useRecognitionPack.ts";
import { useSessions } from "./composables/useSessions.ts";
import { useDocRun } from "./composables/useDocRun.ts";
import { useSheetRun } from "./composables/useSheetRun.ts";
import { useVault } from "./composables/useVault.ts";
import { fileKind, fileKindErrors } from "./core/file-kind.ts";
import type { Format, Session } from "./core/sessions.ts";
import HomePage from "./pages/HomePage.vue";
import DocPage from "./pages/DocPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import SheetPage from "./pages/SheetPage.vue";
import WorkspacePage from "./pages/WorkspacePage.vue";

// The shell owns navigation and wires the three shared stores for its pages.
const pack = useRecognitionPack();
const store = useSessions();
const { sessions, storageError } = store;
// Text and spreadsheet masking share one detector; requests take turns.
const detector = queueDetections(createTextDetector());
const run = useMaskingRun({ detector, pack, sessions, onSession: adoptSession });
const sheetFiles = createSheetFiles();
const sheet = useSheetRun({ detector, files: sheetFiles, pack, sessions, onSession: adoptSession });
const doc = useDocRun({ detector, files: sheetFiles, pack, sessions, onSession: adoptSession });
const vault = useVault();
// Clipboard quick actions (decision 0090) reuse the text run and every alias table.
const quick = useQuickActions({
  adapter: nativeQuickActions,
  run,
  sessions,
  locked: () => vault.state.value === "locked",
  // Quitting from the tray waits for the debounced vault save below.
  flush: async () => {
    clearTimeout(saveTimer);
    if (vault.state.value === "unlocked") await vault.save(sessions.value);
  },
  // The unknown-codes card leads to the passcode setting (decision 0096).
  openSettings: () => void navigate("settings"),
  historyKept: () => vault.state.value === "unlocked",
  // "Mở trong OfflineMask" in the restore preview (decision 0096).
  openSession: (id) => {
    const session = store.find(id);
    if (session) void navigate(session.format, id);
  },
  // A file from the Finder service (decision 0094) opens like one dropped on the home page.
  openFile: async (file) => {
    const kind = fileKind(file.name);
    if (kind === "text") {
      const error = await run.openTextFile(file);
      if (!error) void navigate("text");
      return error;
    }
    if (kind === "excel") {
      void navigate("excel");
      void sheet.openFile(file);
      return "";
    }
    if (kind === "word") {
      void navigate("word");
      void doc.openFile(file);
      return "";
    }
    return fileKindErrors[kind];
  },
});
provide(packKey, pack);
provide(quickKey, quick);
provide(sessionsKey, store);
provide(runKey, run);
provide(vaultKey, vault);
provide(sheetKey, sheet);
provide(docKey, doc);

// The app passcode is optional (decision 0064). When one exists the lock page
// comes first; private sessions mirror into the vault while it is open.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  sessions,
  () => {
    if (vault.state.value !== "unlocked") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void vault.save(sessions.value), 300);
  },
  { deep: true },
);

const page = ref<Page>("home");
const activeId = ref<string | null>(null);
const sidebarOpen = ref(false);
const active = computed(() => store.find(activeId.value));
const activeText = computed(() =>
  active.value?.fixture === "private-text-v1" || active.value?.fixture === "sample-v1"
    ? active.value
    : undefined,
);
const activeSheet = computed(() =>
  active.value?.fixture === "private-sheet-v1" ? active.value : undefined,
);
const activeDoc = computed(() =>
  active.value?.fixture === "private-doc-v1" ? active.value : undefined,
);
const format = computed<Format>(
  () =>
    active.value?.format ?? (page.value === "excel" || page.value === "word" ? page.value : "text"),
);
// Settings has no crumb: its heading already says "Cài đặt".
const topbarLabel = computed(() =>
  page.value === "home" || page.value === "settings"
    ? ""
    : { text: "Văn bản", excel: "Bảng tính", word: "Tài liệu" }[format.value],
);

/** History is a passcode feature (decision 0071). Without it each format has one
 * screen: a new result replaces the previous one, and coming back to the format
 * shows whatever was last open there (decision 0072). */
const historyOn = computed(() => vault.state.value === "unlocked");
const lastOpened: Record<Format, string | null> = { text: null, excel: null, word: null };

const pageRef = useTemplateRef<PageHandle>("pageRef");
const sidebar = useTemplateRef<InstanceType<typeof AppSidebar>>("sidebar");
const sidebarToggle = useTemplateRef<HTMLButtonElement>("sidebarToggle");

/** Back to the front: the models may have been paged out while the app sat idle. */
function warmWhenVisible() {
  if (document.visibilityState === "visible") run.warmUp();
}
onMounted(() => {
  window.addEventListener("focus", run.warmUp);
  document.addEventListener("visibilitychange", warmWhenVisible);
  void pack.start();
  void vault.start();
  void quick.start();
});
onBeforeUnmount(() => {
  window.removeEventListener("focus", run.warmUp);
  document.removeEventListener("visibilitychange", warmWhenVisible);
  clearTimeout(saveTimer);
  pack.stop();
  quick.stop();
  run.destroy();
});

function adoptSession(session: Session) {
  if (!historyOn.value) {
    for (const old of sessions.value.filter((item) => item.format === session.format))
      store.remove(old.id);
    lastOpened[session.format] = session.id;
    if (activeId.value && !store.find(activeId.value)) activeId.value = session.id;
  }
  store.add(session);
  // A finished run only takes the screen while the user still waits on its page.
  const waiting = page.value === session.format && !activeId.value;
  if (!waiting) return;
  activeId.value = session.id;
  void nextTick(() => pageRef.value?.focusResult?.());
}
async function navigate(destination: Page, id: string | null = null) {
  if (destination === "text" || destination === "excel" || destination === "word")
    lastOpened[destination] = id;
  page.value = destination;
  activeId.value = id;
  sidebarOpen.value = false;
  run.processingError.value = "";
  await nextTick();
  window.scrollTo({ top: 0, left: 0 });
  pageRef.value?.focusHeading();
}
/** The sidebar and home cards open a format; without history that means its last screen.
 * "Tạo mới" and "Sửa văn bản" inside the page go through `navigate` and start a draft. */
function openFormat(destination: Page, id: string | null = null) {
  if (id || historyOn.value || destination === "home" || destination === "settings")
    return navigate(destination, id);
  const last = lastOpened[destination];
  return navigate(destination, last && store.find(last) ? last : null);
}
async function startMasking() {
  await run.mask("text");
}
function removeSession(id: string) {
  const target = active.value?.id === id ? format.value : null;
  store.remove(id);
  quick.forget(id);
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
  <LockPage v-if="vault.state.value === 'locked'" />
  <div v-else-if="vault.checked.value" class="app-shell">
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
      :history="historyOn"
      :version="version"
      @navigate="openFormat"
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
          ><span v-if="topbarLabel">{{ topbarLabel }}</span>
        </div>
      </header>
      <main :class="{ 'home-page': page === 'home', 'wide-page': page === 'excel' }">
        <!-- The text and spreadsheet pages stay alive across navigation, so the step,
             view and pasted reply are still there on return. All of it is RAM only. -->
        <KeepAlive include="WorkspacePage,SheetPage,DocPage">
          <HomePage v-if="page === 'home'" ref="pageRef" @navigate="openFormat" @start="navigate" />
          <SettingsPage v-else-if="page === 'settings'" ref="pageRef" />
          <SheetPage
            v-else-if="page === 'excel'"
            ref="pageRef"
            :session="activeSheet"
            @navigate="navigate"
            @remove="removeSession"
          />
          <DocPage
            v-else-if="page === 'word'"
            ref="pageRef"
            :session="activeDoc"
            @navigate="navigate"
            @remove="removeSession"
          />
          <WorkspacePage
            v-else
            ref="pageRef"
            key="text"
            format="text"
            :session="activeText"
            @navigate="navigate"
            @mask="startMasking"
            @remove="removeSession"
          />
        </KeepAlive>
        <p v-if="storageError" class="storage-error" role="alert">
          {{ storageError }}
        </p>
      </main>
    </div>
  </div>
</template>
