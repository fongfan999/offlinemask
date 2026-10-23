import test from "node:test";
import assert from "node:assert/strict";
import { nextTick, ref } from "vue";
import { analyzeText } from "../src/core/text.ts";
import { createTextSession } from "../src/core/sessions.ts";
import {
  quickDirection,
  quickMessages,
  restoreFromTables,
  sessionFindings,
} from "../src/core/quick-actions.ts";
import {
  launchError,
  lockedMessage,
  popoverKey,
  introKey,
  popoverPermission,
  serviceFileError,
  shortcutError,
  shortcutKey,
  useQuickActions,
  workingMessage,
} from "../src/composables/useQuickActions.ts";
import { dotSpot, growFrom } from "../src/adapters/quick-panel.ts";

const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});
const phoneText = "Gọi 0901234567 giúp tôi.";
function phoneSession(existing = []) {
  return createTextSession(phoneText, existing, [detection(4, 14, "SDT")]);
}

test("direction: aliases of a known table restore, foreign aliases are refused, text masks", () => {
  const analysis = analyzeText("Email minh.anh@example.com", "4aae", [detection(6, 26, "EMAIL")]);
  const tables = [analysis.findings];
  assert.equal(quickDirection("", tables), "empty");
  assert.equal(quickDirection("   \n", tables), "empty");
  assert.equal(quickDirection("Xin chào", tables), "mask");
  assert.equal(quickDirection("Gửi [EMAIL_1_4aae] nhé", tables), "restore");
  assert.equal(quickDirection("Gửi [EMAIL_1_dead] nhé", tables), "unknown");
  assert.equal(quickDirection("Gửi [EMAIL_1_4aae]", []), "unknown");
});

test("restore searches every table at once and reports aliases from no table", () => {
  const a = analyzeText("A 0901234567", "4aae", [detection(2, 12, "SDT")]);
  const b = analyzeText("B minh@example.com", "beef", [detection(2, 18, "EMAIL")]);
  const result = restoreFromTables("[SDT_1_4aae] / [EMAIL_1_beef] / [SDT_1_dead]", [
    a.findings,
    b.findings,
  ]);
  assert.equal(result.text, "0901234567 / minh@example.com / [SDT_1_dead]");
  assert.equal(result.restored, 2);
  assert.deepEqual(result.unknown, ["[SDT_1_dead]"]);
});

test("sample sessions have no alias table; private ones expose theirs", () => {
  const session = phoneSession();
  assert.equal(sessionFindings(session).length, 1);
  assert.deepEqual(
    sessionFindings({
      id: "s",
      number: 1,
      format: "text",
      fixture: "sample-v1",
      createdAt: "",
      decisions: {},
    }),
    [],
  );
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
function fakeAdapter(clipboard = "") {
  const calls = [];
  let commandHandler;
  let shortcutHandler;
  const adapter = {
    desktop: true,
    calls,
    clipboard,
    fire: () => shortcutHandler?.(),
    command: (command) => commandHandler?.(command),
    readClipboard: async () => adapter.clipboard,
    writeClipboard: async (text) => {
      calls.push(["write", text]);
      adapter.clipboard = text;
    },
    registerShortcut: async (handler) => {
      calls.push(["register"]);
      shortcutHandler = handler;
    },
    unregisterShortcut: async () => calls.push(["unregister"]),
    onCommand: async (handler) => {
      commandHandler = handler;
      return () => calls.push(["unlisten"]);
    },
    sendStatus: async (status) => calls.push(["status", status.message, status.tone]),
    permission: "unsupported",
    selection: null,
    inputPermission: async (prompt) => {
      calls.push(["permission", prompt]);
      return adapter.permission;
    },
    copySelection: async () => {
      calls.push(["copy"]);
      if (adapter.selection !== null) adapter.clipboard = adapter.selection;
    },
    pasteResult: async () => calls.push(["paste", adapter.clipboard]),
    closeHandler: null,
    autostart: false,
    onCloseRequested: async (handler) => {
      adapter.closeHandler = handler;
      return () => calls.push(["unclose"]);
    },
    hideMainWindow: async () => calls.push(["hide-main"]),
    trayOffers: [],
    setTrayOffer: async (on) => adapter.trayOffers.push(on),
    launchAtLogin: async () => adapter.autostart,
    setLaunchAtLogin: async (on) => {
      calls.push(["autostart", on]);
      adapter.autostart = on;
    },
    quit: async () => calls.push(["quit"]),
    showMainWindow: async () => calls.push(["show-main"]),
    serviceHandler: null,
    files: {},
    onService: async (handler) => {
      adapter.serviceHandler = handler;
      return () => {};
    },
    readServiceFile: async (path) => {
      calls.push(["read", path]);
      const bytes = adapter.files[path];
      if (!bytes) throw new Error("denied");
      return bytes;
    },
    popover: true,
    selectionHandler: null,
    clearedHandler: null,
    selectionSupported: async () => adapter.popover,
    setSelectionWatch: async (on) => {
      if (!adapter.popover) throw new Error("unsupported");
      calls.push(["popover", on]);
    },
    onSelection: async (handler) => {
      adapter.selectionHandler = handler;
      return () => {};
    },
    onSelectionCleared: async (handler) => {
      adapter.clearedHandler = handler;
      return () => {};
    },
    dismissPanel: async () => calls.push(["dismiss"]),
    current: null,
    readSelection: async () => adapter.current,
  };
  return adapter;
}
function fakeRun(sessions) {
  const run = {
    outcome: null,
    texts: [],
    probed: [],
    // Like the real check: phone numbers and emails count, unless a test says otherwise.
    found: null,
    kinds: [],
    async probe(text) {
      run.probed.push(text);
      const count = run.found ?? (/\d{9,}|@/.test(text) ? 1 : 0);
      return { count, kinds: run.kinds };
    },
    async maskText(text) {
      run.texts.push(text);
      if (run.outcome) return run.outcome;
      const session = phoneSession(sessions.value);
      sessions.value = [session, ...sessions.value];
      return { session };
    },
  };
  return run;
}

test("the shortcut masks ordinary text and leaves the masked copy on the clipboard", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter(phoneText);
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick.start();
  // Start clears a panel left from a page WebKit reloaded mid-action, reads the
  // permission once, then takes the shortcut because it is granted.
  assert.deepEqual(adapter.calls, [
    ["dismiss"],
    ["permission", false],
    ["register"],
    ["popover", true],
  ]);
  const status = await quick.act("auto");
  assert.equal(status.tone, "ok");
  assert.equal(status.message, quickMessages.masked(1));
  assert.deepEqual(run.texts, [phoneText]);
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.equal(adapter.clipboard, `Gọi ${alias} giúp tôi.`);
  // The panel saw the work in progress, then the result.
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "status").map((call) => [call[1], call[2]]),
    [
      [workingMessage, "busy"],
      [quickMessages.masked(1), "ok"],
    ],
  );
});

test("the same shortcut restores an AI reply, even after the session was replaced on screen", async () => {
  const sessions = ref([phoneSession()]);
  await nextTick();
  const alias = sessions.value[0].analysis.findings[0].alias;
  const adapter = fakeAdapter(`Tóm tắt: khách gọi từ ${alias}.`);
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  // The one-screen flow drops the session; its table stays for this launch.
  sessions.value = [];
  await nextTick();
  const status = await quick.act("auto");
  assert.equal(status.message, quickMessages.restored(1, 0));
  assert.equal(adapter.clipboard, "Tóm tắt: khách gọi từ 0901234567.");
  assert.deepEqual(run.texts, []);
});

test("empty, foreign-alias, locked and busy cases change nothing on the clipboard", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const run = fakeRun(sessions);
  let locked = true;
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => locked,
    storage: memoryStorage(),
  });
  assert.equal((await quick.act("auto")).message, lockedMessage);
  locked = false;
  assert.equal((await quick.act("auto")).message, quickMessages.empty);
  adapter.clipboard = "Xem [SDT_1_dead]";
  assert.equal((await quick.act("auto")).message, quickMessages.unknown);
  assert.equal((await quick.act("restore")).message, quickMessages.unknown);
  adapter.clipboard = "không có mã";
  assert.equal((await quick.act("restore")).message, quickMessages.noAliases);
  run.outcome = { error: "busy", message: "" };
  assert.equal((await quick.act("mask")).message, quickMessages.busy);
  run.outcome = { error: "invalid", message: "quá dài" };
  assert.equal((await quick.act("mask")).message, "quá dài");
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "write"),
    [],
  );
  // Only the two explicit mask requests reached the detector; refusals cost nothing.
  assert.equal(run.texts.length, 2);
});

test("preferences persist as on/off flags; a failed registration turns the shortcut off", async () => {
  const storage = memoryStorage({ [popoverKey]: "on" });
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  adapter.registerShortcut = async () => {
    throw new Error("taken");
  };
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage,
  });
  assert.equal(quick.shortcutOn.value, true);
  await quick.start();
  assert.equal(quick.shortcutOn.value, false);
  assert.equal(quick.shortcutFailure.value, shortcutError);
  adapter.registerShortcut = async () => adapter.calls.push(["register"]);
  await quick.setShortcut(true);
  assert.equal(storage.data.get(shortcutKey), "on");
  assert.equal(quick.shortcutFailure.value, "");
  quick.stop();
  assert.deepEqual(adapter.calls.at(-1), ["unregister"]);
});

test("in the browser preview nothing registers and the preferences stay off", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.desktop = false;
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [shortcutKey]: "on" }),
  });
  assert.equal(quick.shortcutOn.value, false);
  await quick.start();
  assert.deepEqual(adapter.calls, []);
});

test("with permission, the shortcut takes the selection and pastes the result over it", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("bản cũ trong clipboard");
  adapter.permission = "granted";
  adapter.selection = phoneText;
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  const status = await quick.act("auto");
  assert.equal(status.message, quickMessages.masked(1, true));
  assert.deepEqual(run.texts, [phoneText]);
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [["paste", `Gọi ${alias} giúp tôi.`]],
  );
  // A marker went on the clipboard before the copy chord, so a selection equal to
  // the old clipboard would still have counted.
  const writes = adapter.calls.filter((call) => call[0] === "write").map((call) => call[1]);
  assert.match(writes[0], /OfflineMask/);
  assert.equal(writes.at(-1), `Gọi ${alias} giúp tôi.`);
  // The panel's own buttons never touch the selection: the two chords are the shortcut's
  // read and its check before the paste.
  adapter.clipboard = phoneText;
  await quick.act("mask");
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 2);
});

test("a selection changed while masking ran is left alone; the result waits in a preview", async () => {
  // The user switched to another app and selected something else before the result came.
  const sessions = ref([]);
  const adapter = fakeAdapter("bản cũ trong clipboard");
  adapter.permission = "granted";
  adapter.selection = phoneText;
  const run = fakeRun(sessions);
  const maskText = run.maskText;
  run.maskText = async (text) => {
    adapter.selection = "Một đoạn khác ở ứng dụng khác";
    return maskText(text);
  };
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  const status = await quick.act("auto");
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 0);
  // Nothing is left on the clipboard: the user's own text is back, the result is shown.
  assert.equal(adapter.clipboard, "bản cũ trong clipboard");
  assert.equal(status.tone, "preview");
  assert.equal(status.message, quickMessages.maskedMoved);
  assert.equal(status.preview.text, `Gọi ${alias} giúp tôi.`);
  assert.equal(status.inPlace, undefined);
  // The user has moved on, so the card opens in the corner, not beside the old circle.
  assert.equal(status.corner, true);
  // Its copy button is how the result reaches the clipboard.
  adapter.command("copy");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(adapter.clipboard, `Gọi ${alias} giúp tôi.`);

  // Nothing selected any more (the click landed elsewhere): no paste either.
  adapter.clipboard = "bản cũ trong clipboard";
  adapter.selection = phoneText;
  run.maskText = async (text) => {
    adapter.selection = null;
    return maskText(text);
  };
  assert.equal((await quick.act("auto")).tone, "preview");
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 0);
  assert.equal(adapter.clipboard, "bản cũ trong clipboard");
});

test("where Accessibility reads the selection, the check before the paste skips the clipboard", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("bản cũ trong clipboard");
  adapter.permission = "granted";
  adapter.selection = phoneText;
  adapter.current = { text: phoneText, bounds: null, pointer: { x: 1, y: 1 }, editable: true };
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  assert.equal((await quick.act("auto")).message, quickMessages.masked(1, true));
  // One copy chord, the read; the check asked Accessibility instead.
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 1);
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 1);

  // Accessibility now reports another selection: no paste, no second copy chord.
  const maskText = run.maskText;
  run.maskText = async (text) => {
    adapter.current = { ...adapter.current, text: "Đoạn khác" };
    return maskText(text);
  };
  adapter.current = { text: phoneText, bounds: null, pointer: { x: 1, y: 1 }, editable: true };
  adapter.clipboard = "bản cũ trong clipboard";
  assert.equal((await quick.act("auto")).tone, "preview");
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 2);
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 1);
  assert.equal(adapter.clipboard, "bản cũ trong clipboard");
});

test("nothing selected, or no permission, falls back to the clipboard; the hint shows once", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter(phoneText);
  adapter.permission = "granted";
  adapter.selection = null; // the copy chord changes nothing
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  assert.equal((await quick.act("auto")).message, quickMessages.masked(1));
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [],
  );
  // No selection: the marker was replaced by the user's clipboard before masking it.
  const writes = adapter.calls.filter((call) => call[0] === "write").map((call) => call[1]);
  assert.match(writes[0], /OfflineMask/);
  assert.equal(writes[1], phoneText);

  const denied = fakeAdapter(phoneText);
  denied.permission = "denied";
  const quick2 = useQuickActions({
    adapter: denied,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  const first = await quick2.act("auto");
  assert.equal(first.message, `${quickMessages.masked(1)} ${quickMessages.permissionHint}`);
  assert.equal(quick2.inputPermission.value, "denied");
  denied.clipboard = phoneText;
  const second = await quick2.act("auto");
  assert.equal(second.message, quickMessages.masked(1));
  assert.deepEqual(
    denied.calls.filter((call) => call[0] === "copy"),
    [],
  );
  // The Settings button asks with the system prompt.
  await quick2.checkInputPermission(true);
  assert.deepEqual(denied.calls.at(-1), ["permission", true]);
});

test("closing the window hides it and tells the panel; the login item mirrors the OS", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.autostart = true;
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  assert.equal(quick.launchAtLogin.value, true);
  adapter.closeHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "status" || call[0] === "hide-main"),
    [["hide-main"]],
  );
  await quick.setLaunchAtLogin(false);
  assert.equal(quick.launchAtLogin.value, false);
  assert.deepEqual(adapter.calls.at(-1), ["autostart", false]);
  adapter.setLaunchAtLogin = async () => {
    throw new Error("no launch agent");
  };
  await quick.setLaunchAtLogin(true);
  assert.equal(quick.launchFailure.value, launchError);
  assert.equal(quick.launchAtLogin.value, false);
  quick.stop();
  assert.ok(adapter.calls.some((call) => call[0] === "unclose"));
});

test("a selection with nothing to hide, or a failure, hands the clipboard back", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("bản cũ");
  adapter.permission = "granted";
  adapter.selection = "Không có gì để ẩn ở đây.";
  const run = fakeRun(sessions);
  run.outcome = { session: createTextSession(adapter.selection, [], []) };
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  const status = await quick.act("auto");
  assert.equal(status.message, quickMessages.nothing);
  assert.equal(adapter.clipboard, "bản cũ");
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [],
  );
  // An unexpected throw after the busy flash still ends in a status, never a stuck panel.
  run.maskText = async () => {
    throw new Error("synthetic");
  };
  const failed = await quick.act("auto");
  assert.equal(failed.message, quickMessages.failed);
  assert.equal(failed.tone, "error");
  assert.equal(adapter.clipboard, "bản cũ");
  assert.equal(quick.busy.value, false);
});

test("the tray's quit flushes pending work before the native exit", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const order = [];
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    flush: async () => {
      order.push("flush");
    },
    storage: memoryStorage(),
  });
  await quick.start();
  adapter.command("quit");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, ["flush"]);
  assert.deepEqual(adapter.calls.at(-1), ["quit"]);
});

test("a Service hands text straight to the action and the first file to its page", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted"; // a Service never takes the selection
  const run = fakeRun(sessions);
  const opened = [];
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    openFile: async (file) => {
      opened.push([file.name, file.size]);
      return file.name.endsWith(".pdf") ? "PDF sắp được hỗ trợ." : "";
    },
    storage: memoryStorage(),
  });
  await quick.start();
  adapter.serviceHandler({ kind: "text", text: phoneText });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.texts, [phoneText]);
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "copy" || call[0] === "paste"),
    [],
  );
  assert.equal(quick.lastStatus.value.message, quickMessages.masked(1));

  adapter.files["/tmp/a.xlsx"] = new Uint8Array([1, 2, 3]);
  adapter.serviceHandler({ kind: "files", paths: ["/tmp/a.xlsx", "/tmp/b.xlsx"] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(opened, [["a.xlsx", 3]]);
  assert.equal(quick.lastStatus.value.message, quickMessages.oneFile("a.xlsx"));
  adapter.files["/tmp/c.pdf"] = new Uint8Array([1]);
  adapter.serviceHandler({ kind: "files", paths: ["/tmp/c.pdf"] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value.message, "PDF sắp được hỗ trợ.");
  adapter.serviceHandler({ kind: "files", paths: ["/tmp/never-offered.csv"] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value.message, serviceFileError);
});

test("the popover asks above a fresh selection and its button replaces that selection in place", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const storage = memoryStorage();
  const quick = useQuickActions({ adapter, run, sessions, locked: () => false, storage });
  await quick.start();
  assert.equal(quick.popoverOn.value, false);
  // Off: a selection shows nothing.
  adapter.selectionHandler({
    text: phoneText,
    bounds: null,
    pointer: { x: 10, y: 10 },
    editable: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value, null);

  await quick.setPopover(true);
  assert.equal(storage.data.get(popoverKey), "on");
  assert.ok(adapter.calls.some((call) => call[0] === "popover" && call[1] === true));
  const bounds = { x: 100, y: 200, width: 80, height: 18 };
  adapter.selectionHandler({
    text: phoneText,
    bounds,
    pointer: { x: 150, y: 210 },
    editable: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value.tone, "select");
  assert.equal(quick.lastStatus.value.message, quickMessages.selectMask);
  assert.equal(quick.lastStatus.value.action, "mask");
  assert.equal(quick.lastStatus.value.hint, "Ẩn thông tin");
  assert.deepEqual(quick.lastStatus.value.anchor, { bounds, pointer: { x: 150, y: 210 } });

  // The panel's button reads the exact selection with one copy chord, masks it, checks
  // with a second one that the selection is still that text, and pastes over it.
  adapter.selection = phoneText;
  adapter.command("mask");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.texts, [phoneText]);
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [["paste", `Gọi ${alias} giúp tôi.`]],
  );
  assert.equal(quick.lastStatus.value.message, quickMessages.masked(1, true));
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 2);
  adapter.selection = null;

  // A reply with that alias asks to restore; a press elsewhere dismisses the question.
  adapter.selectionHandler({
    text: `Trả lời ${alias}`,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value.message, quickMessages.selectRestore);
  assert.equal(quick.lastStatus.value.action, "restore");
  assert.equal(quick.lastStatus.value.hint, "Khôi phục thông tin");
  adapter.clearedHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(adapter.calls.at(-1), ["dismiss"]);
  // After the dismissal the button is back to the clipboard flow.
  adapter.clipboard = phoneText;
  adapter.command("mask");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 1);

  // An empty selection shows nothing, and says why in Settings.
  const before = quick.lastStatus.value;
  adapter.selectionHandler({ text: "  ", bounds: null, pointer: { x: 1, y: 1 }, editable: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value, before);
  assert.equal(quick.lastSkip.value, quickMessages.skipped.empty);

  // Without the macOS permission the switch stays on but says what is missing.
  adapter.permission = "denied";
  await quick.checkInputPermission();
  await quick.setPopover(true);
  assert.equal(quick.popoverFailure.value, popoverPermission);
  // Unsupported systems keep it off.
  const bare = fakeAdapter("");
  bare.popover = false;
  const quick2 = useQuickActions({
    adapter: bare,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick2.start();
  assert.equal(quick2.popoverOn.value, false);
});

test("the circle sits over the end of the selection, flips below at the top edge, stays on screen", () => {
  const dot = { width: 48, height: 48 };
  const area = { x: 0, y: 25, width: 1440, height: 875 };
  // Centred over the selection's right end, just above its first line.
  assert.deepEqual(
    dotSpot(
      { bounds: { x: 500, y: 400, width: 100, height: 20 }, pointer: { x: 0, y: 0 } },
      dot,
      area,
    ),
    { x: 576, y: 348 },
  );
  // Too close to the top: just below the selection instead.
  assert.deepEqual(
    dotSpot(
      { bounds: { x: 500, y: 40, width: 100, height: 20 }, pointer: { x: 0, y: 0 } },
      dot,
      area,
    ),
    { x: 576, y: 64 },
  );
  // No rectangle: beside the pointer, clamped to the right edge.
  assert.deepEqual(dotSpot({ pointer: { x: 1430, y: 500 } }, dot, area), { x: 1392, y: 444 });
  // The hover menu grows from the circle's corner and only moves left at the edge.
  assert.deepEqual(growFrom({ x: 576, y: 348 }, { width: 240, height: 48 }, area), {
    x: 576,
    y: 348,
  });
  assert.deepEqual(growFrom({ x: 1392, y: 444 }, { width: 240, height: 48 }, area), {
    x: 1200,
    y: 444,
  });
});

test("read-only text: no circle for plain text, a restore preview with copy and open for AI replies", async () => {
  const sessions = ref([phoneSession()]);
  await nextTick();
  const alias = sessions.value[0].analysis.findings[0].alias;
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const opened = [];
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    openSession: (id) => opened.push(id),
    storage: memoryStorage(),
  });
  adapter.showMainWindow = async () => adapter.calls.push(["show-main"]);
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Plain read-only text the rules find nothing in: no circle, and Settings says why.
  adapter.selectionHandler({
    text: "Một đoạn văn bản bình thường.",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: false,
  });
  await tick();
  assert.equal(quick.lastStatus.value, null);
  assert.equal(quick.lastSkip.value, quickMessages.skipped.plain);

  // An AI reply with a known alias: the restore circle; its click opens the preview.
  const reply = `Khách gọi từ ${alias}, gọi lại giúp.`;
  adapter.selectionHandler({ text: reply, bounds: null, pointer: { x: 1, y: 1 }, editable: false });
  await tick();
  assert.equal(quick.lastStatus.value.tone, "select");
  assert.equal(quick.lastStatus.value.action, "restore");
  assert.equal(quick.lastStatus.value.hint, "Khôi phục thông tin");
  adapter.command("restore");
  await tick();
  const preview = quick.lastStatus.value;
  assert.equal(preview.tone, "preview");
  assert.equal(preview.message, quickMessages.previewTitle);
  assert.equal(preview.preview.text, "Khách gọi từ 0901234567, gọi lại giúp.");
  assert.deepEqual(preview.preview.marks, [{ start: 13, end: 23, kind: "value" }]);
  assert.equal(preview.preview.canOpen, true);
  // Nothing was pasted, and the user's clipboard is back after the exact read.
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [],
  );
  assert.equal(adapter.clipboard, "clipboard cũ");

  // "Sao chép" puts the restored text on the clipboard and confirms.
  adapter.command("copy");
  await tick();
  assert.equal(adapter.clipboard, "Khách gọi từ 0901234567, gọi lại giúp.");
  assert.equal(quick.lastStatus.value.message, quickMessages.previewCopied);
  // Confirmed on the preview's copy icon, not with a corner card.
  assert.equal(quick.lastStatus.value.copied, true);

  // "Mở trong OfflineMask" opens that session and brings the window back.
  adapter.selectionHandler({ text: reply, bounds: null, pointer: { x: 1, y: 1 }, editable: false });
  await tick();
  adapter.command("restore");
  await tick();
  adapter.command("open");
  await tick();
  assert.deepEqual(opened, [sessions.value[0].id]);
  assert.ok(adapter.calls.some((call) => call[0] === "show-main"));
  assert.deepEqual(adapter.calls.at(-1), ["dismiss"]);
});

test("editable text: the circle masks, or restores in place when it holds known aliases", async () => {
  const sessions = ref([phoneSession()]);
  await nextTick();
  const alias = sessions.value[0].analysis.findings[0].alias;
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  adapter.selectionHandler({
    text: `Đã gọi ${alias}`,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await tick();
  assert.equal(quick.lastStatus.value.action, "restore");
  adapter.selection = `Đã gọi ${alias}`;
  adapter.command("restore");
  await tick();
  await tick();
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [["paste", "Đã gọi 0901234567"]],
  );
  assert.equal(quick.lastStatus.value.message, quickMessages.restored(1, 0, true));
});

test("quick masking hides every category the machine can run", async () => {
  const detector = {
    calls: [],
    prepare() {},
    cancel() {},
    destroy() {},
    async detect(text, _progress, _root, options) {
      detector.calls.push(options);
      return [];
    },
  };
  const { useMaskingRun } = await import("../src/composables/useMaskingRun.ts");
  const { detectionOptions, localOptions } = await import("../src/core/detection/options.ts");
  const ready = ref(false);
  const run = useMaskingRun({
    detector,
    pack: { ready, readyRoot: ref(null) },
    sessions: ref([]),
    onSession: () => {},
  });
  run.selectedOptions.value = ["email"];
  await run.maskText("Gọi 0901234567");
  assert.deepEqual(detector.calls.at(-1), [...localOptions]);
  ready.value = true;
  await run.maskText("Gọi 0901234567");
  assert.deepEqual(
    detector.calls.at(-1),
    detectionOptions.map((option) => option.id),
  );
});

test("read-only plain text: a circle only when the rules find something; its click shows the masked copy", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const opened = [];
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    openSession: (id) => opened.push(id),
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const select = () =>
    adapter.selectionHandler({
      text: phoneText,
      bounds: null,
      pointer: { x: 1, y: 1 },
      editable: false,
    });

  // The rules find nothing: no circle on a web page or a document.
  run.found = 0;
  select();
  await tick();
  assert.equal(quick.lastStatus.value, null);

  // They find a phone number: the masking circle.
  run.found = 1;
  select();
  await tick();
  assert.equal(quick.lastStatus.value.tone, "select");
  assert.equal(quick.lastStatus.value.action, "mask");
  assert.equal(quick.lastStatus.value.hint, "Ẩn thông tin");

  // Its click masks into a new session and previews the masked copy; nothing is pasted.
  adapter.command("mask");
  await tick();
  await tick();
  const status = quick.lastStatus.value;
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.equal(status.tone, "preview");
  assert.equal(status.message, quickMessages.maskedTitle);
  assert.equal(status.preview.text, `Gọi ${alias} giúp tôi.`);
  assert.deepEqual(status.preview.marks, [{ start: 4, end: 4 + alias.length }]);
  assert.equal(status.preview.canOpen, true);
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [],
  );
  assert.equal(adapter.clipboard, "clipboard cũ");

  // Copy puts the masked copy on the clipboard; open goes to the new session.
  adapter.command("copy");
  await tick();
  assert.equal(adapter.clipboard, `Gọi ${alias} giúp tôi.`);
  assert.equal(quick.lastStatus.value.message, quickMessages.previewCopied);
  select();
  await tick();
  adapter.command("mask");
  await tick();
  await tick();
  adapter.command("open");
  await tick();
  assert.deepEqual(opened, [sessions.value[0].id]);
  // Still on that selection: the preview opened beside the circle.
  assert.equal(quick.lastStatus.value.corner, undefined);

  // The user selected something else while masking ran: the preview takes the corner.
  adapter.current = { text: phoneText, bounds: null, pointer: { x: 1, y: 1 }, editable: false };
  const maskText = run.maskText;
  run.maskText = async (text) => {
    adapter.current = { ...adapter.current, text: "Đoạn khác" };
    return maskText(text);
  };
  select();
  await tick();
  adapter.command("mask");
  await tick();
  await tick();
  assert.equal(quick.lastStatus.value.tone, "preview");
  assert.equal(quick.lastStatus.value.corner, true);
});

test("the circle replaces with the exact selection, never with repeated Accessibility text", async () => {
  // Chromium editors can report the selected text of a rich input several times over.
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  adapter.selectionHandler({
    text: phoneText + phoneText + phoneText,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await tick();
  adapter.selection = phoneText;
  adapter.command("mask");
  await tick();
  await tick();
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.deepEqual(run.texts, [phoneText]);
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [["paste", `Gọi ${alias} giúp tôi.`]],
  );

  // No exact read (the app ignores the copy chord): the result goes to the clipboard
  // only, and nothing is pasted over the selection.
  adapter.selection = null;
  adapter.clipboard = "clipboard cũ";
  adapter.selectionHandler({
    text: "Số 0912345678",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await tick();
  adapter.command("mask");
  await tick();
  await tick();
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 1);
  assert.equal(run.texts.at(-1), "Số 0912345678");
  // (The fake run masks its own sample text; what matters is that the result went to
  // the clipboard instead of over the selection.)
  assert.match(adapter.clipboard, /\[SDT_1_[a-f0-9]{4}\]/);
});

test("a click on the circle reports its progress in place; the shortcut's results go to the corner", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const sent = [];
  adapter.sendStatus = async (status) => sent.push(status);
  adapter.selectionHandler({
    text: phoneText,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await tick();
  adapter.selection = phoneText;
  adapter.command("mask");
  await tick();
  await tick();
  const after = sent.slice(1).map((status) => [status.tone, status.inPlace ?? false]);
  assert.deepEqual(after, [
    ["busy", true],
    ["ok", true],
  ]);
  assert.equal(sent.at(-1).message, quickMessages.masked(1, true));
  assert.equal(quickMessages.masked(1, true), "Đã ẩn 1 thông tin");

  // The shortcut keeps the corner toast.
  sent.length = 0;
  adapter.selection = null;
  adapter.clipboard = phoneText;
  await quick.act("auto");
  assert.ok(sent.every((status) => !status.inPlace));
});

test("stopping while start is still registering listeners leaves none behind", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter(phoneText);
  const removed = [];
  const slow = (name, assign) => async (handler) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    assign(handler);
    return () => removed.push(name);
  };
  adapter.onCommand = slow("command", (handler) => (adapter.commandHandler = handler));
  adapter.onSelection = slow("selection", (handler) => (adapter.selectionHandler = handler));
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  const starting = quick.start();
  quick.stop();
  await starting;
  assert.ok(removed.includes("command"));
  assert.ok(removed.includes("selection"));
});

test("read-only selections anchor the circle to the cursor, editable ones to the text", async () => {
  const sessions = ref([phoneSession()]);
  await nextTick();
  const alias = sessions.value[0].analysis.findings[0].alias;
  const adapter = fakeAdapter("");
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const bounds = { x: 1000, y: 200, width: 700, height: 460 };
  const pointer = { x: 1210, y: 660 };
  adapter.selectionHandler({ text: `Gọi ${alias}`, bounds, pointer, editable: false });
  await tick();
  assert.deepEqual(quick.lastStatus.value.anchor, { pointer });
  adapter.selectionHandler({ text: phoneText, bounds, pointer, editable: true });
  await tick();
  assert.deepEqual(quick.lastStatus.value.anchor, { bounds, pointer });
});

test("a replaced instance stopping late does not unregister the live shortcut", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  const make = () =>
    useQuickActions({
      adapter,
      run: fakeRun(sessions),
      sessions,
      locked: () => false,
      storage: memoryStorage({ [popoverKey]: "on" }),
    });
  const old = make();
  await old.start();
  const fresh = make();
  await fresh.start();
  old.stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "unregister"),
    [],
  );
  fresh.stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(adapter.calls.at(-1), ["unregister"]);
});

test("codes of an earlier launch get a muted circle whose click explains and leads to the passcode", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const settings = [];
  let kept = false;
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    openSettings: () => settings.push("open"),
    historyKept: () => kept,
    storage: memoryStorage(),
  });
  adapter.showMainWindow = async () => adapter.calls.push(["show-main"]);
  await quick.start();
  await quick.setPopover(true);
  // Turning the popover on wakes the detector with a throwaway check.
  assert.deepEqual(run.probed, ["a@example.com"]);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  for (const editable of [false, true]) {
    adapter.selectionHandler({
      text: "Mã [SDT_1_dead] cũ",
      bounds: null,
      pointer: { x: 1, y: 1 },
      editable,
    });
    await tick();
    assert.equal(quick.lastStatus.value.tone, "select");
    assert.equal(quick.lastStatus.value.action, "unknown");
    assert.equal(quick.lastStatus.value.hint, quickMessages.hintUnknown);
  }
  adapter.command("unknown");
  await tick();
  assert.equal(quick.lastStatus.value.tone, "notice");
  assert.equal(quick.lastStatus.value.notice.body, quickMessages.unknownBody);
  assert.equal(quick.lastStatus.value.notice.settings, true);
  // Nothing was copied, pasted or masked.
  assert.deepEqual(
    adapter.calls.filter((call) => ["copy", "paste"].includes(call[0])),
    [],
  );
  assert.deepEqual(run.texts, []);
  adapter.command("settings");
  await tick();
  assert.deepEqual(settings, ["open"]);
  assert.ok(adapter.calls.some((call) => call[0] === "show-main"));
  // With history kept the card does not suggest a passcode.
  kept = true;
  adapter.selectionHandler({
    text: "Mã [SDT_1_dead] cũ",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: false,
  });
  await tick();
  adapter.command("unknown");
  await tick();
  assert.equal(quick.lastStatus.value.notice.body, quickMessages.unknownBodySaved);
  assert.equal(quick.lastStatus.value.notice.settings, false);
});

test("a check slower than 1.5 s shows the circle anyway; plain text in any field shows none", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  // Nothing to hide, editable or not: no circle, and Settings says why.
  for (const editable of [true, false]) {
    adapter.selectionHandler({
      text: "Cảm ơn anh, em gửi lại sau nhé",
      bounds: null,
      pointer: { x: 1, y: 1 },
      editable,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(quick.lastStatus.value, null);
    assert.equal(quick.lastSkip.value, quickMessages.skipped.plain);
  }
  // A check that never answers in time: the circle appears rather than nothing.
  run.probe = () => new Promise(() => {});
  adapter.selectionHandler({
    text: phoneText,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  assert.equal(quick.lastStatus.value.tone, "select");
  assert.equal(quick.lastSkip.value, "");
  quick.stop();
});

test("a selection cleared while its check runs gets no circle", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await quick.setPopover(true);
  let answer;
  run.probe = () => new Promise((resolve) => (answer = resolve));
  adapter.selectionHandler({
    text: phoneText,
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  adapter.clearedHandler();
  answer({ count: 1, kinds: [] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.lastStatus.value, null);
  quick.stop();
});

test("the circle's check is the click's own detection, models included, and the click reuses it", async () => {
  const detector = {
    calls: [],
    prepare() {},
    cancel() {},
    destroy() {},
    async detect(text, _progress, root, options) {
      detector.calls.push({ text, root, options });
      // A name only the pack's models find: the built-in rules would see nothing.
      const start = text.indexOf("Phong Phan");
      return start < 0
        ? []
        : [
            {
              start,
              end: start + 10,
              type: "TEN",
              label: "Họ và tên",
              source: "m",
              reason: "m",
              priority: 1,
            },
          ];
    },
  };
  const { useMaskingRun } = await import("../src/composables/useMaskingRun.ts");
  const { detectionOptions } = await import("../src/core/detection/options.ts");
  const sessions = ref([]);
  const run = useMaskingRun({
    detector,
    pack: { ready: ref(true), readyRoot: ref("/packs/vi") },
    sessions,
    onSession: (session) => (sessions.value = [session, ...sessions.value]),
  });
  // The ready pack's warm-up run is not part of this check.
  detector.calls.length = 0;
  const text = "Nhờ anh Phong Phan gọi lại";
  const probed = await run.probe(text);
  assert.equal(probed.count, 1);
  assert.deepEqual(detector.calls[0], {
    text,
    root: "/packs/vi",
    options: detectionOptions.map((option) => option.id),
  });
  const result = await run.maskText(text);
  // One detection for the check and the click together.
  assert.equal(detector.calls.length, 1);
  assert.equal(result.session.analysis.findings[0].value, "Phong Phan");
  // A different selection is detected afresh.
  await run.maskText("Gọi Phong Phan");
  assert.equal(detector.calls.length, 2);
});

test("the preview opens just below its circle, or above it at the bottom of the screen", async () => {
  const { previewSpot } = await import("../src/adapters/quick-panel.ts");
  const area = { x: 0, y: 25, width: 1440, height: 875 };
  const circle = { x: 600, y: 300, width: 48, height: 48 };
  const card = { width: 356, height: 168 };
  assert.deepEqual(previewSpot(circle, card, area), { x: 600, y: 348 });
  // No room below: above the circle.
  assert.deepEqual(previewSpot({ ...circle, y: 800 }, card, area), { x: 600, y: 632 });
  // Near the right edge: pulled left to stay on screen.
  assert.deepEqual(previewSpot({ ...circle, x: 1300 }, card, area), { x: 1084, y: 348 });
});

test("⌘⇧M does exactly what a click on the circle does, and nothing without a selection", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("clipboard cũ");
  adapter.permission = "granted";
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick.start();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const sent = [];
  adapter.sendStatus = async (status) => sent.push(status);

  // No readable selection: nothing at all, no clipboard flow.
  adapter.current = null;
  adapter.fire();
  await tick();
  assert.deepEqual(sent, []);
  assert.deepEqual(run.texts, []);
  assert.equal(adapter.clipboard, "clipboard cũ");

  // Editable selection: the circle by the text, then in place with spinner and check.
  const bounds = { x: 300, y: 200, width: 120, height: 18 };
  adapter.current = { text: phoneText, bounds, pointer: { x: 5, y: 5 }, editable: true };
  adapter.selection = phoneText;
  adapter.fire();
  await tick();
  await tick();
  await tick();
  assert.equal(sent[0].tone, "select");
  assert.equal(sent[0].action, "mask");
  assert.deepEqual(sent[0].anchor, { bounds, pointer: { x: 5, y: 5 } });
  assert.deepEqual(
    sent.slice(1).map((status) => [status.tone, status.inPlace ?? false]),
    [
      ["busy", true],
      ["ok", true],
    ],
  );
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "paste"),
    [["paste", `Gọi ${alias} giúp tôi.`]],
  );

  // Read-only text with that alias: the circle by the cursor, then the preview.
  sent.length = 0;
  adapter.current = {
    text: `Gọi lại ${alias}`,
    bounds,
    pointer: { x: 7, y: 9 },
    editable: false,
  };
  adapter.selection = `Gọi lại ${alias}`;
  adapter.fire();
  await tick();
  await tick();
  assert.equal(sent[0].action, "restore");
  assert.deepEqual(sent[0].anchor, { pointer: { x: 7, y: 9 } });
  assert.equal(sent.at(-1).tone, "preview");
  assert.equal(sent.at(-1).preview.text, "Gọi lại 0901234567");
  assert.equal(adapter.calls.filter((call) => call[0] === "paste").length, 1);

  // Codes of no known session: the explanation card.
  sent.length = 0;
  adapter.current = {
    text: "Mã [SDT_1_dead]",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: false,
  };
  adapter.fire();
  await tick();
  assert.equal(sent.at(-1).tone, "notice");
});

test("the shortcut is only taken once the permission is granted, and released when it goes", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "denied";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick.start();
  assert.equal(adapter.calls.filter((call) => call[0] === "register").length, 0);
  adapter.permission = "granted";
  await quick.checkInputPermission();
  assert.equal(adapter.calls.filter((call) => call[0] === "register").length, 1);
  // Turned off by the user: released; on again: taken again.
  await quick.setShortcut(false);
  assert.deepEqual(adapter.calls.at(-1), ["unregister"]);
  await quick.setShortcut(true);
  assert.deepEqual(adapter.calls.at(-1), ["register"]);
  quick.stop();
});

test("the shortcut is a sub-option of the circle: off with it, back with it", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick.start();
  const registers = () => adapter.calls.filter((call) => call[0] === "register").length;
  assert.equal(registers(), 1);
  await quick.setPopover(false);
  assert.deepEqual(adapter.calls.at(-1), ["unregister"]);
  // The preference itself is kept for when the circle comes back.
  assert.equal(quick.shortcutOn.value, true);
  await quick.setPopover(true);
  assert.equal(registers(), 2);
  quick.stop();
});

test("the tray offers Ẩn nhanh only while it is off", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  await nextTick();
  assert.equal(adapter.trayOffers.at(-1), true);
  await quick.setPopover(true);
  await nextTick();
  assert.equal(adapter.trayOffers.at(-1), false);
  await quick.setPopover(false);
  await nextTick();
  assert.equal(adapter.trayOffers.at(-1), true);
  quick.stop();
});

test("the one-time card primes the permission and turns Ẩn nhanh on once it is granted", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "denied";
  const storage = memoryStorage();
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage,
  });
  await quick.start();
  quick.offerIntro();
  assert.equal(quick.introStage.value, "offer");
  await quick.startIntro();
  // A sentence first; the system dialog only on "Tiếp tục".
  assert.equal(quick.introStage.value, "prime");
  assert.equal(
    adapter.calls.some((call) => call[0] === "permission" && call[1] === true),
    false,
  );
  assert.equal(storage.data.get(introKey), "on");
  await quick.grantAndEnable();
  assert.equal(quick.introStage.value, "waiting");
  assert.deepEqual(adapter.calls.filter((call) => call[0] === "permission").at(-1), [
    "permission",
    true,
  ]);
  assert.equal(quick.popoverOn.value, false);
  adapter.permission = "granted";
  await quick.checkInputPermission();
  assert.equal(quick.popoverOn.value, true);
  assert.equal(quick.introStage.value, "done");
  quick.dismissIntro();
  quick.offerIntro();
  assert.equal(quick.introStage.value, null);
  quick.stop();
});

test("with the permission already there the card turns Ẩn nhanh on at once", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "granted";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  quick.offerIntro();
  await quick.startIntro();
  assert.equal(quick.popoverOn.value, true);
  assert.equal(quick.introStage.value, "done");
  quick.stop();
});

test("Để sau hides the card for good, and it never shows once Ẩn nhanh is on", async () => {
  const sessions = ref([]);
  const storage = memoryStorage();
  const make = (permission, store) => {
    const adapter = fakeAdapter("");
    adapter.permission = permission;
    return useQuickActions({
      adapter,
      run: fakeRun(sessions),
      sessions,
      locked: () => false,
      storage: store,
    });
  };
  const quick = make("denied", storage);
  await quick.start();
  quick.offerIntro();
  quick.dismissIntro();
  quick.offerIntro();
  assert.equal(quick.introStage.value, null);
  quick.stop();
  const later = make("denied", storage);
  await later.start();
  later.offerIntro();
  assert.equal(later.introStage.value, null);
  later.stop();

  const on = make("granted", memoryStorage({ [popoverKey]: "on" }));
  await on.start();
  on.offerIntro();
  assert.equal(on.introStage.value, null);
  on.stop();
});

test("switched on without the permission still counts as off for the offers", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "denied";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [popoverKey]: "on" }),
  });
  await quick.start();
  await nextTick();
  assert.equal(quick.popoverOn.value, true);
  assert.equal(quick.quickReady.value, false);
  assert.equal(adapter.trayOffers.at(-1), true);
  quick.offerIntro();
  assert.equal(quick.introStage.value, "offer");
  await quick.startIntro();
  await quick.grantAndEnable();
  adapter.permission = "granted";
  await quick.checkInputPermission();
  await nextTick();
  assert.equal(quick.quickReady.value, true);
  assert.equal(quick.introStage.value, "done");
  assert.equal(adapter.trayOffers.at(-1), false);
  quick.stop();
});

test("the card goes with the result it sat under; an unanswered offer can come back", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  adapter.permission = "denied";
  const quick = useQuickActions({
    adapter,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  quick.offerIntro();
  quick.closeIntro();
  assert.equal(quick.introStage.value, null);
  quick.offerIntro();
  assert.equal(quick.introStage.value, "offer");
  await quick.startIntro();
  quick.closeIntro();
  quick.offerIntro();
  assert.equal(quick.introStage.value, null);
  quick.stop();
});

test("the circle goes by the text, even when a field only reports its frame", async () => {
  const { selectionAnchor } = await import("../src/adapters/quick-actions.ts");
  const pointer = { x: 900, y: 920 };
  const text = { x: 600, y: 910, width: 300, height: 20 };
  const field = { x: 594, y: 908, width: 529, height: 36 };
  // A native field reports the selection itself.
  assert.deepEqual(selectionAnchor({ text: "x", bounds: text, pointer, editable: true }), {
    bounds: text,
    pointer,
  });
  // Read-only text: the cursor.
  assert.deepEqual(selectionAnchor({ text: "x", bounds: text, pointer, editable: false }), {
    pointer,
  });
  // Only the field's frame (Chromium, Electron): a mouse selection ends at the pointer…
  assert.deepEqual(
    selectionAnchor({
      text: "x",
      bounds: field,
      pointer,
      editable: true,
      field: true,
      mouse: true,
    }),
    { pointer },
  );
  // …a keyboard one (⌘A, ⌘⇧M) starts at the field's first line, never its far end.
  const keys = selectionAnchor({ text: "x", bounds: field, pointer, editable: true, field: true });
  assert.equal(keys.bounds.x, field.x + 8);
  assert.ok(keys.bounds.x + keys.bounds.width < field.x + 40);
  assert.ok(
    keys.bounds.y >= field.y && keys.bounds.y + keys.bounds.height <= field.y + field.height,
  );
  // A drag that ended outside the field also falls back to its start.
  const outside = selectionAnchor({
    text: "x",
    bounds: field,
    pointer: { x: 10, y: 10 },
    editable: true,
    field: true,
    mouse: true,
  });
  assert.equal(outside.bounds.x, field.x + 8);
});
