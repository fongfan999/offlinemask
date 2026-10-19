import test from "node:test";
import assert from "node:assert/strict";
import {
  detectStructuredValues,
  reconcileStructuredValues,
} from "../src/core/detection/structured-values.ts";
import { filterDetections } from "../src/core/detection/options.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
import { completeAddressBoundaries } from "../src/core/detection/address-boundaries.ts";
import { analyzeText } from "../src/core/text.ts";
const entries = (text) =>
  detectStructuredValues(text).detections.map((d) => [d.type, text.slice(d.start, d.end)]);
const model = (text, value, type = "SDT") => ({
  start: text.indexOf(value),
  end: text.indexOf(value) + value.length,
  type,
  label: type,
  priority: 50,
  source: "Synthetic",
  reason: "Test",
});

test("prose credentials keep complete punctuation and meaning before category selection", () => {
  for (const text of [
    "Đã ghi tên đăng nhập demo_692, mật khẩu Test!9kA# và API key trial/54+7=code.",
    "Đã ghi tên đăng nhập là demo_692, mật khẩu là Test!9kA# và API key là trial/54+7=code.",
    "Username is demo_692, password is Test!9kA# and API key is trial/54+7=code.",
  ])
    assert.deepEqual(entries(text), [
      ["NGUOI_DUNG", "demo_692"],
      ["MAT_KHAU", "Test!9kA#"],
      ["KHOA", "trial/54+7=code."],
    ]);
  const text = "Khách đã dán mật khẩu hello@example.net vào lời nhắn.";
  const corrected = reconcileStructuredValues(text, [model(text, "hello@example.net", "EMAIL")]);
  assert.deepEqual(filterDetections(corrected, ["email"]), []);
  assert.deepEqual(
    filterDetections(corrected, ["other"]).map((d) => text.slice(d.start, d.end)),
    ["hello@example.net"],
  );
  assert.deepEqual(entries("Mật khẩu “only letters and spaces” không được chia sẻ."), [
    ["MAT_KHAU", "only letters and spaces"],
  ]);
  assert.deepEqual(entries("Mật khẩu 5829 đã bị lộ."), [["MAT_KHAU", "5829"]]);
});

test("credential prose ignores ordinary instructions, missing values and unrelated next lines", () => {
  for (const text of [
    "Mật khẩu phải chứa 12 ký tự.",
    "Mật khẩu 1234 ký tự không được hỗ trợ.",
    "Tên đăng nhập không được chứa khoảng trắng.",
    "API key chưa được cấp.",
    "Password is required.",
    "Mật khẩu là bắt buộc.",
    "Tên đăng nhập đang để trống.",
    "Mật khẩu của tôi chưa được cấp.",
    "API key cho yêu cầu này sẽ được cấp sau.",
    "Mật khẩu\nDemo!72",
    "Mật khẩu “chưa đóng",
    "Mật khẩu “nhiều\ndòng”",
    "API key " + "x".repeat(1025),
  ])
    assert.deepEqual(entries(text), [], text.slice(0, 100));
});

test("credential source offsets survive decomposed copulas, emoji and quoted nested labels", () => {
  const text = "📎 Mật khẩu là “text; API key: inside”; Tên đăng nhập là demo_718".normalize("NFD");
  const result = detectStructuredValues(text).detections;
  assert.deepEqual(
    result.map((d) => text.slice(d.start, d.end)),
    ["text; API key: inside", "demo_718"],
  );
  assert.equal(result[0].start, text.indexOf("text;"));
  assert.equal(result[1].start, text.indexOf("demo_718"));
});

test("explicit passport and tax labels take priority over phone or fragmented model evidence", async (context) => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => assert.fail("No network");
  context.after(() => (globalThis.fetch = previous));
  for (const source of [
    "Hộ chiếu số: AB7182649; Mã số thuế: 0319264857-002",
    "Passport number AB7182649; Tax ID 0319264857002",
    "Hộ chiếu AB7182649; MST 0319264857-002".normalize("NFD"),
  ]) {
    const values = entries(source);
    assert.equal(values.length, 2);
    assert.ok(values.every(([t]) => t === "GIAY_TO"));
    const detect = createDetectionEngine();
    assert.deepEqual(
      await detect({ text: source, options: ["phone"] }, () => assert.fail("No model loading")),
      [],
    );
    const ds = await detect({ text: source, options: ["banking"] }, () =>
      assert.fail("No model loading"),
    );
    assert.deepEqual(
      ds.map((d) => source.slice(d.start, d.end)),
      values.map(([, v]) => v),
    );
  }
  const text = "Mã số thuế 0319264857; Điện thoại 0938 765 421";
  const corrected = reconcileStructuredValues(text, [
    model(text, "0319264857"),
    model(text, "0938 765 421"),
  ]);
  assert.deepEqual(
    filterDetections(corrected, ["phone"]).map((d) => text.slice(d.start, d.end)),
    ["0938 765 421"],
  );
  assert.deepEqual(
    filterDetections(corrected, ["banking"]).map((d) => text.slice(d.start, d.end)),
    ["0319264857"],
  );
});

test("bounded identifier recognition rejects partial codes and leaves amounts and generic labels untouched", () => {
  for (const text of [
    "Hộ chiếu: chưa cung cấp",
    "MST: đang cập nhật",
    "Mã số thuế: 123456789",
    "Mã số thuế: 123456789012",
    "Mã số thuế: 12345678901234",
    "Mã số thuế: 0319264857-1234",
    "MST 0319264857A",
    "MST 0319264857 4",
    "Hộ chiếu A12345",
    "Hộ chiếu AB123456789",
    "Hộ chiếu A1234567-X",
    "Hộ chiếu AB7182649A",
    "Số tiền 0319264857 đồng",
    "passport policy requires review",
  ])
    assert.deepEqual(entries(text), [], text);
});

test("street type between house number and name stays inside a bounded address", () => {
  for (const street of ["57/2 đường Hoàng Sa", "16A phố Trúc Bạch", "81 đại lộ Thăng Long"]) {
    const text = `Nhận thư tại ${street}, Hà Nội. Phí giao: 25.000 đồng.`;
    const detections = completeAddressBoundaries(text, [
      model(text, street.split(" ").slice(-2).join(" "), "DIA_CHI"),
      model(text, "Hà Nội", "DIA_CHI"),
    ]);
    const result = analyzeText(text, "12345678", detections);
    assert.equal(result.findings[0].value, street + ", Hà Nội");
    assert.ok(result.spans.every((s) => s.end <= text.indexOf(". Phí")));
  }
  const address = "căn 906, tòa C3, 57/2 đường Hoàng Sa, Hà Nội".normalize("NFD");
  const text = `Nhận thư tại ${address}.`;
  const result = analyzeText(
    text,
    "12345678",
    completeAddressBoundaries(text, [
      model(text, "Hoàng Sa".normalize("NFD"), "DIA_CHI"),
      model(text, "Hà Nội".normalize("NFD"), "DIA_CHI"),
    ]),
  );
  assert.equal(result.findings[0].value, address);
});

test("address number repair still requires address evidence and stops at field or sentence boundaries", () => {
  const text = "Địa chỉ: 57 đường Hoàng Sa, Hà Nội; số tiền 98.000 đồng.";
  assert.deepEqual(completeAddressBoundaries(text, []), []);
  for (const ordinary of [
    "Có 57 đường cần sửa, Hà Nội.",
    "Có 57 đường Hồ Sơ, Hà Nội.",
    "Báo cáo 81 đại lộ cần nâng cấp, Hà Nội.",
  ]) {
    const result = analyzeText(
      ordinary,
      "12345678",
      completeAddressBoundaries(ordinary, [model(ordinary, "Hà Nội", "DIA_CHI")]),
    );
    assert.deepEqual(
      result.findings.map((f) => f.value),
      ["Hà Nội"],
    );
  }
});

test("one wrapped house number or address unit joins without absorbing quantities or a blank paragraph", () => {
  for (const newline of ["\n", "\r\n"])
    for (const address of [
      `57/2${newline}đường Hoàng Sa, Hà Nội`,
      `thôn${newline}Tân Phước, xã An Lạc, Đồng Tháp`,
    ]) {
      const text = `Khách đề nghị gửi thông báo về ${address}. Ngày giao dịch: 22/09/2026.`;
      const value = address.includes("Hoàng") ? "Hoàng Sa" : "Tân Phước";
      const city = address.includes("Hà Nội") ? "Hà Nội" : "Đồng Tháp";
      const ds = completeAddressBoundaries(text, [
        model(text, value, "DIA_CHI"),
        model(text, city, "DIA_CHI"),
      ]);
      assert.equal(analyzeText(text, "12345678", ds).findings[0].value, address);
    }
  for (const text of [
    "Số lượng: 57\nđường Hoàng Sa, Hà Nội.",
    "Địa chỉ: 57\n\nđường Hoàng Sa, Hà Nội.",
    "Có 57\nđường Hoàng Sa, Hà Nội.",
  ]) {
    const ds = completeAddressBoundaries(text, [
      model(text, "Hoàng Sa", "DIA_CHI"),
      model(text, "Hà Nội", "DIA_CHI"),
    ]);
    const a = analyzeText(text, "12345678", ds);
    assert.ok(a.spans.every((s) => s.start > text.indexOf("57") + 1));
  }
  const address = "118 đường Đặng Văn Ngữ, phường Trung Tự, Hà Nội";
  const text = `Khách cập nhật nơi thường trú thành ${address}.`;
  const ds = completeAddressBoundaries(text, [
    model(text, "phường Trung Tự", "DIA_CHI"),
    model(text, "Hà Nội", "DIA_CHI"),
  ]);
  assert.equal(analyzeText(text, "12345678", ds).findings[0].value, address);
});
