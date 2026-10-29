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
import AppFooter from "./components/AppFooter.vue";
import AppSidebar from "./components/AppSidebar.vue";
import BrandMark from "./components/BrandMark.vue";
import LockPage from "./components/LockPage.vue";
import {
  packKey,
  docKey,
  folderKey,
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
import { useFolderRun } from "./composables/useFolderRun.ts";
import { useSheetRun } from "./composables/useSheetRun.ts";
import { useVault } from "./composables/useVault.ts";
import { fileKind, fileKindErrors } from "./core/file-kind.ts";
import type { Format, Session } from "./core/sessions.ts";
import HomePage from "./pages/HomePage.vue";
import DocPage from "./pages/DocPage.vue";
import FolderPage from "./pages/FolderPage.vue";
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
const folder = useFolderRun({ detector, pack, sessions });
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
provide(folderKey, folder);

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
    : page.value === "folder"
      ? "Thư mục"
      : { text: "Văn bản", excel: "Bảng tính", word: "Tài liệu" }[format.value],
);
/** A folder in progress has no session, so the sidebar lists it from here (decision 0172). */
const folderStatus: Record<string, string> = {
  surveying: "Đang đọc thư mục",
  ready: "Chờ bắt đầu",
  review: "Đã ẩn · chờ lưu",
  saving: "Đang lưu",
  saved: "Đã lưu",
};
const folderItem = computed(() => {
  const phase = folder.phase.value;
  if (phase === "empty") return null;
  const progress = folder.progress.value;
  const status =
    phase === "masking"
      ? `Đang ẩn · ${progress?.total ? Math.floor((progress.done / progress.total) * 100) : 0}%`
      : folderStatus[phase]!;
  return { name: folder.name.value, status };
});

/** History is a passcode feature (decision 0071). Without it each format has one
 * screen: a new result replaces the previous one, and coming back to the format
 * shows whatever was last open there (decision 0072). */
const historyOn = computed(() => vault.state.value === "unlocked");
const lastOpened: Record<Format, string | null> = { text: null, excel: null, word: null };

const pageRef = useTemplateRef<PageHandle>("pageRef");
const sidebar = useTemplateRef<InstanceType<typeof AppSidebar>>("sidebar");
const sidebarToggle = useTemplateRef<HTMLButtonElement>("sidebarToggle");

/** History past its keep period goes while the app runs too (decision 0143): it can sit
 * in the tray for weeks. Checked hourly and whenever the window comes back. */
function expireHistory() {
  if (vault.state.value !== "unlocked") return;
  const target = active.value ? format.value : null;
  const removed = store.expire();
  for (const id of removed) quick.forget(id);
  if (target && activeId.value && removed.includes(activeId.value)) void navigate(target);
}
const expireTimer = setInterval(expireHistory, 60 * 60 * 1000);
/** Back to the front: the models may have been paged out while the app sat idle. */
function warmWhenVisible() {
  if (document.visibilityState !== "visible") return;
  run.warmUp();
  expireHistory();
}
function onFocus() {
  run.warmUp();
  expireHistory();
}
onMounted(() => {
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", warmWhenVisible);
  void pack.start();
  void vault.start();
  void quick.start();
});
onBeforeUnmount(() => {
  window.removeEventListener("focus", onFocus);
  document.removeEventListener("visibilitychange", warmWhenVisible);
  clearTimeout(saveTimer);
  clearInterval(expireTimer);
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
  if (
    id ||
    historyOn.value ||
    destination === "home" ||
    destination === "settings" ||
    destination === "folder"
  )
    return navigate(destination, id);
  const last = lastOpened[destination];
  return navigate(destination, last && store.find(last) ? last : null);
}
/** "+ Ẩn thông tin mới": home on its first tab, even when home is already open. */
async function startNew() {
  await navigate("home");
  pageRef.value?.startOver?.();
}
/** Home's text field: an empty text page with the cursor in the box (decision 0172). */
async function startTyping() {
  await navigate("text");
  pageRef.value?.focusInput?.();
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
/** Wide windows can fold the sidebar away (decision 0172). The sidebar's column shrinks
 * while the sidebar slides by the same amount on the same curve (CSS), and the logo flies
 * between the sidebar and the top bar's centre, turning once on the way: a copy of it
 * travels above the page from where it is to where it will be, measured before the
 * layout starts moving, and both real logos stay hidden until it lands. With reduced
 * motion it simply switches. Kept in memory only: a launch starts with the sidebar open. */
const collapsed = ref(false);
const measuring = ref(false);
const flying = ref(false);
const shell = useTemplateRef<HTMLDivElement>("shell");
const sidebarExpand = useTemplateRef<HTMLButtonElement>("sidebarExpand");
const foldMs = 560;
const foldEase = "cubic-bezier(0.65, 0, 0.35, 1)";
const brandOf = (root: HTMLElement, folded: boolean) =>
  root.querySelector<HTMLElement>(folded ? ".topbar-brand" : ".sidebar .brand");
async function toggleCollapsed() {
  // One fold at a time: a second click mid-flight would launch a second logo.
  if (measuring.value || flying.value) return;
  const target = !collapsed.value;
  const root = shell.value;
  const from = root && brandOf(root, !target);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!root || !from || still) {
    collapsed.value = target;
    await nextTick();
  } else {
    const first = from.getBoundingClientRect();
    // Where the logo lands: the end state laid out once with transitions off, then undone.
    measuring.value = true;
    collapsed.value = target;
    await nextTick();
    const last = brandOf(root, target)!.getBoundingClientRect();
    collapsed.value = !target;
    await nextTick();
    void root.offsetWidth;
    measuring.value = false;
    await nextTick();
    void root.offsetWidth;
    // Now the real move: the layout transitions, the copy flies.
    const copy = from.cloneNode(true) as HTMLElement;
    copy.className = "brand brand-flight";
    copy.setAttribute("aria-hidden", "true");
    copy.tabIndex = -1;
    Object.assign(copy.style, {
      left: `${last.left}px`,
      top: `${last.top}px`,
      width: `${last.width}px`,
      height: `${last.height}px`,
    });
    document.body.append(copy);
    flying.value = true;
    collapsed.value = target;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const flight = copy.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
      { duration: foldMs, easing: foldEase },
    );
    copy.querySelector(".brand-mark")?.animate(
      [
        { rotate: "0deg", scale: "1" },
        { scale: "1.14", offset: 0.5 },
        { rotate: target ? "360deg" : "-360deg", scale: "1" },
      ],
      { duration: foldMs, easing: foldEase },
    );
    // A window hidden mid-fold may never paint the end: land the logo on time anyway.
    await Promise.race([
      flight.finished.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, foldMs + 150)),
    ]);
    copy.remove();
    flying.value = false;
  }
  if (collapsed.value) sidebarExpand.value?.focus();
  else sidebar.value?.focusStart();
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
  <div
    v-else-if="vault.checked.value"
    ref="shell"
    class="app-shell"
    :class="{ 'is-collapsed': collapsed, 'is-measuring': measuring, 'is-flying': flying }"
  >
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
      :folder="folderItem"
      :version="version"
      @navigate="openFormat"
      @close="closeSidebar"
      @collapse="toggleCollapsed"
      @start="startNew"
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
          ><button
            ref="sidebarExpand"
            class="sidebar-expand"
            aria-label="Mở thanh bên"
            title="Mở thanh bên"
            @click="toggleCollapsed"
          >
            <AppIcon name="sidebar" :size="18" /></button
          ><span v-if="topbarLabel">{{ topbarLabel }}</span>
        </div>
        <!-- Folded sidebar: its logo sits here, centred (decision 0172). Always rendered,
             shown only while folded, so its place can be measured before the move. -->
        <button
          class="brand topbar-brand"
          aria-label="OfflineMask — Trang chủ"
          @click="openFormat('home')"
        >
          <span class="brand-mark"><BrandMark :size="28" /></span
          ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
        </button>
      </header>
      <main
        :class="{
          'home-page': page === 'home',
          'wide-page': page === 'excel' || page === 'folder',
        }"
      >
        <!-- The text and spreadsheet pages stay alive across navigation, so the step,
             view and pasted reply are still there on return. All of it is RAM only. -->
        <KeepAlive include="WorkspacePage,SheetPage,DocPage,FolderPage">
          <HomePage
            v-if="page === 'home'"
            ref="pageRef"
            @navigate="openFormat"
            @start="navigate"
            @type="startTyping"
          />
          <SettingsPage v-else-if="page === 'settings'" ref="pageRef" />
          <FolderPage v-else-if="page === 'folder'" ref="pageRef" />
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
      <AppFooter :version="version" />
    </div>
  </div>
</template>
