<script setup lang="ts">
import type { PickedFolder } from "../adapters/folder.ts";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import AppIcon from "../components/AppIcon.vue";
import BrandMark from "../components/BrandMark.vue";
import FileDropZone from "../components/FileDropZone.vue";
import FolderPicker from "../components/FolderPicker.vue";
import RestoreBox from "../components/RestoreBox.vue";
import {
  docKey,
  folderKey,
  packKey,
  quickKey,
  runKey,
  sheetKey,
  useProvided,
  type Page,
} from "../composables/context.ts";
import { fileKind, fileKindErrors } from "../core/file-kind.ts";
import { quickDirection } from "../core/quick-actions.ts";
import { sampleText } from "../core/review.ts";
import { packProgress } from "../composables/useRecognitionPack.ts";
import { version } from "../../package.json";

const emit = defineEmits<{
  /** A link: Cài đặt, or a format's page as last left. */
  navigate: [destination: Page];
  /** The start box: the format's first step, where the file or text just went. */
  start: [destination: Page];
  /** The text field: an empty text page with the cursor in it. */
  type: [];
}>();
const pack = useProvided(packKey);
const run = useProvided(runKey);
const sheet = useProvided(sheetKey);
const doc = useProvided(docKey);
const quick = useProvided(quickKey);
const folder = useProvided(folderKey);
/** A dropped or picked folder, or several files, goes to the folder page (decision 0171).
 * Only home offers the folder picker: a folder may hold every format. */
function startFolder(picked: PickedFolder) {
  void folder.load(picked);
  emit("start", "folder");
}
/** The version and the website sit under the page, not in the sidebar, which is often
 * folded away (decision 0172). */
const websiteError = ref("");
async function visitWebsite(event: MouseEvent) {
  websiteError.value = "";
  try {
    await openProductWebsite(event);
  } catch {
    websiteError.value = "Chưa mở được trình duyệt. Bạn có thể truy cập OfflineMask.com.";
  }
}
/** Ẩn nhanh, the way in from other apps (decision 0099): offered while it does not work. */
const quickOffer = computed(
  () => quick.desktop && quick.popoverSupported.value && !quick.quickReady.value,
);

/** One place to start (decision 0089): drop or choose any supported file, or paste
 * text anywhere on the page; the app opens the right page with it. */
const accept = ".xlsx,.xls,.ods,.csv,.docx,.odt,.pdf,.txt,.md";
const pasteKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘V" : "Ctrl+V";
const startError = ref("");
async function startWith(file: File) {
  startError.value = "";
  const kind = fileKind(file.name);
  if (kind === "text") {
    startError.value = await run.openTextFile(file);
    if (!startError.value) emit("start", "text");
  } else if (kind === "excel") {
    emit("start", "excel");
    void sheet.openFile(file);
  } else if (kind === "word") {
    emit("start", "word");
    void doc.openFile(file);
  } else startError.value = fileKindErrors[kind];
}
function startWithText(text: string) {
  if (run.processing.value) {
    startError.value = "Trang Văn bản đang ẩn một văn bản khác. Hãy thử lại khi xong.";
    return;
  }
  run.draft.value = text;
  run.processingError.value = "";
  emit("start", "text");
}
/** What the drop zone opens, in the words people use for them (decision 0172). */
const formats = [
  { label: "Word", ext: ".docx", icon: "file" },
  { label: "PDF", ext: ".pdf", icon: "file" },
  { label: "Excel", ext: ".xlsx .xls", icon: "table" },
  { label: "CSV", ext: ".csv", icon: "table" },
  { label: "OpenDocument", ext: ".odt .ods", icon: "file" },
  { label: "Văn bản", ext: ".txt .md", icon: "text" },
  { label: "Cả thư mục", ext: "", icon: "folder" },
] as const;
/** Which half of the job the box is for; a pasted AI reply switches it (decision 0172). */
const mode = ref<"hide" | "restore">("hide");
const restoreBox = useTemplateRef<InstanceType<typeof RestoreBox>>("restoreBox");
const known = computed(() => [...quick.knownFindings.value, ...folder.findings.value]);
async function openRestore(text: string) {
  mode.value = "restore";
  await nextTick();
  restoreBox.value?.fill(text);
}
function paste(event: ClipboardEvent) {
  // Typing into the restore box (or any field) is the field's own business.
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable]")) return;
  const file = event.clipboardData?.files[0];
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!file && !text.trim()) return;
  event.preventDefault();
  if (file) void startWith(file);
  else if (mode.value === "restore" || quickDirection(text, [known.value]) === "restore")
    void openRestore(text);
  else startWithText(text);
}
onMounted(() => window.addEventListener("paste", paste));
onBeforeUnmount(() => window.removeEventListener("paste", paste));
const heading = useTemplateRef<HTMLHeadingElement>("heading");
defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
});

interface PackNotice {
  icon: "download";
  title: string;
  detail?: string;
  action?: { label: string; run: () => void; needsDesktop?: boolean };
}
const packNotice = computed<PackNotice | null>(() => {
  const status = pack.status.value;
  const size = formatModelBytes(status.total);
  const download = (label: string) => ({
    label,
    run: () => void pack.run("download"),
    needsDesktop: true,
  });
  const progress = () => ({ label: "Xem tiến độ", run: () => emit("navigate", "settings") });
  switch (status.stage) {
    case "checking":
      return null;
    // Once installed there is nothing to do here; Cài đặt shows the pack (decision 0088).
    case "ready":
      return null;
    case "downloading":
      return {
        icon: "download",
        title: `Đang tải về… ${packProgress(status)} %`,
        detail: "Chỉ cần tải một lần.",
        action: progress(),
      };
    case "installing":
    case "cancelling":
      return {
        icon: "download",
        title: `Đang cài đặt… ${packProgress(status)} %`,
        detail: "Chỉ cần tải một lần.",
        action: progress(),
      };
    case "paused":
      return {
        icon: "download",
        title: "Đã tạm dừng tải.",
        detail: "Phần đã tải được giữ lại.",
        action: download("Tiếp tục tải"),
      };
    case "error":
      return {
        icon: "download",
        title: "Chưa tải xong.",
        detail: pack.error.value || "Kiểm tra kết nối rồi thử lại.",
        action: download("Thử lại"),
      };
    default:
      return {
        icon: "download",
        title: `Muốn tự ẩn cả họ tên và địa chỉ? Tải thêm gói nhận diện (${size}, chỉ một lần).`,
        detail:
          pack.error.value || "Không bắt buộc: email, số điện thoại, số tài khoản đã được ẩn ngay.",
        action: download("Tải về"),
      };
  }
});
</script>

<template>
  <div class="introduction">
    <span class="hero-logo brand-mark" aria-hidden="true">
      <BrandMark :size="38" />
    </span>
    <!-- The website's line and swaps, so the app opens on what the visitor already read. -->
    <h1 ref="heading" tabindex="-1"><em>AI</em> không nên biết bạn đang nói về <em>ai</em>.</h1>
    <p>Ẩn thông tin riêng trước khi hỏi AI, nhận lại bản đầy đủ khi AI trả lời.</p>
    <div class="home-swaps" aria-hidden="true">
      <span class="home-swap"><s>Phong Phan</s><b>[TEN_1_4e8c]</b></span>
      <span class="home-swap"><s>0901234567</s><b>[SDT_1_4e8c]</b></span>
    </div>
  </div>
  <!-- Home holds both ends of the job (decision 0172): hide before asking the AI, and put
       the real information back into its reply. -->
  <div class="home-tabs" role="tablist" aria-label="Việc cần làm">
    <button
      id="tab-hide"
      role="tab"
      :aria-selected="mode === 'hide'"
      aria-controls="panel-hide"
      @click="mode = 'hide'"
    >
      <AppIcon name="mask" :size="17" />Ẩn thông tin riêng
    </button>
    <button
      id="tab-restore"
      role="tab"
      :aria-selected="mode === 'restore'"
      aria-controls="panel-restore"
      @click="mode = 'restore'"
    >
      <AppIcon name="undo" :size="17" />Nhận lại bản đầy đủ
    </button>
  </div>
  <section
    v-if="mode === 'hide'"
    id="panel-hide"
    class="start-box"
    role="tabpanel"
    aria-labelledby="tab-hide"
  >
    <FileDropZone
      icon="upload"
      title="Kéo tệp hoặc cả thư mục vào đây"
      :accept="accept"
      folders
      @file="startWith"
      @folder="startFolder"
    >
      <!-- Every kind the app opens, named the way people know them. -->
      <span class="home-formats" aria-label="Mở được">
        <span v-for="format in formats" :key="format.label" class="home-format"
          ><AppIcon :name="format.icon" :size="14" />{{ format.label
          }}<small v-if="format.ext">{{ format.ext }}</small></span
        >
      </span>
    </FileDropZone>
    <p v-if="startError" class="input-error start-error" role="alert">{{ startError }}</p>
    <!-- Looks like the text box it opens, so typing is as obvious as dropping. -->
    <button type="button" class="home-type" @click="emit('type')">
      <AppIcon name="compose" :size="17" /><span>Hoặc gõ, dán văn bản vào đây…</span
      ><kbd>{{ pasteKey }}</kbd>
    </button>
    <div class="start-actions">
      <FolderPicker @folder="startFolder" />
      <button type="button" class="sample-link" @click="startWithText(sampleText)">
        Xem thử với ví dụ
      </button>
      <span class="start-private"
        ><AppIcon name="lock" :size="13" />Thông tin của bạn không rời khỏi máy này.</span
      >
    </div>
    <!-- The other way in, until it works (decision 0099). -->
    <p v-if="quickOffer" class="start-quick">
      <BrandMark :size="14" />Hoặc bôi đen chữ ngay trong ChatGPT, Claude hay Gemini để ẩn tại chỗ.
      <button type="button" class="link-button" @click="emit('navigate', 'settings')">
        Bật Ẩn nhanh
      </button>
    </p>
  </section>
  <div v-else id="panel-restore" role="tabpanel" aria-labelledby="tab-restore">
    <RestoreBox ref="restoreBox" @hide="mode = 'hide'" />
  </div>
  <div v-if="packNotice" class="pack-notice" role="status">
    <AppIcon :name="packNotice.icon" :size="16" />
    <p>
      {{ packNotice.title }}<span v-if="packNotice.detail">{{ packNotice.detail }}</span>
    </p>
    <button
      v-if="packNotice.action"
      class="quiet-button"
      :disabled="pack.busy.value || (packNotice.action.needsDesktop && !desktopModels)"
      @click="packNotice.action.run()"
    >
      {{ packNotice.action.label }}<AppIcon name="chevron" :size="12" />
    </button>
  </div>
  <footer class="home-footer">
    <a :href="productWebsite" target="_blank" rel="noopener noreferrer" @click="visitWebsite">
      OfflineMask.com<AppIcon name="external" :size="12" /></a
    ><span aria-hidden="true">·</span><span class="app-version">Phiên bản {{ version }}</span>
    <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
  </footer>
</template>
