<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import AppIcon from "./components/AppIcon.vue";
import ModelSettings from "./components/ModelSettings.vue";
import SettingsTools from "./components/SettingsTools.vue";
import ComingSoonBadge from "./components/ComingSoonBadge.vue";
import { modelStatus, downloadModels, cancelModelDownload, desktopModels, totalModelBytes, installedModelBytes, formatModelBytes, type ModelStatus } from "./adapters/models";
import { detectionOptions, localOptions, requiresModels, type DetectionOption } from "./core/detection/options";
import MaskingPreview from "./components/MaskingPreview.vue";
import { version } from "../package.json";
import { openProductWebsite, productWebsite } from "./adapters/desktop";
import { findings, sampleText } from "./core/review";
import { addManualMask, previewSelection, type SourceSelection } from "./core/manual-mask";
import { maxTextLength, validateText } from "./core/text";
import { createTextDetector } from "./adapters/text-detection";
import {
  createSession,
  createTextSession,
  decodeSessions,
  encodeSessions,
  historyKey,
  maskedRows,
  sessionOutput,
  sessionTitle,
  sheetHeaders,
  sheetRows,
  type Format,
  type Session,
} from "./core/sessions";

const models = ref<ModelStatus>({ stage: 'checking', downloaded: 0, total: totalModelBytes, installedBytes: installedModelBytes, installed: 0, error: null, root: null });
const modelActionBusy = ref(false);
const modelError = ref('');
const selectedOptions = ref<DetectionOption[]>([...localOptions]);
const selectionEdited = ref(false);
const modelsReady = computed(() => models.value.stage === 'ready');
const missingSelectedModels = computed(() => requiresModels(selectedOptions.value) && !modelsReady.value);
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
let preloadRoot: string | null = null;
async function refreshModels() {
  try {
    models.value = await modelStatus();
    if (modelsReady.value && !selectionEdited.value) selectedOptions.value = detectionOptions.map(option => option.id);
    if (!disposed && modelsReady.value && models.value.root && preloadRoot !== models.value.root) {
      preloadRoot = models.value.root;
      detector.prepare(preloadRoot);
    } else if (!modelsReady.value) preloadRoot = null;
    modelError.value = '';
  } catch { modelError.value = 'Chưa kiểm tra được gói nhận diện. Hãy mở lại ứng dụng để thử lại.'; }
}
async function pollModels() {
  await refreshModels();
  if (!disposed) statusTimer = setTimeout(pollModels, 1000);
}
onMounted(pollModels);
onBeforeUnmount(() => { disposed = true; clearTimeout(statusTimer); });
async function modelAction(action: 'download' | 'pause') {
  if (modelActionBusy.value) return;
  modelActionBusy.value = true;
  try {
    if (action === 'download') await downloadModels();
    else await cancelModelDownload();
    await refreshModels();
  } catch { modelError.value = 'Chưa thực hiện được thao tác. Vui lòng thử lại.'; }
  finally { modelActionBusy.value = false; }
}
const sessions = ref<Session[]>([]);
const draft = ref("");
const processing = ref(false);
const processingError = ref("");
const processingStatus = ref("");
const detector = createTextDetector();
let currentRun = 0;
function cancelProcessing(preserveModels = false) {
  currentRun++;
  detector.cancel(preserveModels);
  processing.value = false;
  processingStatus.value = "";
}
onBeforeUnmount(() => { currentRun++; detector.destroy(); });
const draftError = computed(() => validateText(draft.value));
const storageError = ref("");
const websiteError = ref("");
async function visitWebsite(event: MouseEvent) {
  websiteError.value = "";
  try {
    await openProductWebsite(event);
  } catch {
    websiteError.value = "Chưa mở được trình duyệt. Bạn có thể truy cập offlinemask.com.";
  }
}
try {
  sessions.value = decodeSessions(localStorage.getItem(historyKey));
} catch {
  storageError.value =
    "Không thể đọc lịch sử đã lưu. Các phiên mới vẫn có thể dùng trong lần mở này.";
}
const page = ref<"home" | "settings" | Format>("home");
const activeId = ref<string | null>(null);
const active = computed(() =>
  sessions.value.find((s) => s.id === activeId.value),
);
const format = computed(
  () => active.value?.format ?? (page.value === "excel" ? "excel" : "text"),
);
const view = ref<"original" | "masked">("masked");
const changesOpen = ref(false);
const sidebarOpen = ref(false);
const copied = ref(false);
const copyStatus = ref("");
const manualCopy = ref(false);
const selectedText = ref<{ sessionId: string; text: string; view: string; range: SourceSelection } | null>(null);
const reviewStatus = ref('');
function captureSelection() {
  const session = active.value;
  const element = content.value;
  selectedText.value = null;
  if (session?.fixture !== 'private-text-v1' || !element || manualCopy.value) return;
  const range = previewSelection(session.original, session.analysis, session.decisions,
    view.value === 'masked', element.selectionStart, element.selectionEnd);
  if (range) selectedText.value = { sessionId: session.id, text: visibleText.value, view: view.value, range };
}
async function hideSelection() {
  const session = active.value;
  const selection = selectedText.value;
  if (session?.fixture !== 'private-text-v1' || !selection || session.id !== selection.sessionId
    || selection.text !== visibleText.value || selection.view !== view.value) return;
  const update = addManualMask(session.original, session.analysis, session.decisions, session.id.slice(0, 8), selection.range, session.manualMaskCount);
  session.reviewUndo = { analysis: session.analysis, decisions: { ...session.decisions } };
  session.manualMaskCount = update.manualMaskCount;
  session.analysis = update.analysis;
  session.decisions = update.decisions;
  view.value = 'masked';
  clearFeedback();
  reviewStatus.value = 'Đã ẩn phần đã chọn.';
  await nextTick();
  content.value?.focus();
  content.value?.setSelectionRange(0, 0);
}
async function undoManualMask() {
  const session = active.value;
  if (session?.fixture !== 'private-text-v1' || !session.reviewUndo) return;
  const previous = session.reviewUndo;
  session.analysis = previous.analysis;
  session.decisions = previous.decisions;
  delete session.reviewUndo;
  clearFeedback();
  reviewStatus.value = 'Đã hoàn tác lần ẩn thêm vừa rồi.';
  await nextTick();
  content.value?.focus();
}
const content = useTemplateRef<HTMLTextAreaElement>("content");
const copyButton = useTemplateRef<HTMLButtonElement>("copyButton");
const sidebarStart = useTemplateRef<HTMLButtonElement>("sidebarStart");
const sidebarToggle = useTemplateRef<HTMLButtonElement>("sidebarToggle");
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const output = computed(() =>
  active.value ? sessionOutput(active.value) : "",
);
const uncheckedCategories = computed(() => {
  const session = active.value;
  return session?.fixture === 'private-text-v1' ? detectionOptions.filter(option => !session.options.includes(option.id)).map(option => option.label).join(', ') : '';
});
const privateSession = computed(() => active.value?.fixture === "private-text-v1");
const activeFindings = computed(() =>
  active.value?.fixture === "private-text-v1" ? active.value.analysis.findings : findings,
);
const visibleText = computed(() =>
  active.value && view.value === "masked" ? output.value
    : active.value?.fixture === "private-text-v1" ? active.value.original : sampleText,
);
const rows = computed(() =>
  active.value && view.value === "masked"
    ? maskedRows(active.value.decisions)
    : sheetRows,
);
const maskCount = computed(() =>
  active.value
    ? activeFindings.value.filter((f) => active.value?.decisions[f.id] === "mask").length
    : 0,
);
const title = computed(() =>
  active.value
    ? sessionTitle(active.value)
    : format.value === "text"
      ? "Ẩn thông tin trong văn bản."
      : "Ẩn thông tin trong bảng tính.",
);
function save() {
  // Leave unreadable history intact instead of overwriting it without recovery.
  if (storageError.value.startsWith("Không thể đọc")) return;
  try {
    localStorage.setItem(historyKey, encodeSessions(sessions.value));
    storageError.value = "";
  } catch {
    storageError.value =
      "Chưa lưu được lịch sử. Giữ ứng dụng mở để tiếp tục các phiên này.";
  }
}
async function openSidebar() {
  sidebarOpen.value = true;
  await nextTick();
  sidebarStart.value?.focus();
}
async function closeSidebar() {
  sidebarOpen.value = false;
  await nextTick();
  sidebarToggle.value?.focus();
}
function clearFeedback() {
  selectedText.value = null;
  reviewStatus.value = "";
  copied.value = false;
  copyStatus.value = "";
  manualCopy.value = false;
  processingError.value = "";
}
async function navigate(
  destination: "home" | "settings" | Format,
  id: string | null = null,
) {
  if (processing.value) cancelProcessing();
  page.value = destination;
  activeId.value = id;
  view.value = "masked";
  changesOpen.value = false;
  sidebarOpen.value = false;
  clearFeedback();
  await nextTick();
  window.scrollTo({ top: 0, left: 0 });
  heading.value?.focus({ preventScroll: true });
}
async function mask() {
  if (processing.value || active.value) return;
  if (format.value === 'text') {
    if (missingSelectedModels.value) { await navigate('settings'); return; }
    if (draftError.value || !selectedOptions.value.length) return;
  }
  processing.value = true;
  const run = ++currentRun;
  const original = draft.value;
  const options = [...selectedOptions.value];
  clearFeedback();
  try {
    const modelRoot = modelsReady.value ? models.value.root ?? undefined : undefined;
    if (run !== currentRun) return;
    const detections = format.value === "text" ? await detector.detect(original, (progress) => {
      processingStatus.value = progress.stage === "loading"
        ? "Đang chuẩn bị… Lần đầu có thể mất một lúc."
        : `Đang phân tích ${Math.round(progress.completed / progress.total * 100)}%…`;
    }, modelRoot, options) : [];
    if (run !== currentRun) return;
    const session = format.value === "text"
      ? createTextSession(original, sessions.value, detections, options)
      : createSession("excel", sessions.value);
    sessions.value.unshift(session);
    activeId.value = session.id;
    view.value = "masked";
    if (session.fixture === "private-text-v1") draft.value = "";
    else save();
    await nextTick();
    copyButton.value?.focus();
  } catch {
    if (run === currentRun)
      processingError.value = "Chưa xử lý được văn bản trên thiết bị. Nội dung vẫn được giữ nguyên. Hãy thử lại hoặc kiểm tra gói nhận diện trong Cài đặt.";
  } finally {
    if (run === currentRun) {
      processing.value = false;
      processingStatus.value = "";
    }
  }
}
function toggle(id: string) {
  if (!active.value) return;
  if (active.value.fixture === "private-text-v1") delete active.value.reviewUndo;
  active.value.decisions[id] =
    active.value.decisions[id] === "mask" ? "keep" : "mask";
  view.value = "masked";
  clearFeedback();
  if (!privateSession.value) save();
}
function selectView(nextView: "original" | "masked") {
  selectedText.value = null;
  reviewStatus.value = "";
  view.value = nextView;
  manualCopy.value = false;
}
async function copy() {
  selectedText.value = null;
  const text = output.value;
  const sessionId = activeId.value;
  try {
    await navigator.clipboard.writeText(text);
    if (activeId.value !== sessionId || output.value !== text) return;
    copied.value = true;
    copyStatus.value = "Đã sao chép. Bạn có thể dán vào nơi mình chọn.";
  } catch {
    if (activeId.value !== sessionId || output.value !== text) return;
    view.value = "masked";
    manualCopy.value = true;
    await nextTick();
    content.value?.focus();
    content.value?.select();
    copyStatus.value = "Nhấn ⌘C hoặc Ctrl+C để sao chép phần đã chọn.";
  }
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="ambient" aria-hidden="true"></div>
  <div class="app-shell">
    <button
      v-if="sidebarOpen"
      class="sidebar-scrim"
      aria-label="Đóng thanh bên"
      @click="closeSidebar"
    ></button>
    <aside
      id="sidebar"
      class="sidebar glass"
      :class="{ 'is-open': sidebarOpen }"
      aria-label="Điều hướng và lịch sử"
      @keydown.esc="closeSidebar"
    >
      <button
        ref="sidebarStart"
        class="brand"
        aria-label="OfflineMask — Trang chủ"
        @click="navigate('home')"
      >
        <span class="brand-mark"><AppIcon name="shield" :size="22" /></span
        >OfflineMask
      </button>
      <nav aria-label="Định dạng">
        <button
          :aria-current="page === 'home' ? 'page' : undefined"
          @click="navigate('home')"
        >
          <AppIcon name="home" />Trang chủ
        </button>
        <button
          :aria-current="page === 'text' && !active ? 'page' : undefined"
          @click="navigate('text')"
        >
          <AppIcon name="text" />Văn bản
        </button>
        <button
          :aria-current="page === 'excel' && !active ? 'page' : undefined"
          @click="navigate('excel')"
        >
          <AppIcon name="table" />Bảng tính
        </button>
      </nav>
      <div class="history-heading">
        CÁC PHIÊN CỦA BẠN <span>{{ sessions.length || "" }}</span>
      </div>
      <div class="history-list">
        <p v-if="!sessions.length" class="empty-history">
          Chưa có phiên nào.
        </p>
        <button
          v-for="session in sessions"
          :key="session.id"
          class="history-item"
          :aria-current="activeId === session.id ? 'page' : undefined"
          @click="navigate(session.format, session.id)"
        >
          <AppIcon
            :name="session.format === 'text' ? 'file' : 'table'"
            :size="16"
          /><span
            ><strong>{{ sessionTitle(session) }}</strong
            ><small>{{ dateLabel(session.createdAt) }}{{ session.fixture === 'private-text-v1' ? ' · Tạm thời' : ' · Mẫu' }}</small></span
          >
        </button>
      </div>
      <nav class="settings-nav" aria-label="Cài đặt ứng dụng">
        <button :aria-current="page === 'settings' ? 'page' : undefined" @click="navigate('settings')"><AppIcon name="settings" />Cài đặt<span v-if="['downloading', 'installing'].includes(models.stage)" class="settings-dot" aria-label="Đang chuẩn bị gói nhận diện"></span></button>
      </nav>
      <footer class="sidebar-footer">
        <a :href="productWebsite" target="_blank" rel="noopener noreferrer" @click="visitWebsite">
          offlinemask.com<AppIcon name="external" :size="12" />
        </a>
        <span class="app-version" :aria-label="`Phiên bản ${version}`">{{ version }}</span>
        <p v-if="websiteError" class="website-error" role="alert">{{ websiteError }}</p>
      </footer>
    </aside>
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
          ><span v-if="page !== 'home'">{{
            page === "settings" ? "Cài đặt" : format === "text" ? "Văn bản" : "Bảng tính"
          }}</span>
        </div>
      </header>
      <main :class="{ 'home-page': page === 'home' }">
        <template v-if="page === 'home'">
          <div class="introduction">
            <span class="hero-logo brand-mark" aria-hidden="true">
              <AppIcon name="shield" :size="28" />
            </span>
            <h1 ref="heading" tabindex="-1">
              Ẩn thông tin nhạy cảm<span>trước khi chia sẻ với AI.</span>
            </h1>
            <p>Thay thông tin riêng tư bằng bí danh. Không cần Internet.</p>
            <MaskingPreview />
          </div>
          <section class="format-grid" aria-labelledby="format-heading">
            <h2 id="format-heading">Chọn nội dung để bắt đầu</h2>
            <button class="format-card glass" @click="navigate('text')">
              <span class="format-icon"><AppIcon name="text" :size="29" /></span
              ><span class="format-title"
                >Văn bản<AppIcon name="arrow" :size="20" /></span
              ><span class="format-description"
                >Email, tin nhắn, tài liệu</span>
            </button>
            <button class="format-card glass" @click="navigate('excel')">
              <span class="format-icon"
                ><AppIcon name="table" :size="29" /></span
              ><span class="format-title"
                >Bảng tính<AppIcon name="arrow" :size="20" /></span
              ><span class="format-description"
                >Excel, CSV</span>
            </button>
          </section>
          <aside class="coming-soon" aria-labelledby="upcoming-formats">
            <span id="upcoming-formats" class="upcoming-formats-label">Định dạng <ComingSoonBadge /></span>
            <ul aria-labelledby="upcoming-formats">
              <li>PDF</li>
              <li>Word</li>
              <li>Hình ảnh</li>
            </ul>
          </aside>
        </template>
        <template v-else-if="page === 'settings'">
          <div class="editor-heading"><h1 ref="heading" tabindex="-1">Cài đặt</h1></div>
          <ModelSettings :status="models" :desktop="desktopModels" :busy="modelActionBusy" :error="modelError" @download="modelAction('download')" @pause="modelAction('pause')" />
          <SettingsTools />
        </template>
        <template v-else>
          <div class="editor-heading">
            <div>
              <span v-if="format === 'excel' && !active" class="eyebrow">THỬ VỚI DỮ LIỆU MẪU</span>
              <h1 ref="heading" tabindex="-1">{{ title }}</h1>
              <p>
                {{
                  active
                    ? "Đọc lại kết quả, rồi sao chép khi bạn thấy phù hợp."
                    : format === 'text' ? "Nhập hoặc dán văn bản để ẩn thông tin bằng bí danh."
                      : "Một lần nhấn. Thông tin riêng tư được thay bằng bí danh."
                }}
              </p>
            </div>
            <button
              v-if="active"
              class="quiet-button"
              @click="navigate(format)"
            >
              <AppIcon name="plus" :size="15" />Phiên mới
            </button>
          </div>
          <section
            class="glass-card glass"
            :aria-label="
              format === 'text'
                ? 'Ẩn thông tin trong văn bản'
                : 'Ẩn thông tin trong bảng tính mẫu'
            "
          >
            <header class="card-header">
              <div
                v-if="active"
                class="view-switch"
                aria-label="Chọn bản văn bản"
              >
                <button
                  :aria-pressed="view === 'masked'"
                  @click="selectView('masked')"
                >
                  Bản đã ẩn thông tin</button
                ><button
                  :aria-pressed="view === 'original'"
                  @click="selectView('original')"
                >
                  Bản gốc
                </button>
              </div>
              <span v-else class="document-label"
                ><AppIcon
                  :name="format === 'text' ? 'file' : 'table'"
                  :size="17"
                />{{
                  format === "text"
                    ? "Văn bản của bạn"
                    : "Giao dịch mẫu · 2 dòng"
                }}</span
              >
              <button v-if="format === 'text' && !active && !draft" class="quiet-button" @click="draft = sampleText">
                Dùng văn bản mẫu
              </button>
              <span v-else-if="format === 'excel' || (active && !privateSession)" class="sample-tag">Dữ liệu mẫu</span>
            </header>
            <template v-if="format === 'text' && !active">
              <fieldset class="detection-options" :disabled="processing">
                <legend>Bạn muốn ẩn thông tin nào?</legend>
                <div class="option-grid">
                  <label v-for="option in detectionOptions" :key="option.id" class="detection-option" :class="{ selected: selectedOptions.includes(option.id) }" :title="option.detail">
                    <input v-model="selectedOptions" type="checkbox" :aria-label="option.model && !modelsReady ? `${option.label} · Cần tải thêm` : option.label" :value="option.id" @change="selectionEdited = true" />
                    <span>{{ option.label }}<small v-if="option.model && !modelsReady">Cần tải thêm</small></span>
                  </label>
                </div>
                <div v-if="missingSelectedModels" class="model-requirement">
                  <AppIcon name="download" :size="16" /><p>Tải gói nhận diện để dùng các mục đã chọn.<span>{{ formatModelBytes(models.total) }} · Chỉ cần tải một lần</span></p><button class="quiet-button" @click="navigate('settings')">{{ ['downloading', 'installing'].includes(models.stage) ? 'Xem tiến độ' : 'Xem chi tiết' }}<AppIcon name="chevron" :size="12" /></button>
                </div>
                <p v-if="!selectedOptions.length" class="input-error" role="status">Chọn ít nhất một loại thông tin để tiếp tục.</p>
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
              <p id="text-input-hint" class="input-hint" :class="{ 'input-error': draft.length > maxTextLength }" aria-live="polite">
                {{ draft.length > maxTextLength ? draftError : `${draft.length.toLocaleString('vi-VN')} / 50.000 ký tự` }}
              </p>
            </template>
            <template v-else-if="format === 'text' || manualCopy"
              ><label class="sr-only" for="document-content">{{
                active && view === "masked" ? "Bản đã ẩn thông tin" : "Bản gốc"
              }}</label
              ><textarea
                id="document-content"
                ref="content"
                class="text-content"
                :value="manualCopy ? output : visibleText"
                readonly
                :aria-describedby="privateSession ? 'manual-review-hint' : undefined"
                @select="captureSelection"
                @keyup="captureSelection"
                @mouseup="captureSelection"
                spellcheck="false"
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
                    active && view === "masked" ? "Bảng đã ẩn thông tin" : "Bảng gốc"
                  }}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th
                      v-for="header in sheetHeaders"
                      :key="header"
                      scope="col"
                    >
                      {{ header }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in rows" :key="index">
                    <th scope="row">{{ index + 1 }}</th>
                    <td
                      v-for="(cell, col) in row"
                      :key="col"
                      :class="{ alias: cell.startsWith('[') }"
                    >
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="sheet-caption">
                <AppIcon name="table" :size="14" />Giao dịch<span
                  >2 dòng · 6 cột</span
                >
              </div>
            </div>
            <div v-if="privateSession" class="manual-review">
              <p id="manual-review-hint" role="status">{{ reviewStatus || 'Bôi đen phần còn sót để ẩn thêm.' }}</p>
              <div class="manual-review-actions">
                <button v-if="selectedText" class="quiet-button" @click="hideSelection">Ẩn phần đã chọn</button>
                <button v-if="active?.fixture === 'private-text-v1' && active.reviewUndo" class="quiet-button" @click="undoManualMask">Hoàn tác</button>
              </div>
            </div>
            <p v-if="uncheckedCategories" class="detection-note scope-note"><AppIcon name="info" :size="16" /><span>Chưa kiểm tra: {{ uncheckedCategories }}.</span></p>
            <p v-if="active && !activeFindings.length" class="detection-note" role="status">
              Chưa phát hiện thông tin cần ẩn. Bản xem trước giữ nguyên nội dung; hãy kiểm tra lại trước khi chia sẻ.
            </p>
            <div v-if="active && activeFindings.length" class="changes">
              <button
                class="changes-toggle"
                :aria-expanded="changesOpen"
                aria-controls="change-list"
                @click="changesOpen = !changesOpen"
              >
                <span
                  ><AppIcon name="check" :size="15" />Đã ẩn
                  {{ maskCount }} mục thông tin</span
                ><span
                  >{{ changesOpen ? "Thu gọn" : "Xem thay đổi"
                  }}<AppIcon name="chevron" :size="12"
                /></span>
              </button>
              <div v-show="changesOpen" id="change-list" class="change-list">
                <p>Bỏ chọn những thông tin bạn muốn giữ nguyên.</p>
                <label
                  v-for="finding in activeFindings"
                  :key="finding.id"
                  class="change-row"
                  ><input
                    type="checkbox"
                    :checked="active.decisions[finding.id] === 'mask'"
                    @change="toggle(finding.id)"
                  /><span
                    ><strong>{{ finding.label }}</strong
                    ><small>{{ finding.value }}</small><small>{{ finding.reason }}</small><small>{{ finding.source }}</small></span
                  ><code>{{
                    active.decisions[finding.id] === "mask"
                      ? finding.alias
                      : "Giữ nguyên"
                  }}</code></label
                >
              </div>
            </div>
            <p v-if="processing" class="detection-note" role="status">{{ processingStatus }}</p>
            <footer class="card-footer">
              <span v-if="active" class="action-hint">{{ privateSession ? 'Đóng ứng dụng sẽ xóa phiên này.' : 'Phiên mẫu' }}</span>
              <button v-if="processing" class="quiet-button" @click="cancelProcessing(true)">Hủy xử lý</button>
              <button v-if="!active" class="primary-action" :disabled="processing || (format === 'text' && (!selectedOptions.length || (!missingSelectedModels && !!draftError)))" @click="mask">
                <AppIcon name="sparkle" :size="17" />{{ processing ? 'Đang xử lý…' : format === 'text' && missingSelectedModels ? 'Tải thêm để tiếp tục' : 'Ẩn thông tin' }}<AppIcon
                  name="arrow"
                  :size="16"
                /></button
              ><button
                v-else
                ref="copyButton"
                class="primary-action"
                @click="copy"
              >
                <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />{{
                  copied ? "Đã sao chép" : "Sao chép kết quả"
                }}
              </button>
            </footer>
          </section>
          <p v-if="processingError" class="storage-error" role="alert">{{ processingError }}</p>
          <p v-if="active || copyStatus" class="feedback" role="status">
            {{
              copyStatus ||
              (active
                ? "Kiểm tra nội dung còn lại trước khi chia sẻ."
                : "Kết quả sẽ xuất hiện trong một phiên mới ở thanh bên.")
            }}
          </p>
          <p v-if="format === 'excel'" class="prototype-note">Bảng mẫu tương tác. Chưa nhập hoặc xuất tệp Excel/CSV; sao chép ở dạng bảng phân cách bằng tab.</p>
        </template>
        <p v-if="storageError" class="storage-error" role="alert">
          {{ storageError }}
        </p>
      </main>
    </div>
  </div>
</template>
