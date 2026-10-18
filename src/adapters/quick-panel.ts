import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, PhysicalPosition, primaryMonitor } from "@tauri-apps/api/window";
import {
  events,
  mainWindow,
  panelPositionKey,
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
  onMoved(handler: () => void): Promise<UnlistenFn>;
  send(command: QuickCommand): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  /** Move to the remembered spot, or the bottom-right corner of the primary screen. */
  place(): Promise<void>;
  rememberPosition(): Promise<void>;
}

const margin = 24;
const none: UnlistenFn = () => {};

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
