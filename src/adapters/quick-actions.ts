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

/** Panel or tray → shell: a button in the panel, its close control, or the tray's quit. */
export type QuickCommand = "mask" | "restore" | "unpin" | "quit";
export interface QuickStatus {
  message: string;
  tone: "ok" | "error" | "busy";
}
/** Shell → panel: a result to show, and whether the panel stays after showing it. */
export interface PanelStatus extends QuickStatus {
  pinned: boolean;
}
export const events = {
  command: "quick-command",
  status: "quick-status",
  pin: "quick-pin",
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
};
