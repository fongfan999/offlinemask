import test from "node:test";
import assert from "node:assert/strict";
import { detectContactDetails } from "../src/core/detection/contact.ts";
import { createTextDetector } from "../src/adapters/text-detection.ts";

test("contact libraries detect complete emails and national/international phone formats", () => {
  const text = "Email: minh.anh+test@example.com.vn, điện thoại +84 901 234 567. Máy bàn: (028) 3822 1234. UK: +44 20 7946 0958.";
  assert.deepEqual(detectContactDetails(text).map(({ start, end }) => text.slice(start, end)), [
    "minh.anh+test@example.com.vn", "+84 901 234 567", "(028) 3822 1234", "+44 20 7946 0958",
  ]);
  assert.deepEqual(detectContactDetails("Ngày 09/09/2026: 2.500.000 đồng. STK 001234567890."), []);
});

test("cancellation and runtime failure reject without leaking source text and allow retry", async (context) => {
  const workers = [];
  class FakeWorker {
    terminated = false;
    constructor() { workers.push(this); }
    postMessage(value) { this.sent = value; }
    terminate() { this.terminated = true; }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { value: FakeWorker, configurable: true });
  context.after(() => previous ? Object.defineProperty(globalThis, "Worker", previous) : delete globalThis.Worker);
  const detector = createTextDetector();
  const cancelled = detector.detect("synthetic source", () => {});
  detector.destroy();
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.ok(workers[0].terminated);
  const failed = detector.detect("synthetic source", () => {});
  // A queued event from the terminated worker must not settle the newer request.
  workers[0].onmessage({ data: { type: "result", runId: workers[0].sent.runId, detections: ["stale"] } });
  workers[1].onerror({ message: "synthetic source", preventDefault() {} });
  await assert.rejects(failed, { message: "Local detector failed" });
  assert.ok(workers[1].terminated);
  const retry = detector.detect("synthetic source", () => {});
  workers[2].onmessage({ data: { type: "result", runId: workers[2].sent.runId, detections: [] } });
  assert.deepEqual(await retry, []);
  const warm = detector.detect("next source", () => {});
  assert.equal(workers.length, 3);
  workers[2].onmessage({ data: { type: "result", runId: workers[2].sent.runId, detections: [] } });
  await warm;
  detector.destroy();
});

const { createDetectionEngine } = await import('../src/core/detection/engine.ts');
const { filterDetections, requiresModels, localOptions } = await import('../src/core/detection/options.ts');
const { createTextSession, sessionOutput, encodeSessions } = await import('../src/core/sessions.ts');

test('local choices work without model files or network and preserve unchecked categories', async (context) => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network forbidden'); };
  context.after(() => { globalThis.fetch = savedFetch; });
  const text = 'Tôi là Nguyễn Minh Anh. Email: minh@example.com. SĐT 0901234567. CCCD: 079123456789. STK: 001234567890.';
  const detect = createDetectionEngine();
  const all = await detect({ text, options: localOptions }, () => assert.fail('No model should load'));
  assert.deepEqual(new Set(all.map(d => d.type)), new Set(['CCCD', 'STK', 'EMAIL', 'SDT']));
  const options = ['email'];
  const emails = await detect({ text, options }, () => assert.fail('No model should load'));
  const session = createTextSession(text, [], emails, options);
  options.push('name');
  assert.deepEqual(session.options, ['email']);
  const output = sessionOutput(session);
  assert.ok(!output.includes('minh@example.com'));
  for (const retained of ['Nguyễn Minh Anh', '0901234567', '079123456789', '001234567890']) assert.ok(output.includes(retained));
  assert.deepEqual(JSON.parse(encodeSessions([session])).sessions, []);
  assert.deepEqual(await detect({ text, options: [] }, () => {}), []);
  await assert.rejects(detect({ text, options: ['name'] }, () => {}), /Models required/);
});

test('category selection filters model and library evidence before transformation', () => {
  const values = ['TEN','DIA_CHI','EMAIL','SDT','CCCD','GIAY_TO','STK','GD','KH','NGAY_SINH','MAT_KHAU'].map(type => ({type}));
  assert.deepEqual(filterDetections(values, ['banking']).map(d => d.type), ['CCCD','GIAY_TO','STK','GD','KH']);
  assert.deepEqual(filterDetections(values, ['name','address']).map(d => d.type), ['TEN','DIA_CHI']);
  assert.deepEqual(filterDetections(values, ['other']).map(d => d.type), ['NGAY_SINH','MAT_KHAU']);
  assert.equal(requiresModels(localOptions), false);
  assert.equal(requiresModels(['email','address']), true);
});
