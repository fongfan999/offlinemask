import test from "node:test";
import assert from "node:assert/strict";
import { detectStructuredValues } from "../src/core/detection/structured-values.ts";
import { detectContextFields } from "../src/core/detection/context-fields.ts";
import { applyDetectionPolicy } from "../src/core/detection/policy.ts";
import { filterDetections } from "../src/core/detection/options.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
const structured = (text) =>
  detectStructuredValues(text).detections.map((d) => [d.type, text.slice(d.start, d.end)]);
const context = (text) =>
  detectContextFields(text).detections.map((d) => [d.type, text.slice(d.start, d.end)]);

test("labelled payment values retain full spans, including NFD and emoji offsets", () => {
  for (const normalization of ["NFC", "NFD"]) {
    const text =
      "📎 Thẻ thử nghiệm số 4111 1111 1111 1111, mã CVV 123. Mã PIN thẻ của tôi là 4826.".normalize(
        normalization,
      );
    assert.deepEqual(structured(text), [
      ["THE", "4111 1111 1111 1111"],
      ["CVV", "123"],
      ["PIN", "4826"],
    ]);
    for (const d of detectStructuredValues(text).detections)
      assert.equal(d.start, text.indexOf(text.slice(d.start, d.end)));
  }
  for (const [text, type, value] of [
    ["Số thẻ: 4111-1111-1111-1112", "THE", "4111-1111-1111-1112"], // no Luhn gate
    ["Card number = 1234567890123", "THE", "1234567890123"],
    ["Số thẻ 1234567890123456789", "THE", "1234567890123456789"],
    ["CVC2: 9876", "CVV", "9876"],
    ["PIN thử nghiệm: 482601", "PIN", "482601"],
  ])
    assert.deepEqual(structured(text), [[type, value]], text);
});
test("unlabelled numbers, length instructions and malformed payment values remain untouched", () => {
  for (const text of [
    "4111 1111 1111 1111",
    "Có 4826 hồ sơ",
    "PIN gồm 6 chữ số",
    "CVV: 123 ký tự",
    "PIN: 4826 digits",
    "CVV: 12345",
    "CVV: 123 4 5",
    "CVV: 123.45",
    "CVV: 123abc",
    "PIN: 4826019",
    "PIN: 4826/12",
    "PIN: 4826-XYZ",
    "Số thẻ: 123456789012",
    "Số thẻ: 12345678901234567890",
    "Số thẻ: 4111111111111111x",
    "Số thẻ\n4111111111111111",
  ]) {
    assert.deepEqual(structured(text), [], text);
  }
});
test("IPv4 needs explicit context and a whole canonical dotted decimal token", () => {
  for (const intro of ["IP ", "IP:", "địa chỉ IP ", "IP đăng nhập: ", "IPv4 = "]) {
    const text = ("📎 " + intro + "192.0.2.42.").normalize("NFD");
    assert.deepEqual(context(text), [["IP", "192.0.2.42"]], text);
    assert.equal(detectContextFields(text).detections[0].start, text.indexOf("192.0.2.42"));
  }
  for (const text of [
    "192.0.2.42",
    "Version: 192.0.2.42",
    "IP: 999.0.2.42",
    "IP: 192.0.2.42x",
    "IP: 192.0.2.42/24",
    "IP: 192.0.2.42..",
    "IP: 192.0.2.42.5",
    "IP: 127.1",
    "IP: 0xc0.0.2.42",
    "IP: 0192.0.2.42",
    "IP: 192.0.2.42:8443",
    "IP\n192.0.2.42",
    "SKIP: 192.0.2.42",
  ]) {
    assert.deepEqual(context(text), [], text);
  }
});
test("named birthday bridge keeps calendar validation, exact offsets and the name prediction", () => {
  for (const normalization of ["NFC", "NFD"]) {
    const text =
      "📎 Ngày sinh của Lục Anh Duy là 02 tháng 11 năm 1988. Ngày tiếp nhận là 09/09/2026.".normalize(
        normalization,
      );
    const name = "Lục Anh Duy".normalize(normalization);
    const d = {
      start: text.indexOf(name),
      end: text.indexOf(name) + name.length,
      type: "TEN",
      label: "Tên",
      source: "Test",
      reason: "Test",
      priority: 50,
    };
    assert.deepEqual(context(text), [
      ["NGAY_SINH", "02 tháng 11 năm 1988".normalize(normalization)],
    ]);
    assert.ok(
      applyDetectionPolicy(text, [d]).complete.some(
        (row) => row.type === "TEN" && text.slice(row.start, row.end) === name,
      ),
    );
  }
  assert.deepEqual(context("Ngay sinh cua Luc Anh Duy la 2/11/1988"), [["NGAY_SINH", "2/11/1988"]]);
  for (const text of [
    "Ngày sinh của Lục Anh Duy là 31/02/1988",
    "Ngày sinh của khách chưa rõ. Ngày hẹn là 2/11/1988",
    "Ngày sinh của Lục Anh Duy\nlà 2/11/1988",
    "Ngày sinh của An Bình Cát Duy Em Giang Huy là 2/11/1988",
  ])
    assert.deepEqual(context(text), [], text);
});
test("TSV accounts require explicit headers and aligned whole cells, and stop at table boundaries", () => {
  for (const newline of ["\n", "\r\n", "\r"]) {
    const text = [
      "Họ tên\tSố tài khoản\tSố tiền",
      "Trịnh Hải Đăng\t002345678901\t1.250.000 đồng",
      "Mây\t  00 234 567 891  \t4826",
      "",
      "Ngoài bảng\t9999999999\t9999999999",
    ]
      .join(newline)
      .normalize("NFD");
    assert.deepEqual(structured(text), [
      ["STK", "002345678901"],
      ["STK", "00 234 567 891"],
    ]);
    for (const d of detectStructuredValues(text).detections)
      assert.equal(d.start, text.indexOf(text.slice(d.start, d.end)));
  }
  for (const text of [
    "Tên\tSố lượng\nMinh\t002345678901",
    "Họ tên\tSố tài khoản\nMinh\t123456x",
    "Họ tên\tSố tài khoản\nMinh\t123456789012345678901",
    "Họ tên\tSố tài khoản\nMinh\t123456\t123456",
    "Họ tên\tSố tài khoản\n\nMinh\t002345678901",
  ])
    assert.deepEqual(structured(text), [], text);
});
test("opaque credentials retain precedence over new structured recognizers", () => {
  const value = "CVV: 123; PIN: 4826; IP: 192.0.2.42; Ngày sinh của Lục Anh Duy là 2/11/1988";
  const text = `Mật khẩu: "${value}"`;
  assert.deepEqual(
    applyDetectionPolicy(text, []).complete.map((d) => [d.type, text.slice(d.start, d.end)]),
    [["MAT_KHAU", value]],
  );
});
test("payment fields stay other; account table works without a pack and does not load a model", async () => {
  const text =
    "CVV: 123; PIN: 4826; Số thẻ: 4111111111111111; IP: 192.0.2.42\nHọ tên\tSố tài khoản\nMinh\t002345678901";
  const ds = applyDetectionPolicy(text, []).complete;
  assert.equal(filterDetections(ds, ["other"]).length, 4);
  assert.deepEqual(
    filterDetections(ds, ["banking"]).map((d) => text.slice(d.start, d.end)),
    ["002345678901"],
  );
  const engine = createDetectionEngine();
  assert.deepEqual(
    (
      await engine({ text, options: ["banking", "email", "phone"] }, () =>
        assert.fail("Model loaded"),
      )
    ).map((d) => text.slice(d.start, d.end)),
    ["002345678901"],
  );
  await assert.rejects(
    engine({ text, options: ["other"] }, () => {}),
    /Models required/,
  );
});

test("account labels followed by “số” still mask the account number", async () => {
  const { detectBankingIdentifiers } = await import("../src/core/detection/banking.ts");
  for (const [text, value] of [
    ["thanh toán vào tài khoản số 0071000123456 tại Vietcombank.", "0071000123456"],
    ["Tài khoản số: 0071000123456", "0071000123456"],
    ["STK số 0071000123456", "0071000123456"],
  ]) {
    assert.deepEqual(structured(text), [["STK", value]], text);
    assert.deepEqual(
      detectBankingIdentifiers(text).map((d) => [d.type, text.slice(d.start, d.end)]),
      [["STK", value]],
      text,
    );
  }
  for (const text of ["Có 3 tài khoản số dư âm", "Tài khoản số 2 đã khóa"]) {
    assert.deepEqual(structured(text), [], text);
    assert.deepEqual(detectBankingIdentifiers(text), [], text);
  }
});
