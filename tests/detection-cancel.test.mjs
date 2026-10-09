import test from "node:test";
import assert from "node:assert/strict";
import { createTextDetector } from "../src/adapters/text-detection.ts";
import { createModelRunner } from "../src/core/detection/model-runner.ts";

function setup(context) {
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
    emit(message) {
      this.onmessage({ data: message });
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { value: Worker, configurable: true });
  context.after(() =>
    previous ? Object.defineProperty(globalThis, "Worker", previous) : delete globalThis.Worker,
  );
  const detector = createTextDetector();
  context.after(() => detector.destroy());
  return { workers, detector };
}

test("cancelled results cannot become the queued retry; acknowledgement reuses warm worker", async (context) => {
  const { workers, detector } = setup(context);
  const first = detector.detect("synthetic cancelled", () => {});
  const worker = workers[0],
    id = worker.sent[0].runId;
  worker.emit({
    type: "progress",
    runId: id,
    progress: { stage: "processing", completed: 1, total: 10 },
  });
  detector.cancel(true);
  await assert.rejects(first, { name: "AbortError" });
  const retry = detector.detect("synthetic retry", () => {});
  assert.equal(worker.sent.length, 2); // detect, cancel; retry waits for old inference to drain
  worker.emit({ type: "cancelled", runId: id });
  assert.equal(workers.length, 1);
  assert.equal(worker.sent.length, 3);
  worker.emit({ type: "result", runId: id, detections: ["stale"] });
  worker.emit({ type: "result", runId: worker.sent[2].runId, detections: [] });
  assert.deepEqual(await retry, []);
  assert.equal(worker.terminated, false);
});

test("cancelling during loading releases sessions before retry; cancelling queued retry removes its input", async (context) => {
  const { workers, detector } = setup(context);
  const cold = detector.detect("synthetic cold", () => {});
  detector.cancel(true);
  await assert.rejects(cold, { name: "AbortError" });
  assert.equal(workers[0].terminated, false);
  workers[0].emit({ type: "reset", runId: workers[0].sent.at(-1).runId });
  const first = detector.detect("synthetic first", () => {});
  const worker = workers[0],
    id = worker.sent.at(-1).runId;
  worker.emit({
    type: "progress",
    runId: id,
    progress: { stage: "processing", completed: 1, total: 2 },
  });
  detector.cancel(true);
  await assert.rejects(first);
  const queued = detector.detect("synthetic queued", () => {});
  detector.cancel(true);
  await assert.rejects(queued);
  worker.emit({ type: "cancelled", runId: id });
  assert.equal(worker.sent.length, 4);
});

test("unresponsive cancellation has a bounded hard-reset fallback and retries on a new worker", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { workers, detector } = setup(context);
  const first = detector.detect("synthetic first", () => {});
  workers[0].emit({
    type: "progress",
    runId: workers[0].sent[0].runId,
    progress: { stage: "processing", completed: 1, total: 2 },
  });
  detector.cancel(true);
  await assert.rejects(first);
  const retry = detector.detect("synthetic retry", () => {});
  context.mock.timers.tick(5000);
  assert.ok(workers[0].terminated);
  assert.equal(workers.length, 2);
  workers[1].emit({ type: "result", runId: workers[1].sent[0].runId, detections: [] });
  assert.deepEqual(await retry, []);
});

test("abort discards in-flight predictions, stops further chunks, and leaves provider reusable", async () => {
  const controller = new AbortController();
  let calls = 0;
  const provider = {
    source: "Synthetic",
    align: (_text, tokens) => tokens,
    tokenCount: (text) => text.length,
    dispose: async () => {},
    predict: async () => {
      calls++;
      controller.abort();
      return [];
    },
  };
  const runner = createModelRunner([provider]);
  await assert.rejects(
    runner.inspect(
      "Synthetic content. ".repeat(100),
      () => assert.fail("No stale progress"),
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  provider.predict = async () => {
    calls++;
    return [];
  };
  await runner.inspect("No private values.");
  assert.equal(calls, 2);
});

test("worker failure while draining releases the queued retry into a fresh runtime", async (context) => {
  const { workers, detector } = setup(context);
  const first = detector.detect("synthetic first", () => {});
  const old = workers[0];
  old.emit({
    type: "progress",
    runId: old.sent[0].runId,
    progress: { stage: "processing", completed: 1, total: 2 },
  });
  detector.cancel(true);
  await assert.rejects(first);
  const retry = detector.detect("synthetic retry", () => {});
  old.onerror({ preventDefault() {} });
  assert.ok(old.terminated);
  assert.equal(workers.length, 2);
  old.emit({ type: "result", runId: old.sent[0].runId, detections: ["stale"] });
  workers[1].emit({ type: "result", runId: workers[1].sent[0].runId, detections: [] });
  assert.deepEqual(await retry, []);
});
