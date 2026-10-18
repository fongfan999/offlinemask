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
  panelKey,
  shortcutError,
  shortcutKey,
  useQuickActions,
  workingMessage,
} from "../src/composables/useQuickActions.ts";

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
  };
  return adapter;
}
function fakeRun(sessions) {
  const run = {
    outcome: null,
    texts: [],
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
