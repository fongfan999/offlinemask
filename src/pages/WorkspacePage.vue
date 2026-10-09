<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import { formatModelBytes } from "../adapters/models.ts";
import { packKey, runKey, sessionsKey, useProvided, type Page } from "../composables/context.ts";
import { reviewHint, useTextReview, type ReviewView } from "../composables/useTextReview.ts";
import { detectionOptions } from "../core/detection/options.ts";
import { findings, sampleText } from "../core/review.ts";
import {
  maskedRows,
  sessionOutput,
  sessionTitle,
  sheetHeaders,
  sheetRows,
  type Format,
  type Session,
} from "../core/sessions.ts";
import { maxTextLength } from "../core/text.ts";

const props = defineProps<{ format: Format; session?: Session }>();
const emit = defineEmits<{
  navigate: [destination: Page, id?: string | null];
  mask: [];
  remove: [id: string];
}>();

const { status: models, ready: modelsReady, preparing } = useProvided(packKey);
const {
  draft,
  selectedOptions,
  selectionEdited,
  processing,
  processingStatus,
  processingError,
  draftError,
  missingSelectedModels,
  cancel,
} = useProvided(runKey);
const { save } = useProvided(sessionsKey);

const view = ref<ReviewView>("masked");
const changesOpen = ref(false);
const copied = ref(false);
const copyStatus = ref("");
const manualCopy = ref(false);
const content = useTemplateRef<HTMLTextAreaElement>("content");
const copyButton = useTemplateRef<HTMLButtonElement>("copyButton");
const heading = useTemplateRef<HTMLHeadingElement>("heading");

const session = computed(() => props.session);
const privateSession = computed(() => session.value?.fixture === "private-text-v1");
const output = computed(() => (session.value ? sessionOutput(session.value) : ""));
const activeFindings = computed(() =>
  session.value?.fixture === "private-text-v1" ? session.value.analysis.findings : findings,
);
const visibleText = computed(() =>
  session.value && view.value === "masked"
    ? output.value
    : session.value?.fixture === "private-text-v1"
      ? session.value.original
      : sampleText,
);
const rows = computed(() =>
  session.value && view.value === "masked" ? maskedRows(session.value.decisions) : sheetRows,
);
const maskCount = computed(() =>
  session.value
    ? activeFindings.value.filter((finding) => session.value?.decisions[finding.id] === "mask")
        .length
    : 0,
);
const uncheckedCategories = computed(() => {
  const current = session.value;
  return current?.fixture === "private-text-v1"
    ? detectionOptions
        .filter((option) => !current.options.includes(option.id))
        .map((option) => option.label)
        .join(", ")
    : "";
});
const title = computed(() =>
  session.value
    ? sessionTitle(session.value)
    : props.format === "text"
      ? "Ẩn thông tin trong văn bản."
      : "Ẩn thông tin trong bảng tính.",
);
/** A text run keeps going in the background; the sample table never waits. */
const textProcessing = computed(() => props.format === "text" && processing.value);
const characterLimit = maxTextLength.toLocaleString("vi-VN");

const review = useTextReview({
  session: () => session.value,
  view,
  visibleText: () => visibleText.value,
  element: () => content.value,
  manualCopy: () => manualCopy.value,
});
const { selectedText, reviewStatus, captureSelection } = review;

function clearCopyFeedback() {
  copied.value = false;
  copyStatus.value = "";
  manualCopy.value = false;
  processingError.value = "";
}
function clearFeedback() {
  review.clear();
  clearCopyFeedback();
}
watch(
  () => session.value?.id,
  () => {
    view.value = "masked";
    changesOpen.value = false;
    clearFeedback();
  },
);

async function hideSelection() {
  clearCopyFeedback();
  await review.hideSelection();
}
async function undoManualMask() {
  clearCopyFeedback();
  await review.undoManualMask();
}
function toggle(id: string) {
  const current = session.value;
  if (!current) return;
  if (current.fixture === "private-text-v1") delete current.reviewUndo;
  current.decisions[id] = current.decisions[id] === "mask" ? "keep" : "mask";
  view.value = "masked";
  clearFeedback();
  if (current.fixture === "sample-v1") save();
}
function selectView(nextView: ReviewView) {
  review.clear();
  view.value = nextView;
  manualCopy.value = false;
}
function primaryAction() {
  if (props.format === "text" && missingSelectedModels.value) {
    emit("navigate", "settings");
    return;
  }
  clearFeedback();
  emit("mask");
}
async function copy() {
  selectedText.value = null;
  const text = output.value;
  const sessionId = session.value?.id;
  try {
    await navigator.clipboard.writeText(text);
    if (session.value?.id !== sessionId || output.value !== text) return;
    copied.value = true;
    copyStatus.value = "Đã sao chép. Bạn có thể dán vào nơi mình chọn.";
  } catch {
    if (session.value?.id !== sessionId || output.value !== text) return;
    view.value = "masked";
    manualCopy.value = true;
    await nextTick();
    content.value?.focus();
    content.value?.select();
    copyStatus.value = "Nhấn ⌘C hoặc Ctrl+C để sao chép phần đã chọn.";
  }
}
defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
  focusResult() {
    copyButton.value?.focus();
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <span v-if="format === 'excel' && !session" class="eyebrow">THỬ VỚI DỮ LIỆU MẪU</span>
      <h1 ref="heading" tabindex="-1">{{ title }}</h1>
      <p>
        {{
          session
            ? "Đọc lại kết quả, rồi sao chép khi bạn thấy phù hợp."
            : format === "text"
              ? "Nhập hoặc dán văn bản để ẩn thông tin bằng bí danh."
              : "Một lần nhấn. Thông tin riêng tư được thay bằng bí danh."
        }}
      </p>
    </div>
    <div v-if="session" class="editor-actions">
      <button class="quiet-button" @click="emit('remove', session.id)">
        <AppIcon name="close" :size="15" />Xóa phiên
      </button>
      <button class="quiet-button" @click="emit('navigate', format)">
        <AppIcon name="plus" :size="15" />Phiên mới
      </button>
    </div>
  </div>
  <section
    class="glass-card glass"
    :aria-label="
      format === 'text' ? 'Ẩn thông tin trong văn bản' : 'Ẩn thông tin trong bảng tính mẫu'
    "
  >
    <header class="card-header">
      <div v-if="session" class="view-switch" aria-label="Chọn bản văn bản">
        <button :aria-pressed="view === 'masked'" @click="selectView('masked')">
          Bản đã ẩn thông tin</button
        ><button :aria-pressed="view === 'original'" @click="selectView('original')">
          Bản gốc
        </button>
      </div>
      <span v-else class="document-label"
        ><AppIcon :name="format === 'text' ? 'file' : 'table'" :size="17" />{{
          format === "text" ? "Văn bản của bạn" : "Giao dịch mẫu · 2 dòng"
        }}</span
      >
      <button
        v-if="format === 'text' && !session && !draft"
        class="quiet-button"
        @click="draft = sampleText"
      >
        Dùng văn bản mẫu
      </button>
      <span v-else-if="format === 'excel' || (session && !privateSession)" class="sample-tag"
        >Dữ liệu mẫu</span
      >
    </header>
    <template v-if="format === 'text' && !session">
      <fieldset class="detection-options" :disabled="processing">
        <legend>Bạn muốn ẩn thông tin nào?</legend>
        <div class="option-grid">
          <label
            v-for="option in detectionOptions"
            :key="option.id"
            class="detection-option"
            :class="{ selected: selectedOptions.includes(option.id) }"
            :title="option.detail"
          >
            <input
              v-model="selectedOptions"
              type="checkbox"
              :aria-label="
                option.model && !modelsReady ? `${option.label} · Cần tải thêm` : option.label
              "
              :value="option.id"
              @change="selectionEdited = true"
            />
            <span
              >{{ option.label
              }}<small v-if="option.model && !modelsReady">Cần tải thêm</small></span
            >
          </label>
        </div>
        <div v-if="missingSelectedModels" class="model-requirement">
          <AppIcon name="download" :size="16" />
          <p>
            Tải gói nhận diện để dùng các mục đã chọn.<span
              >{{ formatModelBytes(models.total) }} · Chỉ cần tải một lần</span
            >
          </p>
          <button class="quiet-button" @click="emit('navigate', 'settings')">
            {{ preparing ? "Xem tiến độ" : "Xem chi tiết" }}<AppIcon name="chevron" :size="12" />
          </button>
        </div>
        <p v-if="!selectedOptions.length" class="input-error" role="status">
          Chọn ít nhất một loại thông tin để tiếp tục.
        </p>
      </fieldset>
      <label class="sr-only" for="text-input">Văn bản cần ẩn thông tin</label>
      <textarea
        id="text-input"
        v-model="draft"
        :disabled="processing"
        class="text-content"
        placeholder="Nhập hoặc dán văn bản vào đây…"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        aria-describedby="text-input-hint"
        :aria-invalid="draft.length > maxTextLength"
        @input="processingError = ''"
      ></textarea>
      <p
        id="text-input-hint"
        class="input-hint"
        :class="{ 'input-error': draft.length > maxTextLength }"
        aria-live="polite"
      >
        {{
          draft.length > maxTextLength
            ? draftError
            : `${draft.length.toLocaleString("vi-VN")} / ${characterLimit} ký tự`
        }}
      </p>
    </template>
    <template v-else-if="format === 'text' || manualCopy"
      ><label class="sr-only" for="document-content">{{
        session && view === "masked" ? "Bản đã ẩn thông tin" : "Bản gốc"
      }}</label
      ><textarea
        id="document-content"
        ref="content"
        class="text-content"
        :value="manualCopy ? output : visibleText"
        readonly
        :aria-describedby="privateSession ? 'manual-review-hint' : undefined"
        spellcheck="false"
        @select="captureSelection"
        @keyup="captureSelection"
        @mouseup="captureSelection"
      ></textarea>
    </template>
    <div
      v-else
      class="sheet-scroll"
      tabindex="0"
      aria-label="Bảng giao dịch mẫu, cuộn ngang để xem các cột"
    >
      <table>
        <caption class="sr-only">
          {{
            session && view === "masked" ? "Bảng đã ẩn thông tin" : "Bảng gốc"
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th v-for="header in sheetHeaders" :key="header" scope="col">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index">
            <th scope="row">{{ index + 1 }}</th>
            <td v-for="(cell, col) in row" :key="col" :class="{ alias: cell.startsWith('[') }">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="sheet-caption">
        <AppIcon name="table" :size="14" />Giao dịch<span>2 dòng · 6 cột</span>
      </div>
    </div>
    <div v-if="privateSession" class="manual-review">
      <p id="manual-review-hint" role="status">{{ reviewStatus || reviewHint }}</p>
      <div class="manual-review-actions">
        <button v-if="selectedText" class="quiet-button" @click="hideSelection">
          Ẩn phần đã chọn
        </button>
        <button
          v-if="session?.fixture === 'private-text-v1' && session.reviewUndo"
          class="quiet-button"
          @click="undoManualMask"
        >
          Hoàn tác
        </button>
      </div>
    </div>
    <p v-if="uncheckedCategories" class="detection-note scope-note">
      <AppIcon name="info" :size="16" /><span>Chưa kiểm tra: {{ uncheckedCategories }}.</span>
    </p>
    <p v-if="session && !activeFindings.length" class="detection-note" role="status">
      Chưa phát hiện thông tin cần ẩn. Bản xem trước giữ nguyên nội dung; hãy kiểm tra lại trước khi
      chia sẻ.
    </p>
    <div v-if="session && activeFindings.length" class="changes">
      <button
        class="changes-toggle"
        :aria-expanded="changesOpen"
        aria-controls="change-list"
        @click="changesOpen = !changesOpen"
      >
        <span><AppIcon name="check" :size="15" />Đã ẩn {{ maskCount }} mục thông tin</span
        ><span
          >{{ changesOpen ? "Thu gọn" : "Xem thay đổi" }}<AppIcon name="chevron" :size="12"
        /></span>
      </button>
      <div v-show="changesOpen" id="change-list" class="change-list">
        <p>Bỏ chọn những thông tin bạn muốn giữ nguyên.</p>
        <label v-for="finding in activeFindings" :key="finding.id" class="change-row"
          ><input
            type="checkbox"
            :checked="session.decisions[finding.id] === 'mask'"
            @change="toggle(finding.id)"
          /><span
            ><strong>{{ finding.label }}</strong
            ><small>{{ finding.value }}</small
            ><small>{{ finding.reason }}</small
            ><small>{{ finding.source }}</small></span
          ><code>{{
            session.decisions[finding.id] === "mask" ? finding.alias : "Giữ nguyên"
          }}</code></label
        >
      </div>
    </div>
    <p v-if="textProcessing" class="detection-note" role="status">{{ processingStatus }}</p>
    <footer class="card-footer">
      <span v-if="session" class="action-hint">{{
        privateSession ? "Đóng ứng dụng sẽ xóa phiên này." : "Phiên mẫu"
      }}</span>
      <button v-if="textProcessing" class="quiet-button" @click="cancel(true)">Hủy xử lý</button>
      <button
        v-if="!session"
        class="primary-action"
        :disabled="
          format === 'text' &&
          (processing || !selectedOptions.length || (!missingSelectedModels && !!draftError))
        "
        @click="primaryAction"
      >
        <AppIcon name="sparkle" :size="17" />{{
          textProcessing
            ? "Đang xử lý…"
            : format === "text" && missingSelectedModels
              ? "Tải thêm để tiếp tục"
              : "Ẩn thông tin"
        }}<AppIcon name="arrow" :size="16" /></button
      ><button v-else ref="copyButton" class="primary-action" @click="copy">
        <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />{{
          copied ? "Đã sao chép" : "Sao chép kết quả"
        }}
      </button>
    </footer>
  </section>
  <p v-if="processingError" class="storage-error" role="alert">{{ processingError }}</p>
  <p v-if="session || copyStatus" class="feedback" role="status">
    {{
      copyStatus ||
      (session
        ? "Kiểm tra nội dung còn lại trước khi chia sẻ."
        : "Kết quả sẽ xuất hiện trong một phiên mới ở thanh bên.")
    }}
  </p>
  <p v-if="format === 'excel'" class="prototype-note">
    Bảng mẫu tương tác. Chưa nhập hoặc xuất tệp Excel/CSV; sao chép ở dạng bảng phân cách bằng tab.
  </p>
</template>
