import { computed, ref, watch, type Ref } from "vue";
import {
  panelKey,
  trayLabel,
  type InputPermission,
  type QuickActionsAdapter,
  type QuickCommand,
  type QuickStatus,
} from "../adapters/quick-actions.ts";
import {
  quickDirection,
  quickMessages,
  restoreFromTables,
  sessionFindings,
} from "../core/quick-actions.ts";
import type { Finding } from "../core/review.ts";
import { isPrivate, sessionOutput, type Session, type TextSession } from "../core/sessions.ts";

export const shortcutKey = "offlinemask.quick-shortcut.v1";
export const shortcutError =
  "Chưa đăng ký được phím tắt. Có thể một ứng dụng khác đang dùng tổ hợp này.";
export const lockedMessage = "Mở khóa OfflineMask trước khi dùng thao tác nhanh.";
export const workingMessage = "Đang ẩn thông tin…";
/** Flashed in the panel when the main window is closed (decision 0092). */
export const backgroundMessage = `OfflineMask vẫn chạy nền: phím tắt và bảng nổi vẫn dùng được. Mở lại hoặc thoát hẳn từ biểu tượng OfflineMask ở ${trayLabel}.`;
export const launchError = "Chưa đổi được cài đặt khởi động cùng máy. Vui lòng thử lại.";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function defaultStorage(): PreferenceStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export interface QuickActionsDependencies {
  adapter: QuickActionsAdapter;
  run: {
    maskText(
      text: string,
    ): Promise<
      { session: TextSession } | { error: "busy" | "invalid" | "failed"; message: string }
    >;
  };
  sessions: Ref<readonly Session[]>;
  /** While the lock screen is up, nothing may be masked or restored. */
  locked: () => boolean;
  /** Pending work to finish before the process ends (the shell's debounced vault save). */
  flush?: () => Promise<void>;
  storage?: PreferenceStorage | null;
}

/** Clipboard quick actions (decision 0090): one global shortcut that masks ordinary
 * text and restores an AI reply, and a floating panel with the same two actions.
 * The clipboard is read only when the user asks; nothing watches it.
 */
export function useQuickActions({
  adapter,
  run,
  sessions,
  locked,
  flush,
  storage = defaultStorage(),
}: QuickActionsDependencies) {
  // Two preferences, no content: on/off for the shortcut and the panel.
  const read = (key: string, fallback: boolean) => {
    try {
      const value = storage?.getItem(key);
      return value === null || value === undefined ? fallback : value === "on";
    } catch {
      return fallback;
    }
  };
  const write = (key: string, value: boolean) => {
    try {
      storage?.setItem(key, value ? "on" : "off");
    } catch {
      // Unwritable storage: the choice holds until the app closes.
    }
  };
  const shortcutOn = ref(adapter.desktop && read(shortcutKey, true));
  const pinned = ref(adapter.desktop && read(panelKey, false));
  const shortcutFailure = ref("");
  const lastStatus = ref<QuickStatus | null>(null);
  const busy = ref(false);
  /** The login item (decision 0092); read from the OS, never assumed. */
  const launchAtLogin = ref(false);
  const launchFailure = ref("");
  async function readLaunchAtLogin() {
    if (!adapter.desktop) return;
    try {
      launchAtLogin.value = await adapter.launchAtLogin();
    } catch {
      launchAtLogin.value = false;
    }
  }
  async function setLaunchAtLogin(on: boolean) {
    launchFailure.value = "";
    try {
      await adapter.setLaunchAtLogin(on);
      launchAtLogin.value = on;
    } catch {
      launchFailure.value = launchError;
      await readLaunchAtLogin();
    }
  }
  /** Closing the window keeps the shortcut and panel alive; the panel says so. */
  async function closeToBackground() {
    await adapter
      .sendStatus({ message: backgroundMessage, tone: "ok", pinned: pinned.value })
      .catch(() => {});
    await adapter.hideMainWindow().catch(() => {});
  }
  /** Whether ⌘⇧M may replace the selection in place (decision 0091); "unknown" until checked. */
  const inputPermission = ref<InputPermission | "unknown">("unknown");
  let hinted = false;
  async function checkInputPermission(prompt = false) {
    if (!adapter.desktop) return;
    try {
      inputPermission.value = await adapter.inputPermission(prompt);
    } catch {
      inputPermission.value = "unsupported";
    }
  }

  // Alias tables of every private session seen in this launch, RAM only. A session
  // replaced on the one-screen flow without a passcode (decision 0072) stays
  // restorable until the app closes; an explicitly deleted one is forgotten.
  const tables = new Map<string, readonly Finding[]>();
  watch(
    sessions,
    (list) => {
      for (const session of list)
        if (isPrivate(session)) tables.set(session.id, sessionFindings(session));
    },
    { deep: true, immediate: true },
  );
  const knownTables = () => [...tables.values()];
  function forget(id: string) {
    tables.delete(id);
  }

  async function show(status: QuickStatus) {
    lastStatus.value = status;
    if (adapter.desktop)
      await adapter.sendStatus({ ...status, pinned: pinned.value }).catch(() => {});
  }
  /** The shortcut first tries to take the front application's selection. A marker
   * goes on the clipboard before the copy chord, so a selection that equals the old
   * clipboard still counts and no answer to the chord is told apart from one; with
   * nothing selected the user's clipboard is put back. Without permission the
   * clipboard's own text is used as before. */
  async function takeSelection(before: string): Promise<{ text: string; replaced: boolean }> {
    if (inputPermission.value === "unknown") await checkInputPermission();
    if (inputPermission.value !== "granted") return { text: before, replaced: false };
    // An empty clipboard (or an image) needs no marker: any text after the chord is new.
    const marker = before ? `\u2063OfflineMask ${Date.now().toString(36)}\u2063` : "";
    try {
      if (marker) await adapter.writeClipboard(marker);
      await adapter.copySelection();
      const text = await adapter.readClipboard();
      if (text !== marker && text.trim()) return { text, replaced: true };
    } catch {
      // Keys could not be sent this time: the clipboard flow still works.
    }
    if (marker) await adapter.writeClipboard(before).catch(() => {});
    return { text: before, replaced: false };
  }
  /** Run one action. `auto` (the shortcut) decides from the text: known aliases
   * restore, anything else is masked; the panel's buttons act on the clipboard only. */
  async function act(command: "auto" | "mask" | "restore"): Promise<QuickStatus> {
    let replaced = false;
    let before = "";
    const done = async (message: string, tone: QuickStatus["tone"] = "ok") => {
      // Only the first clipboard-only result after a refusal carries the hint.
      if (command === "auto" && !replaced && inputPermission.value === "denied" && !hinted) {
        hinted = true;
        message += ` ${quickMessages.permissionHint}`;
      }
      const status = { message, tone };
      await show(status);
      return status;
    };
    /** Nothing changed: a taken selection hands the user their clipboard back. */
    const undone = async (message: string) => {
      if (replaced) await adapter.writeClipboard(before).catch(() => {});
      return done(message, "error");
    };
    if (locked()) return done(lockedMessage, "error");
    if (busy.value) return done(quickMessages.busy, "error");
    busy.value = true;
    try {
      try {
        before = await adapter.readClipboard();
      } catch {
        return await done(quickMessages.clipboard, "error");
      }
      let text = before;
      if (command === "auto") ({ text, replaced } = await takeSelection(before));
      const direction = quickDirection(text, knownTables());
      if (direction === "empty") return await undone(quickMessages.empty);
      if (command === "restore" || (command === "auto" && direction !== "mask")) {
        if (direction !== "restore")
          return await undone(
            direction === "unknown" ? quickMessages.unknown : quickMessages.noAliases,
          );
        const result = restoreFromTables(text, knownTables());
        try {
          await adapter.writeClipboard(result.text);
        } catch {
          return await done(quickMessages.clipboard, "error");
        }
        if (replaced) await adapter.pasteResult().catch(() => {});
        return await done(quickMessages.restored(result.restored, result.unknown.length, replaced));
      }
      await show({ message: workingMessage, tone: "busy" });
      const outcome = await run.maskText(text);
      if ("error" in outcome)
        return await undone(outcome.error === "busy" ? quickMessages.busy : outcome.message);
      const session = outcome.session;
      if (!session.analysis.findings.length) return await undone(quickMessages.nothing);
      try {
        await adapter.writeClipboard(sessionOutput(session));
      } catch {
        return await done(quickMessages.clipboard, "error");
      }
      // The result is pasted before the panel flashes, so the paste cannot land there.
      if (replaced) await adapter.pasteResult().catch(() => {});
      return await done(quickMessages.masked(session.analysis.findings.length, replaced));
    } catch {
      // Whatever broke, the panel must not stay on "Đang ẩn thông tin…".
      return await undone(quickMessages.failed);
    } finally {
      busy.value = false;
    }
  }

  async function applyShortcut(on: boolean) {
    shortcutFailure.value = "";
    if (!adapter.desktop) return;
    try {
      if (on) await adapter.registerShortcut(() => void act("auto"));
      else await adapter.unregisterShortcut();
    } catch {
      if (on) {
        shortcutOn.value = false;
        shortcutFailure.value = shortcutError;
      }
    }
  }
  async function setShortcut(on: boolean) {
    shortcutOn.value = on;
    write(shortcutKey, on);
    await applyShortcut(on);
  }
  async function setPinned(on: boolean) {
    pinned.value = on;
    write(panelKey, on);
    if (adapter.desktop) await adapter.setPinned(on).catch(() => {});
  }
  /** The tray's quit: finish pending saves, then let the native side exit. */
  async function quit() {
    try {
      await flush?.();
    } finally {
      await adapter.quit().catch(() => {});
    }
  }
  function onCommand(command: QuickCommand) {
    if (command === "unpin") void setPinned(false);
    else if (command === "quit") void quit();
    else void act(command);
  }

  let stopCommands: (() => void) | undefined;
  let stopClose: (() => void) | undefined;
  // Permission is granted in the OS settings while this window is in the background,
  // so it is re-read whenever the window comes back.
  const recheck = () => void checkInputPermission();
  async function start() {
    if (!adapter.desktop) return;
    stopCommands = await adapter.onCommand(onCommand).catch(() => undefined);
    stopClose = await adapter
      .onCloseRequested(() => void closeToBackground())
      .catch(() => undefined);
    if (shortcutOn.value) await applyShortcut(true);
    if (typeof window !== "undefined") window.addEventListener("focus", recheck);
    await Promise.all([checkInputPermission(), readLaunchAtLogin()]);
  }
  function stop() {
    stopCommands?.();
    stopCommands = undefined;
    stopClose?.();
    stopClose = undefined;
    if (typeof window !== "undefined") window.removeEventListener("focus", recheck);
    if (shortcutOn.value) void applyShortcut(false);
  }

  return {
    desktop: adapter.desktop,
    shortcutOn: computed(() => shortcutOn.value),
    pinned: computed(() => pinned.value),
    shortcutFailure,
    lastStatus,
    busy,
    inputPermission: computed(() => inputPermission.value),
    checkInputPermission,
    launchAtLogin: computed(() => launchAtLogin.value),
    launchFailure,
    setLaunchAtLogin,
    act,
    setShortcut,
    setPinned,
    forget,
    start,
    stop,
  };
}
