<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import AppIcon from "./components/AppIcon.vue";
import BrandMark from "./components/BrandMark.vue";
import {
  panelKey,
  quickShortcutLabel,
  type PanelStatus,
  type QuickCommand,
} from "./adapters/quick-actions.ts";
import { nativeQuickPanel as panel, type Spot } from "./adapters/quick-panel.ts";

/** The floating quick-action window (decisions 0090 and 0096). It owns only its own
 * window: its shape, where it sits, whether it is shown. The shell does the masking
 * and restoring; this page never touches the clipboard. Four shapes:
 * - `dot`: a 32 px circle just above a fresh selection; one click runs its action.
 *   Hovering it shows a one-line hint beside it saying what that click will do;
 * - `preview`: read-only AI text with the real values back, top right, with copy and
 *   open-in-app buttons; it stays until one is used or it is closed;
 * - `toast`: a small rounded card in the corner for progress and results;
 * - `panel`: the full panel with both buttons, when the user keeps it on screen. */
type Mode = "dot" | "preview" | "notice" | "toast" | "panel";

const flashMs = 3600;
/** A question (a selection, the clipboard watch's nudge) waits longer for an answer. */
const askMs = 9000;
/** Leaving the circle folds the hint away after this pause, so a sloppy pointer is forgiven. */
const leaveMs = 350;
/** Transparent margin around the shape, room for its shadow. */
const inset = 8;

const status = ref<PanelStatus | null>(null);
const pinned = ref(false);
const mode = ref<Mode>("panel");
/** The circle is hovered: the hint shows beside it. */
const hovered = ref(false);
/** A click on the circle that works in place plays out on the circle itself: it spins
 * while the text is processed, shows a check mark when the text is replaced, or an
 * exclamation mark with one short line when it could not be. */
type Circle = "idle" | "busy" | "done" | "error";
const circle = ref<Circle>("idle");
const circleAction = ref<"mask" | "restore" | "unknown">("mask");
/** The first sentence of a message is enough beside the circle. */
const shortMessage = computed(() => (status.value?.message ?? "").split(/\.\s/)[0]);
const shape = useTemplateRef<HTMLElement>("shape");
const busy = computed(() => status.value?.tone === "busy");
let dot: Spot | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
let hoverPoll: ReturnType<typeof setInterval> | undefined;
const stops: (() => void)[] = [];
let alive = true;

function readPinned() {
  try {
    return localStorage.getItem(panelKey) === "on";
  } catch {
    return false;
  }
}
/** Size the window to the shape now on screen. */
async function fit() {
  await nextTick();
  const box = shape.value?.getBoundingClientRect();
  if (!box) return { width: 0, height: 0 };
  const size = { width: box.width + inset * 2, height: box.height + inset * 2 };
  await panel.fit(size.width, size.height).catch(() => {});
  return size;
}
function hideLater(delay: number) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => void hide(), delay);
}
/** The shape fades out before the window goes; a new status during the fade wins. */
const fadeMs = 260;
const leaving = ref(false);
let fadeToken = 0;
async function hide() {
  clearTimeout(hideTimer);
  clearTimeout(leaveTimer);
  stopHover();
  dot = null;
  if (pinned.value && mode.value !== "panel") return showCorner();
  const token = ++fadeToken;
  leaving.value = true;
  await new Promise((resolve) => setTimeout(resolve, fadeMs));
  if (token !== fadeToken) return;
  await panel.hide();
  leaving.value = false;
}
/** Anything shown again cancels a fade in progress. */
function stayVisible() {
  fadeToken++;
  leaving.value = false;
}
async function showCorner() {
  stayVisible();
  stopHover();
  mode.value = pinned.value ? "panel" : "toast";
  await fit();
  await panel.place().catch(() => {});
  await panel.show();
}
async function showDot(anchor: NonNullable<PanelStatus["anchor"]>) {
  stayVisible();
  mode.value = "dot";
  hovered.value = false;
  circle.value = "idle";
  circleAction.value = status.value?.action ?? "mask";
  const size = await fit();
  dot = await panel.placeDot(anchor, size).catch(() => null);
  await panel.show();
  startHover();
}

/** Hover is read from the pointer position, which also works while OfflineMask is
 * in the background; mouseenter is only a faster path when the webview reports it. */
function startHover() {
  stopHover();
  hoverPoll = setInterval(async () => {
    const inside = await panel.pointerInside().catch(() => false);
    if (inside) void enter();
    else void leave();
  }, 80);
}
function stopHover() {
  clearInterval(hoverPoll);
  hoverPoll = undefined;
}
/** Pointer over the circle: show the hint beside it (the circle stays where it is). */
async function enter() {
  clearTimeout(leaveTimer);
  leaveTimer = undefined;
  if (mode.value !== "dot" || hovered.value) return;
  clearTimeout(hideTimer);
  hovered.value = true;
  await reshape();
}
/** Pointer gone: after a short pause the hint folds away. */
function leave() {
  if (leaveTimer || mode.value !== "dot" || !hovered.value) return;
  leaveTimer = setTimeout(async () => {
    leaveTimer = undefined;
    if (mode.value !== "dot") return;
    hovered.value = false;
    await reshape();
    hideLater(flashMs);
  }, leaveMs);
}
async function reshape() {
  const size = await fit();
  if (dot) await panel.placeFrom(dot, size).catch(() => {});
}

/** The restore preview's text split around the restored values, for highlighting. */
const previewParts = computed(() => {
  const preview = status.value?.preview;
  if (!preview) return [];
  const parts: { text: string; restored: boolean }[] = [];
  let cursor = 0;
  for (const mark of preview.marks) {
    if (mark.start > cursor)
      parts.push({ text: preview.text.slice(cursor, mark.start), restored: false });
    parts.push({ text: preview.text.slice(mark.start, mark.end), restored: true });
    cursor = mark.end;
  }
  if (cursor < preview.text.length)
    parts.push({ text: preview.text.slice(cursor), restored: false });
  return parts;
});
/** The preview can grow for a long answer, keeping its top-right corner. */
const expanded = ref(false);
async function toggleExpanded() {
  expanded.value = !expanded.value;
  await fit();
  await panel.placeTopRight().catch(() => {});
}
/** Codes from an earlier launch: a small card saying why nothing can be restored. */
async function showNotice() {
  stayVisible();
  stopHover();
  dot = null;
  mode.value = "notice";
  await fit();
  await panel.placeTopRight().catch(() => {});
  await panel.show();
}
async function showPreview() {
  stayVisible();
  expanded.value = false;
  stopHover();
  dot = null;
  mode.value = "preview";
  await fit();
  await panel.placeTopRight().catch(() => {});
  await panel.show();
}

async function present(next: PanelStatus) {
  stayVisible();
  status.value = next;
  pinned.value = next.pinned;
  clearTimeout(hideTimer);
  if (next.tone === "preview") return showPreview();
  if (next.tone === "notice") return showNotice();
  if (next.inPlace && mode.value === "dot") {
    stopHover();
    hovered.value = false;
    circle.value = next.tone === "busy" ? "busy" : next.tone === "error" ? "error" : "done";
    await reshape();
    if (next.tone !== "busy") hideLater(next.tone === "error" ? 4500 : 1500);
    return;
  }
  if (next.tone === "select" && next.anchor) {
    await showDot(next.anchor);
    hideLater(askMs);
    return;
  }
  await showCorner();
  if (!pinned.value && next.tone !== "busy") hideLater(next.tone === "offer" ? askMs : flashMs);
}
async function send(command: QuickCommand) {
  await panel.send(command).catch(() => {});
}
async function close() {
  pinned.value = false;
  await panel.hide();
  await send("unpin");
}

/** Browser preview only: `pill.html?state=dot|hover|restore|unknown|circle-busy|circle-done|circle-error|preview|notice|toast|busy|offer|panel` shows
 * one shape with sample text, so the design can be checked without the desktop app. */
function preview() {
  const state = new URLSearchParams(location.search).get("state");
  if (!state) return;
  const samples: Record<string, PanelStatus> = {
    dot: { message: "", tone: "select", action: "mask", pinned: false },
    unknown: {
      message: "",
      tone: "select",
      action: "unknown",
      hint: "Không tìm thấy bản gốc",
      pinned: false,
    },
    notice: {
      message: "Không tìm thấy bản gốc",
      tone: "notice",
      pinned: false,
      notice: {
        body: "Các mã thay thế này được tạo trong một lần mở trước và chưa được lưu lại, nên không khôi phục được. Đặt mật mã để giữ lịch sử giữa các lần mở OfflineMask.",
        settings: true,
      },
    },
    "circle-busy": { message: "Đang ẩn thông tin…", tone: "busy", inPlace: true, pinned: false },
    "circle-done": { message: "Đã ẩn 2 thông tin", tone: "ok", inPlace: true, pinned: false },
    "circle-error": {
      message: "Không thấy thông tin cần ẩn. Clipboard được giữ nguyên.",
      tone: "error",
      inPlace: true,
      pinned: false,
    },
    hover: {
      message: "",
      tone: "select",
      action: "mask",
      hint: "Ẩn thông tin",
      pinned: false,
    },
    restore: {
      message: "",
      tone: "select",
      action: "restore",
      hint: "Khôi phục thông tin",
      pinned: false,
    },
    toast: { message: "Đã ẩn 2 thông tin ngay tại chỗ bạn chọn.", tone: "ok", pinned: false },
    preview: {
      message: "Đã khôi phục 2 thông tin",
      tone: "preview",
      pinned: false,
      preview: {
        text: "Tóm tắt: khách Nguyễn Văn A gọi từ 0901234567 và cần hỗ trợ gấp. Đã gửi email xác nhận tới a@example.com.",
        marks: [
          { start: 35, end: 45 },
          { start: 91, end: 104 },
        ],
        canOpen: true,
      },
    },
    busy: { message: "Đang ẩn thông tin…", tone: "busy", pinned: false },
    offer: {
      message: "Văn bản vừa sao chép có 2 thông tin nhạy cảm.",
      tone: "offer",
      pinned: false,
    },
    panel: { message: "Sao chép văn bản, rồi bấm một nút.", tone: "ok", pinned: true },
  };
  status.value = samples[state] ?? null;
  pinned.value = state === "panel";
  hovered.value = state === "hover" || state === "restore" || state === "unknown";
  circleAction.value = state === "restore" || state === "unknown" ? state : "mask";
  circle.value = state.startsWith("circle-") ? (state.slice(7) as Circle) : "idle";
  const dotStates = ["dot", "restore", "hover", "unknown"];
  mode.value =
    dotStates.includes(state) || state.startsWith("circle-")
      ? "dot"
      : state === "panel" || state === "preview" || state === "notice"
        ? state
        : "toast";
}

onMounted(async () => {
  pinned.value = readPinned();
  if (!panel.desktop) return preview();
  mode.value = pinned.value ? "panel" : "toast";
  // Take the corner (or the remembered spot) while still hidden, so the first
  // flash does not jump.
  await fit();
  await panel.place().catch(() => {});
  // Handlers run only while this page instance is mounted: a hot reload in development
  // replaces the instance, and a leftover one must not keep resizing the window.
  stops.push(
    await panel.onStatus((next) => {
      if (alive) void present(next);
    }),
    await panel.onPin(async (next) => {
      if (!alive) return;
      pinned.value = next;
      if (next) await showCorner();
      else await hide();
    }),
    await panel.onDismiss(() => {
      if (alive) void hide();
    }),
    // Only the full panel can be dragged; its resting place is remembered.
    await panel.onMoved(() => {
      if (alive && mode.value === "panel") void panel.rememberPosition().catch(() => {});
    }),
  );
  // Unmounted while the listeners were still being registered: drop them now.
  if (!alive) for (const stop of stops) stop();
  else if (pinned.value) await showCorner();
});
onBeforeUnmount(() => {
  alive = false;
  clearTimeout(hideTimer);
  clearTimeout(leaveTimer);
  stopHover();
  for (const stop of stops) stop();
});
</script>

<template>
  <div class="quick-window" :class="[`is-${mode}`, { 'is-leaving': leaving }]">
    <!-- The circle over a selection: one click does what its icon says. Hovering it
         shows a one-line hint beside it saying what that click will do. -->
    <div
      v-if="mode === 'dot'"
      ref="shape"
      class="quick-dot-wrap"
      @mouseenter="enter"
      @mouseleave="leave"
    >
      <button
        class="quick-dot"
        :class="[`is-${circle}`, { 'is-unknown': circleAction === 'unknown' }]"
        :disabled="circle !== 'idle'"
        :aria-label="
          circleAction === 'mask'
            ? 'Ẩn thông tin'
            : circleAction === 'restore'
              ? 'Khôi phục thông tin'
              : 'Không tìm thấy bản gốc'
        "
        @click="send(circleAction)"
      >
        <span v-if="circle === 'busy'" class="quick-spinner" aria-hidden="true"></span>
        <AppIcon v-else-if="circle === 'done'" name="check" :size="18" />
        <AppIcon v-else-if="circle === 'error'" name="info" :size="18" />
        <BrandMark v-else-if="circleAction === 'mask'" :size="20" />
        <BrandMark v-else variant="restore" :size="20" />
      </button>
      <span
        v-if="circle === 'idle' && hovered && status?.hint"
        class="quick-hint"
        aria-hidden="true"
      >
        {{ status.hint }}
      </span>
      <span v-else-if="circle === 'error'" class="quick-hint is-error" role="status">
        {{ shortMessage }}
      </span>
      <span v-else-if="circle !== 'idle'" class="sr-only" role="status">{{ status?.message }}</span>
    </div>

    <!-- Codes from an earlier launch: why nothing can be restored, and the way out. -->
    <section
      v-else-if="mode === 'notice'"
      ref="shape"
      class="quick-preview quick-notice"
      aria-live="polite"
    >
      <header class="quick-preview-head">
        <span class="quick-toast-mark is-muted" aria-hidden="true">
          <BrandMark variant="restore" :size="16" />
        </span>
        <h1 class="quick-preview-title">{{ status?.message }}</h1>
        <button class="pill-close" aria-label="Đóng" @click="send('close')">
          <AppIcon name="close" :size="14" />
        </button>
      </header>
      <p class="quick-notice-text">{{ status?.notice?.body }}</p>
      <footer class="quick-preview-actions">
        <button v-if="status?.notice?.settings" class="quick-flat" @click="send('settings')">
          Đặt mật mã
        </button>
        <button class="primary-action quick-preview-copy" @click="send('close')">Đã hiểu</button>
      </footer>
    </section>

    <!-- Read-only AI text with the real values back: copy it, or open its session. -->
    <section
      v-else-if="mode === 'preview'"
      ref="shape"
      class="quick-preview"
      :class="{ 'is-expanded': expanded }"
      aria-live="polite"
    >
      <header class="quick-preview-head">
        <span class="quick-toast-mark" aria-hidden="true"><BrandMark :size="16" /></span>
        <h1 class="quick-preview-title">{{ status?.message }}</h1>
        <button
          class="pill-close"
          :aria-label="expanded ? 'Thu gọn' : 'Xem rộng hơn'"
          :title="expanded ? 'Thu gọn' : 'Xem rộng hơn'"
          :aria-pressed="expanded"
          @click="toggleExpanded"
        >
          <AppIcon :name="expanded ? 'shrink' : 'expand'" :size="14" />
        </button>
        <button class="pill-close" aria-label="Đóng" @click="send('close')">
          <AppIcon name="close" :size="14" />
        </button>
      </header>
      <p class="quick-preview-text">
        <template v-for="(part, index) in previewParts" :key="index"
          ><mark v-if="part.restored">{{ part.text }}</mark
          ><template v-else>{{ part.text }}</template></template
        >
      </p>
      <footer class="quick-preview-actions">
        <button v-if="status?.preview?.canOpen" class="quick-flat" @click="send('open')">
          Mở trong OfflineMask
        </button>
        <button class="primary-action quick-preview-copy" @click="send('copy')">
          <AppIcon name="copy" :size="14" />Sao chép
        </button>
      </footer>
    </section>

    <!-- Progress and results: a small card in the corner. -->
    <div v-else-if="mode === 'toast'" ref="shape" class="quick-toast" :class="`is-${status?.tone}`">
      <span class="quick-toast-mark" aria-hidden="true">
        <AppIcon v-if="status?.tone === 'error'" name="info" :size="14" />
        <AppIcon v-else-if="status?.tone === 'ok'" name="check" :size="14" />
        <BrandMark v-else :size="16" />
      </span>
      <p class="quick-toast-text" role="status">{{ status?.message }}</p>
      <button v-if="status?.tone === 'offer'" class="quick-chip is-primary" @click="send('mask')">
        Ẩn
      </button>
      <div v-if="busy" class="pill-progress" aria-hidden="true"><span></span></div>
    </div>

    <!-- Kept on screen: the full panel, draggable by its header. -->
    <div v-else ref="shape" class="pill">
      <div class="pill-head" data-tauri-drag-region>
        <span class="brand-mark" data-tauri-drag-region><BrandMark :size="18" /></span>
        <span class="brand-name" data-tauri-drag-region
          >Offline<span class="brand-accent">Mask</span></span
        >
        <span class="pill-hint" data-tauri-drag-region>{{ quickShortcutLabel }}</span>
        <button class="pill-close" aria-label="Ẩn bảng nổi" @click="close">
          <AppIcon name="close" :size="14" />
        </button>
      </div>
      <div class="pill-actions">
        <button class="primary-action" :disabled="busy" @click="send('mask')">
          <BrandMark :size="16" />Ẩn thông tin
        </button>
        <button class="quiet-button" :disabled="busy" @click="send('restore')">
          <BrandMark variant="restore" :size="16" />Khôi phục
        </button>
      </div>
      <p class="pill-status" :class="`is-${status?.tone ?? 'idle'}`" role="status">
        {{ status?.message ?? "Sao chép văn bản, rồi bấm một nút." }}
      </p>
      <div v-if="busy" class="pill-progress" aria-hidden="true"><span></span></div>
    </div>
  </div>
</template>
