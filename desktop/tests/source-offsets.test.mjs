import test from "node:test";
import assert from "node:assert/strict";
import { alignSourceTokens } from "../src/core/detection/source-offsets.ts";
const tokens = (words) => words.map((word, i) => ({ word, index: i + 1, entity: "O", score: 1 }));

test("exact offsets include decomposed accents, emoji, literal special tokens and CRLF", () => {
  const text = "😀 Nguyễn\r\n[CLS] An";
  const aligned = alignSourceTokens(text, tokens(["▁😀", "▁N", "guy", "ễ", "n", "[CLS]", "▁An"]));
  assert.deepEqual(
    aligned.map((t) => text.slice(t.start, t.end)),
    ["😀", "N", "guy", "ễ", "n", "[CLS]", "An"],
  );
  assert.equal(aligned.at(-1).end, text.length);
});

test("alignment never jumps past an unaccounted word or folds accents/case", () => {
  for (const [text, words] of [
    ["An An", ["▁An"]],
    ["X An", ["▁An"]],
    ["An", ["▁an"]],
    ["Án", ["▁An"]],
    ["An Bí", ["▁An", "▁Bi"]],
  ])
    assert.throws(() => alignSourceTokens(text, tokens(words)));
});

test("literal metaspace and unknown Unicode source pieces are retained", () => {
  const text = "An ▁ 👨‍👩‍👧‍👦 Ａ";
  const aligned = alignSourceTokens(
    text,
    tokens(["▁An", "▁", "▁", "▁", "👨", "‍", "👩", "‍", "👧", "‍", "👦", "▁", "Ａ"]),
  );
  assert.ok(aligned.some((t) => text.slice(t.start, t.end) === "▁"));
  assert.equal(aligned.at(-1).end, text.length);
  assert.ok(aligned.every((t) => t.start >= 0 && t.end > t.start && t.end <= text.length));
});

test("single nonbreaking spaces remain literal tokens after synthetic metaspace prefixes", () => {
  const text = "[CLS]\u00a0An\u00a0Bình";
  const aligned = alignSourceTokens(text, tokens(["[CLS]", "▁", "\u00a0", "An", "\u00a0", "Bình"]));
  assert.deepEqual(
    aligned.map((t) => text.slice(t.start, t.end)),
    ["[CLS]", "\u00a0", "An", "\u00a0", "Bình"],
  );
});
