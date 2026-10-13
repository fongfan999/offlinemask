<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import PasscodeSetup from "../components/PasscodeSetup.vue";
import RestorePanel from "../components/RestorePanel.vue";
import SheetPreview from "../components/SheetPreview.vue";
import { packKey, sheetKey, useProvided, vaultKey, type Page } from "../composables/context.ts";
import type { SheetRestore } from "../composables/useSheetRun.ts";
import { applyEdits } from "../core/sheet/mask.ts";
import { sampleSheetCsv, sampleSheetName } from "../core/sheet/sample.ts";
import { sheetPreviewRows, type SheetSession } from "../core/sessions.ts";

const props = defineProps<{ session?: SheetSession }>();
const emit = defineEmits<{
  navigate: [destination: Page, id?: string | null];
  remove: [id: string];
}>();

const sheet = useProvided(sheetKey);
const pack = useProvided(packKey);
const vault = useProvided(vaultKey);
const historyOn = computed(() => vault.state.value === "unlocked");
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const picker = useTemplateRef<HTMLInputElement>("picker");
const returnedPicker = useTemplateRef<HTMLInputElement>("returnedPicker");
const primary = useTemplateRef<HTMLButtonElement>("primary");

const stepLabels = ["Ẩn thông tin", "Tải về và gửi AI", "Khôi phục"];
const restoreStep = ref(false);
const step = computed(() => (!props.session ? 1 : restoreStep.value ? 3 : 2));
const sheetIndex = ref(0);
const showOriginal = ref(false);
const dragging = ref(false);
const status = ref("");
const restoreKind = ref<"file" | "text">("file");
// Plain data (not deeply reactive): its edits are posted to the worker as they are.
const restore = shallowRef<SheetRestore | null>(null);
const restoreError = ref("");
const restoreBusy = ref(false);
const restoreSaved = ref(false);
const settingPasscode = ref(false);
const keptNotice = ref("");

const draft = sheet.draft;
watch(
  () => props.session?.id,
  () => {
    restoreStep.value = false;
    sheetIndex.value = 0;
    status.value = "";
    restoreSaved.value = false;
    sheet.closeReturned(restore.value);
    restore.value = null;
    restoreError.value = "";
  },
);
watch(
  () => draft.value?.handle,
  () => {
    sheetIndex.value = 0;
    showOriginal.value = false;
  },
);

const title = computed(() =>
  props.session
    ? props.session.fileName
    : draft.value
      ? draft.value.fileName
      : "Ẩn thông tin trong bảng tính.",
);
const subtitle = computed(() => {
  if (props.session) {
    const rows = props.session.sheets.reduce((sum, item) => sum + item.rows, 0);
    return step.value === 3
      ? `Bảng tính #${props.session.number}`
      : `Bảng tính #${props.session.number} · ${rows.toLocaleString("vi-VN")} dòng · Đọc lại rồi tải tệp đã ẩn về để gửi AI.`;
  }
  return draft.value
    ? `${totalRows.value.toLocaleString("vi-VN")} dòng${draft.value.tables.length > 1 ? ` · ${draft.value.tables.length} trang tính` : ""} · Chọn cách xử lý từng cột, rồi ẩn toàn bộ.`
    : "Mở tệp Excel hoặc CSV. Thông tin bạn chọn được thay bằng mã như [SDT_1_…], ngay trên máy bạn.";
});
const totalRows = computed(
  () => draft.value?.tables.reduce((sum, table) => sum + table.rows.length, 0) ?? 0,
);
const sheetNames = computed(() =>
  props.session
    ? props.session.sheets.map((item) => item.name)
    : (draft.value?.tables.map((table) => table.name) ?? []),
);
const draftView = computed(() => {
  const table = draft.value?.tables[sheetIndex.value];
  if (!table) return null;
  if (showOriginal.value)
    return {
      preamble: table.preamble,
      preambleChanged: new Set<string>(),
      header: table.header,
      rows: table.rows.slice(0, sheetPreviewRows),
      changed: new Set<string>(),
    };
  return sheet.preview.value[sheetIndex.value] ?? null;
});
/** The masking panel: stage, share done, and an estimate once there is enough to go on. */
function duration(seconds: number) {
  if (seconds < 60) return `${Math.max(5, Math.round(seconds / 5) * 5)} giây`;
  return `${Math.round(seconds / 60)} phút`;
}
/** One steady line while masking: the same words, a percentage that only goes up,
 * and a time estimate only once it is stable. Stages (loading the models, reading,
 * writing) are not named: with the native engine they change many times a second. */
let shownPercent = 0;
watch(
  () => sheet.processing.value,
  (running) => {
    if (running) shownPercent = 0;
  },
);
const progressView = computed(() => {
  const progress = sheet.progress.value;
  if (!progress) return null;
  const reading = progress.total ? Math.floor((progress.done * 100) / progress.total) : 0;
  const percent = (shownPercent = Math.max(
    shownPercent,
    progress.stage === "masking" ? 100 : Math.min(reading, 99),
  ));
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  // Once an estimate shows, it stays until the end ("Sắp xong…" for the last stretch).
  const estimate =
    elapsed <= 5 || percent < 5
      ? ""
      : percent >= 95 || progress.stage === "masking"
        ? "Sắp xong…"
        : `Còn khoảng ${duration((elapsed * (progress.total - progress.done)) / Math.max(1, progress.done))}`;
  // Only a percentage and a time: counts of "distinct texts" mean nothing to people.
  return { title: `Đang ẩn thông tin… ${percent} %`, percent, detail: estimate };
});
const scanning = computed(() =>
  sheet.plans.value.some((plans) => plans.some((plan) => plan.mode === "scan")),
);
const scanNeedsPack = computed(() => scanning.value && !pack.ready.value);
const hidden = computed(() =>
  sheet.plans.value.reduce(
    (sum, plans) => sum + plans.filter((plan) => plan.mode !== "keep").length,
    0,
  ),
);

/** Restored preview of the returned file. */
const restoreView = computed(() => {
  const current = restore.value;
  const table = current?.tables[0];
  if (!current || !table) return null;
  return applyEdits(table, current.edits[0], sheetPreviewRows);
});

function pick(files: FileList | null | undefined) {
  const file = files?.[0];
  if (file) void sheet.openFile(file);
}
function drop(event: DragEvent) {
  dragging.value = false;
  pick(event.dataTransfer?.files);
}
function trySample() {
  const file = new File([sampleSheetCsv()], sampleSheetName, { type: "text/csv" });
  void sheet.openFile(file);
}
async function maskAll() {
  await sheet.maskAll();
}
async function download() {
  if (!props.session) return;
  status.value = "";
  try {
    if (await sheet.download(props.session)) {
      status.value =
        "Đã lưu tệp đã ẩn. Gửi tệp này cho AI; khi có tệp trả về, mở ở bước Khôi phục.";
      restoreStep.value = true;
    }
  } catch {
    status.value = "Chưa lưu được tệp. Hãy thử lại.";
  }
}
async function openReturned(files: FileList | null | undefined) {
  const file = files?.[0];
  if (!file || !props.session) return;
  restoreBusy.value = true;
  restoreError.value = "";
  restoreSaved.value = false;
  sheet.closeReturned(restore.value);
  restore.value = null;
  const result = await sheet.openReturned(props.session, file);
  restoreBusy.value = false;
  if (typeof result === "string") restoreError.value = result;
  else restore.value = result;
}
function dropReturned(event: DragEvent) {
  dragging.value = false;
  void openReturned(event.dataTransfer?.files);
}
async function downloadRestored() {
  if (!restore.value) return;
  try {
    restoreSaved.value = await sheet.downloadRestored(restore.value);
  } catch {
    restoreError.value = "Chưa lưu được tệp. Hãy thử lại.";
  }
}
function anotherFile() {
  sheet.closeReturned(restore.value);
  restore.value = null;
  restoreSaved.value = false;
}
/** "Tạo mới" and "Ẩn bảng tính mới" start from an empty drop zone. */
function newSheet() {
  sheet.discardDraft();
  emit("navigate", "excel");
}
function openStep(target: number) {
  if (!props.session) return;
  if (target === 1) {
    // The same file and choices, ready to mask again; this session is kept.
    if (sheet.reopen(props.session)) emit("navigate", "excel");
    return;
  }
  restoreStep.value = target === 3;
}
function canOpenStep(target: number) {
  if (!props.session) return false;
  return (
    (target === 1 && sheet.canReopen(props.session)) ||
    (target === 2 && step.value === 3) ||
    (target === 3 && step.value === 2)
  );
}
const restoreStatus = computed(() => {
  const current = restore.value;
  if (!current) return "";
  if (!current.restored)
    return "Không tìm thấy mã thay thế của bảng tính này trong tệp. Hãy kiểm tra đúng tệp AI trả về.";
  return `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} mã thay thế${current.tables.length > 1 ? " trong mọi trang tính" : ""}.`;
});

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
      <button v-if="session" class="quiet-button" @click="newSheet">
        <AppIcon name="plus" :size="15" />Tạo mới
      </button>
      <button
        v-else-if="!sheet.processing.value"
        class="quiet-button"
        @click="sheet.discardDraft()"
      >
        <AppIcon name="close" :size="15" />Chọn tệp khác
      </button>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Ẩn thông tin trong bảng tính">
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
              v-else-if="index + 1 === step && sheet.processing.value"
              class="spinner"
            ></span
            ><template v-else>{{ index + 1 }}</template></span
          ><span class="step-label">{{ label }}</span>
        </button>
      </template>
    </nav>

    <!-- Step 1: open a file, choose per column, preview, mask all. -->
    <div v-if="!session" class="step-panel">
      <template v-if="!draft">
        <button
          type="button"
          class="drop-zone"
          :class="{ 'is-dragging': dragging, 'is-busy': sheet.opening.value }"
          :disabled="sheet.opening.value"
          @click="picker?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="drop"
        >
          <span class="drop-icon"><AppIcon name="table" :size="26" /></span>
          <strong>{{
            sheet.opening.value ? "Đang mở tệp…" : "Kéo thả tệp Excel hoặc CSV vào đây"
          }}</strong>
          <span>hoặc <u>chọn tệp</u> · .xlsx, .csv · tối đa 20 MB</span>
        </button>
        <input
          ref="picker"
          class="sr-only"
          type="file"
          accept=".xlsx,.csv"
          tabindex="-1"
          aria-hidden="true"
          @change="
            pick(($event.target as HTMLInputElement).files);
            ($event.target as HTMLInputElement).value = '';
          "
        />
        <div class="input-hint-row">
          <button type="button" class="sample-link" @click="trySample">Thử với tệp mẫu</button>
        </div>
        <p v-if="sheet.fileError.value" class="input-error drop-error" role="alert">
          {{ sheet.fileError.value }}
        </p>
      </template>
      <template v-else>
        <!-- While masking runs, only the progress, Hủy and the busy button remain. -->
        <template v-if="!progressView">
          <header class="card-header sheet-toolbar">
            <p class="sheet-hint">Chọn cách xử lý từng cột. Gợi ý dựa trên tên cột và dữ liệu.</p>
            <div class="view-switch" aria-label="Chọn bản xem">
              <button :aria-pressed="!showOriginal" @click="showOriginal = false">
                Xem trước bản đã ẩn</button
              ><button :aria-pressed="showOriginal" @click="showOriginal = true">Bản gốc</button>
            </div>
          </header>
          <div v-if="sheetNames.length > 1" class="sheet-tabs" role="tablist">
            <button
              v-for="(name, index) in sheetNames"
              :key="name + index"
              role="tab"
              :aria-selected="index === sheetIndex"
              @click="sheetIndex = index"
            >
              {{ name }}
            </button>
          </div>
        </template>
        <div v-if="progressView" class="sheet-progress" role="status" aria-live="polite">
          <p class="sheet-progress-title">
            <span class="spinner" aria-hidden="true"></span>{{ progressView.title }}
          </p>
          <progress
            class="pack-progress"
            :value="progressView.percent"
            max="100"
            :aria-label="progressView.title"
          ></progress>
          <p v-if="progressView.detail" class="sheet-progress-detail">{{ progressView.detail }}</p>
        </div>
        <SheetPreview
          v-else-if="draftView"
          :preamble="draftView.preamble"
          :preamble-changed="draftView.preambleChanged"
          :header="draftView.header"
          :rows="draftView.rows"
          :changed="draftView.changed"
          :plans="draft.plans[sheetIndex]"
          :label="`Trang ${sheetNames[sheetIndex]}`"
          @plan="(column, plan) => sheet.setPlan(sheetIndex, column, plan)"
        />
        <p v-if="!progressView" class="sheet-caption-line">
          Xem trước {{ Math.min(sheetPreviewRows, draft.tables[sheetIndex]?.rows.length ?? 0) }} /
          {{ (draft.tables[sheetIndex]?.rows.length ?? 0).toLocaleString("vi-VN") }} dòng
          đầu<template v-if="sheet.previewScanning.value">
            · <span class="spinner" aria-hidden="true"></span> Đang đọc các ô được quét…</template
          >
        </p>
        <p v-if="scanNeedsPack && !progressView" class="sheet-note">
          <AppIcon name="info" :size="14" />Các ô được quét đang tìm email, số điện thoại, số tài
          khoản. Tải gói nhận diện để tìm cả họ tên và địa chỉ.
        </p>
        <p v-for="note in progressView ? [] : draft.notes" :key="note" class="sheet-note">
          <AppIcon name="info" :size="14" />{{ note }}
        </p>
        <p v-if="sheet.processingError.value" class="input-error drop-error" role="alert">
          {{ sheet.processingError.value }}
        </p>
        <footer class="card-footer sheet-footer">
          <span v-if="!hidden" class="action-hint">Chưa chọn cột nào để ẩn hoặc quét.</span>
          <button v-if="sheet.processing.value" class="quiet-button" @click="sheet.cancelMask()">
            Hủy
          </button>
          <button
            ref="primary"
            class="primary-action"
            :disabled="sheet.processing.value || !hidden"
            @click="maskAll"
          >
            <span v-if="sheet.processing.value" class="spinner" aria-hidden="true"></span
            ><AppIcon v-else name="sparkle" :size="17" />{{
              sheet.processing.value
                ? "Đang ẩn…"
                : `Ẩn toàn bộ ${totalRows.toLocaleString("vi-VN")} dòng`
            }}<AppIcon name="arrow" :size="16" />
          </button>
        </footer>
      </template>
    </div>

    <!-- Step 2: read the masked result and save the masked copy. -->
    <div v-else-if="step === 2" class="step-panel">
      <p class="sheet-summary">
        <AppIcon name="check" :size="15" />Đã ẩn {{ session.masked.toLocaleString("vi-VN") }} ô ·
        {{ session.findings.length.toLocaleString("vi-VN") }} mã thay thế
      </p>
      <div v-if="sheetNames.length > 1" class="sheet-tabs" role="tablist">
        <button
          v-for="(name, index) in sheetNames"
          :key="name + index"
          role="tab"
          :aria-selected="index === sheetIndex"
          @click="sheetIndex = index"
        >
          {{ name }}
        </button>
      </div>
      <SheetPreview
        v-if="session.preview[sheetIndex]"
        :preamble="session.preview[sheetIndex]!.preamble"
        :header="session.preview[sheetIndex]!.header"
        :rows="session.preview[sheetIndex]!.rows"
        highlight-aliases
        :label="`Bản đã ẩn, trang ${sheetNames[sheetIndex]}`"
      />
      <p class="sheet-caption-line">
        {{ Math.min(sheetPreviewRows, session.sheets[sheetIndex]?.rows ?? 0) }} /
        {{ (session.sheets[sheetIndex]?.rows ?? 0).toLocaleString("vi-VN") }} dòng đầu của bản đã ẩn
      </p>
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
                keptNotice = 'Đã bật lịch sử. Bảng tính này có trong thanh bên.';
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
      <p v-if="!sheet.canDownload(session)" class="sheet-note">
        <AppIcon name="info" :size="14" />Tệp gốc không còn mở trong lần này, nên không tải lại được
        bản đã ẩn. Bạn vẫn khôi phục được tệp AI trả về ở bước 3.
      </p>
      <footer class="card-footer">
        <button v-if="!sheet.canDownload(session)" class="quiet-button" @click="openStep(3)">
          Đến bước Khôi phục<AppIcon name="arrow" :size="15" />
        </button>
        <button v-else ref="primary" class="primary-action" @click="download">
          <AppIcon name="download" :size="17" />Tải tệp đã ẩn<AppIcon name="arrow" :size="16" />
        </button>
      </footer>
    </div>

    <!-- Step 3: restore the AI's returned file, or a pasted reply. -->
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
        <input
          ref="returnedPicker"
          class="sr-only"
          type="file"
          accept=".xlsx,.csv"
          tabindex="-1"
          aria-hidden="true"
          @change="
            openReturned(($event.target as HTMLInputElement).files);
            ($event.target as HTMLInputElement).value = '';
          "
        />
        <button
          v-if="!restore"
          type="button"
          class="drop-zone"
          :class="{ 'is-dragging': dragging, 'is-busy': restoreBusy }"
          :disabled="restoreBusy"
          @click="returnedPicker?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="dropReturned"
        >
          <span class="drop-icon"><AppIcon name="undo" :size="24" /></span>
          <strong>{{ restoreBusy ? "Đang mở tệp…" : "Kéo thả tệp AI trả về vào đây" }}</strong>
          <span>hoặc <u>chọn tệp</u> · mã thay thế được đổi lại thành thông tin thật</span>
        </button>
        <template v-else>
          <p class="sheet-summary" role="status">
            <AppIcon :name="restore.restored ? 'check' : 'info'" :size="15" />{{ restoreStatus }}
          </p>
          <p v-if="restore.unknown.length" class="sheet-note restore-unknown">
            {{ restore.unknown.length }} mã thay thế không thuộc bảng tính này được giữ nguyên:
            {{ restore.unknown.slice(0, 5).join(", ") }}{{ restore.unknown.length > 5 ? "…" : "" }}
          </p>
          <SheetPreview
            v-if="restoreView"
            :header="restoreView.header"
            :rows="restoreView.rows"
            :changed="restoreView.changed"
            tone="value"
            :label="`Bản đã khôi phục, ${restore.fileName}`"
          />
        </template>
        <p v-if="restoreError" class="input-error drop-error" role="alert">{{ restoreError }}</p>
        <footer class="card-footer">
          <button class="quiet-button" @click="openStep(2)">
            <AppIcon name="eye" :size="15" />Xem lại bản đã ẩn
          </button>
          <template v-if="restore && restoreSaved">
            <button class="quiet-button" @click="anotherFile">Khôi phục tệp khác</button>
            <button class="quiet-button" @click="newSheet">
              <AppIcon name="plus" :size="15" />Ẩn bảng tính mới
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
          new-label="Ẩn bảng tính mới"
          @new-text="newSheet"
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
