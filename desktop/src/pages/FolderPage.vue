<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import type { PickedFolder } from "../adapters/folder.ts";
import AppIcon from "../components/AppIcon.vue";
import CannotOpen from "../components/CannotOpen.vue";
import BrandMark from "../components/BrandMark.vue";
import FileDropZone from "../components/FileDropZone.vue";
import JobTime from "../components/JobTime.vue";
import LongJobNote from "../components/LongJobNote.vue";
import MaskProgress from "../components/MaskProgress.vue";
import RestoreBox from "../components/RestoreBox.vue";
import ReviewList from "../components/ReviewList.vue";
import SheetPreview from "../components/SheetPreview.vue";
import { folderKey, packKey, useProvided } from "../composables/context.ts";

/** A whole folder (decision 0171): what it holds and how long it will take, column
 * choices per spreadsheet layout, one run, one review of the folder's values, and a
 * mirrored folder of masked copies. */
const emit = defineEmits<{ navigate: ["home"] }>();
const folder = useProvided(folderKey);
const pack = useProvided(packKey);
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const primary = useTemplateRef<HTMLButtonElement>("primary");
const saveError = ref("");
const shownFiles = 200;

const phase = folder.phase;
/** The same three steps as one file (decision 0171): hide, save and send to AI, restore.
 * Step 3 opens once the masked copies are saved, since that is what goes to the AI. */
const stepLabels = ["Ẩn thông tin", "Tải về và gửi AI", "Khôi phục"];
const restoreStep = ref(false);
const step = computed(() =>
  ["review", "saving", "saved"].includes(phase.value) ? (restoreStep.value ? 3 : 2) : 1,
);
watch(phase, (value) => {
  if (value !== "saved") restoreStep.value = false;
});
/** Back to step 1 only before saving: hiding again makes new codes. */
function canOpenStep(target: number) {
  if (target === 1) return phase.value === "review";
  if (target === 2) return step.value === 3;
  return step.value === 2 && phase.value === "saved";
}
function openStep(target: number) {
  if (!canOpenStep(target)) return;
  if (target === 1) folder.edit();
  restoreStep.value = target === 3;
}
const count = (n: number) => n.toLocaleString("vi-VN");
/** A large file masked here on its own (decision 0174) is a file, not a folder. */
const subject = computed(() => (folder.files.value.length === 1 ? "Tệp này" : "Thư mục này"));
const emptyReason = computed(
  () =>
    (folder.failed.value.length
      ? "Không mở được tệp nào trong thư mục này; lý do ở bên dưới."
      : folder.skipped.value.length
        ? "Thư mục này chỉ có những loại tệp OfflineMask chưa đọc được."
        : "Thư mục này trống.") + "\nHãy chọn một thư mục có tệp Word, PDF, Excel, CSV hoặc TXT.",
);
const docs = computed(() => folder.readable.value.filter((file) => file.kind === "word").length);
const sheets = computed(() => folder.readable.value.length - docs.value);
const subtitle = computed(() => {
  if (phase.value === "empty")
    return "Kéo thả một thư mục để ẩn mọi tài liệu và bảng tính trong đó.";
  const parts = [`${count(folder.files.value.length)} tệp`];
  if (docs.value) parts.push(`${count(docs.value)} tài liệu`);
  if (sheets.value) parts.push(`${count(sheets.value)} bảng tính`);
  return parts.join(" - ");
});
const surveyed = computed(
  () => folder.files.value.filter((file) => !["waiting", "reading"].includes(file.status)).length,
);
/** The file being read now, so a slow one does not look like a stall. */
const currentFile = computed(
  () => folder.files.value.find((file) => file.status === "reading")?.path ?? "",
);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const hidden = computed(() => folder.masked.value.reduce((sum, file) => sum + file.masked, 0));
const statusLabel: Record<string, string> = {
  waiting: "Chờ",
  reading: "Đang đọc",
  ready: "Sẵn sàng",
  masking: "Đang ẩn",
  masked: "Đã ẩn",
  saved: "Đã lưu",
  failed: "Lỗi",
};
const baseName = (path: string) => path.split("/").pop() ?? path;
/** A few names, then how many more: "A, B và 3 cột khác". */
const someNames = (names: string[], noun: string, shown = 2) =>
  names.length <= shown + 1
    ? names.join(", ")
    : `${names.slice(0, shown).join(", ")} và ${count(names.length - shown)} ${noun} khác`;
/** The spreadsheets that share a layout: a group is named by its files, not by the sheet
 * that happened to be read first, so every spreadsheet in the folder can be found. */
const layoutFiles = (key: string) =>
  folder.readable.value
    .filter((file) => file.kind === "excel" && file.sheets.some((sheet) => sheet.layout === key))
    .map((file) => baseName(file.path));
const sheetFiles = computed(() => folder.readable.value.filter((file) => file.kind === "excel"));
const docFiles = computed(() => folder.readable.value.filter((file) => file.kind === "word"));
/** What happens to a group's columns, naming them: people choose by column, not by count. */
const layoutSummary = (layout: { header: string[]; plans: readonly { mode: string }[] }) => {
  const named = (mode: string) =>
    layout.header.filter((_, i) => layout.plans[i]?.mode === mode).map((name) => name || "(trống)");
  const hide = named("hide");
  const scan = named("scan");
  const keep = layout.plans.length - hide.length - scan.length;
  const parts: string[] = [];
  if (hide.length) parts.push(`Ẩn cả cột ${someNames(hide, "cột")}`);
  if (scan.length) parts.push(`tìm và ẩn trong cột ${someNames(scan, "cột")}`);
  if (keep) parts.push(`giữ nguyên ${count(keep)} cột`);
  return capital(parts.join(" - ")) || "Không có cột nào";
};

/** Another folder starts where every job does: home, whose drop zone takes folders. */
function another() {
  folder.reset();
  emit("navigate", "home");
}
async function open(picked: PickedFolder) {
  saveError.value = "";
  await folder.load(picked);
}
async function save() {
  saveError.value = "";
  try {
    await folder.save();
  } catch {
    saveError.value = "Chưa lưu được thư mục. Hãy chọn nơi lưu khác rồi thử lại.";
    if (folder.phase.value === "saving") folder.phase.value = "review";
  }
}

defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
  focusResult() {
    primary.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <h1 ref="heading" tabindex="-1">{{ folder.name.value || "Ẩn cả thư mục" }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div
      v-if="
        phase !== 'empty' &&
        !folder.busy.value &&
        !(phase === 'ready' && !folder.readable.value.length)
      "
      class="editor-actions"
    >
      <button class="quiet-button" @click="another">
        <AppIcon name="plus" :size="15" />Tạo mới
      </button>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Ẩn thông tin trong thư mục">
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
              v-else-if="index + 1 === step && folder.busy.value"
              class="spinner"
            ></span
            ><template v-else>{{ index + 1 }}</template></span
          ><span class="step-label">{{ label }}</span>
        </button>
      </template>
    </nav>

    <!-- Step 3: a reply or a returned file, restored with this folder's codes. -->
    <RestoreBox
      v-if="step === 3"
      :scope="folder.findings.value"
      subject="thư mục"
      new-label="Ẩn thư mục khác"
      @hide="another"
    />

    <!-- Step 1: pick a folder. -->
    <div v-else-if="phase === 'empty'" class="step-panel">
      <FileDropZone
        icon="upload"
        title="Kéo thả thư mục vào đây"
        hint="Word, PDF, Excel, CSV, TXT bên trong"
        accept=".docx,.odt,.pdf,.txt,.md,.xlsx,.xls,.ods,.csv"
        folders
        directory
        @folder="open"
      />
    </div>

    <!-- Read each file once to size the work: a count, a bar and the file in hand. -->
    <div v-else-if="phase === 'surveying'" class="step-panel">
      <div class="sheet-progress folder-survey" role="status" aria-live="polite">
        <p class="sheet-progress-title">
          <span class="spinner" aria-hidden="true"></span>Đang xem trong thư mục...
          <span class="folder-survey-count"
            >{{ count(surveyed) }} / {{ count(folder.files.value.length) }} tệp</span
          >
        </p>
        <progress
          class="pack-progress"
          :value="surveyed"
          :max="Math.max(1, folder.files.value.length)"
          aria-label="Đang xem trong thư mục"
        ></progress>
        <p class="sheet-progress-detail folder-survey-file">{{ currentFile }}</p>
        <button type="button" class="quiet-button" @click="folder.cancel()">Hủy</button>
      </div>
    </div>

    <template v-else>
      <div class="step-panel">
        <!-- What the folder holds, how long it takes, and column choices. -->
        <!-- Nothing to hide: an empty folder, or only files it cannot read. -->
        <CannotOpen
          v-if="phase === 'ready' && !folder.readable.value.length"
          title="Không có tệp nào để ẩn"
          :detail="emptyReason"
          button="Chọn thư mục khác"
          @again="another"
        />
        <template v-else-if="phase === 'ready'">
          <LongJobNote :seconds="folder.estimate.value" :subject="subject" />
          <!-- Files it cannot open come first, folded to one line like the long-job note. -->
          <details v-if="folder.failed.value.length" class="long-job-note is-warning">
            <summary>
              <AppIcon name="info" :size="16" /><span
                ><strong>{{ count(folder.failed.value.length) }} tệp không mở được</strong>, sẽ
                không được ẩn</span
              ><AppIcon class="folder-chevron" name="chevron" :size="14" />
            </summary>
            <ul>
              <li v-for="file in folder.failed.value" :key="file.path">
                <strong>{{ file.path }}</strong
                >: {{ file.error }}
              </li>
            </ul>
          </details>
          <p class="folder-ready" role="note">
            <AppIcon name="eye" :size="16" /><span
              ><strong>Xem lại trước khi ẩn.</strong>
              {{
                folder.layouts.value.length
                  ? "Mở từng bảng tính để xem cột nào sẽ được ẩn, rồi bấm"
                  : "Kiểm tra các tệp bên dưới, rồi bấm"
              }}
              "Ẩn {{ count(folder.readable.value.length) }} tệp".</span
            >
          </p>
          <p v-if="!pack.ready.value" class="sheet-note">
            <AppIcon name="info" :size="14" />Đang tìm email, số điện thoại, số tài khoản. Tải gói
            nhận diện để tìm cả họ tên và địa chỉ.
          </p>

          <section v-if="folder.layouts.value.length" class="folder-layouts">
            <h2 class="folder-section-title">Bảng tính - {{ count(sheetFiles.length) }} tệp</h2>
            <p v-if="folder.layouts.value.length < sheetFiles.length" class="sheet-hint">
              Các bảng tính có cùng các cột được gom lại: chọn một lần cho cả nhóm.
            </p>
            <details
              v-for="layout in folder.layouts.value"
              :key="layout.key"
              class="folder-layout"
              :open="folder.layouts.value.length === 1"
            >
              <summary>
                <AppIcon name="table" :size="16" /><span class="folder-summary-text"
                  ><strong>{{ someNames(layoutFiles(layout.key), "tệp") }}</strong
                  ><span>{{ layoutSummary(layout) }}</span></span
                ><span class="folder-open-label"
                  ><span class="when-closed">Xem cột</span
                  ><span class="when-open">Thu gọn</span></span
                ><AppIcon class="folder-chevron" name="chevron" :size="14" />
              </summary>
              <SheetPreview
                :header="layout.header"
                :rows="layout.sample"
                :plans="layout.plans"
                :label="`Các cột của ${layout.example}`"
                @plan="(column, plan) => folder.setPlan(layout.key, column, plan)"
              />
              <p class="sheet-caption-line">
                Xem trước: {{ layout.example
                }}<template v-if="layout.sheets > 1">
                  - áp dụng cho {{ count(layout.sheets) }} trang tính</template
                >
              </p>
            </details>
          </section>

          <section v-if="docFiles.length" class="folder-layouts">
            <h2 class="folder-section-title">Tài liệu - {{ count(docFiles.length) }} tệp</h2>
            <div class="folder-docs">
              <AppIcon name="file" :size="16" /><span class="folder-summary-text"
                ><strong>{{
                  someNames(
                    docFiles.map((file) => baseName(file.path)),
                    "tệp",
                  )
                }}</strong
                ><span>Tìm và ẩn thông tin trong toàn bộ nội dung</span></span
              >
            </div>
          </section>
        </template>

        <MaskProgress
          v-if="phase === 'masking' && folder.progress.value"
          :progress="folder.progress.value"
        />
        <p
          v-if="phase === 'saving' && folder.progress.value"
          class="sheet-caption-line"
          role="status"
        >
          <span class="spinner" aria-hidden="true"></span>Đang lưu
          {{ count(folder.progress.value.done) }} / {{ count(folder.progress.value.total) }} tệp
        </p>

        <!-- The folder's values, once. -->
        <template v-if="phase === 'review' || phase === 'saved'">
          <p v-if="phase === 'review'" class="folder-ready" role="note">
            <AppIcon name="eye" :size="16" /><span
              ><strong
                >Đã ẩn {{ count(hidden) }} chỗ trong
                {{ count(folder.masked.value.length) }} tệp.</strong
              >
              Xem lại danh sách bên dưới, bỏ chọn những gì không cần ẩn, rồi bấm "Lưu thư mục đã
              ẩn".</span
            >
          </p>
          <p v-if="phase === 'saved'" class="folder-ready" role="status">
            <AppIcon name="check" :size="16" /><span
              ><strong>Đã lưu vào thư mục "{{ folder.saveTarget.value }}".</strong> Gửi các tệp cần
              thiết trong thư mục đó cho AI. Khi AI trả lời, sang bước 3 để đổi các mã lại thành
              thông tin thật.</span
            >
          </p>
          <ReviewList
            v-if="folder.review.value.length && phase === 'review'"
            :groups="folder.review.value"
            :files="folder.fileCounts.value"
            @change="folder.setKept"
          />
        </template>

        <details
          v-if="folder.failed.value.length && !(phase === 'ready' && folder.readable.value.length)"
          class="folder-files"
          open
        >
          <summary>
            <AppIcon name="info" :size="16" /><span class="folder-summary-text"
              ><strong>{{ count(folder.failed.value.length) }} tệp chưa xử lý được</strong></span
            ><AppIcon class="folder-chevron" name="chevron" :size="14" />
          </summary>
          <ul>
            <li v-for="file in folder.failed.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ file.error }}</span>
            </li>
          </ul>
        </details>
        <details v-if="folder.skipped.value.length" class="folder-files">
          <summary>
            <AppIcon name="info" :size="16" /><span class="folder-summary-text"
              ><strong>{{ count(folder.skipped.value.length) }} tệp bỏ qua</strong
              ><span>Mở ra để xem lý do</span></span
            ><AppIcon class="folder-chevron" name="chevron" :size="14" />
          </summary>
          <ul>
            <li v-for="file in folder.skipped.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ file.reason }}</span>
            </li>
          </ul>
        </details>
        <details v-if="folder.files.value.length && phase !== 'ready'" class="folder-files">
          <summary>
            <AppIcon name="folder" :size="16" /><span class="folder-summary-text"
              ><strong>Các tệp trong thư mục</strong><span>{{ subtitle }}</span></span
            ><AppIcon class="folder-chevron" name="chevron" :size="14" />
          </summary>
          <ul>
            <li v-for="file in folder.files.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ statusLabel[file.status] }}</span>
            </li>
            <li v-if="folder.files.value.length > shownFiles" class="folder-reason">
              và {{ count(folder.files.value.length - shownFiles) }} tệp khác
            </li>
          </ul>
        </details>
        <p v-if="saveError" class="input-error drop-error" role="alert">{{ saveError }}</p>

        <footer
          v-if="phase !== 'ready' || folder.readable.value.length"
          class="card-footer sheet-footer"
        >
          <JobTime v-if="phase === 'ready'" :seconds="folder.estimate.value">
            - thư mục gốc giữ nguyên</JobTime
          >
          <span v-else class="action-hint">Thư mục gốc không bị thay đổi.</span>
          <button v-if="phase === 'masking'" class="quiet-button" @click="folder.cancel()">
            Hủy
          </button>
          <button
            v-if="phase === 'ready' || phase === 'masking'"
            ref="primary"
            class="primary-action"
            :disabled="phase === 'masking' || !folder.readable.value.length"
            @click="folder.maskAll()"
          >
            <span v-if="phase === 'masking'" class="spinner" aria-hidden="true"></span
            ><BrandMark v-else :size="17" />{{
              phase === "masking" ? "Đang ẩn..." : `Ẩn ${count(folder.readable.value.length)} tệp`
            }}<AppIcon name="arrow" :size="16" />
          </button>
          <template v-else-if="phase === 'saved'">
            <button class="quiet-button" @click="save">
              <AppIcon name="download" :size="15" />Lưu thêm một bản
            </button>
            <button ref="primary" class="primary-action" @click="openStep(3)">
              <AppIcon name="undo" :size="17" />Sang bước 3: Khôi phục<AppIcon
                name="arrow"
                :size="16"
              />
            </button>
          </template>
          <button
            v-else-if="folder.masked.value.length"
            ref="primary"
            class="primary-action"
            :disabled="phase === 'saving'"
            @click="save"
          >
            <span v-if="phase === 'saving'" class="spinner" aria-hidden="true"></span
            ><AppIcon v-else name="download" :size="17" />Lưu thư mục đã ẩn<AppIcon
              name="arrow"
              :size="16"
            />
          </button>
        </footer>
      </div>
    </template>
  </section>
</template>
