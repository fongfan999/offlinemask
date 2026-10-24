<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import AppIcon from "./components/AppIcon.vue";
import BrandMark from "./components/BrandMark.vue";
import { type PanelStatus, type QuickCommand } from "./adapters/quick-actions.ts";
import { nativeQuickPanel as panel, type Spot } from "./adapters/quick-panel.ts";

/** The floating quick-action window (decisions 0090 and 0096). It owns only its own
 * window: its shape, where it sits, whether it is shown. The shell does the masking
 * and restoring; this page never touches the clipboard. Its shapes:
 * - `dot`: a 32 px circle just above a fresh selection; one click runs its action.
 *   Hovering it shows a one-line hint beside it saying what that click will do, and
 *   "Tắt ở …" to stop it showing in that AI place (decision 0135). After ⌘⇧M outside
 *   the AI places, the check mark offers "Luôn hiện nút ở …";
 * - `preview`: read-only AI text with the real values back, top right, with copy and
 *   open-in-app buttons; it stays until one is used or it is closed;
 * - `notice`: why codes of an earlier launch cannot be restored;
 * - `toast`: a small rounded card in the corner for clipboard results (tray, Services).
 * The always-visible panel was removed: the circle and ⌘⇧M cover it (decision 0096). */
type Mode = "dot" | "preview" | "notice" | "toast";

const flashMs = 3600;
/** A question (a selection, the clipboard watch's nudge) waits longer for an answer. */
const askMs = 9000;
/** Leaving the circle folds the hint away after this pause, so a sloppy pointer is forgiven. */
const leaveMs = 350;
/** Transparent margin around the shape, room for its shadow. */
const inset = 8;

const status = ref<PanelStatus | null>(null);
const mode = ref<Mode>("toast");
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
/** Where the last circle stood, so its preview opens beside it. */
let lastCircle: (Spot & { width: number; height: number }) | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
let hoverPoll: ReturnType<typeof setInterval> | undefined;
const stops: (() => void)[] = [];
let alive = true;

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
  stopTips();
  clearTimeout(hideTimer);
  clearTimeout(leaveTimer);
  stopHover();
  dot = null;
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
  stopTips();
  stopHover();
  mode.value = "toast";
  await fit();
  await panel.place().catch(() => {});
  await panel.show();
}
async function showDot(anchor: NonNullable<PanelStatus["anchor"]>) {
  stayVisible();
  stopTips();
  mode.value = "dot";
  hovered.value = false;
  circle.value = "idle";
  circleAction.value = status.value?.action ?? "mask";
  const size = await fit();
  dot = await panel.placeDot(anchor, size).catch(() => null);
  lastCircle = dot ? { ...dot, ...size } : null;
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
/** Expanding keeps the card where it is (the user may have dragged it), pulled back
 * inside the screen if the larger card would run off it. */
async function toggleExpanded() {
  expanded.value = !expanded.value;
  await fit();
  await panel.keepOnScreen().catch(() => {});
}
/** Hints for the preview's icon buttons. Hover is read from the pointer position, as
 * for the circle, and the element under it is looked up in the page. */
const tip = ref<{ text: string; x: number; y: number } | null>(null);
let tipPoll: ReturnType<typeof setInterval> | undefined;
/** A hint shows after the pointer rests on a button, and stays through a brief slip
 * off it, so passing over the icons never makes it flicker. */
const tipDelayMs = 350;
const tipGraceMs = 150;
let hovering: HTMLElement | null = null;
let hoverSince = 0;
let leftAt = 0;
function tipFor(button: HTMLElement | null) {
  const card = shape.value;
  if (!button || !card) return null;
  const box = button.getBoundingClientRect();
  const frame = card.getBoundingClientRect();
  // Right-aligned to the button: the icons sit at the card's right edge, so a
  // centred hint would run past it and be cut off by the window.
  return {
    text: button.dataset.tip ?? "",
    x: box.right - frame.left,
    y: box.bottom - frame.top + 6,
  };
}
/** One step of the hint: `target` is the element under the pointer, or null. Only a
 * change of button, the delay or the grace changes what is on screen. */
function updateTip(target: Element | null, now = Date.now()) {
  const button = copied.value ? null : (target?.closest<HTMLElement>("[data-tip]") ?? null);
  if (button !== hovering) {
    if (!button && hovering && now - leftAt < tipGraceMs) return;
    if (!button && hovering && !leftAt) {
      leftAt = now;
      return;
    }
    hovering = button;
    hoverSince = now;
    leftAt = 0;
    tip.value = null;
    return;
  }
  leftAt = 0;
  if (!button) return;
  if (!tip.value && now - hoverSince >= tipDelayMs) tip.value = tipFor(button);
  else if (tip.value && tip.value.text !== button.dataset.tip) tip.value = tipFor(button);
}
function startTips() {
  stopTips();
  // The desktop window is in the background, so hover comes from the pointer position
  // alone; the page's own mouse events are left to the browser preview.
  tipPoll = setInterval(async () => {
    const point = await panel.pointerInPage().catch(() => null);
    updateTip(point ? document.elementFromPoint(point.x, point.y) : null);
  }, 80);
}
function stopTips() {
  clearInterval(tipPoll);
  tipPoll = undefined;
  hovering = null;
  leftAt = 0;
  tip.value = null;
}
/** Browser preview only: there the page gets hover events and nothing polls. */
function previewHover(target: EventTarget | null) {
  if (panel.desktop) return;
  tip.value = copied.value
    ? null
    : tipFor((target as Element | null)?.closest<HTMLElement>("[data-tip]") ?? null);
}
/** Codes from an earlier launch: a small card saying why nothing can be restored. */
async function showNotice() {
  stayVisible();
  stopTips();
  stopHover();
  dot = null;
  mode.value = "notice";
  await fit();
  await panel.placeTopRight().catch(() => {});
  await panel.show();
}
async function showPreview() {
  stayVisible();
  copied.value = false;
  startTips();
  expanded.value = false;
  stopHover();
  dot = null;
  mode.value = "preview";
  const size = await fit();
  // Beside the circle that opened it; the top-right corner when there was none, or when
  // the user has moved on from that selection.
  if (lastCircle && !status.value?.corner)
    await panel.placePreview(lastCircle, size).catch(() => {});
  else await panel.placeTopRight().catch(() => {});
  await panel.show();
}

/** The preview's copy icon shows a check mark once the copy worked. */
const copied = ref(false);
async function present(next: PanelStatus) {
  stayVisible();
  if (next.copied && mode.value === "preview") {
    // Keep the preview's content; confirm on the icon, then let the card fade away.
    copied.value = true;
    tip.value = null;
    hideLater(1600);
    return;
  }
  // An in-place result keeps what the circle's own question said about its place.
  status.value =
    next.inPlace && mode.value === "dot" && status.value?.offerPlace
      ? { ...next, offerPlace: status.value.offerPlace }
      : next;
  clearTimeout(hideTimer);
  if (next.tone === "preview") return showPreview();
  if (next.tone === "notice") return showNotice();
  if (next.inPlace && mode.value === "dot") {
    stopHover();
    hovered.value = false;
    circle.value = next.tone === "busy" ? "busy" : next.tone === "error" ? "error" : "done";
    await reshape();
    // The offer to show there by itself needs time to be read and clicked.
    const offering = circle.value === "done" && !!status.value?.offerPlace;
    if (next.tone !== "busy") hideLater(next.tone === "error" ? 4500 : offering ? 6000 : 1500);
    return;
  }
  if (next.tone === "select" && next.anchor) {
    await showDot(next.anchor);
    hideLater(askMs);
    return;
  }
  await showCorner();
  if (next.tone !== "busy") hideLater(flashMs);
}
async function send(command: QuickCommand) {
  await panel.send(command).catch(() => {});
}

/** Browser preview only: `pill.html?state=dot|hover|restore|unknown|circle-busy|circle-done|circle-error|preview|copied|notice|toast|busy` shows
 * one shape with sample text, so the design can be checked without the desktop app. */
function preview() {
  const state = new URLSearchParams(location.search).get("state");
  if (!state) return;
  const samples: Record<string, PanelStatus> = {
    dot: { message: "", tone: "select", action: "mask" },
    unknown: {
      message: "",
      tone: "select",
      action: "unknown",
      hint: "Không tìm thấy bản gốc",
    },
    notice: {
      message: "Không tìm thấy bản gốc",
      tone: "notice",
      notice: {
        body: "Các mã thay thế này được tạo trong một lần mở trước và chưa được lưu lại, nên không khôi phục được. Đặt mật mã để giữ lịch sử giữa các lần mở OfflineMask.",
        settings: true,
      },
    },
    "circle-busy": { message: "Đang ẩn thông tin…", tone: "busy", inPlace: true },
    "circle-done": { message: "Đã ẩn 2 thông tin", tone: "ok", inPlace: true },
    "circle-error": {
      message: "Không thấy thông tin cần ẩn. Clipboard được giữ nguyên.",
      tone: "error",
      inPlace: true,
    },
    hover: {
      message: "",
      tone: "select",
      action: "mask",
      hint: "Ẩn thông tin",
    },
    restore: {
      message: "",
      tone: "select",
      action: "restore",
      hint: "Khôi phục thông tin",
    },
    toast: { message: "Đã ẩn 2 thông tin ngay tại chỗ bạn chọn.", tone: "ok" },
    preview: {
      message: "Đã khôi phục",
      tone: "preview",
      preview: {
        text: "Tóm tắt: khách Nguyễn Văn A gọi từ 0901234567 và cần hỗ trợ gấp. Đã gửi email xác nhận tới a@example.com.",
        marks: [
          { start: 35, end: 45 },
          { start: 91, end: 104 },
        ],
        canOpen: true,
      },
    },
    busy: { message: "Đang ẩn thông tin…", tone: "busy" },
  };
  status.value = samples[state === "copied" ? "preview" : state] ?? null;
  copied.value = state === "copied";
  hovered.value = state === "hover" || state === "restore" || state === "unknown";
  circleAction.value = state === "restore" || state === "unknown" ? state : "mask";
  circle.value = state.startsWith("circle-") ? (state.slice(7) as Circle) : "idle";
  const dotStates = ["dot", "restore", "hover", "unknown"];
  mode.value =
    dotStates.includes(state) || state.startsWith("circle-")
      ? "dot"
      : state === "preview" || state === "notice"
        ? state
        : state === "copied"
          ? "preview"
          : "toast";
}

onMounted(async () => {
  if (!panel.desktop) return preview();
  // Take the corner while still hidden, so the first flash does not jump.
  await fit();
  await panel.place().catch(() => {});
  // Handlers run only while this page instance is mounted: a hot reload in development
  // replaces the instance, and a leftover one must not keep resizing the window.
  stops.push(
    await panel.onStatus((next) => {
      if (alive) void present(next);
    }),
    await panel.onDismiss(() => {
      if (alive) void hide();
    }),
  );
  // Unmounted while the listeners were still being registered: drop them now.
  if (!alive) for (const stop of stops) stop();
});
onBeforeUnmount(() => {
  alive = false;
  stopTips();
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
      <button
        v-if="circle === 'idle' && hovered && status?.place"
        class="quick-hint quick-hint-action"
        @click="send('forget-place')"
      >
        <AppIcon name="close" :size="12" />Tắt ở {{ status.place }}
      </button>
      <span v-if="circle === 'error'" class="quick-hint is-error" role="status">
        {{ shortMessage }}
      </span>
      <span v-else-if="circle !== 'idle'" class="sr-only" role="status">{{ status?.message }}</span>
      <button
        v-if="circle === 'done' && status?.offerPlace"
        class="quick-hint quick-hint-action"
        @click="send('keep-place')"
      >
        <AppIcon name="plus" :size="12" />Luôn hiện nút ở {{ status.offerPlace }}
      </button>
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
      <header
        class="quick-preview-head"
        data-tauri-drag-region
        @mouseover="previewHover($event.target)"
        @mouseleave="previewHover(null)"
      >
        <span class="quick-toast-mark" aria-hidden="true" data-tauri-drag-region
          ><BrandMark :size="16" data-tauri-drag-region
        /></span>
        <h1 class="quick-preview-title" data-tauri-drag-region>{{ status?.message }}</h1>
        <!-- Icons only; each names itself in a hint drawn by the card (data-tip), since
             the system's tooltips do not show while OfflineMask is in the background. -->
        <button
          class="quick-icon is-primary"
          :class="{ 'is-copied': copied }"
          :aria-label="copied ? 'Đã sao chép' : 'Sao chép'"
          :data-tip="copied ? 'Đã sao chép' : 'Sao chép'"
          :disabled="copied"
          @click="send('copy')"
        >
          <AppIcon v-if="copied" name="check" :size="15" />
          <AppIcon v-else name="copy" :size="15" />
        </button>
        <button
          v-if="status?.preview?.canOpen"
          class="quick-icon"
          aria-label="Mở trong OfflineMask"
          data-tip="Mở trong OfflineMask"
          @click="send('open')"
        >
          <AppIcon name="external" :size="14" />
        </button>
        <button
          class="quick-icon"
          :aria-label="expanded ? 'Thu gọn' : 'Xem rộng hơn'"
          :data-tip="expanded ? 'Thu gọn' : 'Xem rộng hơn'"
          :aria-pressed="expanded"
          @click="toggleExpanded"
        >
          <AppIcon :name="expanded ? 'shrink' : 'expand'" :size="14" />
        </button>
        <button class="quick-icon" aria-label="Đóng" data-tip="Đóng" @click="send('close')">
          <AppIcon name="close" :size="14" />
        </button>
      </header>
      <p class="quick-preview-text">
        <template v-for="(part, index) in previewParts" :key="index"
          ><mark v-if="part.restored">{{ part.text }}</mark
          ><template v-else>{{ part.text }}</template></template
        >
      </p>
      <span v-if="tip" class="quick-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
        {{ tip.text }}
      </span>
    </section>

    <!-- Progress and results: a small card in the corner. -->
    <div v-else-if="mode === 'toast'" ref="shape" class="quick-toast" :class="`is-${status?.tone}`">
      <span class="quick-toast-mark" aria-hidden="true">
        <AppIcon v-if="status?.tone === 'error'" name="info" :size="14" />
        <AppIcon v-else-if="status?.tone === 'ok'" name="check" :size="14" />
        <BrandMark v-else :size="16" />
      </span>
      <p class="quick-toast-text" role="status">{{ status?.message }}</p>
      <div v-if="busy" class="pill-progress" aria-hidden="true"><span></span></div>
    </div>
  </div>
</template>
