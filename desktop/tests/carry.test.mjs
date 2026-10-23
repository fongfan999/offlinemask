import test from "node:test";
import assert from "node:assert/strict";
import { carryDetections } from "../src/core/detection/carry.ts";

const span = (text, value, type = "TEN") => {
  const start = text.indexOf(value);
  return {
    start,
    end: start + value.length,
    type,
    label: type,
    source: "t",
    reason: "t",
    priority: 1,
  };
};

test("detections move onto the same text with other whitespace", () => {
  const from = "Kính gửi,Tôi là Nguyễn Minh Anh";
  const to = "Kính gửi,\n\nTôi là Nguyễn  Minh Anh\n";
  const [carried] = carryDetections([span(from, "Nguyễn Minh Anh")], from, to);
  // The span keeps its characters; inner whitespace comes from the new text.
  assert.equal(to.slice(carried.start, carried.end), "Nguyễn  Minh Anh");
  assert.deepEqual(carryDetections([], from, from), []);
});

test("text that differs in anything but whitespace carries nothing", () => {
  const from = "Số 0901234567";
  assert.equal(carryDetections([span(from, "0901234567", "SDT")], from, "Số 0901234568"), null);
  assert.equal(carryDetections([], from, from + from), null);
});
