<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import AppIcon from "../components/AppIcon.vue";
import BrandMark from "../components/BrandMark.vue";
import FileDropZone from "../components/FileDropZone.vue";
import MaskingPreview from "../components/MaskingPreview.vue";
import {
  docKey,
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
  /** A link: Cài đặt, or a format's page as the user last left it. */
  navigate: [destination: Page];
  /** The start box: the format's first step, where the file or text just went. */
  start: [destination: Page];
}>();
const pack = useProvided(packKey);
const run = useProvided(runKey);
const sheet = useProvided(sheetKey);
const doc = useProvided(docKey);
const quick = useProvided(quickKey);
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
    <h1 ref="heading" tabindex="-1">Ẩn thông tin riêng<span>trước khi chia sẻ với AI.</span></h1>
    <p>Số tài khoản, số điện thoại, họ tên… được đổi thành mã thay thế ngay trên máy bạn.</p>
    <MaskingPreview />
  </div>
  <section class="start-box" aria-label="Bắt đầu">
    <FileDropZone
      icon="upload"
      title="Kéo thả tệp hoặc dán văn bản"
      :hint="`Excel, CSV, Word, PDF, TXT · dán bằng ${pasteKey}`"
      :accept="accept"
      compact
      @file="startWith"
    />
    <p v-if="startError" class="input-error start-error" role="alert">{{ startError }}</p>
    <div class="start-notes">
      <span><AppIcon name="lock" :size="13" />Tệp và văn bản không rời khỏi máy bạn.</span>
      <button type="button" class="sample-link" @click="startWithText(sampleText)">
        Xem thử với ví dụ
      </button>
    </div>
    <!-- The other way in, until it works (decision 0099). -->
    <p v-if="quickOffer" class="start-quick">
      <BrandMark :size="14" />Hoặc bôi đen chữ ngay trong ChatGPT, Claude hay Gemini để ẩn tại chỗ.
      <button type="button" class="link-button" @click="emit('navigate', 'settings')">
        Bật Ẩn nhanh
      </button>
    </p>
  </section>
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
