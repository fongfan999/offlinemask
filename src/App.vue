<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import AppIcon from "./components/AppIcon.vue";
import MaskingPreview from "./components/MaskingPreview.vue";
import { version } from "../package.json";
import { openProductWebsite, productWebsite } from "./adapters/desktop";
import { findings, sampleText } from "./core/review";
import {
  createSession,
  decodeSessions,
  encodeSessions,
  historyKey,
  maskedRows,
  sessionOutput,
  sessionTitle,
  sheetHeaders,
  sheetRows,
  type Format,
  type SampleSession,
} from "./core/sessions";

const sessions = ref<SampleSession[]>([]);
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
const page = ref<"home" | Format>("home");
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
const content = useTemplateRef<HTMLTextAreaElement>("content");
const copyButton = useTemplateRef<HTMLButtonElement>("copyButton");
const sidebarStart = useTemplateRef<HTMLButtonElement>("sidebarStart");
const sidebarToggle = useTemplateRef<HTMLButtonElement>("sidebarToggle");
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const output = computed(() =>
  active.value ? sessionOutput(active.value) : "",
);
const visibleText = computed(() =>
  active.value && view.value === "masked" ? output.value : sampleText,
);
const rows = computed(() =>
  active.value && view.value === "masked"
    ? maskedRows(active.value.decisions)
    : sheetRows,
);
const maskCount = computed(() =>
  active.value
    ? findings.filter((f) => active.value?.decisions[f.id] === "mask").length
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
  copied.value = false;
  copyStatus.value = "";
  manualCopy.value = false;
}
async function navigate(
  destination: "home" | Format,
  id: string | null = null,
) {
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
  const session = createSession(format.value, sessions.value);
  sessions.value.unshift(session);
  activeId.value = session.id;
  view.value = "masked";
  clearFeedback();
  save();
  await nextTick();
  copyButton.value?.focus();
}
function toggle(id: string) {
  if (!active.value) return;
  active.value.decisions[id] =
    active.value.decisions[id] === "mask" ? "keep" : "mask";
  view.value = "masked";
  clearFeedback();
  save();
}
async function copy() {
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
            ><small>{{ dateLabel(session.createdAt) }}</small></span
          >
        </button>
      </div>
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
            format === "text" ? "Văn bản" : "Bảng tính"
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
            <span id="upcoming-formats">Định dạng sắp có</span>
            <ul aria-labelledby="upcoming-formats">
              <li>PDF</li>
              <li>Word</li>
              <li>Hình ảnh</li>
            </ul>
          </aside>
        </template>
        <template v-else>
          <div class="editor-heading">
            <div>
              <span class="eyebrow">{{
                active ? "PHIÊN ĐÃ XỬ LÝ" : "THỬ VỚI DỮ LIỆU MẪU"
              }}</span>
              <h1 ref="heading" tabindex="-1">{{ title }}</h1>
              <p>
                {{
                  active
                    ? "Đọc lại kết quả, rồi sao chép khi bạn thấy phù hợp."
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
                ? 'Ẩn thông tin trong văn bản mẫu'
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
                  @click="view = 'masked'"
                >
                  Bản đã ẩn thông tin</button
                ><button
                  :aria-pressed="view === 'original'"
                  @click="view = 'original'"
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
                    ? "Yêu cầu hỗ trợ"
                    : "Giao dịch mẫu · 2 dòng"
                }}</span
              ><span class="sample-tag">Dữ liệu mẫu</span>
            </header>
            <template v-if="format === 'text' || manualCopy"
              ><label class="sr-only" for="document-content">{{
                active && view === "masked" ? "Bản đã ẩn thông tin" : "Văn bản mẫu"
              }}</label
              ><textarea
                id="document-content"
                ref="content"
                class="text-content"
                :value="manualCopy ? output : visibleText"
                readonly
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
            <div v-if="active" class="changes">
              <button
                class="changes-toggle"
                :aria-expanded="changesOpen"
                aria-controls="change-list"
                @click="changesOpen = !changesOpen"
              >
                <span
                  ><AppIcon name="check" :size="15" />Đã ẩn
                  {{ maskCount }} loại thông tin</span
                ><span
                  >{{ changesOpen ? "Thu gọn" : "Xem thay đổi"
                  }}<AppIcon name="chevron" :size="12"
                /></span>
              </button>
              <div v-show="changesOpen" id="change-list" class="change-list">
                <p>Bỏ chọn những thông tin bạn muốn giữ nguyên.</p>
                <label
                  v-for="finding in findings"
                  :key="finding.id"
                  class="change-row"
                  ><input
                    type="checkbox"
                    :checked="active.decisions[finding.id] === 'mask'"
                    @change="toggle(finding.id)"
                  /><span
                    ><strong>{{ finding.label }}</strong
                    ><small>{{ finding.value }}</small></span
                  ><code>{{
                    active.decisions[finding.id] === "mask"
                      ? finding.alias
                      : "Giữ nguyên"
                  }}</code></label
                >
              </div>
            </div>
            <footer class="card-footer">
              <span class="action-hint"
                ><AppIcon :name="active ? 'check' : 'lock'" :size="14" />{{
                  active
                    ? storageError
                      ? "Phiên đang mở trên thiết bị."
                      : "Phiên đã được lưu trên thiết bị."
                    : "Bản gốc luôn được giữ nguyên."
                }}</span
              ><button v-if="!active" class="primary-action" @click="mask">
                <AppIcon name="sparkle" :size="17" />Ẩn thông tin<AppIcon
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
          <p class="feedback" role="status">
            {{
              copyStatus ||
              (active
                ? "Kiểm tra nội dung còn lại trước khi chia sẻ."
                : "Kết quả sẽ xuất hiện trong một phiên mới ở thanh bên.")
            }}
          </p>
          <p class="prototype-note">
            {{
              format === "excel"
                ? "Bảng mẫu tương tác. Chưa nhập hoặc xuất tệp Excel/CSV; sao chép ở dạng bảng phân cách bằng tab."
                : "Văn bản mẫu tương tác. Chưa hỗ trợ nội dung riêng hoặc khôi phục."
            }}
          </p>
        </template>
        <p v-if="storageError" class="storage-error" role="alert">
          {{ storageError }}
        </p>
      </main>
    </div>
  </div>
</template>
