<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import RestorePanel from "../components/RestorePanel.vue";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import {
  packKey,
  runKey,
  sessionsKey,
  useProvided,
  vaultKey,
  type Page,
} from "../composables/context.ts";
import { reviewHint, useTextReview, type ReviewView } from "../composables/useTextReview.ts";
import { detectionOptions } from "../core/detection/options.ts";
import { possibleNames } from "../core/name-hints.ts";
import { findings, sampleText } from "../core/review.ts";
import { sessionPreview } from "../core/session-preview.ts";
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

const pack = useProvided(packKey);
const { status: models, ready: modelsReady, preparing } = pack;
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
const vault = useProvided(vaultKey);

const view = ref<ReviewView>("masked");
/** The text card shows one step at a time: 1 paste, 2 mask (while processing), 3 copy, 4 restore. */
const stepLabels = ["Ẩn thông tin", "Sao chép sang AI", "Khôi phục"];
const restoreStep = ref(false);
/** Step panels cross-fade; focus that targets the incoming panel waits for it. */
const pendingFocus = ref<"copy" | "restore" | "step2" | null>(null);
function afterStepEnter() {
  const target = pendingFocus.value;
  pendingFocus.value = null;
  if (target === "copy") copyButton.value?.focus();
  else if (target === "restore") restorePanel.value?.focusInput();
  else if (target === "step2") stepButtons.value?.[1]?.focus();
}
const changesOpen = ref(false);
const copied = ref(false);
const copyStatus = ref("");
const manualCopy = ref(false);
const content = useTemplateRef<HTMLTextAreaElement>("content");
const copyButton = useTemplateRef<HTMLButtonElement>("copyButton");
const restorePanel = useTemplateRef<InstanceType<typeof RestorePanel>>("restorePanel");
const stepButtons = useTemplateRef<HTMLButtonElement[]>("stepButtons");
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
/** Categories this run did not check. Names left in clear text are the one way the
 * product fails silently, so that case is called out above the copy button, with a
 * cheap local hint at what may still be a name and the way to fix it.
 */
const unchecked = computed(() => {
  const current = session.value;
  if (current?.fixture !== "private-text-v1") return null;
  const options = detectionOptions.filter((option) => !current.options.includes(option.id));
  if (!options.length) return null;
  const nameUnchecked = options.some((option) => option.id === "name");
  return {
    count: options.length,
    labels: options.map((option) => option.label).join(", "),
    nameUnchecked,
    names: nameUnchecked ? possibleNames(output.value) : [],
    needsPack: options.some((option) => option.model) && !modelsReady.value,
  };
});
const warning = computed(() => {
  const current = unchecked.value;
  if (!current) return null;
  const title = current.names.length
    ? `Có thể còn tên người chưa được ẩn: ${current.names.join(", ")}.`
    : current.nameUnchecked
      ? "Tên người chưa được kiểm tra."
      : `Chưa kiểm tra: ${current.labels}.`;
  const body = [
    current.nameUnchecked && current.count > 1 ? `Chưa kiểm tra: ${current.labels}.` : "",
    current.needsPack
      ? `Bôi đen phần còn sót để ẩn ngay, hoặc tải gói nhận diện (${formatModelBytes(models.value.total)}, một lần) để ẩn tự động.`
      : "Bôi đen phần còn sót để ẩn ngay. Lần sau hãy chọn thêm các mục này trước khi ẩn.",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    body,
    action: current.needsPack ? (preparing.value ? "progress" : "download") : null,
  };
});
function warningAction() {
  if (warning.value?.action === "download") void pack.run("download");
  else emit("navigate", "settings");
}
const title = computed(() =>
  session.value
    ? privateSession.value
      ? sessionPreview(session.value)
      : sessionTitle(session.value)
    : props.format === "text"
      ? "Ẩn thông tin trong văn bản."
      : "Ẩn thông tin trong bảng tính.",
);
const subtitle = computed(() =>
  session.value
    ? privateSession.value
      ? `${sessionTitle(session.value)} · ${
          step.value === 3
            ? "Dán câu trả lời của AI; mã thay thế được đổi lại thành tên thật ngay trên máy bạn."
            : "Đọc lại bản đã ẩn, rồi sao chép để gửi AI."
        }`
      : "Đọc lại kết quả, rồi sao chép khi bạn thấy phù hợp."
    : props.format === "text"
      ? "Nhập hoặc dán văn bản để ẩn thông tin bằng mã thay thế."
      : "Một lần nhấn. Thông tin riêng tư được thay bằng mã thay thế.",
);
/** A text run keeps going in the background; the sample table never waits. */
const textProcessing = computed(() => props.format === "text" && processing.value);
const step = computed(() => {
  if (!session.value) return 1;
  return restoreStep.value && privateSession.value ? 3 : 2;
});
function canOpenStep(target: number) {
  if (target === 1) return !!session.value && props.format === "text";
  return (
    (target === 2 && step.value === 3) || (target === 3 && step.value === 2 && privateSession.value)
  );
}
/** Step 1 from a session reopens the draft with this text and choices; the
 * session stays in the sidebar and masking again creates a new one (no overwrite). */
function openStep(target: number) {
  if (!canOpenStep(target)) return;
  if (target === 1) {
    const current = session.value!;
    draft.value = current.fixture === "private-text-v1" ? current.original : sampleText;
    if (current.fixture === "private-text-v1") {
      selectedOptions.value = [...current.options];
      selectionEdited.value = true;
    }
    emit("navigate", "text");
    return;
  }
  restoreStep.value = target === 3;
  pendingFocus.value = target === 3 ? "restore" : "step2";
}
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
    restoreStep.value = false;
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
const primaryDisabled = computed(
  () =>
    props.format === "text" &&
    (processing.value ||
      !selectedOptions.value.length ||
      (!missingSelectedModels.value && !!draftError.value)),
);
function primaryAction() {
  if (props.format === "text" && missingSelectedModels.value) {
    emit("navigate", "settings");
    return;
  }
  clearFeedback();
  emit("mask");
}
/** ⌘/Ctrl+Enter inside the draft does what the primary button does. */
function submitShortcut() {
  if (!primaryDisabled.value) primaryAction();
}
/** Copy the masked text; `restore` also moves on to pasting the AI's reply. */
async function copy(restore = false) {
  selectedText.value = null;
  const text = output.value;
  const sessionId = session.value?.id;
  try {
    await navigator.clipboard.writeText(text);
    if (session.value?.id !== sessionId || output.value !== text) return;
    copied.value = true;
    copyStatus.value =
      restore && privateSession.value
        ? "Đã sao chép. Dán vào ChatGPT, Gemini hoặc Claude; khi có câu trả lời, dán vào ô này."
        : "Đã sao chép. Bạn có thể dán vào nơi mình chọn.";
    if (restore && privateSession.value) openStep(3);
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
    if (copyButton.value) copyButton.value.focus();
    else pendingFocus.value = "copy";
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <span v-if="format === 'excel' && !session" class="eyebrow">THỬ VỚI DỮ LIỆU MẪU</span>
      <h1 ref="heading" tabindex="-1">{{ title }}</h1>
      <p>{{ subtitle }}</p>
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
    <nav v-if="format === 'text'" class="stepper" aria-label="Các bước">
      <template v-for="(label, index) in stepLabels" :key="label">
        <span
          v-if="index"
          class="step-line"
          :class="{ 'is-done': index < step }"
          aria-hidden="true"
        ></span>
        <button
          ref="stepButtons"
          type="button"
          class="step"
          :class="{
            'is-current': index + 1 === step,
            'is-done': index + 1 < step,
            'is-upcoming': index + 1 > step,
          }"
          :aria-label="`Bước ${index + 1}: ${label}`"
          :title="
            index === 0 && session ? 'Sửa văn bản rồi ẩn lại. Phiên này vẫn được giữ.' : undefined
          "
          :aria-current="index + 1 === step ? 'step' : undefined"
          :disabled="!canOpenStep(index + 1)"
          @click="openStep(index + 1)"
        >
          <span class="step-number" aria-hidden="true"
            ><AppIcon v-if="index + 1 < step" name="check" :size="12" /><span
              v-else-if="index + 1 === step && textProcessing"
              class="spinner"
            ></span
            ><template v-else>{{ index + 1 }}</template></span
          ><span class="step-label">{{ label }}</span>
        </button>
      </template>
    </nav>
    <Transition name="step" mode="out-in" @after-enter="afterStepEnter">
      <div
        v-if="step === 3 && session?.fixture === 'private-text-v1'"
        key="restore"
        class="step-panel"
      >
        <RestorePanel ref="restorePanel" :session-id="session.id" :analysis="session.analysis" />
        <footer class="card-footer">
          <span class="action-hint"
            ><AppIcon name="lock" :size="13" />Phiên này sẽ bị xóa khi bạn đóng ứng dụng.</span
          >
          <button class="quiet-button" @click="openStep(2)">
            <AppIcon name="eye" :size="15" />Xem lại bản đã ẩn
          </button>
        </footer>
      </div>
      <div v-else :key="session ? 'review' : 'draft'" class="step-panel">
        <header v-if="session || format === 'excel'" class="card-header">
          <div v-if="session" class="view-switch" aria-label="Chọn bản văn bản">
            <button :aria-pressed="view === 'masked'" @click="selectView('masked')">
              Bản đã ẩn</button
            ><button :aria-pressed="view === 'original'" @click="selectView('original')">
              Bản gốc
            </button>
          </div>
          <span v-else class="document-label"
            ><AppIcon name="table" :size="17" />Giao dịch mẫu · 2 dòng</span
          >
          <span v-if="format === 'excel' || (session && !privateSession)" class="sample-tag"
            >Dữ liệu mẫu</span
          >
          <button
            v-else-if="privateSession"
            class="icon-button"
            :class="{ 'is-done': copied }"
            :aria-label="copied ? 'Đã sao chép' : 'Chỉ sao chép'"
            :title="copied ? 'Đã sao chép' : 'Chỉ sao chép'"
            @click="copy(false)"
          >
            <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />
          </button>
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
                {{ preparing ? "Xem tiến độ" : "Xem chi tiết"
                }}<AppIcon name="chevron" :size="12" />
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
            @keydown.meta.enter.prevent="submitShortcut"
            @keydown.ctrl.enter.prevent="submitShortcut"
          ></textarea>
          <div class="input-hint-row">
            <button
              v-if="!draft && !processing"
              type="button"
              class="sample-link"
              @click="draft = sampleText"
            >
              Thử với văn bản mẫu
            </button>
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
          </div>
        </template>
        <template v-else-if="format === 'text' || manualCopy"
          ><label class="sr-only" for="document-content">{{
            session && view === "masked" ? "Bản đã ẩn" : "Bản gốc"
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
          <p id="manual-review-hint" role="status">
            <AppIcon v-if="!reviewStatus" name="compose" :size="14" />{{
              reviewStatus || reviewHint
            }}
          </p>
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
        <div v-if="warning" class="review-warning" role="status">
          <AppIcon name="info" :size="18" />
          <p>
            <strong>{{ warning.title }}</strong
            ><span>{{ warning.body }}</span>
          </p>
          <button
            v-if="warning.action"
            class="quiet-button"
            :disabled="pack.busy.value || (warning.action === 'download' && !desktopModels)"
            @click="warningAction"
          >
            {{ warning.action === "download" ? "Tải về" : "Xem tiến độ"
            }}<AppIcon name="chevron" :size="12" />
          </button>
        </div>
        <p v-if="session && !activeFindings.length" class="detection-note" role="status">
          Chưa phát hiện thông tin cần ẩn. Bản xem trước giữ nguyên nội dung; hãy kiểm tra lại trước
          khi chia sẻ.
        </p>
        <div v-if="session && activeFindings.length" class="changes">
          <button
            class="changes-toggle"
            :aria-expanded="changesOpen"
            aria-controls="change-list"
            @click="changesOpen = !changesOpen"
          >
            <span
              ><AppIcon name="check" :size="15" />Đã ẩn {{ maskCount }} mục{{
                unchecked ? ` · ${unchecked.count} loại chưa kiểm tra` : " thông tin"
              }}</span
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
          <span v-if="session" class="action-hint"
            ><AppIcon v-if="privateSession" name="lock" :size="13" />{{
              !privateSession
                ? "Phiên mẫu"
                : vault.state.value === "unlocked"
                  ? "Đã lưu trên máy này."
                  : "Phiên này sẽ bị xóa khi bạn đóng ứng dụng."
            }}<button
              v-if="privateSession && vault.state.value === 'none'"
              class="link-button"
              @click="emit('navigate', 'settings')"
            >
              Đặt mật mã để giữ lại
            </button></span
          >
          <button v-if="textProcessing" class="quiet-button" @click="cancel(true)">
            Hủy xử lý
          </button>
          <button
            v-if="!session"
            class="primary-action"
            :disabled="primaryDisabled"
            :title="format === 'text' ? '⌘/Ctrl + Enter' : undefined"
            @click="primaryAction"
          >
            <span v-if="textProcessing" class="spinner" aria-hidden="true"></span
            ><AppIcon v-else name="sparkle" :size="17" />{{
              textProcessing
                ? "Đang xử lý…"
                : format === "text" && missingSelectedModels
                  ? "Tải thêm để tiếp tục"
                  : "Ẩn thông tin"
            }}<AppIcon name="arrow" :size="16" /></button
          ><button
            v-else-if="privateSession"
            ref="copyButton"
            class="primary-action"
            @click="copy(true)"
          >
            <AppIcon name="copy" :size="17" />Sao chép<AppIcon name="arrow" :size="16" />Khôi phục</button
          ><button v-else ref="copyButton" class="primary-action" @click="copy(false)">
            <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />{{
              copied ? "Đã sao chép" : "Sao chép kết quả"
            }}
          </button>
        </footer>
      </div>
    </Transition>
  </section>
  <p v-if="processingError" class="storage-error" role="alert">{{ processingError }}</p>
  <p v-if="(session && step !== 3) || copyStatus" class="feedback" role="status">
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
