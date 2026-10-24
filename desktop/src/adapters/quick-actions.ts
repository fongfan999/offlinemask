import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";
import type { Place } from "../core/places.ts";

/** The one quick-action shortcut (decision 0090). Copy, press it, paste. */
export const quickShortcut = "CommandOrControl+Shift+M";
export const quickShortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "⌘⇧M"
  : "Ctrl+Shift+M";
/** Label of the floating panel window in `tauri.conf.json`. */
export const panelWindow = "pill";
export const mainWindow = "main";
/** Where the app keeps living once its window is closed (decision 0092). */
export const trayLabel = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "thanh menu"
  : "khay hệ thống";

/** Panel or tray → shell: a button in the panel, its close control, the tray's quit, or
 * the restore preview's two actions (decision 0096). */
export type QuickCommand =
  | "mask"
  | "restore"
  | "unknown"
  | "quit"
  | "copy"
  | "open"
  | "close"
  | "settings"
  /** The tray's "Ẩn nhanh khi bôi đen" check item (decision 0137). */
  | "toggle-quick"
  /** The circle's "Tắt ở …": no circle by itself in this place any more (decision 0135). */
  | "forget-place"
  /** After ⌘⇧M somewhere else: "Luôn hiện nút ở …" adds that place. */
  | "keep-place";
/** Logical screen points, top-left origin (decision 0096). */
export interface ScreenPoint {
  x: number;
  y: number;
}
export interface ScreenRect extends ScreenPoint {
  width: number;
  height: number;
}
/** Where the panel should sit for a selection: above its rectangle, else at the pointer. */
export interface PanelAnchor {
  bounds?: ScreenRect;
  pointer: ScreenPoint;
}
export interface QuickStatus {
  message: string;
  /** `select` is the popover's question: it stays longer than a result and waits for a
   * click. */
  tone: "ok" | "error" | "busy" | "select" | "preview" | "notice";
  anchor?: PanelAnchor;
  /** For a selection: what the circle's click does, and so which icon it shows. */
  action?: "mask" | "restore" | "unknown";
  /** For a selection: what that click will do, in a few words, shown on hover. */
  hint?: string;
  /** Progress and result of a click on the circle that works in place: the circle itself
   * spins, then shows a check mark, instead of a card in the corner. */
  inPlace?: boolean;
  /** A preview for a result the user did not wait for beside the circle (the selection
   * moved, decision 0127): it opens in the top-right corner instead. */
  corner?: boolean;
  /** The preview's copy worked: its copy icon turns into a check mark and the card fades. */
  copied?: boolean;
  /** The restore preview of read-only text: the restored text, where each restored
   * value sits in it, and whether its session can be opened in the app. */
  preview?: { text: string; marks: { start: number; end: number }[]; canOpen: boolean };
  /** An explanation card (codes from an earlier launch): its body, and whether it offers
   * the way to the passcode setting. */
  notice?: { body: string; settings: boolean };
  /** For a circle in an AI place: its name, for "Tắt ở …" beside the hint (decision 0135). */
  place?: string;
  /** For ⌘⇧M outside the AI places: its name, for "Luôn hiện nút ở …" once it is done. */
  offerPlace?: string;
}
/** Text the user just selected in another application (decision 0096). */
export interface SelectionMade {
  text: string;
  bounds?: ScreenRect | null;
  pointer: ScreenPoint;
  /** Typed into: masking replaces it. Read-only text only ever gets a restore preview. */
  editable: boolean;
  /** `bounds` is only the frame of the field holding the text (Chromium and Electron
   * fields give no geometry for a range). */
  field?: boolean;
  /** Made with the mouse, so `pointer` is where the drag or clicks ended. */
  mouse?: boolean;
  /** The application, or the page's host in a browser (decision 0135); none where the
   * platform cannot tell, or in a browser outside any page. */
  place?: Place | null;
  /** The circle shows there by itself; only ⌘⇧M reports a selection elsewhere. */
  listed?: boolean;
}
/** Where the circle goes for a selection (decision 0101): by the text whenever its
 * place is known. Read-only text (a chat bubble, a page) often reports a whole block,
 * so the cursor is the better spot. When an editable field only reports its frame, the
 * end of a mouse selection is where the pointer came up; after the keyboard (⌘A, ⌘⇧M)
 * the text begins at the field's top-left. */
export function selectionAnchor(selection: SelectionMade): PanelAnchor {
  const { bounds, pointer } = selection;
  if (!selection.editable || !bounds) return { pointer };
  if (!selection.field) return { bounds, pointer };
  const inside =
    pointer.x >= bounds.x &&
    pointer.x <= bounds.x + bounds.width &&
    pointer.y >= bounds.y &&
    pointer.y <= bounds.y + bounds.height;
  if (selection.mouse && inside) return { pointer };
  // The first line's start: a small box just inside the field's padding.
  const line = Math.min(bounds.height, 24);
  return {
    bounds: {
      x: bounds.x + 8,
      y: bounds.y + Math.min(6, (bounds.height - line) / 2),
      width: 16,
      height: line,
    },
    pointer,
  };
}
/** What a macOS Service handed over (decision 0094). */
export type ServiceRequest = { kind: "text"; text: string } | { kind: "files"; paths: string[] };
/** Shell → panel: a result or a shape to show. */
export type PanelStatus = QuickStatus;
export const events = {
  command: "quick-command",
  status: "quick-status",
  service: "quick-service",
  dismiss: "quick-dismiss",
  selectionMade: "selection-made",
  selectionCleared: "selection-cleared",
} as const;

/** Whether the app may send the copy and paste keystrokes that replace a selection
 * in place (decision 0091): macOS needs the Accessibility permission, Windows and
 * X11 need nothing, Wayland has no way. */
export type InputPermission = "granted" | "denied" | "unsupported";

export interface QuickActionsAdapter {
  /** False in the browser preview, where no global shortcut or panel exists. */
  desktop: boolean;
  /** With `prompt`, macOS shows its permission dialog. */
  inputPermission(prompt: boolean): Promise<InputPermission>;
  /** The front application's selection, read natively without leaving anything on the
   * user's clipboard (decision 0130); null when nothing answered. With `keep`, a paste
   * follows: the clipboard is put back after it, or by `releaseClipboard` (decision 0131). */
  copySelection(keep?: boolean): Promise<string | null>;
  /** Put back a clipboard kept for a paste that is not coming; nothing when none is. */
  releaseClipboard(): Promise<void>;
  /** Put `text` over the front application's selection, natively, the user's clipboard
   * left as it was (decision 0130). */
  replaceSelection(text: string): Promise<void>;
  /** Empty string when the clipboard holds no text. */
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  registerShortcut(handler: () => void): Promise<void>;
  unregisterShortcut(): Promise<void>;
  onCommand(handler: (command: QuickCommand) => void): Promise<() => void>;
  sendStatus(status: PanelStatus): Promise<void>;
  /** Called instead of closing the main window; the handler decides what to do. */
  onCloseRequested(handler: () => void): Promise<() => void>;
  hideMainWindow(): Promise<void>;
  launchAtLogin(): Promise<boolean>;
  setLaunchAtLogin(on: boolean): Promise<void>;
  /** End the process; the shell flushes pending saves first (decision 0092). */
  quit(): Promise<void>;
  /** Bring the main window back, from wherever it is (decision 0096). */
  showMainWindow(): Promise<void>;
  /** The tray menu's "Ẩn nhanh khi bôi đen" check item: its mark, and whether it can be
   * used here (decision 0137). */
  setTrayQuick(on: boolean, available: boolean): Promise<void>;
  /** Text or files from a macOS Service (decision 0094). */
  onService(handler: (request: ServiceRequest) => void): Promise<() => void>;
  /** Bytes of a file a Service handed over; any other path is refused natively. */
  readServiceFile(path: string): Promise<Uint8Array<ArrayBuffer>>;
  /** The selection popover (decision 0096): mouse-button gestures in other apps. */
  selectionSupported(): Promise<boolean>;
  setSelectionWatch(on: boolean): Promise<void>;
  onSelection(handler: (selection: SelectionMade) => void): Promise<() => void>;
  onSelectionCleared(handler: () => void): Promise<() => void>;
  /** Hide the panel unless the user keeps it. */
  dismissPanel(): Promise<void>;
  /** The front application's current selection, read once (for ⌘⇧M), or null. */
  readSelection(): Promise<SelectionMade | null>;
  /** The AI places the circle shows in by itself (decision 0135). True where the platform
   * honours them; elsewhere the circle still shows in every application. */
  setPlaces(places: { apps: string[]; browsers: string[]; hosts: string[] }): Promise<boolean>;
}

export const nativeQuickActions: QuickActionsAdapter = {
  desktop: isTauri(),
  async inputPermission(prompt) {
    if (!isTauri()) return "unsupported";
    const state = await invoke<string>("quick_input_permission", { prompt });
    return state === "granted" || state === "denied" ? state : "unsupported";
  },
  copySelection: (keep = false) => invoke<string | null>("quick_copy_selection", { keep }),
  releaseClipboard: () => invoke("quick_release_clipboard"),
  replaceSelection: (text) => invoke("quick_replace_selection", { text }),
  async readClipboard() {
    if (!isTauri()) return navigator.clipboard.readText();
    try {
      return await readText();
    } catch {
      // The plugin rejects when the clipboard is empty or holds no text.
      return "";
    }
  },
  writeClipboard: (text) => (isTauri() ? writeText(text) : navigator.clipboard.writeText(text)),
  async registerShortcut(handler) {
    if (await isRegistered(quickShortcut)) await unregister(quickShortcut);
    await register(quickShortcut, (event) => {
      if (event.state === "Pressed") handler();
    });
  },
  async unregisterShortcut() {
    if (await isRegistered(quickShortcut)) await unregister(quickShortcut);
  },
  onCommand: (handler) =>
    listen<{ command: QuickCommand }>(events.command, (event) => handler(event.payload.command)),
  sendStatus: (status) => emitTo(panelWindow, events.status, status),
  onCloseRequested: (handler) =>
    getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      handler();
    }),
  hideMainWindow: () => invoke("quick_hide_main"),
  // Natively, so the Store build can use its startup task instead of the Run key.
  launchAtLogin: () => invoke<boolean>("quick_launch_at_login"),
  setLaunchAtLogin: (on) => invoke("quick_set_launch_at_login", { on }),
  quit: () => invoke("quick_quit"),
  showMainWindow: () => invoke("quick_show_main"),
  setTrayQuick: (on, available) => invoke("quick_tray_state", { on, available }),
  onService: (handler) => listen<ServiceRequest>(events.service, (event) => handler(event.payload)),
  async readServiceFile(path) {
    const bytes = await invoke<ArrayBuffer | number[]>("quick_read_service_file", { path });
    return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
  },
  selectionSupported: () =>
    isTauri() ? invoke<boolean>("quick_selection_supported") : Promise.resolve(false),
  setSelectionWatch: (on) => invoke("quick_selection_watch", { enabled: on }),
  onSelection: (handler) =>
    listen<SelectionMade>(events.selectionMade, (event) => handler(event.payload)),
  onSelectionCleared: (handler) => listen(events.selectionCleared, () => handler()),
  dismissPanel: () => emitTo(panelWindow, events.dismiss, {}),
  readSelection: () =>
    isTauri() ? invoke<SelectionMade | null>("quick_read_selection") : Promise.resolve(null),
  setPlaces: (places) =>
    isTauri() ? invoke<boolean>("quick_set_places", places) : Promise.resolve(false),
};
