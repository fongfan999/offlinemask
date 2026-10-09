import test from "node:test";
import assert from "node:assert/strict";
import {
  detectContextFields,
  reconcileContextFields,
} from "../src/core/detection/context-fields.ts";
import { applyDetectionPolicy } from "../src/core/detection/policy.ts";
import { filterDetections } from "../src/core/detection/options.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
const seed = (text, value, type = "TO_CHUC") => ({
  start: text.indexOf(value),
  end: text.indexOf(value) + value.length,
  type,
  label: type,
  priority: 50,
  source: "Synthetic",
  reason: "Test",
});
const entries = (text, seeds = []) =>
  detectContextFields(text, seeds).detections.map((d) => [d.type, text.slice(d.start, d.end)]);

test("IPv6 parser retains compressed, mapped, full and scoped source values without a network", (context) => {
  const old = globalThis.fetch;
  globalThis.fetch = () => assert.fail("Network forbidden");
  context.after(() => (globalThis.fetch = old));
  for (const value of [
    "2001:db8:72::5",
    "2001:0DB8:0000:0000:0000:0000:0000:0012",
    "::ffff:192.0.2.48",
    "fe80::72%en0",
    "::1",
  ]) {
    for (const text of [`📎 IP: ${value}.`, `IPv6:${value}`, `[${value}]:8443`])
      assert.deepEqual(entries(text), [["IP", value]], text);
  }
  assert.deepEqual(entries("IP: ::"), [["IP", "::"]]);
});
test("IPv6 candidates reject malformed whole tokens, CIDRs and version/time lookalikes", () => {
  for (const text of [
    "::",
    "12:30:45",
    "version 1.4.2",
    "2001:::7",
    "2001:db8::g7",
    "z2001:db8::1",
    "2001:db8::1oops",
    "2001:db8::1..",
    "2001:db8::1/64",
    "::ffff:999.0.0.1",
  ])
    assert.deepEqual(entries(text), [], text);
});
test("birth-date context accepts valid written and numeric dates with exact NFD offsets", () => {
  for (const value of ["ngày 29 tháng 2 năm 2000", "29/2/2000"])
    for (const intro of ["Ngày sinh: ", "Ngày sinh của khách được ghi là ", "Sinh ngày "]) {
      const text = ("😀 " + intro + value + ". Ngày hẹn: 18/09/2026.").normalize("NFD");
      assert.deepEqual(entries(text), [["NGAY_SINH", value.normalize("NFD")]]);
      const d = detectContextFields(text).detections[0];
      assert.equal(d.start, text.indexOf(value.normalize("NFD")));
    }
  for (const text of [
    "Ngày sinh: ngày 29 tháng 2 năm 2001",
    "Ngày sinh: 31/4/1998",
    "Ngày sinh chưa rõ, ngày hẹn: 12/09/2026.",
    "Ngày sinh\nNgày giao dịch: 12/09/2026",
    "Ngày giao dịch: ngày 12 tháng 9 năm 2026",
    "ngày 12 tháng 9 năm 2026",
  ])
    assert.deepEqual(entries(text), [], text);
});
test("valid operational fields suppress model guesses without treating all dates or numbers as public", () => {
  const text =
    "Ngày hẹn trả kết quả là 18/09/2026. Mã HTTP 404. Phiên bản phần mềm: 2.7.4. Số hồ sơ đã xử lý: 27.";
  const guesses = ["18/09/2026", "404", "2.7.4", "27"].map((v) => seed(text, v, "NGAY_SINH"));
  assert.deepEqual(reconcileContextFields(text, guesses), []);
  for (const text of [
    "Ngày hẹn: 31/02/2026",
    "HTTP status 999",
    "Version 1.2.3.4.5",
    "Version 2.7.4-private",
  ]) {
    const d = seed(text, text.slice(text.indexOf(" ") + 1), "MAT_KHAU");
    assert.deepEqual(reconcileContextFields(text, [d]), [d], text);
  }
  const bare = "Ngày 18/09/2026";
  assert.equal(reconcileContextFields(bare, [seed(bare, "18/09/2026", "NGAY_SINH")]).length, 1);
});
test("organization boundaries keep a legal prefix and lowercase business connectors", () => {
  for (const name of [
    "Công ty TNHH Trà Mộc Sơn",
    "Hợp tác xã Nông sản Mây Hồng",
    "Hop tac xa Nong san May Hong",
  ]) {
    const text = `Chi trả cho ${name}. Tổng số chứng từ: 27.`;
    const last = name.split(" ").slice(-2).join(" ");
    assert.deepEqual(entries(text, [seed(text, last, "TEN")]), [["TO_CHUC", name]]);
    const labelled = `Đơn vị: ${name}\nSố tiền: 1.200.000 đồng.`;
    assert.deepEqual(entries(labelled), [["TO_CHUC", name]]);
  }
  const name = "Công ty Cổ phần Dịch vụ Bình An".normalize("NFD");
  assert.deepEqual(entries("Tên doanh nghiệp: " + name), [["TO_CHUC", name]]);
});
test("organization completion requires a bounded name and context and never consumes following prose", () => {
  for (const text of [
    "Công ty đã thông báo kết quả.",
    "Hợp tác xã phải bổ sung hồ sơ.",
    "Đơn vị: chưa cung cấp",
    "Đơn vị: Công ty đang chờ",
    "Công ty Thử Nghiệm",
  ])
    assert.deepEqual(entries(text), [], text);
  const text = "Hợp tác xã Nông sản Mây Hồng đề nghị kiểm tra tài khoản.";
  assert.deepEqual(entries(text, [seed(text, "Mây Hồng")]), [
    ["TO_CHUC", "Hợp tác xã Nông sản Mây Hồng"],
  ]);
  const long = "Đơn vị: Công ty " + Array.from({ length: 15 }, (_, i) => `Tên${i}`).join(" ");
  assert.deepEqual(entries(long), []);
});
test("opaque credentials retain precedence over dates, IPs, organization labels and operational facts", () => {
  const value = "Ngày sinh: 12/8/1991; IP: 2001:db8::9; Đơn vị: Công ty Mây Hồng; Mã HTTP 404";
  const text = `Mật khẩu: "${value}"`;
  const result = applyDetectionPolicy(text, [seed(text, "Mây Hồng", "TEN")]).complete;
  assert.deepEqual(
    result.map((d) => [d.type, text.slice(d.start, d.end)]),
    [["MAT_KHAU", value]],
  );
});
test("contextual additions remain other and do not load a model for local-only choices", async () => {
  const text = "IP: 2001:db8::9; Ngày sinh: ngày 4 tháng 6 năm 1984";
  const corrected = applyDetectionPolicy(text, [
    seed(text, "2001", "TEN"),
    seed(text, "1984", "STK"),
  ]).complete;
  assert.equal(filterDetections(corrected, ["other"]).length, 2);
  assert.deepEqual(filterDetections(corrected, ["name", "banking", "phone", "email"]), []);
  const detect = createDetectionEngine();
  await assert.rejects(
    detect({ text, options: ["other"] }, () => {}),
    /Models required/,
  );
  assert.deepEqual(
    await detect({ text, options: ["email"] }, () => assert.fail("Model loaded")),
    [],
  );
});
