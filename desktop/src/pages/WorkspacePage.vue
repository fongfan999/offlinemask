<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import BrandMark from "../components/BrandMark.vue";
import HighlightedText from "../components/HighlightedText.vue";
import MaskProgress from "../components/MaskProgress.vue";
import KeepOffer from "../components/KeepOffer.vue";
import QuickIntro from "../components/QuickIntro.vue";
import RestorePanel from "../components/RestorePanel.vue";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import {
  packKey,
  quickKey,
  runKey,
  sessionsKey,
  useProvided,
  vaultKey,
  type Page,
} from "../composables/context.ts";
import { packProgress } from "../composables/useRecognitionPack.ts";
import { reviewHint, useTextReview, type ReviewView } from "../composables/useTextReview.ts";
import { detectionOptions } from "../core/detection/options.ts";
import { possibleNames } from "../core/name-hints.ts";
import { findings, sampleText } from "../core/review.ts";
import { occurrenceMarks, reviewDisplay, type TextMark } from "../core/review-marks.ts";
import { sessionPreview } from "../core/session-preview.ts";
import {
  sessionOutput,
  sessionTitle,
  type Format,
  type SampleSession,
  type TextSession,
} from "../core/sessions.ts";
import { maxTextLength } from "../core/text.ts";

const props = defineProps<{ format: Format; session?: SampleSession | TextSession }>();
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
  progress,
  processingError,
  draftError,
  missingSelectedModels,
  cancel,
  openTextFile,
} = useProvided(runKey);
const { save } = useProvided(sessionsKey);
const vault = useProvided(vaultKey);
const quick = useProvided(quickKey);
/** History is a passcode feature (decision 0071). Without one nothing talks about
 * saving: the user chose not to keep anything, and the review screen offers it once. */
const historyOn = computed(() => vault.state.value === "unlocked");
const savedNote = vault.savedNote;

const view = ref<ReviewView>("masked");
/** The text card shows one step at a time: 1 paste, 2 mask (while processing), 3 copy, 4 restore. */
const stepLabels = ["Ẩn thông tin", "Sao chép sang AI", "Khôi phục"];
const restoreStep = ref(false);
/** Step panels cross-fade; focus that targets the incoming panel waits for it. */
const pendingFocus = ref<"copy" | "restore" | "step2" | null>(null);
function afterStepEnter() {
  const target = pendingFocus.value;
  pendingFocus.value = null;
  if (target === "copy") copyButton.value?.focus({ preventScroll: true });
  else if (target === "restore") restorePanel.value?.focusInput();
  else if (target === "step2") stepButtons.value?.[1]?.focus();
}
const changesOpen = ref(false);
const copied = ref(false);
const copyStatus = ref("");
/** A reply is in the restore box, so the copy note's "paste it here" is done. */
const replyPasted = ref(false);
const manualCopy = ref(false);
const highlighted = useTemplateRef<InstanceType<typeof HighlightedText>>("highlighted");
const content = computed(() => highlighted.value?.field ?? null);
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
/** What the review textarea shows, with each hidden value (or alias) highlighted
 * and, in the masked copy, likely names still in clear text marked as hints. */
const display = computed<{ text: string; marks: TextMark[] }>(() => {
  const current = session.value;
  if (manualCopy.value || current?.fixture !== "private-text-v1")
    return { text: manualCopy.value ? output.value : visibleText.value, marks: [] };
  const shown = reviewDisplay(
    current.original,
    current.analysis,
    current.decisions,
    view.value === "masked",
  );
  const names = view.value === "masked" ? (unchecked.value?.names ?? []) : [];
  return {
    text: shown.text,
    marks: [...shown.marks, ...occurrenceMarks(shown.text, names, "hint", shown.marks)].sort(
      (a, b) => a.start - b.start,
    ),
  };
});
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
    current.names.length
      ? "Bấm tên bên dưới để ẩn, hoặc bôi đen phần khác còn sót."
      : "Bôi đen phần còn sót để ẩn ngay.",
    current.needsPack
      ? `Tải gói nhận diện (${formatModelBytes(models.value.total)}, một lần) để ẩn tự động.`
      : "Lần sau hãy chọn thêm các mục này trước khi ẩn.",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    body,
    names: current.names,
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
    : "Ẩn thông tin trong văn bản.",
);
/** The title is the first masked line: its codes are set like the review's highlights,
 * so a code in the heading does not read as a typo (decision 0134). Odd parts are codes. */
const titleParts = computed(() => title.value.split(/(\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\])/));
const subtitle = computed(() =>
  session.value
    ? privateSession.value
      ? step.value === 3
        ? sessionTitle(session.value)
        : `${sessionTitle(session.value)} · Đọc lại bản đã ẩn, rồi sao chép để gửi AI.`
      : "Đọc lại kết quả, rồi sao chép khi bạn thấy phù hợp."
    : "Thông tin bạn chọn được thay bằng mã như [SDT_1_…], ngay trên máy bạn.",
);
/** A text run keeps going in the background while the user navigates. */
/** A .txt or .md file dropped on the text box becomes the draft (decision 0088); other
 * files are pointed to their page. Dropped text (not a file) is left to the browser. */
function dragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
}
async function dropFile(event: DragEvent) {
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  processingError.value = /\.(txt|md)$/i.test(file.name)
    ? await openTextFile(file)
    : "Ô này nhận tệp .txt hoặc .md. Mở tệp Excel ở Bảng tính, tệp Word ở Tài liệu.";
}
const textProcessing = computed(() => props.format === "text" && processing.value);
/** Short texts finish in a moment; the progress panel appears only for a longer run,
 * so it never flashes (decision 0082). */
const progressShown = ref(false);
let progressTimer: ReturnType<typeof setTimeout> | undefined;
watch(textProcessing, (busy) => {
  clearTimeout(progressTimer);
  progressShown.value = false;
  if (busy) progressTimer = setTimeout(() => (progressShown.value = true), 700);
});
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
/** The counter only matters near the limit. */
const showCounter = computed(() => draft.value.length >= maxTextLength * 0.9);
/** Categories fold into one line under the text; the checkboxes open on request. */
const optionsOpen = ref(false);
const optionsSummary = computed(() => {
  const chosen = detectionOptions.filter((option) => selectedOptions.value.includes(option.id));
  return chosen.length ? chosen.map((option) => option.label).join(", ") : "chưa chọn mục nào";
});
const optionsNeedPack = computed(
  () =>
    !modelsReady.value &&
    detectionOptions.some((option) => option.model && !selectedOptions.value.includes(option.id)),
);

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
async function hideName(name: string) {
  clearCopyFeedback();
  await review.hideOccurrences(name);
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
/** While a selected category waits for the pack, the notice and the primary button
 * follow every stage: download, install, pause, error (decision 0074). */
const packWait = computed(() => {
  const status = models.value;
  const percent = packProgress(status);
  switch (status.stage) {
    case "downloading":
      return {
        busy: true,
        percent,
        title: `Đang tải gói nhận diện… ${percent} %`,
        detail: `${formatModelBytes(status.downloaded)} / ${formatModelBytes(status.total)} · Tải xong sẽ tự cài đặt, rồi nút Ẩn thông tin bật lại.`,
        button: `Đang tải… ${percent} %`,
        action: "pause" as const,
      };
    case "installing":
      return {
        busy: true,
        percent,
        title:
          status.installed >= status.installedBytes
            ? "Đang kiểm tra gói nhận diện lần cuối…"
            : `Đang cài đặt gói nhận diện… ${percent} %`,
        detail: "Bước này không cần Internet. Xong là nút Ẩn thông tin bật lại.",
        button:
          status.installed >= status.installedBytes
            ? "Đang kiểm tra…"
            : `Đang cài đặt… ${percent} %`,
        action: "pause" as const,
      };
    case "cancelling":
      return {
        busy: true,
        percent,
        title: "Đang tạm dừng…",
        detail: "Phần đã tải được giữ lại.",
        button: "Đang tạm dừng…",
        action: null,
      };
    case "paused":
      return {
        busy: false,
        percent,
        title: `Đã tạm dừng tải · ${percent} %`,
        detail: "Phần đã tải được giữ lại.",
        button: "Tiếp tục tải",
        action: "resume" as const,
      };
    case "error":
      return {
        busy: false,
        percent: null,
        title: "Chưa tải xong gói nhận diện.",
        detail: pack.error.value || "Kiểm tra kết nối rồi thử lại.",
        button: "Thử lại",
        action: "resume" as const,
      };
    default:
      return {
        busy: false,
        percent: null,
        title: "Tải gói nhận diện để dùng các mục đã chọn.",
        detail: `${formatModelBytes(status.total)} · Chỉ cần tải một lần`,
        button: "Tải thêm để tiếp tục",
        action: "details" as const,
      };
  }
});
/** The notice already shows progress; its button acts on the download in place. */
function packWaitAction() {
  const action = packWait.value.action;
  if (action === "resume") void pack.run("download");
  else if (action === "pause") void pack.run("pause");
  else emit("navigate", "settings");
}
const primaryDisabled = computed(
  () =>
    props.format === "text" &&
    (processing.value ||
      !selectedOptions.value.length ||
      (missingSelectedModels.value && packWait.value.busy) ||
      (!missingSelectedModels.value && !!draftError.value)),
);
function primaryAction() {
  // "Tải thêm để tiếp tục" is an explicit request: start the download, then show its progress.
  if (props.format === "text" && missingSelectedModels.value) {
    if (desktopModels && ["missing", "paused", "error"].includes(models.value.stage))
      void pack.run("download");
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
        ? "Đã sao chép bản đã ẩn. Dán vào công cụ AI bạn dùng (ChatGPT, Claude, Gemini…), rồi đưa câu trả lời của AI vào bước Khôi phục."
        : "Đã sao chép. Bạn có thể dán vào nơi mình chọn.";
    if (restore && privateSession.value) openStep(3);
    // The trip Ẩn nhanh saves: offer it once (decision 0098).
    quick.offerIntro();
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
  /** After masking, focus the copy button but keep the heading and text in view. */
  focusResult() {
    window.scrollTo({ top: 0 });
    if (copyButton.value) copyButton.value.focus({ preventScroll: true });
    else pendingFocus.value = "copy";
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <h1 ref="heading" tabindex="-1">
        <template v-for="(part, index) in titleParts" :key="index"
          ><span v-if="index % 2" class="title-alias">{{ part }}</span
          ><template v-else>{{ part }}</template></template
        >
      </h1>
      <p>{{ subtitle }}</p>
    </div>
    <div v-if="session" class="editor-actions">
      <button v-if="historyOn" class="quiet-button" @click="emit('remove', session.id)">
        <AppIcon name="close" :size="15" />Xóa khỏi lịch sử
      </button>
      <button class="quiet-button" @click="emit('navigate', format)">
        <AppIcon name="plus" :size="15" />Tạo mới
      </button>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Ẩn thông tin trong văn bản">
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
            index === 0 && session
              ? historyOn
                ? 'Sửa văn bản rồi ẩn lại. Bản này vẫn được giữ trong lịch sử.'
                : 'Sửa văn bản rồi ẩn lại.'
              : undefined
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
        <RestorePanel
          ref="restorePanel"
          :session-id="session.id"
          :analysis="session.analysis"
          @new-text="emit('navigate', 'text')"
          @pasted="(pasted) => (replyPasted = pasted)"
        >
          <template v-if="savedNote" #hint
            ><AppIcon name="lock" :size="13" />{{ savedNote }}</template
          >
          <button class="quiet-button" @click="openStep(2)">
            <AppIcon name="eye" :size="15" />Xem lại bản đã ẩn
          </button>
        </RestorePanel>
      </div>
      <div v-else :key="session ? 'review' : 'draft'" class="step-panel">
        <header v-if="session" class="card-header">
          <div class="view-switch" aria-label="Chọn bản văn bản">
            <button :aria-pressed="view === 'masked'" @click="selectView('masked')">
              Bản đã ẩn</button
            ><button :aria-pressed="view === 'original'" @click="selectView('original')">
              Bản gốc
            </button>
          </div>
          <span v-if="!privateSession" class="sample-tag">Dữ liệu mẫu</span>
          <button
            v-else-if="privateSession"
            class="quiet-button edit-text"
            :title="historyOn ? 'Bản này vẫn được giữ trong lịch sử.' : undefined"
            @click="openStep(1)"
          >
            <AppIcon name="compose" :size="14" />Sửa văn bản
          </button>
        </header>
        <template v-if="format === 'text' && !session">
          <label class="sr-only" for="text-input">Văn bản cần ẩn thông tin</label>
          <textarea
            id="text-input"
            v-model="draft"
            :disabled="processing"
            class="text-content draft-input"
            placeholder="Nhập, dán văn bản hoặc kéo thả tệp .txt vào đây…"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            aria-describedby="text-input-hint"
            :aria-invalid="draft.length > maxTextLength"
            @input="processingError = ''"
            @dragover="dragOver"
            @drop="dropFile"
            @keydown.meta.enter.prevent="submitShortcut"
            @keydown.ctrl.enter.prevent="submitShortcut"
          ></textarea>
          <div v-if="(!draft && !processing) || showCounter" class="input-hint-row">
            <button
              v-if="!draft && !processing"
              type="button"
              class="sample-link"
              @click="draft = sampleText"
            >
              Thử với văn bản mẫu
            </button>
            <p
              v-if="showCounter"
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
          <!-- What to hide folds into one line; the checkboxes open on request. -->
          <fieldset class="detection-options" :disabled="processing">
            <legend class="sr-only">Bạn muốn ẩn thông tin nào?</legend>
            <div class="options-summary">
              <p>
                Sẽ ẩn: <strong>{{ optionsSummary }}</strong
                ><small v-if="optionsNeedPack && !optionsOpen"> · Một số mục cần tải thêm</small>
              </p>
              <button
                type="button"
                class="link-button"
                :aria-expanded="optionsOpen"
                aria-controls="option-grid"
                @click="optionsOpen = !optionsOpen"
              >
                {{ optionsOpen ? "Thu gọn" : "Thay đổi" }}
              </button>
            </div>
            <div v-show="optionsOpen" id="option-grid" class="option-grid">
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
                    option.model && !modelsReady
                      ? `${option.label} · ${packWait.busy ? 'Đang tải' : 'Cần tải thêm'}`
                      : option.label
                  "
                  :value="option.id"
                  @change="selectionEdited = true"
                />
                <span
                  >{{ option.label
                  }}<small v-if="option.model && !modelsReady">{{
                    packWait.busy ? "Đang tải…" : "Cần tải thêm"
                  }}</small></span
                >
              </label>
            </div>
            <div v-if="missingSelectedModels" class="model-requirement" role="status">
              <span v-if="packWait.busy" class="spinner" aria-hidden="true"></span
              ><AppIcon v-else name="download" :size="16" />
              <div class="model-requirement-body">
                <p>
                  {{ packWait.title }}<span>{{ packWait.detail }}</span>
                </p>
                <progress
                  v-if="packWait.percent !== null"
                  class="pack-progress"
                  :value="packWait.percent"
                  max="100"
                  :aria-label="packWait.title"
                ></progress>
              </div>
              <button
                v-if="packWait.action"
                class="quiet-button"
                :disabled="packWait.action !== 'details' && (pack.busy.value || !desktopModels)"
                @click="packWaitAction"
              >
                {{
                  packWait.action === "resume"
                    ? packWait.button
                    : packWait.action === "pause"
                      ? "Tạm dừng"
                      : "Xem chi tiết"
                }}<AppIcon v-if="packWait.action === 'details'" name="chevron" :size="12" />
              </button>
            </div>
            <p v-if="!selectedOptions.length" class="input-error" role="status">
              Chọn ít nhất một loại thông tin để tiếp tục.
            </p>
          </fieldset>
        </template>
        <template v-else
          ><label class="sr-only" for="document-content">{{
            session && view === "masked" ? "Bản đã ẩn" : "Bản gốc"
          }}</label
          ><HighlightedText
            id="document-content"
            ref="highlighted"
            :value="display.text"
            :marks="display.marks"
            :aria-describedby="privateSession ? 'manual-review-hint' : undefined"
            @select="captureSelection"
            @keyup="captureSelection"
            @mouseup="captureSelection"
          />
        </template>
        <!-- The warning already says how to fix misses; the hint only shows without it. -->
        <div
          v-if="
            privateSession &&
            (!warning ||
              reviewStatus ||
              selectedText ||
              (session?.fixture === 'private-text-v1' && session.reviewUndo))
          "
          class="manual-review"
        >
          <p id="manual-review-hint" role="status">
            <AppIcon v-if="!reviewStatus && !warning" name="compose" :size="14" />{{
              reviewStatus || (warning ? "" : reviewHint)
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
        <KeepOffer v-if="privateSession" subject="văn bản" />
        <div v-if="warning" class="review-warning" role="status">
          <AppIcon name="info" :size="18" />
          <div class="review-warning-body">
            <p>
              <strong>{{ warning.title }}</strong
              ><span>{{ warning.body }}</span>
            </p>
            <div v-if="warning.names.length" class="warning-names">
              <button
                v-for="name in warning.names"
                :key="name"
                class="quiet-button"
                @click="hideName(name)"
              >
                Ẩn “{{ name }}”
              </button>
            </div>
          </div>
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
        <MaskProgress v-if="textProcessing && progressShown && progress" :progress="progress" />
        <footer class="card-footer">
          <span v-if="session" class="action-hint"
            ><AppIcon v-if="privateSession && savedNote" name="lock" :size="13" />{{
              privateSession ? savedNote : "Bản mẫu"
            }}</span
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
            <span
              v-if="textProcessing || (format === 'text' && missingSelectedModels && packWait.busy)"
              class="spinner"
              aria-hidden="true"
            ></span
            ><BrandMark v-else :size="17" />{{
              textProcessing
                ? "Đang xử lý…"
                : format === "text" && missingSelectedModels
                  ? packWait.button
                  : "Ẩn thông tin"
            }}<AppIcon name="arrow" :size="16" /></button
          ><template v-else-if="privateSession"
            ><button class="link-button copy-only" @click="copy(false)">
              {{ copied ? "Đã sao chép" : "Chỉ sao chép" }}</button
            ><button ref="copyButton" class="primary-action" @click="copy(true)">
              <AppIcon name="copy" :size="17" />Sao chép và tiếp tục<AppIcon
                name="arrow"
                :size="16"
              /></button></template
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
  <!-- "Paste the reply here" is done once a reply is in (decision 0134). -->
  <p v-if="copyStatus && !(step === 3 && replyPasted)" class="feedback" role="status">
    {{ copyStatus }}
  </p>
  <!-- Belongs to the copied result: gone with it (decision 0098). -->
  <QuickIntro v-if="copyStatus" />
</template>
