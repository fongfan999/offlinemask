<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import DocPreview from "../components/DocPreview.vue";
import FileDropZone from "../components/FileDropZone.vue";
import MaskProgress from "../components/MaskProgress.vue";
import PasscodeSetup from "../components/PasscodeSetup.vue";
import RestorePanel from "../components/RestorePanel.vue";
import ReviewList from "../components/ReviewList.vue";
import {
  docKey,
  packKey,
  runKey,
  useProvided,
  vaultKey,
  type Page,
} from "../composables/context.ts";
import { docPreviewParagraphs, type DocRestore } from "../composables/useDocRun.ts";
import { applyReplacements } from "../core/doc/docx.ts";
import { sampleDocName, sampleDocx } from "../core/doc/sample.ts";
import type { DocSession } from "../core/sessions.ts";

/** Word and OpenDocument documents (decisions 0078, 0084), in the same three steps as the other pages. */
const props = defineProps<{ session?: DocSession }>();
const emit = defineEmits<{
  navigate: [destination: Page, id?: string | null];
  remove: [id: string];
}>();

const doc = useProvided(docKey);
const pack = useProvided(packKey);
const vault = useProvided(vaultKey);
const run = useProvided(runKey);
const historyOn = computed(() => vault.state.value === "unlocked");
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const primary = useTemplateRef<HTMLButtonElement>("primary");

const stepLabels = ["Ẩn thông tin", "Tải về và gửi AI", "Khôi phục"];
const restoreStep = ref(false);
const step = computed(() => (!props.session ? 1 : restoreStep.value ? 3 : 2));
const showOriginal = ref(false);
const status = ref("");
const restoreKind = ref<"file" | "text">("file");
// Plain data (not deeply reactive): its edits are posted to the worker as they are.
const restore = shallowRef<DocRestore | null>(null);
const restoreError = ref("");
const restoreBusy = ref(false);
const restoreSaved = ref(false);
const settingPasscode = ref(false);
const keptNotice = ref("");

const draft = doc.draft;
const review = computed(() => (props.session ? doc.review(props.session) : null));
watch(
  () => props.session?.id,
  () => {
    restoreStep.value = false;
    status.value = "";
    restoreSaved.value = false;
    doc.closeReturned(restore.value);
    restore.value = null;
    restoreError.value = "";
  },
);
watch(
  () => draft.value?.handle,
  () => (showOriginal.value = false),
);

const title = computed(() =>
  props.session
    ? props.session.fileName
    : draft.value
      ? draft.value.fileName
      : "Ẩn thông tin trong tài liệu.",
);
const subtitle = computed(() => {
  if (props.session)
    return step.value === 3
      ? `Tài liệu #${props.session.number}`
      : `Tài liệu #${props.session.number} · ${props.session.paragraphs.toLocaleString("vi-VN")} đoạn · Đọc lại rồi tải tệp đã ẩn về để gửi AI.`;
  return draft.value
    ? `${draft.value.paragraphs.length.toLocaleString("vi-VN")} đoạn · Xem trước rồi ẩn toàn bộ.`
    : "Mở tệp Word hoặc LibreOffice (.docx, .odt). Thông tin riêng tư được thay bằng mã như [TEN_1_…], ngay trên máy bạn; định dạng được giữ nguyên.";
});
const draftView = computed(() => {
  const current = draft.value;
  if (!current) return [];
  if (showOriginal.value)
    return current.paragraphs
      .slice(0, docPreviewParagraphs)
      .map((paragraph) => ({ text: paragraph.text, marks: [] }));
  return doc.preview.value;
});
const restoreView = computed(() => {
  const current = restore.value;
  if (!current) return [];
  return current.paragraphs
    .slice(0, docPreviewParagraphs)
    .map((paragraph) =>
      applyReplacements(paragraph.text, current.edits.paragraphs.get(paragraph.id) ?? []),
    );
});
const restoreStatus = computed(() => {
  const current = restore.value;
  if (!current) return "";
  if (!current.restored)
    return "Không tìm thấy mã thay thế của tài liệu này trong tệp. Hãy kiểm tra đúng tệp AI trả về.";
  return `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} mã thay thế.`;
});

/** Plain text has a page of its own: a dropped .txt or .md opens there, pasted and
 * ready to mask (decision 0083). */
const plainText = /\.(txt|md)$/i;
async function openFile(file: File) {
  if (!plainText.test(file.name)) return doc.openFile(file);
  doc.fileError.value = await run.openTextFile(file);
  if (!doc.fileError.value) emit("navigate", "text");
}
async function trySample() {
  const bytes = await sampleDocx();
  await doc.openFile(new File([new Uint8Array(bytes)], sampleDocName));
}
function newDoc() {
  doc.discardDraft();
  emit("navigate", "word");
}
async function download() {
  if (!props.session) return;
  status.value = "";
  try {
    if (await doc.download(props.session)) {
      status.value =
        "Đã lưu tệp đã ẩn. Gửi tệp này cho AI; khi có tệp trả về, mở ở bước Khôi phục.";
      restoreStep.value = true;
    }
  } catch {
    status.value = "Chưa lưu được tệp. Hãy thử lại.";
  }
}
async function openReturned(file: File) {
  if (!props.session) return;
  restoreBusy.value = true;
  restoreError.value = "";
  restoreSaved.value = false;
  doc.closeReturned(restore.value);
  restore.value = null;
  const result = await doc.openReturned(props.session, file);
  restoreBusy.value = false;
  if (typeof result === "string") restoreError.value = result;
  else restore.value = result;
}
async function downloadRestored() {
  if (!restore.value) return;
  try {
    restoreSaved.value = await doc.downloadRestored(restore.value);
  } catch {
    restoreError.value = "Chưa lưu được tệp. Hãy thử lại.";
  }
}
function anotherFile() {
  doc.closeReturned(restore.value);
  restore.value = null;
  restoreSaved.value = false;
}
function openStep(target: number) {
  if (!props.session) return;
  if (target === 1) {
    if (doc.reopen(props.session)) emit("navigate", "word");
    return;
  }
  restoreStep.value = target === 3;
}
function canOpenStep(target: number) {
  if (!props.session) return false;
  return (
    (target === 1 && doc.canReopen(props.session)) ||
    (target === 2 && step.value === 3) ||
    (target === 3 && step.value === 2)
  );
}

defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
  focusResult() {
    window.scrollTo({ top: 0 });
    primary.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <h1 ref="heading" tabindex="-1">{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div v-if="session || draft" class="editor-actions">
      <button v-if="session && historyOn" class="quiet-button" @click="emit('remove', session.id)">
        <AppIcon name="close" :size="15" />Xóa khỏi lịch sử
      </button>
      <button v-if="session" class="quiet-button" @click="newDoc">
        <AppIcon name="plus" :size="15" />Tạo mới
      </button>
      <button v-else-if="!doc.processing.value" class="quiet-button" @click="doc.discardDraft()">
        <AppIcon name="close" :size="15" />Chọn tệp khác
      </button>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Ẩn thông tin trong tài liệu">
    <nav class="stepper" aria-label="Các bước">
      <template v-for="(label, index) in stepLabels" :key="label">
        <span
          v-if="index"
          class="step-line"
          :class="{ 'is-done': index < step }"
          aria-hidden="true"
        ></span>
        <button
          type="button"
          class="step"
          :class="{
            'is-current': index + 1 === step,
            'is-done': index + 1 < step,
            'is-upcoming': index + 1 > step,
          }"
          :aria-label="`Bước ${index + 1}: ${label}`"
          :aria-current="index + 1 === step ? 'step' : undefined"
          :disabled="!canOpenStep(index + 1)"
          @click="openStep(index + 1)"
        >
          <span class="step-number" aria-hidden="true"
            ><AppIcon v-if="index + 1 < step" name="check" :size="12" /><span
              v-else-if="index + 1 === step && doc.processing.value"
              class="spinner"
            ></span
            ><template v-else>{{ index + 1 }}</template></span
          ><span class="step-label">{{ label }}</span>
        </button>
      </template>
    </nav>

    <!-- Step 1: open a document, preview, mask all. -->
    <div v-if="!session" class="step-panel">
      <template v-if="!draft">
        <FileDropZone
          icon="file"
          title="Kéo thả tài liệu vào đây"
          hint=".docx, .odt · tối đa 20 MB"
          accept=".docx,.odt,.txt,.md"
          :busy="doc.opening.value"
          @file="openFile"
        />
        <div class="input-hint-row">
          <button type="button" class="sample-link" @click="trySample">Thử với tệp mẫu</button>
        </div>
        <p v-if="doc.fileError.value" class="input-error drop-error" role="alert">
          {{ doc.fileError.value }}
        </p>
      </template>
      <template v-else>
        <template v-if="!doc.progress.value">
          <header class="card-header sheet-toolbar">
            <p class="sheet-hint">Họ tên, số điện thoại, email, số tài khoản… được thay bằng mã.</p>
            <div class="view-switch" aria-label="Chọn bản xem">
              <button :aria-pressed="!showOriginal" @click="showOriginal = false">
                Xem trước bản đã ẩn</button
              ><button :aria-pressed="showOriginal" @click="showOriginal = true">Bản gốc</button>
            </div>
          </header>
        </template>
        <MaskProgress v-if="doc.progress.value" :progress="doc.progress.value" />
        <DocPreview v-else :paragraphs="draftView" :label="`Xem trước ${draft.fileName}`" />
        <p v-if="!doc.progress.value" class="sheet-caption-line">
          Xem trước {{ Math.min(docPreviewParagraphs, draft.paragraphs.length) }} /
          {{ draft.paragraphs.length.toLocaleString("vi-VN") }} đoạn đầu<template
            v-if="doc.previewScanning.value"
          >
            · <span class="spinner" aria-hidden="true"></span> Đang đọc…</template
          >
        </p>
        <p v-if="!pack.ready.value && !doc.progress.value" class="sheet-note">
          <AppIcon name="info" :size="14" />Đang tìm email, số điện thoại, số tài khoản. Tải gói
          nhận diện để tìm cả họ tên và địa chỉ.
        </p>
        <p v-for="note in doc.progress.value ? [] : draft.notes" :key="note" class="sheet-note">
          <AppIcon name="info" :size="14" />{{ note }}
        </p>
        <p v-if="doc.processingError.value" class="input-error drop-error" role="alert">
          {{ doc.processingError.value }}
        </p>
        <footer class="card-footer sheet-footer">
          <button v-if="doc.processing.value" class="quiet-button" @click="doc.cancelMask()">
            Hủy
          </button>
          <button
            ref="primary"
            class="primary-action"
            :disabled="doc.processing.value"
            @click="doc.maskAll()"
          >
            <span v-if="doc.processing.value" class="spinner" aria-hidden="true"></span
            ><AppIcon v-else name="sparkle" :size="17" />{{
              doc.processing.value ? "Đang ẩn…" : "Ẩn toàn bộ tài liệu"
            }}<AppIcon name="arrow" :size="16" />
          </button>
        </footer>
      </template>
    </div>

    <!-- Step 2: read the masked result and save the masked copy. -->
    <div v-else-if="step === 2" class="step-panel">
      <p class="sheet-summary">
        <AppIcon name="check" :size="15" />Đã ẩn {{ session.masked.toLocaleString("vi-VN") }} chỗ ·
        {{ session.findings.length.toLocaleString("vi-VN") }} mã thay thế
      </p>
      <DocPreview :paragraphs="session.preview" :label="`Bản đã ẩn, ${session.fileName}`" />
      <p class="sheet-caption-line">
        {{ Math.min(docPreviewParagraphs, session.paragraphs) }} /
        {{ session.paragraphs.toLocaleString("vi-VN") }} đoạn đầu của bản đã ẩn
      </p>
      <ReviewList
        v-if="review?.length"
        :groups="review"
        @change="(aliases, keep) => doc.setKept(session!, aliases, keep)"
      />
      <div
        v-if="!historyOn && (vault.state.value === 'none' || keptNotice)"
        class="keep-offer"
        role="status"
      >
        <AppIcon name="lock" :size="18" />
        <div class="keep-offer-body">
          <template v-if="keptNotice"
            ><strong>{{ keptNotice }}</strong></template
          >
          <template v-else-if="!settingPasscode">
            <strong>Giữ ứng dụng mở để khôi phục tệp này sau.</strong>
            <span>Đóng ứng dụng sẽ mất bảng mã thay thế. Đặt mật mã để lưu vào lịch sử.</span>
          </template>
          <template v-else>
            <strong>Đặt mật mã cho OfflineMask</strong>
            <span
              >Ứng dụng sẽ hỏi mật mã khi khởi động. Quên mật mã thì phải xóa hết và bắt đầu
              lại.</span
            >
            <PasscodeSetup
              compact
              @created="
                settingPasscode = false;
                keptNotice = 'Đã bật lịch sử. Tài liệu này có trong thanh bên.';
              "
            />
          </template>
        </div>
        <div v-if="!keptNotice" class="keep-offer-actions">
          <button v-if="settingPasscode" class="quiet-button" @click="settingPasscode = false">
            Hủy
          </button>
          <button v-else class="quiet-button accent" @click="settingPasscode = true">
            Đặt mật mã
          </button>
        </div>
      </div>
      <p v-if="!doc.canReopen(session)" class="sheet-note">
        <AppIcon name="info" :size="14" />Tệp gốc không còn mở trong lần này, nên không tải lại được
        bản đã ẩn. Bạn vẫn khôi phục được tệp AI trả về ở bước 3.
      </p>
      <footer class="card-footer sheet-footer">
        <button v-if="!doc.canReopen(session)" class="quiet-button" @click="openStep(3)">
          Đến bước Khôi phục<AppIcon name="arrow" :size="15" />
        </button>
        <button v-else ref="primary" class="primary-action" @click="download">
          <AppIcon name="download" :size="17" />Tải tệp đã ẩn<AppIcon name="arrow" :size="16" />
        </button>
      </footer>
    </div>

    <!-- Step 3: restore the AI's returned document, or a pasted reply. -->
    <div v-else class="step-panel">
      <header class="card-header">
        <div class="view-switch" aria-label="Khôi phục từ">
          <button :aria-pressed="restoreKind === 'file'" @click="restoreKind = 'file'">
            Tệp AI trả về</button
          ><button :aria-pressed="restoreKind === 'text'" @click="restoreKind = 'text'">
            Câu trả lời dạng chữ
          </button>
        </div>
      </header>
      <template v-if="restoreKind === 'file'">
        <FileDropZone
          v-if="!restore"
          icon="undo"
          title="Kéo thả tệp AI trả về vào đây"
          hint="mã thay thế được đổi lại thành thông tin thật"
          accept=".docx,.odt"
          :busy="restoreBusy"
          @file="openReturned"
        />
        <template v-else>
          <p class="sheet-summary" role="status">
            <AppIcon :name="restore.restored ? 'check' : 'info'" :size="15" />{{ restoreStatus }}
          </p>
          <p v-if="restore.unknown.length" class="sheet-note restore-unknown">
            {{ restore.unknown.length }} mã thay thế không thuộc tài liệu này được giữ nguyên:
            {{ restore.unknown.slice(0, 5).join(", ") }}{{ restore.unknown.length > 5 ? "…" : "" }}
          </p>
          <DocPreview
            :paragraphs="restoreView"
            tone="value"
            :label="`Bản đã khôi phục, ${restore.fileName}`"
          />
        </template>
        <p v-if="restoreError" class="input-error drop-error" role="alert">{{ restoreError }}</p>
        <footer class="card-footer sheet-footer">
          <button class="quiet-button" @click="openStep(2)">
            <AppIcon name="eye" :size="15" />Xem lại bản đã ẩn
          </button>
          <template v-if="restore && restoreSaved">
            <button class="quiet-button" @click="anotherFile">Khôi phục tệp khác</button>
            <button class="quiet-button" @click="newDoc">
              <AppIcon name="plus" :size="15" />Ẩn tài liệu mới
            </button>
          </template>
          <button
            v-else-if="restore && restore.restored"
            class="primary-action"
            @click="downloadRestored"
          >
            <AppIcon name="download" :size="17" />Tải tệp đã khôi phục
          </button>
          <button v-else-if="restore" class="quiet-button" @click="anotherFile">
            Chọn tệp khác
          </button>
        </footer>
      </template>
      <template v-else>
        <RestorePanel
          :session-id="session.id"
          :analysis="{ findings: session.findings, spans: [] }"
          new-label="Ẩn tài liệu mới"
          @new-text="newDoc"
        />
        <footer class="card-footer">
          <button class="quiet-button" @click="openStep(2)">
            <AppIcon name="eye" :size="15" />Xem lại bản đã ẩn
          </button>
        </footer>
      </template>
    </div>
  </section>
  <p v-if="status" class="feedback" role="status">{{ status }}</p>
</template>
