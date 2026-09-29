import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetectionEngine } from '../src/core/detection/engine.ts';
import { createTextDetector } from '../src/adapters/text-detection.ts';
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('dispose completes before replacement sessions load, even during preparation', async () => {
  const loading = deferred(), disposal = deferred(); let loads = 0, disposes = 0;
  const engine = createDetectionEngine(undefined, async () => {
    loads++;
    return loads === 1 ? loading.promise : { detect: async () => [], dispose: async () => {} };
  });
  const preparation = engine.prepare('/pack');
  const released = engine.dispose();
  const next = engine.prepare('/pack');
  assert.equal(loads, 1);
  loading.resolve({ dispose: async () => { disposes++; await disposal.promise; } });
  await preparation; await Promise.resolve();
  assert.equal(disposes, 1); assert.equal(loads, 1);
  disposal.resolve(); await Promise.all([released, next]);
  assert.equal(loads, 2); await engine.dispose();
});

test('reset acknowledgement gates reload, reuses worker, and ignores superseded run responses', async context => {
  const workers = [];
  class Worker {
    sent = []; terminated = false;
    constructor() { workers.push(this); }
    postMessage(value) { this.sent.push(value); }
    terminate() { this.terminated = true; }
    emit(value) { this.onmessage({ data: value }); }
  }
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { value: Worker, configurable: true });
  context.after(() => prior ? Object.defineProperty(globalThis, 'Worker', prior) : delete globalThis.Worker);
  const detector = createTextDetector(); context.after(() => detector.destroy());
  const first = detector.detect('Synthetic cancelled', () => {});
  const worker = workers[0], firstId = worker.sent[0].runId;
  detector.cancel(); await assert.rejects(first, { name: 'AbortError' });
  const resetId = worker.sent.at(-1).runId;
  const next = detector.detect('Synthetic next', () => {});
  assert.equal(worker.sent.length, 2);
  worker.emit({ type: 'cancelled', runId: firstId });
  assert.equal(worker.sent.length, 2);
  worker.emit({ type: 'reset', runId: resetId });
  assert.equal(workers.length, 1); assert.equal(worker.sent.length, 3);
  worker.emit({ type: 'result', runId: worker.sent.at(-1).runId, detections: [] });
  assert.deepEqual(await next, []);
  assert.equal(worker.terminated, false);
});

test('session release timeout terminates an unresponsive worker before a queued retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const workers = [];
  class Worker {
    sent = []; terminated = false;
    constructor() { workers.push(this); }
    postMessage(value) { this.sent.push(value); }
    terminate() { this.terminated = true; }
  }
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { value: Worker, configurable: true });
  context.after(() => prior ? Object.defineProperty(globalThis, 'Worker', prior) : delete globalThis.Worker);
  const detector = createTextDetector(); context.after(() => detector.destroy());
  detector.prepare('/pack'); detector.cancel();
  const retry = detector.detect('Synthetic retry', () => {});
  context.mock.timers.tick(29999); assert.equal(workers.length, 1);
  context.mock.timers.tick(1); assert.ok(workers[0].terminated); assert.equal(workers.length, 2);
  workers[1].onmessage({ data: { type: 'result', runId: workers[1].sent[0].runId, detections: [] } });
  assert.deepEqual(await retry, []);
});
