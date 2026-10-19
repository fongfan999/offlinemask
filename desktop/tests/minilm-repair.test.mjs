import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWithMap, originalSpan } from "../scripts/minilm-repair/normalize.mjs";

test("MiniLM prototype maps repeated decomposed names to their own original spans", () => {
  const text = "Nguyễn / Nguyễn";
  const { normalized, spans } = normalizeWithMap(text);
  assert.equal(normalized, "Nguyễn / Nguyễn");
  assert.deepEqual(originalSpan(spans, 0, 6), [0, 8]);
  assert.deepEqual(originalSpan(spans, 9, 15), [11, 19]);
  assert.equal(text.slice(...originalSpan(spans, 9, 15)), "Nguyễn");
});

test("MiniLM prototype covers whole graphemes and converts code points to UTF-16", () => {
  const { normalized, spans } = normalizeWithMap("🙂a\u0301 👩‍👩‍👧‍👦");
  assert.equal(normalized, "🙂á 👩‍👩‍👧‍👦");
  assert.deepEqual(originalSpan(spans, 0, 1), [0, 2]);
  assert.deepEqual(originalSpan(spans, 1, 2), [2, 4]);
  assert.deepEqual(originalSpan(spans, 3, 4), [5, 16]);
  assert.deepEqual(originalSpan(spans, 9, 10), [5, 16]);
});

test("MiniLM prototype refuses missing and invalid source positions", () => {
  const { spans } = normalizeWithMap("a");
  for (const [a, b] of [
    [-1, 1],
    [0, 0],
    [0, 2],
    [0.5, 1],
    [1, 0],
  ])
    assert.throws(() => originalSpan(spans, a, b), /Invalid/);
  assert.throws(() => originalSpan([], 0, 1), /Invalid/);
});
