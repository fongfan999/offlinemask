import test from "node:test";
import assert from "node:assert/strict";
import {
  detectStructuredValues,
  reconcileStructuredValues,
} from "../src/core/detection/structured-values.ts";
import {
  detectLabelledFields,
  reconcileLabelledFields,
} from "../src/core/detection/labelled-fields.ts";
import { filterDetections } from "../src/core/detection/options.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
import { analyzeText } from "../src/core/text.ts";
const entries = (text) =>
  detectStructuredValues(text).detections.map((d) => [d.type, text.slice(d.start, d.end)]);
const model = (start, end, type = "EMAIL") => ({
  start,
  end,
  type,
  label: type,
  priority: 50,
  source: "synthetic model",
  reason: "test",
});

test("opaque credentials preserve internal punctuation, escaped quotes, spaces, and literal labels", () => {
  assert.deepEqual(
    entries("Tên đăng nhập: demo.user_48; Mật khẩu tạm thời: Demo!48#x; API key = sk_test/48+=x"),
    [
      ["NGUOI_DUNG", "demo.user_48"],
      ["MAT_KHAU", "Demo!48#x"],
      ["KHOA", "sk_test/48+=x"],
    ],
  );
  const value = "space ! ; email: unit@example.org, Họ tên: Lê An.";
  assert.deepEqual(entries("Mật khẩu: “" + value + "”; STK: 001234567890"), [
    ["MAT_KHAU", value],
    ["STK", "001234567890"],
  ]);
  const escaped = 'a\\"b';
  assert.deepEqual(entries('password: "' + escaped + '"'), [["MAT_KHAU", escaped]]);
  assert.deepEqual(entries("Mật khẩu: 'null'; API key: `a;b,c.d!`"), [
    ["MAT_KHAU", "null"],
    ["KHOA", "a;b,c.d!"],
  ]);
  assert.deepEqual(entries("Mật khẩu: final.dot."), [["MAT_KHAU", "final.dot."]]); // ambiguous sentence punctuation is conservatively retained in the mask
});

test("malformed or excessive credentials are never silently truncated; placeholders and prose stay visible", () => {
  for (const text of [
    'Mật khẩu: "unterminated',
    'password: "line\nbreak"',
    "API key: " + "x".repeat(1025),
    "Tên đăng nhập: chưa cung cấp.",
    "Mật khẩu: đang cập nhật",
    "API key: N/A",
    "Mật khẩu: vui lòng liên hệ hỗ trợ.",
    "Mật khẩu của tôi chưa được cấp.",
    "HƯỚNG DẪN THAY ĐỔI MẬT KHẨU",
    'password: ""',
  ])
    assert.deepEqual(entries(text), [], text.slice(0, 80));
  assert.deepEqual(entries("API key: " + "x".repeat(1024)), [["KHOA", "x".repeat(1024)]]);
});

test("numeric identifiers keep leading zeros and reject long, partial and alphanumeric numbers", () => {
  assert.deepEqual(
    entries("STK nhận: 0012 3456 7890; Tài khoản thụ hưởng 004455667788; mã bưu chính 012345."),
    [
      ["STK", "0012 3456 7890"],
      ["STK", "004455667788"],
      ["DIA_CHI", "012345"],
    ],
  );
  for (const text of [
    "STK: 12345",
    "STK: 123456789012345678901",
    "STK: 123456abc",
    "mã bưu chính: 1234567",
    "Mã bưu chính: 12345A",
  ])
    assert.deepEqual(entries(text), [], text);
  assert.deepEqual(entries("Số tiền: 001234567890 đồng; Ngày giao dịch: 15/09/2026"), []);
});

test("decomposed Vietnamese labels and emoji preserve exact source offsets", () => {
  const text = "😀 Mật khẩu: “thử ! 49”; Mã bưu chính: 00123";
  const fields = detectStructuredValues(text);
  assert.deepEqual(entries(text), [
    ["MAT_KHAU", "thử ! 49"],
    ["DIA_CHI", "00123"],
  ]);
  assert.equal(fields.detections[0].start, text.indexOf("thử"));
});

test("structured meaning wins before category selection, including valid-looking emails inside passwords", () => {
  const text = 'Mật khẩu: "unit@example.org"; Username: sample_48; Mã bưu chính: 00123.';
  const raw = [
    model(text.indexOf("unit@"), text.indexOf('";')),
    model(text.indexOf("sample"), text.indexOf("; Mã")),
    model(text.indexOf("00123"), text.indexOf("00123") + 5, "TEN"),
  ];
  const reconciled = reconcileStructuredValues(text, raw);
  assert.deepEqual(filterDetections(reconciled, ["email"]), []);
  assert.deepEqual(filterDetections(reconciled, ["name"]), []);
  assert.deepEqual(
    filterDetections(reconciled, ["other"]).map((d) => text.slice(d.start, d.end)),
    ["unit@example.org", "sample_48"],
  );
  assert.deepEqual(
    filterDetections(reconciled, ["address"]).map((d) => text.slice(d.start, d.end)),
    ["00123"],
  );
  const nested = 'Password: "abc Họ tên: Lê An; API key: xyz"';
  const named = reconcileLabelledFields(nested, [], detectLabelledFields(nested));
  assert.deepEqual(
    reconcileStructuredValues(nested, named).map((d) => d.type),
    ["MAT_KHAU"],
  );
});

test("only explicit valid transaction facts suppress conflicting model guesses; birthdays and outside evidence remain", () => {
  const text = "Ngày giao dịch: 29/02/2024; Số tiền: 1.250.000 đồng; Ngày sinh: 12/08/1989. Lê An";
  const at = (value) => text.indexOf(value);
  const raw = [
    model(at("29/02"), at("29/02") + 10, "NGAY_SINH"),
    model(at("1.250"), at("1.250") + 9, "STK"),
    model(at("12/08"), at("12/08") + 10, "NGAY_SINH"),
    model(at("Lê An"), text.length, "TEN"),
  ];
  const result = reconcileStructuredValues(text, raw);
  assert.deepEqual(
    result.map((d) => text.slice(d.start, d.end)),
    ["12/08/1989", "Lê An"],
  );
  const invalid = "Ngày giao dịch: 29/02/2023";
  assert.equal(reconcileStructuredValues(invalid, [model(16, 26, "NGAY_SINH")]).length, 1);
});

test("local-only routing masks role-labelled accounts offline and does not treat a password as a contact", async (context) => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => assert.fail("No network");
  context.after(() => (globalThis.fetch = previous));
  const text = "STK nhận: 001122334455; Mật khẩu: unit@example.org";
  const detect = createDetectionEngine();
  const detections = await detect({ text, options: ["email", "banking"] }, () =>
    assert.fail("No model load"),
  );
  assert.deepEqual(
    analyzeText(text, "12345678", detections).findings.map((f) => f.value),
    ["001122334455"],
  );
  await assert.rejects(
    detect({ text, options: ["other"] }, () => {}),
    /Models required/,
  );
});

test("a tax code may be a 12-digit CCCD, after labels that say so", () => {
  assert.deepEqual(entries("Mã số thuế (CCCD): 031096007594"), [["GIAY_TO", "031096007594"]]);
  assert.deepEqual(entries("MST/CCCD chủ hộ: 0315638910"), [["GIAY_TO", "0315638910"]]);
  assert.deepEqual(entries("MST / CCCD: 001203004567"), [["GIAY_TO", "001203004567"]]);
  assert.deepEqual(entries("Mã số thuế: 0104918404-001"), [["GIAY_TO", "0104918404-001"]]);
  assert.deepEqual(entries("Mã số thuế: 12345"), []);
});
