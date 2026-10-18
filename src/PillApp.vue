<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { listen, emitTo, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, primaryMonitor, PhysicalPosition } from "@tauri-apps/api/window";
import AppIcon from "./components/AppIcon.vue";
import {
  events,
  mainWindow,
  quickShortcutLabel,
  type PanelStatus,
  type QuickCommand,
} from "./adapters/quick-actions.ts";
import { panelKey } from "./composables/useQuickActions.ts";

/** The floating quick-action panel (decision 0090). It owns only its own window:
 * where it sits, whether it is shown, and the last outcome the shell sent. The
 * shell does the masking and restoring; the panel never touches the clipboard. */
const positionKey = "offlinemask.quick-panel-position.v1";
const flashMs = 3600;
const margin = 24;

const status = ref<PanelStatus | null>(null);
const pinned = ref(false);
// In the browser preview the page only shows its layout; there is no window to move.
const desktop = isTauri();
const panel = desktop ? getCurrentWindow() : null;
let flashTimer: ReturnType<typeof setTimeout> | undefined;
const stops: UnlistenFn[] = [];

function readPinned() {
  try {
    return localStorage.getItem(panelKey) === "on";
  } catch {
    return false;
  }
}
/** Last dragged-to position, or the bottom-right corner of the primary screen. */
async function place() {
  if (!panel) return;
  try {
    const raw = localStorage.getItem(positionKey);
    const monitor = await primaryMonitor();
    const size = await panel.outerSize();
    if (raw) {
      const { x, y } = JSON.parse(raw) as { x: number; y: number };
      const inside =
        !monitor ||
        (x >= monitor.position.x &&
          y >= monitor.position.y &&
          x + size.width <= monitor.position.x + monitor.size.width &&
          y + size.height <= monitor.position.y + monitor.size.height);
      if (Number.isFinite(x) && Number.isFinite(y) && inside)
        return panel.setPosition(new PhysicalPosition(x, y));
    }
    if (!monitor) return;
    const area = monitor.workArea ?? monitor;
    const gap = Math.round(margin * monitor.scaleFactor);
    await panel.setPosition(
      new PhysicalPosition(
        area.position.x + area.size.width - size.width - gap,
        area.position.y + area.size.height - size.height - gap,
      ),
    );
  } catch {
    // Without monitor information the window keeps whatever position it has.
  }
}
async function rememberPosition() {
  if (!panel) return;
  try {
    const { x, y } = await panel.outerPosition();
    localStorage.setItem(positionKey, JSON.stringify({ x, y }));
  } catch {
    // Unwritable storage: the next launch uses the default corner.
  }
}
async function show() {
  await place();
  await panel?.show();
}
function hideLater() {
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => void panel?.hide(), flashMs);
}
async function send(command: QuickCommand) {
  await emitTo(mainWindow, events.command, { command }).catch(() => {});
}
async function close() {
  clearTimeout(flashTimer);
  pinned.value = false;
  await panel?.hide();
  await send("unpin");
}

onMounted(async () => {
  pinned.value = readPinned();
  if (!panel) return;
  // Take the corner (or the remembered spot) while still hidden, so the first
  // flash does not jump.
  await place();
  stops.push(
    await listen<PanelStatus>(events.status, async (event) => {
      status.value = event.payload;
      pinned.value = event.payload.pinned;
      clearTimeout(flashTimer);
      await show();
      // A result flashes by; the panel stays only while the user keeps it.
      if (!pinned.value && event.payload.tone !== "busy") hideLater();
    }),
    await listen<{ pinned: boolean }>(events.pin, async (event) => {
      pinned.value = event.payload.pinned;
      clearTimeout(flashTimer);
      if (pinned.value) await show();
      else await panel?.hide();
    }),
    await panel.onMoved(() => void rememberPosition()),
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
  </div>
</template>
