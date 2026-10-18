import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  availableMonitors,
  getCurrentWindow,
  PhysicalPosition,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";
import {
  events,
  mainWindow,
  panelPositionKey,
  type PanelAnchor,
  type PanelStatus,
  type QuickCommand,
} from "./quick-actions.ts";

/** Everything the floating panel window (decision 0090) asks of Tauri: its own
 * window, the two events with the shell, and the screen it sits on. */
export interface QuickPanelAdapter {
  /** False in the browser preview, where the page only shows its layout. */
  desktop: boolean;
  onStatus(handler: (status: PanelStatus) => void): Promise<UnlistenFn>;
  onPin(handler: (pinned: boolean) => void): Promise<UnlistenFn>;
  onDismiss(handler: () => void): Promise<UnlistenFn>;
  onMoved(handler: () => void): Promise<UnlistenFn>;
  send(command: QuickCommand): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  /** Move to the remembered spot, or the bottom-right corner of the primary screen. */
  place(): Promise<void>;
  /** Move just above a selection (or the pointer), kept on that screen (decision 0096). */
  placeNear(anchor: PanelAnchor): Promise<void>;
  rememberPosition(): Promise<void>;
}

const margin = 24;
/** Space between the selection and the panel. */
const gapAboveSelection = 8;
const none: UnlistenFn = () => {};

/** The monitor holding a logical point, else the primary one. */
async function monitorAt(point: { x: number; y: number }): Promise<Monitor | null> {
  const monitors = await availableMonitors();
  const hit = monitors.find((monitor) => {
    const scale = monitor.scaleFactor;
    const left = monitor.position.x / scale;
    const top = monitor.position.y / scale;
    return (
      point.x >= left &&
      point.x < left + monitor.size.width / scale &&
      point.y >= top &&
      point.y < top + monitor.size.height / scale
    );
  });
  return hit ?? (await primaryMonitor());
}
/** Panel position (logical) above the anchor, clamped inside the monitor's work area. */
export function positionAbove(
  anchor: PanelAnchor,
  panel: { width: number; height: number },
  area: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const target = anchor.bounds ?? { ...anchor.pointer, width: 0, height: 0 };
  let x = target.x + target.width / 2 - panel.width / 2;
  let y = target.y - gapAboveSelection - panel.height;
  if (y < area.y) y = target.y + target.height + gapAboveSelection;
  x = Math.min(Math.max(x, area.x), area.x + area.width - panel.width);
  y = Math.min(Math.max(y, area.y), area.y + area.height - panel.height);
  return { x: Math.round(x), y: Math.round(y) };
}

export const nativeQuickPanel: QuickPanelAdapter = {
  desktop: isTauri(),
  onStatus: (handler) =>
    isTauri()
      ? listen<PanelStatus>(events.status, (event) => handler(event.payload))
      : Promise.resolve(none),
  onPin: (handler) =>
    isTauri()
      ? listen<{ pinned: boolean }>(events.pin, (event) => handler(event.payload.pinned))
      : Promise.resolve(none),
  onDismiss: (handler) =>
    isTauri() ? listen(events.dismiss, () => handler()) : Promise.resolve(none),
  onMoved: (handler) =>
    isTauri() ? getCurrentWindow().onMoved(() => handler()) : Promise.resolve(none),
  send: (command) =>
    isTauri() ? emitTo(mainWindow, events.command, { command }) : Promise.resolve(),
  show: () => (isTauri() ? getCurrentWindow().show() : Promise.resolve()),
  hide: () => (isTauri() ? getCurrentWindow().hide() : Promise.resolve()),
  async place() {
    if (!isTauri()) return;
    const panel = getCurrentWindow();
    const monitor = await primaryMonitor();
    const size = await panel.outerSize();
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(panelPositionKey);
    } catch {
      // Unreadable storage: the default corner below.
    }
    if (raw) {
      const { x, y } = JSON.parse(raw) as { x: number; y: number };
      const inside =
        !monitor ||
        (x >= monitor.position.x &&
          y >= monitor.position.y &&
          x + size.width <= monitor.position.x + monitor.size.width &&
          y + size.height <= monitor.position.y + monitor.size.height);
      if (Number.isFinite(x) && Number.isFinite(y) && inside) {
        await panel.setPosition(new PhysicalPosition(x, y));
        return;
      }
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
  },
  async placeNear(anchor) {
    if (!isTauri()) return;
    const panel = getCurrentWindow();
    const monitor = await monitorAt(anchor.bounds ?? anchor.pointer);
    if (!monitor) return;
    const scale = monitor.scaleFactor;
    const physicalArea = monitor.workArea ?? monitor;
    const area = {
      x: physicalArea.position.x / scale,
      y: physicalArea.position.y / scale,
      width: physicalArea.size.width / scale,
      height: physicalArea.size.height / scale,
    };
    const size = await panel.outerSize();
    const spot = positionAbove(
      anchor,
      { width: size.width / scale, height: size.height / scale },
      area,
    );
    await panel.setPosition(
      new PhysicalPosition(Math.round(spot.x * scale), Math.round(spot.y * scale)),
    );
  },
  async rememberPosition() {
    if (!isTauri()) return;
    const { x, y } = await getCurrentWindow().outerPosition();
    try {
      localStorage.setItem(panelPositionKey, JSON.stringify({ x, y }));
    } catch {
      // Unwritable storage: the next launch uses the default corner.
    }
  },
};
