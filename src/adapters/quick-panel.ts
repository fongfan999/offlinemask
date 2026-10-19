import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  availableMonitors,
  cursorPosition,
  getCurrentWindow,
  LogicalSize,
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

/** A logical rectangle on the desktop (points, top-left origin). */
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Where an anchored panel sits, with the screen it is on, so a later resize (the
 * hover menu growing out of the circle) can stay on that screen. */
export interface Spot {
  x: number;
  y: number;
  area: Area;
  scale: number;
}

/** Everything the floating panel window (decision 0090) asks of Tauri: its own
 * window, the two events with the shell, the screen it sits on and the pointer. */
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
  /** Resize to fit the content (logical points). */
  fit(width: number, height: number): Promise<void>;
  /** Move to the remembered spot, or the bottom-right corner of the primary screen. */
  place(): Promise<void>;
  /** The top-right corner of the primary screen, for the restore preview. */
  placeTopRight(): Promise<void>;
  /** The small circle just above the end of a selection (decision 0096). */
  placeDot(anchor: PanelAnchor, size: { width: number; height: number }): Promise<Spot | null>;
  /** The hover menu, growing out of the circle at `from`, kept on its screen. */
  placeFrom(from: Spot, size: { width: number; height: number }): Promise<void>;
  /** Whether the pointer is over the window; works while the app is in the background. */
  pointerInside(): Promise<boolean>;
  /** The pointer in the page's CSS pixels, or null when it is outside the window. */
  pointerInPage(): Promise<{ x: number; y: number } | null>;
  rememberPosition(): Promise<void>;
}

const margin = 24;
/** Space between the selection and the circle. */
const gapToSelection = 4;
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
function clamp(
  spot: { x: number; y: number },
  size: { width: number; height: number },
  area: Area,
) {
  return {
    x: Math.round(Math.min(Math.max(spot.x, area.x), area.x + area.width - size.width)),
    y: Math.round(Math.min(Math.max(spot.y, area.y), area.y + area.height - size.height)),
  };
}
/** The circle's window, centred over the end of the selection just above its first
 * line (below it at the top edge of the screen), or beside the pointer. */
export function dotSpot(
  anchor: PanelAnchor,
  size: { width: number; height: number },
  area: Area,
): { x: number; y: number } {
  const bounds = anchor.bounds;
  if (!bounds)
    return clamp({ x: anchor.pointer.x + 8, y: anchor.pointer.y - size.height - 8 }, size, area);
  const x = bounds.x + bounds.width - size.width / 2;
  let y = bounds.y - gapToSelection - size.height;
  if (y < area.y) y = bounds.y + bounds.height + gapToSelection;
  return clamp({ x, y }, size, area);
}
/** A larger window growing out of a smaller one at `from`: same top-left corner,
 * shifted left only as far as the screen's right edge requires. */
export function growFrom(
  from: { x: number; y: number },
  size: { width: number; height: number },
  area: Area,
): { x: number; y: number } {
  return clamp(from, size, area);
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
  fit: (width, height) =>
    isTauri()
      ? getCurrentWindow().setSize(new LogicalSize(Math.ceil(width), Math.ceil(height)))
      : Promise.resolve(),
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
  async placeTopRight() {
    if (!isTauri()) return;
    const panel = getCurrentWindow();
    const monitor = await primaryMonitor();
    if (!monitor) return;
    const size = await panel.outerSize();
    const area = monitor.workArea ?? monitor;
    const gap = Math.round(margin * monitor.scaleFactor);
    await panel.setPosition(
      new PhysicalPosition(
        area.position.x + area.size.width - size.width - gap,
        area.position.y + gap,
      ),
    );
  },
  async placeDot(anchor, size) {
    if (!isTauri()) return null;
    const monitor = await monitorAt(anchor.bounds ?? anchor.pointer);
    if (!monitor) return null;
    const scale = monitor.scaleFactor;
    const physical = monitor.workArea ?? monitor;
    const area = {
      x: physical.position.x / scale,
      y: physical.position.y / scale,
      width: physical.size.width / scale,
      height: physical.size.height / scale,
    };
    const spot = dotSpot(anchor, size, area);
    await getCurrentWindow().setPosition(
      new PhysicalPosition(Math.round(spot.x * scale), Math.round(spot.y * scale)),
    );
    return { ...spot, area, scale };
  },
  async placeFrom(from, size) {
    if (!isTauri()) return;
    const spot = growFrom(from, size, from.area);
    await getCurrentWindow().setPosition(
      new PhysicalPosition(Math.round(spot.x * from.scale), Math.round(spot.y * from.scale)),
    );
  },
  async pointerInPage() {
    if (!isTauri()) return null;
    const panel = getCurrentWindow();
    const [pointer, position, size] = await Promise.all([
      cursorPosition(),
      panel.innerPosition(),
      panel.innerSize(),
    ]);
    const x = pointer.x - position.x;
    const y = pointer.y - position.y;
    if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
    const ratio = window.devicePixelRatio || 1;
    return { x: x / ratio, y: y / ratio };
  },
  async pointerInside() {
    if (!isTauri()) return false;
    const panel = getCurrentWindow();
    const [pointer, position, size] = await Promise.all([
      cursorPosition(),
      panel.outerPosition(),
      panel.outerSize(),
    ]);
    return (
      pointer.x >= position.x &&
      pointer.y >= position.y &&
      pointer.x < position.x + size.width &&
      pointer.y < position.y + size.height
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
