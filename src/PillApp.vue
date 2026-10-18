<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./components/AppIcon.vue";
import {
  panelKey,
  quickShortcutLabel,
  type PanelStatus,
  type QuickCommand,
} from "./adapters/quick-actions.ts";
import { nativeQuickPanel as panel } from "./adapters/quick-panel.ts";

/** The floating quick-action panel (decision 0090). It owns only its own window:
 * where it sits, whether it is shown, and the last outcome the shell sent. The
 * shell does the masking and restoring; the panel never touches the clipboard. */
const flashMs = 3600;
/** A nudge from the clipboard watch waits for a decision a little longer. */
const offerMs = 9000;

const status = ref<PanelStatus | null>(null);
const pinned = ref(false);
/** While anchored to a selection, a programmatic move must not become the remembered spot. */
let anchored = false;
let flashTimer: ReturnType<typeof setTimeout> | undefined;
const stops: (() => void)[] = [];

function readPinned() {
  try {
    return localStorage.getItem(panelKey) === "on";
  } catch {
    return false;
  }
}
async function show(anchor?: PanelStatus["anchor"]) {
  // Without monitor information the window keeps whatever position it has.
  anchored = !!anchor;
  if (anchor) await panel.placeNear(anchor).catch(() => {});
  else await panel.place().catch(() => {});
  await panel.show();
}
async function hide() {
  anchored = false;
  await panel.hide();
}
function hideLater(delay = flashMs) {
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => void hide(), delay);
}
async function send(command: QuickCommand) {
  await panel.send(command).catch(() => {});
}
async function close() {
  clearTimeout(flashTimer);
  pinned.value = false;
  await hide();
  await send("unpin");
}

onMounted(async () => {
  pinned.value = readPinned();
  if (!panel.desktop) return;
  // Take the corner (or the remembered spot) while still hidden, so the first
  // flash does not jump.
  await panel.place().catch(() => {});
  stops.push(
    await panel.onStatus(async (next) => {
      status.value = next;
      pinned.value = next.pinned;
      clearTimeout(flashTimer);
      await show(next.anchor);
      // A result flashes by; the panel stays only while the user keeps it. A question
      // (offer, select) waits longer for its answer.
      if (!pinned.value && next.tone !== "busy")
        hideLater(next.tone === "offer" || next.tone === "select" ? offerMs : flashMs);
    }),
    await panel.onPin(async (next) => {
      pinned.value = next;
      clearTimeout(flashTimer);
      if (next) await show();
      else await hide();
    }),
    await panel.onDismiss(async () => {
      clearTimeout(flashTimer);
      if (pinned.value) await show();
      else await hide();
    }),
    await panel.onMoved(() => {
      if (!anchored) void panel.rememberPosition().catch(() => {});
    }),
  );
  if (pinned.value) await show();
});
onBeforeUnmount(() => {
  clearTimeout(flashTimer);
  for (const stop of stops) stop();
});
</script>

<template>
  <div class="pill" :class="{ 'is-busy': status?.tone === 'busy' }">
    <div class="pill-head" data-tauri-drag-region>
      <span class="brand-mark" data-tauri-drag-region><AppIcon name="mask" :size="16" /></span>
      <span class="brand-name" data-tauri-drag-region
        >Offline<span class="brand-accent">Mask</span></span
      >
      <span class="pill-hint" data-tauri-drag-region>{{ quickShortcutLabel }}</span>
      <button class="pill-close" aria-label="Ẩn bảng nổi" @click="close">
        <AppIcon name="close" :size="14" />
      </button>
    </div>
    <div class="pill-actions">
      <button class="primary-action" :disabled="status?.tone === 'busy'" @click="send('mask')">
        <AppIcon name="mask" :size="15" />Ẩn thông tin
      </button>
      <button class="quiet-button" :disabled="status?.tone === 'busy'" @click="send('restore')">
        <AppIcon name="undo" :size="15" />Khôi phục
      </button>
    </div>
    <p class="pill-status" :class="`is-${status?.tone ?? 'idle'}`" role="status">
      {{ status?.message ?? "Sao chép văn bản, rồi bấm một nút." }}
    </p>
    <!-- While a text is masked the panel waits in its corner with a moving bar. -->
    <div v-if="status?.tone === 'busy'" class="pill-progress" aria-hidden="true">
      <span></span>
    </div>
  </div>
</template>
