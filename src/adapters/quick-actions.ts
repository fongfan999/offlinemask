import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";

/** The one quick-action shortcut (decision 0090). Copy, press it, paste. */
export const quickShortcut = "CommandOrControl+Shift+M";
export const quickShortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "⌘⇧M"
  : "Ctrl+Shift+M";
/** Label of the floating panel window in `tauri.conf.json`. */
export const panelWindow = "pill";
export const mainWindow = "main";
/** Preferences shared by the shell and the panel window: both read plain storage. */
export const panelKey = "offlinemask.quick-panel.v1";
export const panelPositionKey = "offlinemask.quick-panel-position.v1";
/** Where the app keeps living once its window is closed (decision 0092). */
export const trayLabel = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "thanh menu"
  : "khay hệ thống";

/** Panel or tray → shell: a button in the panel, its close control, the tray's quit, or
 * the restore preview's two actions (decision 0096). */
export type QuickCommand = "mask" | "restore" | "unpin" | "quit" | "copy" | "open" | "close";
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
  /** `offer` is the clipboard watch's nudge and `select` the popover's question: both
   * stay longer than a result and wait for a button. */
  tone: "ok" | "error" | "busy" | "offer" | "select" | "preview";
  anchor?: PanelAnchor;
  /** For a selection: what the circle's click does, and so which icon it shows. */
  action?: "mask" | "restore";
  /** For a selection: what that click will do, in a few words, shown on hover. */
  hint?: string;
  /** The restore preview of read-only text: the restored text, where each restored
   * value sits in it, and whether its session can be opened in the app. */
  preview?: { text: string; marks: { start: number; end: number }[]; canOpen: boolean };
}
/** Text the user just selected in another application (decision 0096). */
export interface SelectionMade {
  text: string;
  bounds?: ScreenRect | null;
  pointer: ScreenPoint;
  /** Typed into: masking replaces it. Read-only text only ever gets a restore preview. */
  editable: boolean;
}
/** What a macOS Service handed over (decision 0094). */
export type ServiceRequest = { kind: "text"; text: string } | { kind: "files"; paths: string[] };
/** Shell → panel: a result to show, and whether the panel stays after showing it. */
export interface PanelStatus extends QuickStatus {
  pinned: boolean;
}
export const events = {
  command: "quick-command",
  status: "quick-status",
  pin: "quick-pin",
  service: "quick-service",
  clipboardChanged: "clipboard-changed",
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
  /** Send the copy chord to the front application and wait for the clipboard. */
  copySelection(): Promise<void>;
  /** Send the paste chord to the front application. */
  pasteResult(): Promise<void>;
  /** Empty string when the clipboard holds no text. */
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  registerShortcut(handler: () => void): Promise<void>;
  unregisterShortcut(): Promise<void>;
  onCommand(handler: (command: QuickCommand) => void): Promise<() => void>;
  sendStatus(status: PanelStatus): Promise<void>;
  setPinned(pinned: boolean): Promise<void>;
  /** Called instead of closing the main window; the handler decides what to do. */
  onCloseRequested(handler: () => void): Promise<() => void>;
  hideMainWindow(): Promise<void>;
  launchAtLogin(): Promise<boolean>;
  setLaunchAtLogin(on: boolean): Promise<void>;
  /** End the process; the shell flushes pending saves first (decision 0092). */
  quit(): Promise<void>;
  /** Bring the main window back, from wherever it is (decision 0096). */
  showMainWindow(): Promise<void>;
  /** Text or files from a macOS Service (decision 0094). */
  onService(handler: (request: ServiceRequest) => void): Promise<() => void>;
  /** Bytes of a file a Service handed over; any other path is refused natively. */
  readServiceFile(path: string): Promise<Uint8Array<ArrayBuffer>>;
  /** The opt-in clipboard watch (decision 0095): change notices only, no content. */
  watchSupported(): Promise<boolean>;
  setClipboardWatch(on: boolean): Promise<void>;
  onClipboardChanged(handler: () => void): Promise<() => void>;
  /** The selection popover (decision 0096): mouse-button gestures in other apps. */
  selectionSupported(): Promise<boolean>;
  setSelectionWatch(on: boolean): Promise<void>;
  onSelection(handler: (selection: SelectionMade) => void): Promise<() => void>;
  onSelectionCleared(handler: () => void): Promise<() => void>;
  /** Hide the panel unless the user keeps it. */
  dismissPanel(): Promise<void>;
}

export const nativeQuickActions: QuickActionsAdapter = {
  desktop: isTauri(),
  async inputPermission(prompt) {
    if (!isTauri()) return "unsupported";
    const state = await invoke<string>("quick_input_permission", { prompt });
    return state === "granted" || state === "denied" ? state : "unsupported";
  },
  copySelection: () => invoke("quick_copy_selection"),
  pasteResult: () => invoke("quick_paste_result"),
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
  setPinned: (pinned) => emitTo(panelWindow, events.pin, { pinned }),
  onCloseRequested: (handler) =>
    getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      handler();
    }),
  hideMainWindow: () => getCurrentWindow().hide(),
  launchAtLogin: () => isEnabled(),
  setLaunchAtLogin: (on) => (on ? enable() : disable()),
  quit: () => invoke("quick_quit"),
  showMainWindow: () => invoke("quick_show_main"),
  onService: (handler) => listen<ServiceRequest>(events.service, (event) => handler(event.payload)),
  async readServiceFile(path) {
    const bytes = await invoke<ArrayBuffer | number[]>("quick_read_service_file", { path });
    return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
  },
  watchSupported: () =>
    isTauri() ? invoke<boolean>("quick_watch_supported") : Promise.resolve(false),
  setClipboardWatch: (on) => invoke("quick_watch_clipboard", { enabled: on }),
  onClipboardChanged: (handler) => listen(events.clipboardChanged, () => handler()),
  selectionSupported: () =>
    isTauri() ? invoke<boolean>("quick_selection_supported") : Promise.resolve(false),
  setSelectionWatch: (on) => invoke("quick_selection_watch", { enabled: on }),
  onSelection: (handler) =>
    listen<SelectionMade>(events.selectionMade, (event) => handler(event.payload)),
  onSelectionCleared: (handler) => listen(events.selectionCleared, () => handler()),
  dismissPanel: () => emitTo(panelWindow, events.dismiss, {}),
};
