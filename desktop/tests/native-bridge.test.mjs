import test from "node:test";
import assert from "node:assert/strict";
import { createTextDetector } from "../src/adapters/text-detection.ts";

test("native preparation replies reach an idle worker; destroyed worker replies are discarded", async (context) => {
  const workers = [],
    calls = [];
  class Worker {
    sent = [];
    constructor() {
      workers.push(this);
    }
    postMessage(value) {
      this.sent.push(value);
    }
    terminate() {}
    emit(data) {
      this.onmessage({ data });
    }
  }
  const prior = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { value: Worker, configurable: true });
  context.after(() =>
    prior ? Object.defineProperty(globalThis, "Worker", prior) : delete globalThis.Worker,
  );
  const detector = createTextDetector(
    (command, args) =>
      new Promise((resolve, reject) => calls.push({ command, args, resolve, reject })),
  );
  context.after(() => detector.destroy());
  detector.prepare("/verified-pack");
  const first = workers[0];
  first.emit({ type: "native", runId: 0, id: 1, request: { operation: "load" } });
  assert.equal(calls[0].command, "recognition_native_load");
  calls[0].resolve({ epoch: 1, labels: [] });
  await Promise.resolve();
  assert.deepEqual(first.sent.at(-1), {
    type: "native-result",
    id: 1,
    result: { epoch: 1, labels: [] },
  });
  first.emit({
    type: "native",
    runId: 0,
    id: 2,
    request: { operation: "run", epoch: 1, model: 0, ids: [1, 2] },
  });
  assert.deepEqual(calls[1].args, { epoch: 1, model: 0, ids: [1, 2] });
  const sent = first.sent.length;
  detector.destroy();
  detector.prepare("/verified-pack");
  calls[1].resolve({ dims: [], data: [] });
  await Promise.resolve();
  assert.equal(first.sent.length, sent);
  assert.equal(workers[1].sent.length, 1);
  workers[1].emit({ type: "native", runId: 0, id: 1, request: { operation: "load" } });
  calls[2].reject(new Error("PRIVATE provider detail"));
  await Promise.resolve();
  assert.deepEqual(workers[1].sent.at(-1), { type: "native-result", id: 1, error: true });
});
