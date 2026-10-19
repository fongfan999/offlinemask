import test from "node:test";
import assert from "node:assert/strict";
import { addManualMasks, unmaskedOccurrences } from "../src/core/manual-mask.ts";
import { occurrenceMarks, reviewDisplay } from "../src/core/review-marks.ts";
import { restoreAliases } from "../src/core/restore.ts";
import { analyzeText, maskedText } from "../src/core/text.ts";

const scope = "4aae";
const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});
const slice = (text, marks) => marks.map((mark) => text.slice(mark.start, mark.end));

test("masked display marks each alias; original display marks the values to hide", () => {
  const text = "Gọi 0901234567\r\nhoặc mail a@b.vn, gọi lại 0901234567.";
  const phone = text.indexOf("0901234567");
  const mail = text.indexOf("a@b.vn");
  const analysis = analyzeText(text, scope, [
    detection(phone, phone + 10, "SDT"),
    detection(mail, mail + 6, "EMAIL"),
  ]);
  const decisions = { SDT_1: "mask", EMAIL_1: "keep" };
  const masked = reviewDisplay(text, analysis, decisions, true);
  assert.equal(masked.text, maskedText(text, analysis, decisions).replace("\r\n", "\n"));
  assert.deepEqual(slice(masked.text, masked.marks), [`[SDT_1_${scope}]`, `[SDT_1_${scope}]`]);
  assert.ok(masked.marks.every((mark) => mark.kind === "alias"));
  const original = reviewDisplay(text, analysis, decisions, false);
  assert.equal(original.text, text.replace("\r\n", "\n"));
  assert.deepEqual(slice(original.text, original.marks), ["0901234567", "0901234567"]);
});

test("occurrence marks find every copy and skip ranges already marked", () => {
  const text = "An Bình gọi. An Bình [TEN_1_4aae] An Bình";
  const taken = [{ start: 21, end: 33, kind: "alias" }];
  const marks = occurrenceMarks(text, ["An Bình", "TEN"], "hint", taken);
  assert.deepEqual(slice(text, marks), ["An Bình", "An Bình", "An Bình"]);
});

test("one click hides every clear-text occurrence of a name under one alias", () => {
  const text = "Tôi là Minh Anh. Gửi Minh Anh, MinhAnh và Minh Anhh. 0901234567";
  const phone = text.indexOf("0901234567");
  const analysis = analyzeText(text, scope, [detection(phone, phone + 10, "SDT")]);
  const ranges = unmaskedOccurrences(text, analysis, "Minh Anh");
  assert.deepEqual(
    ranges.map((range) => text.slice(range.start, range.end)),
    ["Minh Anh", "Minh Anh"],
  );
  const update = addManualMasks(text, analysis, { SDT_1: "mask" }, scope, ranges, 0);
  assert.equal(update.manualMaskCount, 1);
  assert.equal(
    maskedText(text, update.analysis, update.decisions),
    `Tôi là [AN_THEM_1_${scope}]. Gửi [AN_THEM_1_${scope}], MinhAnh và Minh Anhh. [SDT_1_${scope}]`,
  );
  assert.throws(() => addManualMasks(text, analysis, {}, scope, [ranges[0], ranges[0]]));
});

test("restoration reports where each value came back", () => {
  const text = "Khách 0901234567";
  const analysis = analyzeText(text, scope, [detection(6, 16, "SDT")]);
  const result = restoreAliases(`Gọi [SDT_1_${scope}] rồi [SDT_1_${scope}].`, analysis);
  assert.equal(result.restored, 2);
  assert.deepEqual(slice(result.text, result.marks), ["0901234567", "0901234567"]);
});
