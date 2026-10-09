import test from "node:test";
import assert from "node:assert/strict";
import { cachedWindows } from "../scripts/minilm-profile/windows.mjs";
import { modelChunks } from "../src/core/detection/chunks.ts";
const count = (text) => Math.ceil(text.length / 3) + 2;
test("cached planner preserves original windows and token contents", async () => {
  for (const text of [
    "",
    "short",
    "Nguyễn Minh An. ".repeat(400),
    "🙂a\u0301 ".repeat(350),
    "x".repeat(5000),
  ]) {
    const stats = { hits: 0, calls: 0, peak: 0 };
    const seen = new Map(),
      actual = [];
    const encode = async (text) => {
      seen.set(text, (seen.get(text) ?? 0) + 1);
      return { ids: Array.from({ length: count(text) }, (_, i) => i), text };
    };
    for await (const w of cachedWindows(text, encode, stats)) {
      assert.equal(w.encoding.text, w.text);
      actual.push({ start: w.start, text: w.text });
    }
    assert.deepEqual(actual, modelChunks(text, count));
    assert.ok(stats.peak <= 16);
    if (text === "short") assert.equal(stats.calls, 1);
  }
});
test("cached encodings are discarded between documents and on early stop", async () => {
  let calls = 0;
  const encode = async (text) => {
    calls++;
    return { ids: [0, 2], text };
  };
  for (let run = 0; run < 2; run++) {
    for await (const w of cachedWindows("a ".repeat(900), encode, { hits: 0, calls: 0, peak: 0 })) {
      assert.ok(w.text);
      break;
    }
  }
  assert.equal(calls, 4);
});
