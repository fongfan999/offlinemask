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
  backgroundMessage,
  launchError,
  lockedMessage,
  popoverKey,
  popoverPermission,
  serviceFileError,
  shortcutError,
  shortcutKey,
  useQuickActions,
  watchKey,
  workingMessage,
} from "../src/composables/useQuickActions.ts";
import { panelKey } from "../src/adapters/quick-actions.ts";
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
    sendStatus: async (status) =>
      calls.push(["status", status.message, status.tone, status.pinned]),
    setPinned: async (pinned) => calls.push(["pin", pinned]),
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
    launchAtLogin: async () => adapter.autostart,
    setLaunchAtLogin: async (on) => {
      calls.push(["autostart", on]);
      adapter.autostart = on;
    },
    quit: async () => calls.push(["quit"]),
    showMainWindow: async () => calls.push(["show-main"]),
    serviceHandler: null,
    changedHandler: null,
    files: {},
    watch: true,
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
    watchSupported: async () => adapter.watch,
    setClipboardWatch: async (on) => {
      if (!adapter.watch) throw new Error("unsupported");
      calls.push(["watch", on]);
    },
    onClipboardChanged: async (handler) => {
      adapter.changedHandler = handler;
      return () => {};
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
  };
  return adapter;
}
function fakeRun(sessions) {
  const run = {
    outcome: null,
    texts: [],
    probed: [],
    found: 0,
    kinds: [],
    async probe(text) {
      run.probed.push(text);
      return { count: run.found, kinds: run.kinds };
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
  const run = fakeRun(sessions);
  const quick = useQuickActions({
    adapter,
    run,
    sessions,
    locked: () => false,
    storage: memoryStorage(),
  });
  await quick.start();
  // Start registers the shortcut and reads the keystroke permission once.
  assert.deepEqual(adapter.calls, [["register"], ["permission", false]]);
  const status = await quick.act("auto");
  assert.equal(status.tone, "ok");
  assert.equal(status.message, quickMessages.masked(1));
  assert.deepEqual(run.texts, [phoneText]);
  const alias = sessions.value[0].analysis.findings[0].alias;
  assert.equal(adapter.clipboard, `Gọi ${alias} giúp tôi.`);
  // The panel saw the work in progress, then the result; the panel is not pinned.
  assert.deepEqual(
    adapter.calls.filter((call) => call[0] === "status").map((call) => [call[1], call[2], call[3]]),
    [
      [workingMessage, "busy", false],
      [quickMessages.masked(1), "ok", false],
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
  const storage = memoryStorage({ [panelKey]: "on" });
  const sessions = ref([]);
  const adapter = fakeAdapter("");
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
  assert.equal(quick.pinned.value, true);
  assert.equal(quick.shortcutOn.value, true);
  await quick.start();
  assert.equal(quick.shortcutOn.value, false);
  assert.equal(quick.shortcutFailure.value, shortcutError);
  await quick.setPinned(false);
  assert.equal(storage.data.get(panelKey), "off");
  assert.deepEqual(adapter.calls.at(-1), ["pin", false]);
  adapter.registerShortcut = async () => adapter.calls.push(["register"]);
  await quick.setShortcut(true);
  assert.equal(storage.data.get(shortcutKey), "on");
  assert.equal(quick.shortcutFailure.value, "");
  // The panel's close control unpins through the command channel.
  adapter.command("unpin");
  await nextTick();
  assert.equal(quick.pinned.value, false);
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
  // The panel's own buttons never touch the selection.
  adapter.clipboard = phoneText;
  await quick.act("mask");
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 1);
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
    [["status", backgroundMessage, "ok", false], ["hide-main"]],
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

test("the clipboard watch is off by default, nudges only on real finds, never on our own output", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter(phoneText);
  const run = fakeRun(sessions);
  const storage = memoryStorage();
  const quick = useQuickActions({ adapter, run, sessions, locked: () => false, storage });
  await quick.start();
  assert.equal(quick.watchOn.value, false);
  assert.equal(quick.watchSupported.value, true);
  adapter.changedHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.probed, []);

  await quick.setClipboardWatch(true);
  assert.equal(storage.data.get(watchKey), "on");
  assert.deepEqual(adapter.calls.at(-1), ["watch", true]);
  run.found = 2;
  adapter.changedHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.probed, [phoneText]);
  assert.equal(quick.lastStatus.value.message, quickMessages.offer(2));
  assert.equal(quick.lastStatus.value.tone, "offer");

  // Masking from the nudge writes our output; that change is not offered back.
  await quick.act("mask");
  const written = adapter.clipboard;
  adapter.changedHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.probed, [phoneText]);
  assert.equal(adapter.clipboard, written);
  // Alias text (an AI reply) and empty text are left alone too.
  adapter.clipboard = `Reply ${sessions.value[0].analysis.findings[0].alias}`;
  adapter.changedHandler();
  adapter.clipboard = "   ";
  adapter.changedHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(run.probed, [phoneText]);

  // Unsupported systems keep it off and say why.
  const bare = fakeAdapter("");
  bare.watch = false;
  const quick2 = useQuickActions({
    adapter: bare,
    run: fakeRun(sessions),
    sessions,
    locked: () => false,
    storage: memoryStorage({ [watchKey]: "on" }),
  });
  await quick2.start();
  assert.equal(quick2.watchSupported.value, false);
  assert.equal(quick2.watchOn.value, false);
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
  assert.deepEqual(adapter.calls.at(-1), ["popover", true]);
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

  // The panel's button reads the exact selection with one copy chord, masks it, puts the
  // user's clipboard back and pastes the result over the selection.
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
  assert.equal(adapter.calls.filter((call) => call[0] === "copy").length, 1);
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

  // Foreign alias text and empty selections show nothing.
  adapter.selectionHandler({
    text: "[SDT_1_dead]",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: true,
  });
  adapter.selectionHandler({ text: "  ", bounds: null, pointer: { x: 1, y: 1 }, editable: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.notEqual(quick.lastStatus.value.tone, "select");

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

  // Plain read-only text, or a selection holding aliases of no known session: nothing.
  adapter.selectionHandler({
    text: "Một đoạn văn bản bình thường.",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: false,
  });
  adapter.selectionHandler({
    text: "Mã [SDT_1_dead]",
    bounds: null,
    pointer: { x: 1, y: 1 },
    editable: false,
  });
  await tick();
  assert.equal(quick.lastStatus.value, null);

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
  assert.equal(preview.message, quickMessages.previewTitle(1));
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
  assert.equal(status.message, quickMessages.maskedTitle(1));
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
  assert.deepEqual(quick.lastStatus.value.anchor, { bounds: undefined, pointer });
  adapter.selectionHandler({ text: phoneText, bounds, pointer, editable: true });
  await tick();
  assert.deepEqual(quick.lastStatus.value.anchor, { bounds, pointer });
});

test("a replaced instance stopping late does not unregister the live shortcut", async () => {
  const sessions = ref([]);
  const adapter = fakeAdapter("");
  const make = () =>
    useQuickActions({
      adapter,
      run: fakeRun(sessions),
      sessions,
      locked: () => false,
      storage: memoryStorage(),
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
