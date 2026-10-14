import test from "node:test";
import assert from "node:assert/strict";
import { nextTick, ref } from "vue";
import {
  createSession,
  createTextSession,
  encodeSessions,
  historyKey,
} from "../src/core/sessions.ts";
import { localOptions } from "../src/core/detection/options.ts";
import { useSessions, historyReadError } from "../src/composables/useSessions.ts";
import {
  useRecognitionPack,
  packActionError,
  packCheckError,
} from "../src/composables/useRecognitionPack.ts";
import { useMaskingRun, processingFailure } from "../src/composables/useMaskingRun.ts";
import { useTextReview, hiddenMessage, undoneMessage } from "../src/composables/useTextReview.ts";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      data.set(key, value);
    },
  };
}
function status(stage, root = null) {
  return { stage, downloaded: 0, total: 1, installedBytes: 1, installed: 0, error: null, root };
}
function fakeAdapter(overrides = {}) {
  const calls = [];
  let listener;
  return {
    calls,
    push: (next) => listener?.(next),
    status: async () => {
      calls.push("status");
      return status("missing");
    },
    subscribe: async (next) => {
      calls.push("subscribe");
      listener = next;
      return () => calls.push("unsubscribe");
    },
    download: async () => calls.push("download"),
    cancel: async () => calls.push("cancel"),
    uninstall: async () => calls.push("uninstall"),
    ...overrides,
  };
}
function fakeDetector() {
  const calls = [];
  let pending;
  return {
    calls,
    settle: (detections) => pending?.resolve(detections),
    fail: () => pending?.reject(new Error("synthetic")),
    prepare: (root) => calls.push(["prepare", root]),
    cancel: (preserve) => calls.push(["cancel", preserve]),
    destroy: () => calls.push(["destroy"]),
    detect: (text, progress) =>
      new Promise((resolve, reject) => {
        calls.push(["detect", text]);
        progress({ stage: "processing", completed: 1, total: 4 });
        pending = { resolve, reject };
      }),
  };
}

test("sessions: only sample sessions reach storage; private sessions stay in memory", () => {
  const storage = memoryStorage();
  const store = useSessions(storage);
  const sample = createSession("text", []);
  store.add(sample);
  assert.deepEqual(storage.writes, [historyKey]);
  const text = createTextSession(
    "Liên hệ minh.anh@example.com",
    [sample],
    [
      {
        start: 8,
        end: 28,
        type: "EMAIL",
        label: "Email",
        source: "test",
        reason: "test",
        priority: 1,
      },
    ],
  );
  store.add(text);
  assert.equal(storage.writes.length, 1);
  assert.equal(store.sessions.value[0].id, text.id);
  assert.ok(!storage.getItem(historyKey).includes("minh.anh"));
  assert.equal(store.find(text.id)?.id, text.id);
  assert.equal(store.remove(text.id), true);
  assert.equal(storage.writes.length, 1);
  assert.equal(store.remove(sample.id), true);
  assert.equal(storage.writes.length, 2);
  assert.equal(store.remove("missing"), false);
  assert.deepEqual(store.sessions.value, []);
});

test("sessions: unreadable history is reported and never overwritten", () => {
  const storage = memoryStorage({ [historyKey]: "{not json" });
  const store = useSessions(storage);
  assert.equal(store.storageError.value, historyReadError);
  store.add(createSession("text", []));
  store.save();
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.getItem(historyKey), "{not json");
});

test("sessions: stored sample history round trips through the store", () => {
  const sample = createSession("text", []);
  sample.decisions.name = "keep";
  const store = useSessions(memoryStorage({ [historyKey]: encodeSessions([sample]) }));
  assert.equal(store.sessions.value.length, 1);
  assert.equal(store.sessions.value[0].decisions.name, "keep");
});

test("pack: pushes replace polling and actions refresh once", async () => {
  const adapter = fakeAdapter();
  const pack = useRecognitionPack(adapter);
  assert.equal(pack.status.value.stage, "checking");
  await pack.start();
  assert.deepEqual(adapter.calls, ["subscribe", "status"]);
  assert.equal(pack.status.value.stage, "missing");
  adapter.push(status("downloading"));
  assert.equal(pack.preparing.value, true);
  adapter.push(status("ready", "asset://root"));
  assert.equal(pack.ready.value, true);
  assert.equal(pack.readyRoot.value, "asset://root");
  await pack.run("pause");
  assert.deepEqual(adapter.calls.slice(2), ["cancel", "status"]);
  await pack.run("uninstall");
  assert.deepEqual(adapter.calls.slice(4), ["uninstall", "status"]);
  assert.equal(pack.readyRoot.value, null);
  pack.stop();
  assert.equal(adapter.calls.at(-1), "unsubscribe");
  await pack.start();
  assert.equal(adapter.calls.at(-1), "unsubscribe");
});

test("pack: failures surface messages and a missing event channel falls back to polling", async () => {
  const failing = fakeAdapter({
    download: async () => {
      throw new Error("ipc");
    },
  });
  const pack = useRecognitionPack(failing);
  await pack.start();
  await pack.run("download");
  assert.equal(pack.error.value, packActionError);
  failing.push(status("missing"));
  assert.equal(pack.error.value, "");

  const noEvents = fakeAdapter({
    subscribe: async () => {
      throw new Error("permission");
    },
  });
  const polling = useRecognitionPack(noEvents, 5);
  await polling.start();
  assert.equal(polling.status.value.stage, "missing");
  const before = noEvents.calls.filter((call) => call === "status").length;
  await new Promise((resolve) => setTimeout(resolve, 30));
  polling.stop();
  assert.ok(noEvents.calls.filter((call) => call === "status").length > before);

  const unreachable = fakeAdapter({
    status: async () => {
      throw new Error("ipc");
    },
  });
  const broken = useRecognitionPack(unreachable);
  await broken.start();
  assert.equal(broken.error.value, packCheckError);
  broken.stop();
});

test("pack: a stale status read cannot overwrite a newer push after pausing", async () => {
  const at = (stage, revision) => ({ ...status(stage), revision });
  let adapter;
  adapter = fakeAdapter({
    status: async () => at("downloading", 1),
    // The read made right after pausing was taken before the worker stopped,
    // but its reply lands after the "paused" push.
    cancel: async () => {
      adapter.push(at("paused", 4));
    },
  });
  const original = adapter.status;
  const pack = useRecognitionPack(adapter);
  await pack.start();
  assert.equal(pack.status.value.stage, "downloading");
  adapter.status = async () => at("cancelling", 3);
  await pack.run("pause");
  assert.equal(pack.status.value.stage, "paused");
  adapter.status = original;
  adapter.push(at("downloading", 5));
  assert.equal(pack.status.value.stage, "downloading");
  pack.stop();
});

test("run: a finished text run hands its session to the shell and clears the draft", async () => {
  const detector = fakeDetector();
  const ready = ref(false);
  const readyRoot = ref(null);
  const sessions = ref([]);
  const received = [];
  const run = useMaskingRun({
    detector,
    pack: { ready, readyRoot },
    sessions,
    onSession: (session) => received.push(session),
  });
  assert.deepEqual(run.selectedOptions.value, localOptions);
  run.draft.value = "Gọi 0901234567 nhé";
  const masking = run.mask("text");
  assert.equal(run.processing.value, true);
  await nextTick();
  assert.equal(run.progress.value.stage, "reading");
  assert.equal(run.progress.value.done / run.progress.value.total, 0.25);
  detector.settle([
    {
      start: 4,
      end: 14,
      type: "SDT",
      label: "Số điện thoại",
      source: "t",
      reason: "t",
      priority: 1,
    },
  ]);
  const session = await masking;
  assert.equal(session.fixture, "private-text-v1");
  assert.equal(session.analysis.findings[0].value, "0901234567");
  assert.deepEqual(received, [session]);
  assert.equal(run.draft.value, "");
  assert.equal(run.processing.value, false);
  assert.equal(run.progress.value, null);
});

test("run: cancellation discards the result, failures keep the draft, spreadsheets are not its job", async () => {
  const detector = fakeDetector();
  const sessions = ref([]);
  const received = [];
  const run = useMaskingRun({
    detector,
    pack: { ready: ref(false), readyRoot: ref(null) },
    sessions,
    onSession: (session) => received.push(session),
  });
  run.draft.value = "Số 0901234567";
  const cancelled = run.mask("text");
  run.cancel(true);
  assert.deepEqual(detector.calls.at(-1), ["cancel", true]);
  detector.settle([]);
  assert.equal(await cancelled, undefined);
  assert.deepEqual(received, []);
  assert.equal(run.draft.value, "Số 0901234567");

  const failing = run.mask("text");
  detector.fail();
  assert.equal(await failing, undefined);
  assert.equal(run.processingError.value, processingFailure);
  assert.equal(run.draft.value, "Số 0901234567");

  // Spreadsheets have their own flow; the text run ignores them.
  assert.equal(await run.mask("excel"), undefined);
  assert.deepEqual(received, []);
  run.destroy();
  assert.deepEqual(detector.calls.at(-1), ["destroy"]);
});

test("run: a ready pack is prepared once and selects every category unless the user chose", async () => {
  const detector = fakeDetector();
  const ready = ref(false);
  const readyRoot = ref(null);
  const run = useMaskingRun({
    detector,
    pack: { ready, readyRoot },
    sessions: ref([]),
    onSession: () => {},
  });
  run.selectedOptions.value = ["name"];
  assert.equal(run.missingSelectedModels.value, true);
  assert.equal(await run.mask("text"), undefined);
  readyRoot.value = "asset://pack";
  ready.value = true;
  await nextTick();
  assert.deepEqual(detector.calls, [["prepare", "asset://pack"]]);
  assert.equal(run.selectedOptions.value.length, 6);
  assert.equal(run.missingSelectedModels.value, false);
  readyRoot.value = null;
  ready.value = false;
  await nextTick();
  // An uninstalled pack is released rather than kept loaded.
  assert.deepEqual(detector.calls.at(-1), ["cancel", false]);
  readyRoot.value = "asset://pack";
  ready.value = true;
  await nextTick();
  assert.equal(detector.calls.length, 3);

  const edited = useMaskingRun({
    detector: fakeDetector(),
    pack: { ready: ref(false), readyRoot: ref(null) },
    sessions: ref([]),
    onSession: () => {},
  });
  edited.selectionEdited.value = true;
  edited.selectedOptions.value = ["email"];
  const pack = { ready: ref(true), readyRoot: ref("asset://pack") };
  const respectful = useMaskingRun({
    detector: fakeDetector(),
    pack,
    sessions: ref([]),
    onSession: () => {},
  });
  respectful.selectionEdited.value = true;
  respectful.selectedOptions.value = ["email"];
  pack.readyRoot.value = "asset://other";
  await nextTick();
  assert.deepEqual(respectful.selectedOptions.value, ["email"]);
});

test("review: selecting missed text hides that occurrence and undo restores it", async () => {
  const original = "Tên: Nguyễn Văn A, email a@example.com";
  const session = createTextSession(
    original,
    [],
    [{ start: 25, end: 38, type: "EMAIL", label: "Email", source: "t", reason: "t", priority: 1 }],
  );
  const view = ref("original");
  const element = {
    selectionStart: 5,
    selectionEnd: 17,
    focused: 0,
    range: null,
    focus() {
      this.focused++;
    },
    setSelectionRange(start, end) {
      this.range = [start, end];
    },
  };
  let manualCopy = false;
  const review = useTextReview({
    session: () => session,
    view,
    visibleText: () => original,
    element: () => element,
    manualCopy: () => manualCopy,
  });
  manualCopy = true;
  review.captureSelection();
  assert.equal(review.selectedText.value, null);
  manualCopy = false;
  review.captureSelection();
  assert.deepEqual(review.selectedText.value.range, { start: 5, end: 17 });
  assert.equal(await review.hideSelection(), true);
  assert.equal(view.value, "masked");
  assert.equal(review.reviewStatus.value, hiddenMessage);
  assert.equal(review.selectedText.value, null);
  assert.equal(session.analysis.findings.length, 2);
  assert.equal(session.analysis.findings[0].value, "Nguyễn Văn A");
  assert.ok(session.reviewUndo);
  assert.equal(element.focused, 1);
  assert.deepEqual(element.range, [0, 0]);
  assert.equal(await review.undoManualMask(), true);
  assert.equal(session.analysis.findings.length, 1);
  assert.equal(session.reviewUndo, undefined);
  assert.equal(review.reviewStatus.value, undoneMessage);
  assert.equal(await review.undoManualMask(), false);
  review.captureSelection();
  review.clear();
  assert.equal(review.selectedText.value, null);
  assert.equal(await review.hideSelection(), false);
});

test("review: sample sessions and stale selections never change", async () => {
  const sample = createSession("text", []);
  const view = ref("masked");
  const review = useTextReview({
    session: () => sample,
    view,
    visibleText: () => "sample",
    element: () => ({ selectionStart: 0, selectionEnd: 3, focus() {}, setSelectionRange() {} }),
    manualCopy: () => false,
  });
  review.captureSelection();
  assert.equal(review.selectedText.value, null);
  assert.equal(await review.hideSelection(), false);
  assert.equal(await review.undoManualMask(), false);
});

test("run: a .txt file becomes the draft; long, empty or busy cases explain why", async () => {
  const detector = fakeDetector();
  const run = useMaskingRun({
    detector,
    pack: { ready: ref(false), readyRoot: ref(null) },
    sessions: ref([]),
    onSession: () => {},
  });
  assert.equal(await run.openTextFile(new File(["Gọi 0901234567"], "a.txt")), "");
  assert.equal(run.draft.value, "Gọi 0901234567");
  assert.match(await run.openTextFile(new File(["a".repeat(50_001)], "b.md")), /dài hơn 50\.000/);
  assert.match(await run.openTextFile(new File(["  \n"], "c.txt")), /không có chữ/);
  assert.equal(run.draft.value, "Gọi 0901234567", "a refused file leaves the draft");
  void run.mask("text");
  assert.match(await run.openTextFile(new File(["x"], "d.txt")), /đang ẩn/);
});
