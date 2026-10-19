import { computed, ref, watch, type Ref } from "vue";
import {
  selectionAnchor,
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
export const popoverKey = "offlinemask.quick-popover.v1";
/** Set once the one-time Ẩn nhanh card was answered (decision 0098). */
export const introKey = "offlinemask.quick-intro.v1";
/** A selection gets a masking circle only if the click's own detection finds something
 * to hide (decision 0100). A check slower than this shows the circle anyway: a circle
 * that finds nothing is better than one that quietly never appeared. */
const probeMs = 1500;
export const popoverError = "Chưa bật được Ẩn nhanh trên máy này.";
export const popoverPermission = "Ẩn nhanh cần quyền Trợ năng. Bấm Cấp quyền ở trên.";
export const serviceFileError = "Chưa đọc được tệp từ Finder. Hãy kéo tệp vào OfflineMask.";
export const shortcutError =
  "Chưa đăng ký được phím tắt. Có thể một ứng dụng khác đang dùng tổ hợp này.";
export const lockedMessage = "Mở khóa OfflineMask trước khi dùng thao tác nhanh.";
export const workingMessage = "Đang ẩn thông tin…";
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
  // Preferences only, no content: on/off switches.
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
  async function writeClipboard(text: string) {
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
  /** Closing the window keeps the circle and shortcut alive in the menu bar, quietly. */
  async function closeToBackground() {
    await adapter.hideMainWindow().catch(() => {});
  }
  /** Whether ⌘⇧M may replace the selection in place (decision 0091); "unknown" until checked. */
  const inputPermission = ref<InputPermission | "unknown">("unknown");
  /** The one-time Ẩn nhanh card in the app (decision 0098): offered after the first
   * masked copy, then a sentence before the system's permission dialog, a wait for
   * the grant, and a short confirmation. */
  const introSeen = ref(read(introKey, false));
  const introStage = ref<"offer" | "prime" | "waiting" | "done" | null>(null);
  let enableAfterGrant = false;
  function markIntroSeen() {
    if (introSeen.value) return;
    introSeen.value = true;
    write(introKey, true);
  }
  /** Ẩn nhanh actually works: switched on and able to read selections. */
  const quickReady = computed(
    () => popoverOn.value && popoverSupported.value && inputPermission.value === "granted",
  );
  // Working by any route (Settings, the card, a grant): the card has done its job.
  watch(quickReady, (ready) => {
    if (!ready) return;
    markIntroSeen();
    if (introStage.value === "offer" || introStage.value === "prime") introStage.value = null;
  });
  function offerIntro() {
    if (!adapter.desktop || introSeen.value || introStage.value) return;
    if (quickReady.value || !popoverSupported.value) return;
    if (inputPermission.value === "unsupported") return;
    introStage.value = "offer";
  }
  function dismissIntro() {
    introStage.value = null;
    markIntroSeen();
  }
  /** The result it sat under went away (new text, another page): hide the card. An
   * unanswered offer may come back with the next copy; the later steps were answers. */
  function closeIntro() {
    if (introStage.value === "done") dismissIntro();
    else introStage.value = null;
  }
  async function startIntro() {
    markIntroSeen();
    if (inputPermission.value === "granted") {
      await setPopover(true);
      introStage.value = popoverOn.value ? "done" : null;
    } else introStage.value = "prime";
  }
  /** The system's permission prompt, asked for by the user; Ẩn nhanh turns on once
   * the grant arrives (the poll below notices it). */
  async function grantAndEnable() {
    enableAfterGrant = true;
    if (introStage.value === "prime") introStage.value = "waiting";
    await checkInputPermission(true);
  }
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
    // Granted after the user asked for Ẩn nhanh (the card or Cấp quyền): turn it on.
    if (inputPermission.value === "granted" && enableAfterGrant) {
      enableAfterGrant = false;
      if (!popoverOn.value) await setPopover(true);
      if (introStage.value === "waiting") introStage.value = popoverOn.value ? "done" : null;
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
    if (started) await syncShortcut();
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
    if (adapter.desktop) await adapter.sendStatus(status).catch(() => {});
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
  /** ⌘⇧M only reads the selection, which needs the same permission as the circle, so
   * the combination is taken from other applications only once it can do something. */
  let started = false;
  let registered = false;
  async function syncShortcut() {
    // A sub-option of the circle: on only while the circle is on and can read selections.
    const want = shortcutOn.value && popoverOn.value && inputPermission.value === "granted";
    if (want === registered) return;
    registered = want;
    await applyShortcut(want);
    if (want && !shortcutOn.value) registered = false;
  }
  async function setShortcut(on: boolean) {
    shortcutOn.value = on;
    write(shortcutKey, on);
    await syncShortcut();
  }
  /** The popover: a fresh selection in another application. Its direction decides the
   * question; alias text from no known session and locked or busy states show nothing. */
  /** The popover never shows at random. In a field the user types in, the circle masks
   * (or restores, when the text holds known aliases) and replaces the text. In read-only
   * text it only shows for known aliases, and its click opens a restore preview. Anything
   * else (plain read-only text, aliases of no known session) shows nothing. */
  /** Bumped by every selection and every clearing, so a slow check never shows a
   * circle for a selection that is gone. */
  let selectionSeq = 0;
  async function selectionMade(selection: SelectionMade) {
    if (!popoverOn.value) return;
    if (locked()) return void (lastSkip.value = quickMessages.skipped.locked);
    if (busy.value) return void (lastSkip.value = quickMessages.skipped.busy);
    const direction = quickDirection(selection.text, knownTables());
    if (direction === "empty") return void (lastSkip.value = quickMessages.skipped.empty);
    const seq = ++selectionSeq;
    if (direction === "mask") {
      // Any app, editable or not: a circle only when a click would hide something.
      let wait: ReturnType<typeof setTimeout> | undefined;
      const probed = await Promise.race([
        run.probe(selection.text),
        new Promise<null>((resolve) => (wait = setTimeout(() => resolve(null), probeMs))),
      ]);
      clearTimeout(wait);
      // A newer selection, or none any more, took over while the check ran.
      if (seq !== selectionSeq || !popoverOn.value) return;
      if (probed && !probed.count) return void (lastSkip.value = quickMessages.skipped.plain);
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
      anchor: selectionAnchor(selection),
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
    selectionSeq++;
    if (pendingSelection === null) return;
    pendingSelection = null;
    if (adapter.desktop) await adapter.dismissPanel().catch(() => {});
  }
  /** The first check after launch must not wait for the detector (and the pack's models)
   * to start: one throwaway check on synthetic text wakes it when Ẩn nhanh is turned on. */
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
    if (started) await syncShortcut();
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
      anchor: selectionAnchor(selection),
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
    if (command === "quit") void quit();
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
    started = true;
    if (typeof window !== "undefined") window.addEventListener("focus", recheck);
    await Promise.all([checkInputPermission(), readLaunchAtLogin()]);
    popoverSupported.value = await adapter.selectionSupported().catch(() => false);
    if (popoverOn.value) await setPopover(popoverSupported.value);
    // While Ẩn nhanh is off, the tray menu offers it (decision 0098).
    stopTrayOffer = watch(
      () => popoverSupported.value && !quickReady.value,
      (offer) => void adapter.setTrayOffer(offer).catch(() => {}),
      { immediate: true },
    );
  }
  let stopTrayOffer: (() => void) | undefined;
  let stopped = false;
  function stopAll() {
    stopCommands?.();
    stopCommands = undefined;
    stopClose?.();
    stopClose = undefined;
    stopService?.();
    stopService = undefined;
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
    stopSelection?.();
    stopSelection = undefined;
    stopCleared?.();
    stopCleared = undefined;
    stopTrayOffer?.();
    stopTrayOffer = undefined;
    if (typeof window !== "undefined") window.removeEventListener("focus", recheck);
    if (permissionPoll) clearInterval(permissionPoll);
    permissionPoll = undefined;
    started = false;
    if (registered) {
      registered = false;
      void applyShortcut(false);
    }
  }

  return {
    desktop: adapter.desktop,
    shortcutOn: computed(() => shortcutOn.value),
    shortcutFailure,
    lastStatus,
    busy,
    inputPermission: computed(() => inputPermission.value),
    checkInputPermission,
    launchAtLogin: computed(() => launchAtLogin.value),
    launchFailure,
    setLaunchAtLogin,
    popoverOn: computed(() => popoverOn.value),
    quickReady,
    introStage: computed(() => introStage.value),
    offerIntro,
    dismissIntro,
    closeIntro,
    startIntro,
    grantAndEnable,
    lastSkip,
    popoverSupported: computed(() => popoverSupported.value),
    popoverFailure,
    setPopover,
    act,
    shortcut,
    setShortcut,
    forget,
    start,
    stop,
  };
}
