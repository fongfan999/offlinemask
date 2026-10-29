<script setup lang="ts">
import type { PickedFolder } from "../adapters/folder.ts";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import AppIcon from "../components/AppIcon.vue";
import BrandMark from "../components/BrandMark.vue";
import FileDropZone from "../components/FileDropZone.vue";
import FolderPicker from "../components/FolderPicker.vue";
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
import { sampleText } from "../core/review.ts";
import { packProgress } from "../composables/useRecognitionPack.ts";

const emit = defineEmits<{
  /** A link: Cài đặt, Nhận lại bản đầy đủ, or a format's page as last left. */
  navigate: [destination: Page];
  /** The start box: the format's first step, where the file or text just went. */
  start: [destination: Page];
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
/** "Gõ hoặc dán chữ": an empty text page, for people who do not know about ⌘V. */
function typeText() {
  run.processingError.value = "";
  emit("start", "text");
}
function paste(event: ClipboardEvent) {
  const file = event.clipboardData?.files[0];
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!file && !text.trim()) return;
  event.preventDefault();
  if (file) void startWith(file);
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
  <!-- One place to start (decision 0172): a file, a folder or text, the app sorts it. -->
  <section class="start-box" aria-label="Bắt đầu">
    <FileDropZone
      icon="upload"
      title="Kéo tệp hoặc cả thư mục vào đây"
      :hint="`Word, Excel, PDF · dán chữ bằng ${pasteKey}`"
      :accept="accept"
      compact
      folders
      @file="startWith"
      @folder="startFolder"
    />
    <p v-if="startError" class="input-error start-error" role="alert">{{ startError }}</p>
    <div class="start-actions">
      <FolderPicker @folder="startFolder" />
      <button type="button" class="sample-link" @click="typeText">Gõ hoặc dán chữ</button>
      <button type="button" class="sample-link" @click="startWithText(sampleText)">
        Xem thử với ví dụ
      </button>
    </div>
    <p class="start-private">
      <AppIcon name="lock" :size="13" />Tệp và chữ không rời khỏi máy bạn.
    </p>
    <!-- The other way in, until it works (decision 0099). -->
    <p v-if="quickOffer" class="start-quick">
      <BrandMark :size="14" />Hoặc bôi đen chữ ngay trong ChatGPT, Claude hay Gemini để ẩn tại chỗ.
      <button type="button" class="link-button" @click="emit('navigate', 'settings')">
        Bật Ẩn nhanh
      </button>
    </p>
  </section>
  <!-- How it goes, in the website's three steps and words; the third has its own page
       (decision 0172). -->
  <ol class="home-steps" aria-label="Cách dùng">
    <li>
      <span class="home-step-number">01</span><strong>Ẩn thông tin riêng</strong>
      <p>Kéo tệp hoặc dán chữ ở trên. Họ tên, số điện thoại, số tài khoản… thành mã.</p>
    </li>
    <li>
      <span class="home-step-number">02</span><strong>Hỏi AI như mọi khi</strong>
      <p>Dán bản đã ẩn vào ChatGPT, Gemini hay AI bạn hay dùng.</p>
    </li>
    <li>
      <span class="home-step-number">03</span><strong>Nhận lại bản đầy đủ</strong>
      <p>Dán câu trả lời của AI vào OfflineMask, mã tự đổi về thông tin thật.</p>
      <button type="button" class="link-button" @click="emit('navigate', 'restore')">
        Nhận lại bản đầy đủ<AppIcon name="arrow" :size="13" />
      </button>
    </li>
  </ol>
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
</template>
