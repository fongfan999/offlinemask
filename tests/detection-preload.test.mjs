import test from "node:test";
import assert from "node:assert/strict";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
import { createTextDetector } from "../src/adapters/text-detection.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("background preparation and immediate masking share one model load and do not run inference early", async () => {
  const loading = deferred();
  let loads = 0,
    predictions = 0;
  const engine = createDetectionEngine(
    async () => assert.fail("No tokenizer input while preparing"),
    async (root) => {
      assert.equal(root, "/verified-pack");
      loads++;
      return loading.promise;
    },
  );
  const preload = engine.prepare("/verified-pack");
  const second = engine.prepare("/verified-pack");
  const request = engine(
    { text: "Synthetic", options: ["name"], modelRoot: "/verified-pack" },
    () => {},
  );
  assert.equal(loads, 1);
  assert.equal(predictions, 0);
  loading.resolve({
    detect: async (text) => {
      assert.equal(text, "Synthetic");
      predictions++;
      return [];
    },
  });
  await Promise.all([preload, second]);
  assert.deepEqual(await request, []);
  assert.equal(predictions, 1);
  await engine({ text: "Synthetic", options: ["name"], modelRoot: "/verified-pack" }, () => {});
  assert.equal(loads, 1);
  assert.equal(predictions, 2);
});

test("local-only detection never waits for background model loading", async () => {
  const loading = deferred();
  const engine = createDetectionEngine(undefined, async () => loading.promise);
  const preload = engine.prepare("/verified-pack");
  const result = await engine({ text: "synthetic@example.com", options: ["email"] }, () =>
    assert.fail("No model progress"),
  );
  assert.equal(result[0].type, "EMAIL");
  loading.resolve({});
  await preload;
});

test("failed preparation can be retried explicitly without a cached rejected promise", async () => {
  let loads = 0;
  const engine = createDetectionEngine(undefined, async () => {
    loads++;
    if (loads === 1) throw Error("Synthetic runtime failure");
    return { detect: async () => [] };
  });
  await assert.rejects(engine.prepare("/verified-pack"));
  assert.deepEqual(
    await engine({ text: "Synthetic", options: ["name"], modelRoot: "/verified-pack" }, () => {}),
    [],
  );
  assert.equal(loads, 2);
});

test("cancellation while joining preparation produces no inference or stale result", async () => {
  const loading = deferred(),
    controller = new AbortController();
  const engine = createDetectionEngine(undefined, async () => loading.promise);
  const preload = engine.prepare("/verified-pack");
  const request = engine(
    { text: "Synthetic", options: ["name"], modelRoot: "/verified-pack" },
    () => {},
    controller.signal,
  );
  controller.abort();
  loading.resolve({ detect: async () => assert.fail("Cancelled source must not run") });
  await preload;
  await assert.rejects(request, { name: "AbortError" });
});

test("adapter prepares once, uses that same worker for masking, and disposes it on unmount", async (context) => {
  const workers = [];
  class Worker {
    sent = [];
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(message) {
      this.sent.push(message);
    }
    terminate() {
      this.terminated = true;
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { value: Worker, configurable: true });
  context.after(() =>
    previous ? Object.defineProperty(globalThis, "Worker", previous) : delete globalThis.Worker,
  );
  const detector = createTextDetector();
  detector.prepare("/verified-pack");
  detector.prepare("/verified-pack");
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].sent, [{ type: "prepare", modelRoot: "/verified-pack" }]);
  const result = detector.detect("Synthetic", () => {}, "/verified-pack", ["name"]);
  assert.equal(workers.length, 1);
  const runId = workers[0].sent[1].runId;
  workers[0].onmessage({ data: { type: "result", runId, detections: [] } });
  assert.deepEqual(await result, []);
  detector.destroy();
  assert.ok(workers[0].terminated);
});
