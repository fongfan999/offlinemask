import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocument, totalsOf } from "../scripts/document-evaluation.mjs";

/** A read document with the ranges masked in each paragraph. */
const run = (texts, ranges) => ({
  opened: { paragraphs: texts.map((text, id) => ({ id, text })) },
  edits: { paragraphs: new Map(Object.entries(ranges).map(([id, r]) => [Number(id), r])) },
});

test("each expectation lands in its bucket: not read, leaked, over-masked, unlisted", () => {
  const texts = [
    "Họ tên: Nguyễn Văn An · Chức vụ: Giám đốc",
    "Gọi cho bà Trang theo số 0901234567",
  ];
  const at = (line, value) => {
    const start = texts[line].indexOf(value);
    return { start, end: start + value.length };
  };
  const result = evaluateDocument(
    run(texts, {
      0: [at(0, "Nguyễn Văn An"), at(0, "Giám đốc")],
      1: [at(1, "0901234567")],
    }),
    {
      hide: ["Nguyễn Văn An", "0901234567", { value: "Trang", in: "bà Trang" }, "Lê Thị B"],
      keep: ["Giám đốc", "Họ tên"],
      ignore: [],
    },
  );
  assert.deepEqual(result.leaked, ["Trang"]);
  assert.deepEqual(result.notRead, ["Lê Thị B"]);
  assert.deepEqual(result.over, ["Giám đốc"]);
  assert.deepEqual(result.unlisted, []);
  assert.deepEqual(result.masked, ["Nguyễn Văn An", "Giám đốc", "0901234567"]);
  // A masked value in no list is unlisted; a value split by a line break is still read.
  const loose = evaluateDocument(run(["Nguyễn\nVăn An ký"], { 0: [{ start: 14, end: 16 }] }), {
    hide: ["Nguyễn Văn An"],
  });
  assert.deepEqual(loose.notRead, []);
  assert.deepEqual(loose.leaked, []);
  assert.deepEqual(loose.unlisted, ["ký"]);
  assert.deepEqual(totalsOf({ a: result, b: loose, c: { error: "password" } }), {
    documents: 2,
    notRead: 1,
    leaked: 1,
    over: 1,
    unlisted: 1,
  });
});
