import { computed, ref, watch, type Ref } from "vue";
import {
  panelKey,
  trayLabel,
  type InputPermission,
  type QuickActionsAdapter,
  type QuickCommand,
  type QuickStatus,
  type SelectionMade,
  type ServiceRequest,
} from "../adapters/quick-actions.ts";
import {
  aliasMarks,
  quickDirection,
  quickMessages,
  restoreFromTables,
  sessionFindings,
} from "../core/quick-actions.ts";
import { aliasTokens } from "../core/restore.ts";
import type { Finding } from "../core/review.ts";
import { isPrivate, sessionOutput, type Session, type TextSession } from "../core/sessions.ts";

export const shortcutKey = "offlinemask.quick-shortcut.v1";
export const watchKey = "offlinemask.quick-watch.v1";
export const popoverKey = "offlinemask.quick-popover.v1";
/** Read-only text gets a masking circle only if the built-in rules find something to
 * hide within this time; otherwise selecting a sentence on a web page shows nothing. */
const readOnlyProbeMs = 1500;
export const popoverError = "Chưa bật được nút nổi khi bôi đen trên hệ này.";
export const popoverPermission =
  "Nút nổi khi bôi đen cần quyền Trợ năng (nút Cấp quyền ở trên) để đọc phần bạn chọn.";
export const watchError = "Chưa bật được theo dõi clipboard trên hệ này.";
export const serviceFileError = "Chưa đọc được tệp từ Finder. Hãy kéo tệp vào OfflineMask.";
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
    /** Built-in rules only; how many values they find (the clipboard watch). */
    probe(text: string): Promise<{ count: number; kinds: string[] }>;
  };
  /** Opens a file a Service handed over on its page; returns an error message or "". */
  openFile?: (file: File) => Promise<string>;
  /** Opens a session on its page in the main window (the restore preview's second action). */
  openSession?: (id: string) => void;
  /** Opens Cài đặt in the main window (the unknown-codes card's way to the passcode). */
  openSettings?: () => void;
  /** Whether history is kept (a passcode is set), for the unknown-codes explanation. */
  historyKept?: () => boolean;
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
  openFile,
  openSession,
  openSettings,
  historyKept,
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
  // The clipboard watch is opt-in (decision 0095): off until the user turns it on.
  const watchOn = ref(adapter.desktop && read(watchKey, false));
  const watchSupported = ref(false);
  const watchFailure = ref("");
  // The selection popover (decision 0096): opt-in; the last selection waits for a button.
  const popoverOn = ref(adapter.desktop && read(popoverKey, false));
  const popoverSupported = ref(false);
  const popoverFailure = ref("");
  let pendingSelection: {
    text: string;
    editable: boolean;
    action: "mask" | "restore" | "unknown";
  } | null = null;
  /** Why the last selection got no circle; shown in Settings to explain "nothing happened". */
  const lastSkip = ref("");
  /** The restore preview on screen: its text for "Sao chép", its session for "Mở". */
  let preview: { text: string; sessionId: string | null } | null = null;
  /** The last text this app put on the clipboard: its own output is never offered back. */
  let lastWritten = "";
  async function writeClipboard(text: string) {
    lastWritten = text;
    await adapter.writeClipboard(text);
  }
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
  // The grant is given in System Settings while this window sits behind it, and a
  // window-focus event is not guaranteed on the way back, so while it is missing the
  // state is re-read every two seconds; the poll stops as soon as it is granted.
  let permissionPoll: ReturnType<typeof setInterval> | undefined;
  async function checkInputPermission(prompt = false) {
    if (!adapter.desktop) return;
    try {
      inputPermission.value = await adapter.inputPermission(prompt);
    } catch {
      inputPermission.value = "unsupported";
    }
    if (inputPermission.value === "denied") {
      if (!permissionPoll) {
        permissionPoll = setInterval(() => void checkInputPermission(), 2000);
        // Under Node (the tests) a live interval would keep the process alive.
        const timer: unknown = permissionPoll;
        if (typeof timer === "object" && timer && "unref" in timer)
          (timer as { unref(): void }).unref();
      }
    } else if (permissionPoll) {
      clearInterval(permissionPoll);
      permissionPoll = undefined;
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
  const tables_entries = () => tables.entries();
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
      if (marker) await writeClipboard(marker);
      await adapter.copySelection();
      const text = await adapter.readClipboard();
      if (text !== marker && text.trim()) return { text, replaced: true };
    } catch {
      // Keys could not be sent this time: the clipboard flow still works.
    }
    if (marker) await writeClipboard(before).catch(() => {});
    return { text: before, replaced: false };
  }
  /** Run one action. `auto` (the shortcut) decides from the text: known aliases
   * restore, anything else is masked; the panel's buttons act on the clipboard only.
   * `given` is text handed over by a Service: it is used as is and the result goes
   * to the clipboard. */
  async function act(
    command: "auto" | "mask" | "restore",
    given?: string,
    options: { replace?: boolean; inPlace?: boolean } = {},
  ): Promise<QuickStatus> {
    const tag = options.inPlace ? { inPlace: true } : {};
    // A popover action works on text still selected in the front application: the
    // result is pasted over it, like the shortcut's in-place path.
    let replaced = options.replace === true;
    let before = "";
    const done = async (message: string, tone: QuickStatus["tone"] = "ok") => {
      // Only the first clipboard-only result after a refusal carries the hint.
      if (command === "auto" && !replaced && inputPermission.value === "denied" && !hinted) {
        hinted = true;
        message += ` ${quickMessages.permissionHint}`;
      }
      const status = { message, tone, ...tag };
      await show(status);
      return status;
    };
    /** Nothing changed: a taken selection hands the user their clipboard back. */
    const undone = async (message: string) => {
      if (replaced) await writeClipboard(before).catch(() => {});
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
      let text = given ?? before;
      if (command === "auto" && given === undefined)
        ({ text, replaced } = await takeSelection(before));
      const direction = quickDirection(text, knownTables());
      if (direction === "empty") return await undone(quickMessages.empty);
      if (command === "restore" || (command === "auto" && direction !== "mask")) {
        if (direction !== "restore")
          return await undone(
            direction === "unknown" ? quickMessages.unknown : quickMessages.noAliases,
          );
        const result = restoreFromTables(text, knownTables());
        try {
          await writeClipboard(result.text);
        } catch {
          return await done(quickMessages.clipboard, "error");
        }
        if (replaced) await adapter.pasteResult().catch(() => {});
        return await done(quickMessages.restored(result.restored, result.unknown.length, replaced));
      }
      await show({ message: workingMessage, tone: "busy", ...tag });
      const outcome = await run.maskText(text);
      if ("error" in outcome)
        return await undone(outcome.error === "busy" ? quickMessages.busy : outcome.message);
      const session = outcome.session;
      if (!session.analysis.findings.length) return await undone(quickMessages.nothing);
      try {
        await writeClipboard(sessionOutput(session));
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

  /** One shortcut per window, whichever instance registered it last. A hot reload in
   * development creates a new instance before the old one stops; the old one must not
   * then unregister the shortcut the new one just took. */
  const owner = Symbol("quick-actions");
  const registry = globalThis as { __offlinemaskShortcutOwner?: symbol };
  async function applyShortcut(on: boolean) {
    shortcutFailure.value = "";
    if (!adapter.desktop) return;
    try {
      if (on) {
        registry.__offlinemaskShortcutOwner = owner;
        await adapter.registerShortcut(() => void shortcut());
      } else if (registry.__offlinemaskShortcutOwner === owner) {
        registry.__offlinemaskShortcutOwner = undefined;
        await adapter.unregisterShortcut();
      }
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
  /** The popover: a fresh selection in another application. Its direction decides the
   * question; alias text from no known session and locked or busy states show nothing. */
  /** The popover never shows at random. In a field the user types in, the circle masks
   * (or restores, when the text holds known aliases) and replaces the text. In read-only
   * text it only shows for known aliases, and its click opens a restore preview. Anything
   * else (plain read-only text, aliases of no known session) shows nothing. */
  async function selectionMade(selection: SelectionMade) {
    if (!popoverOn.value) return;
    if (locked()) return void (lastSkip.value = quickMessages.skipped.locked);
    if (busy.value) return void (lastSkip.value = quickMessages.skipped.busy);
    const direction = quickDirection(selection.text, knownTables());
    if (direction === "empty") return void (lastSkip.value = quickMessages.skipped.empty);
    if (!selection.editable && direction === "mask") {
      // Plain read-only text: only worth a circle when the rules find something.
      let wait: ReturnType<typeof setTimeout> | undefined;
      const probed = await Promise.race([
        run.probe(selection.text),
        new Promise<null>((resolve) => (wait = setTimeout(() => resolve(null), readOnlyProbeMs))),
      ]);
      clearTimeout(wait);
      if (!probed) return void (lastSkip.value = quickMessages.skipped.slow);
      if (!probed.count) return void (lastSkip.value = quickMessages.skipped.plain);
    }
    lastSkip.value = "";
    // Codes of a session this launch does not know still get a (muted) circle: the text
    // is clearly OfflineMask's, and silence looked like a bug.
    const action = direction;
    pendingSelection = { text: selection.text, editable: selection.editable, action };
    await show({
      message: action === "mask" ? quickMessages.selectMask : quickMessages.selectRestore,
      tone: "select",
      action,
      hint:
        action === "mask"
          ? quickMessages.hintMask
          : action === "restore"
            ? quickMessages.hintRestore
            : quickMessages.hintUnknown,
      // Editable fields report the selection's own rectangle; read-only text (a chat
      // bubble, a page) often reports the whole block, so the cursor is the better spot.
      anchor: {
        bounds: selection.editable ? (selection.bounds ?? undefined) : undefined,
        pointer: selection.pointer,
      },
    });
  }
  /** Read-only AI text: show what it says with the real values, without touching the
   * page or the clipboard; the preview's buttons copy it or open its session. */
  async function showPreview(text: string) {
    const tables = [...tables_entries()];
    const result = restoreFromTables(
      text,
      tables.map(([, findings]) => findings),
    );
    const firstAlias = aliasTokens(text).find((token) =>
      tables.some(([, findings]) => findings.some((finding) => finding.alias === token)),
    );
    const sessionId =
      tables.find(([, findings]) =>
        findings.some((finding) => finding.alias === firstAlias),
      )?.[0] ?? null;
    preview = { text: result.text, sessionId };
    const canOpen = !!sessionId && !!openSession && sessions.value.some((s) => s.id === sessionId);
    await show({
      message: quickMessages.previewTitle,
      tone: "preview",
      preview: { text: result.text, marks: result.marks, canOpen },
    });
  }
  /** Read-only text with something to hide: mask it into a new session and show the
   * masked copy in the preview, ready to copy into the AI tool. */
  async function showMaskedPreview(text: string) {
    if (busy.value) return show({ message: quickMessages.busy, tone: "error" });
    busy.value = true;
    try {
      // The circle spins where it stands; the preview then opens beside it.
      await show({ message: workingMessage, tone: "busy", inPlace: true });
      const outcome = await run.maskText(text);
      if ("error" in outcome)
        return await show({
          message: outcome.error === "busy" ? quickMessages.busy : outcome.message,
          tone: "error",
        });
      const session = outcome.session;
      if (!session.analysis.findings.length)
        return await show({ message: quickMessages.nothing, tone: "error" });
      const masked = sessionOutput(session);
      preview = { text: masked, sessionId: session.id };
      await show({
        message: quickMessages.maskedTitle,
        tone: "preview",
        preview: {
          text: masked,
          marks: aliasMarks(masked, session.analysis.findings),
          canOpen: !!openSession,
        },
      });
    } catch {
      await show({ message: quickMessages.failed, tone: "error" });
    } finally {
      busy.value = false;
    }
  }
  async function previewAction(command: "copy" | "open" | "close") {
    const current = preview;
    if (command === "close" || !current) {
      preview = null;
      if (adapter.desktop) await adapter.dismissPanel().catch(() => {});
      return;
    }
    if (command === "copy") {
      try {
        await writeClipboard(current.text);
      } catch {
        await show({ message: quickMessages.clipboard, tone: "error" });
        return;
      }
      preview = null;
      // Confirmed on the preview's own copy icon, not with a card in the corner.
      await show({ message: quickMessages.previewCopied, tone: "ok", copied: true });
      return;
    }
    if (current.sessionId && openSession) {
      openSession(current.sessionId);
      await adapter.showMainWindow().catch(() => {});
    }
    preview = null;
    if (adapter.desktop) await adapter.dismissPanel().catch(() => {});
  }
  async function selectionCleared() {
    if (pendingSelection === null) return;
    pendingSelection = null;
    if (adapter.desktop) await adapter.dismissPanel().catch(() => {});
  }
  /** The first read-only check after launch must not wait for the detector to start:
   * one throwaway check (synthetic text) wakes it when the popover is turned on. */
  function warmUp() {
    void run.probe("a@example.com").catch(() => {});
  }
  async function setPopover(on: boolean) {
    popoverFailure.value = "";
    try {
      await adapter.setSelectionWatch(on);
      popoverOn.value = on;
      write(popoverKey, on);
      if (on) warmUp();
      if (on && inputPermission.value === "denied") popoverFailure.value = popoverPermission;
    } catch {
      popoverOn.value = false;
      write(popoverKey, false);
      if (on) popoverFailure.value = popoverError;
    }
    if (!on) pendingSelection = null;
  }
  /** The clipboard watch noticed a change: read once, check with the built-in rules,
   * and nudge. Our own output, alias text, empty and locked cases are left alone. */
  async function clipboardChanged() {
    if (!watchOn.value || busy.value || locked()) return;
    let text: string;
    try {
      text = await adapter.readClipboard();
    } catch {
      return;
    }
    if (!text.trim() || text === lastWritten || aliasTokens(text).length) return;
    const { count: found } = await run.probe(text);
    if (found > 0 && watchOn.value)
      await show({ message: quickMessages.offer(found), tone: "offer" });
  }
  async function setClipboardWatch(on: boolean) {
    watchFailure.value = "";
    try {
      await adapter.setClipboardWatch(on);
      watchOn.value = on;
      write(watchKey, on);
    } catch {
      watchOn.value = false;
      write(watchKey, false);
      if (on) watchFailure.value = watchError;
    }
  }
  /** A macOS Service: text is masked or restored to the clipboard; the first file
   * opens on its page in the main window. */
  async function service(request: ServiceRequest) {
    if (request.kind === "text") {
      await act("auto", request.text);
      return;
    }
    const [path, ...rest] = request.paths;
    if (!path || !openFile) return;
    const name = path.split(/[\\/]/).pop() || path;
    try {
      const bytes = await adapter.readServiceFile(path);
      const error = await openFile(new File([bytes], name));
      if (error) await show({ message: error, tone: "error" });
      else if (rest.length) await show({ message: quickMessages.oneFile(name), tone: "ok" });
    } catch {
      await show({ message: serviceFileError, tone: "error" });
    }
  }
  /** The tray's quit: finish pending saves, then let the native side exit. */
  async function quit() {
    try {
      await flush?.();
    } finally {
      await adapter.quit().catch(() => {});
    }
  }
  /** The exact selection of the front application, read with the copy chord at the
   * moment the circle is clicked; the user's clipboard is put back afterwards. The
   * Accessibility text only decides whether the circle shows: some applications
   * (Chromium editors) report it repeated or partial, and pasting a result built from
   * it over the selection duplicated the user's text. */
  async function exactSelection(): Promise<string | null> {
    if (inputPermission.value !== "granted") return null;
    let before = "";
    try {
      before = await adapter.readClipboard();
    } catch {
      // An unreadable clipboard is restored as empty.
    }
    const marker = `\u2063OfflineMask ${Date.now().toString(36)}\u2063`;
    try {
      await writeClipboard(marker);
      await adapter.copySelection();
      const text = await adapter.readClipboard();
      return text !== marker && text.trim() ? text : null;
    } catch {
      return null;
    } finally {
      await writeClipboard(before).catch(() => {});
    }
  }
  async function actOnSelection(
    command: "mask" | "restore",
    selection: { text: string; editable: boolean },
  ) {
    const exact = await exactSelection();
    if (!selection.editable) {
      const text = exact ?? selection.text;
      if (command === "restore") await showPreview(text);
      else await showMaskedPreview(text);
      return;
    }
    // Replace in place only with the exact selection; without it the result goes to
    // the clipboard and the user pastes it.
    if (exact) await act(command, exact, { replace: true, inPlace: true });
    else await act(command, selection.text);
  }
  /** ⌘⇧M does exactly what a click on the circle does, no more and no less: the
   * selection is read with its place and whether it can be typed in, the circle appears
   * there and its action runs at once (in place for editable text, the preview for
   * read-only text, the card for unknown codes). Without a readable selection, or while
   * the app is locked or busy, nothing happens, as no circle would show. */
  async function shortcut() {
    if (locked() || busy.value) return;
    const selection = await adapter.readSelection().catch(() => null);
    const direction = selection ? quickDirection(selection.text, knownTables()) : "empty";
    if (!selection || direction === "empty") return;
    pendingSelection = null;
    const action = direction;
    await show({
      message: action === "mask" ? quickMessages.selectMask : quickMessages.selectRestore,
      tone: "select",
      action,
      anchor: {
        bounds: selection.editable ? (selection.bounds ?? undefined) : undefined,
        pointer: selection.pointer,
      },
    });
    if (action === "unknown") await explainUnknown();
    else await actOnSelection(action, { text: selection.text, editable: selection.editable });
  }
  /** The muted circle's card: why these codes cannot be restored, and the way out. */
  async function explainUnknown() {
    const kept = historyKept?.() ?? false;
    await show({
      message: quickMessages.unknownTitle,
      tone: "notice",
      notice: {
        body: kept ? quickMessages.unknownBodySaved : quickMessages.unknownBody,
        settings: !kept && !!openSettings,
      },
    });
  }
  async function goToSettings() {
    openSettings?.();
    await adapter.showMainWindow().catch(() => {});
    if (adapter.desktop) await adapter.dismissPanel().catch(() => {});
  }
  function onCommand(command: QuickCommand) {
    if (command === "unpin") void setPinned(false);
    else if (command === "quit") void quit();
    else if (command === "settings") void goToSettings();
    else if (command === "copy" || command === "open" || command === "close")
      void previewAction(command);
    else if (pendingSelection !== null) {
      const selection = pendingSelection;
      pendingSelection = null;
      if (selection.action === "unknown" || command === "unknown") void explainUnknown();
      else void actOnSelection(command as "mask" | "restore", selection);
    } else if (command !== "unknown") void act(command);
  }

  let stopCommands: (() => void) | undefined;
  let stopClose: (() => void) | undefined;
  let stopService: (() => void) | undefined;
  let stopWatch: (() => void) | undefined;
  let stopSelection: (() => void) | undefined;
  let stopCleared: (() => void) | undefined;
  // Permission is granted in the OS settings while this window is in the background,
  // so it is re-read whenever the window comes back.
  const recheck = () => void checkInputPermission();
  async function start() {
    if (!adapter.desktop) return;
    stopCommands = await adapter.onCommand(onCommand).catch(() => undefined);
    stopClose = await adapter
      .onCloseRequested(() => void closeToBackground())
      .catch(() => undefined);
    stopService = await adapter
      .onService((request) => void service(request))
      .catch(() => undefined);
    stopWatch = await adapter
      .onClipboardChanged(() => void clipboardChanged())
      .catch(() => undefined);
    stopSelection = await adapter
      .onSelection((selection) => void selectionMade(selection))
      .catch(() => undefined);
    stopCleared = await adapter
      .onSelectionCleared(() => void selectionCleared())
      .catch(() => undefined);
    // stop() ran while the listeners were still being registered (a hot reload in
    // development): drop them instead of leaving a second, invisible instance acting.
    if (stopped) {
      stopAll();
      return;
    }
    if (shortcutOn.value) await applyShortcut(true);
    if (typeof window !== "undefined") window.addEventListener("focus", recheck);
    await Promise.all([checkInputPermission(), readLaunchAtLogin()]);
    watchSupported.value = await adapter.watchSupported().catch(() => false);
    if (watchOn.value) await setClipboardWatch(watchSupported.value);
    popoverSupported.value = await adapter.selectionSupported().catch(() => false);
    if (popoverOn.value) await setPopover(popoverSupported.value);
  }
  let stopped = false;
  function stopAll() {
    stopCommands?.();
    stopCommands = undefined;
    stopClose?.();
    stopClose = undefined;
    stopService?.();
    stopService = undefined;
    stopWatch?.();
    stopWatch = undefined;
    stopSelection?.();
    stopSelection = undefined;
    stopCleared?.();
    stopCleared = undefined;
  }
  function stop() {
    stopped = true;
    stopCommands?.();
    stopCommands = undefined;
    stopClose?.();
    stopClose = undefined;
    stopService?.();
    stopService = undefined;
    stopWatch?.();
    stopWatch = undefined;
    stopSelection?.();
    stopSelection = undefined;
    stopCleared?.();
    stopCleared = undefined;
    if (typeof window !== "undefined") window.removeEventListener("focus", recheck);
    if (permissionPoll) clearInterval(permissionPoll);
    permissionPoll = undefined;
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
    watchOn: computed(() => watchOn.value),
    watchSupported: computed(() => watchSupported.value),
    watchFailure,
    setClipboardWatch,
    popoverOn: computed(() => popoverOn.value),
    lastSkip,
    popoverSupported: computed(() => popoverSupported.value),
    popoverFailure,
    setPopover,
    act,
    shortcut,
    setShortcut,
    setPinned,
    forget,
    start,
    stop,
  };
}
