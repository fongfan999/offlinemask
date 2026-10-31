import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLabelledFields,
  reconcileLabelledFields,
} from "../src/core/detection/labelled-fields.ts";
import { modelDetections } from "../src/core/detection/model-policy.ts";
import { completeAddressBoundaries } from "../src/core/detection/address-boundaries.ts";
import { analyzeText } from "../src/core/text.ts";
import { filterDetections } from "../src/core/detection/options.ts";
const values = (text) =>
  detectLabelledFields(text).detections.map((d) => [d.type, text.slice(d.start, d.end)]);
const model = (start, end, type = "TEN") => ({
  start,
  end,
  type,
  label: type,
  priority: 50,
  source: "synthetic",
  reason: "test",
});

test("bounded labels recognize complete names in upper/lower case without inspecting a name dictionary", () => {
  assert.deepEqual(values("Người thụ hưởng: TRẦN ANH TÚ; STK: 004477889900."), [
    ["TEN", "TRẦN ANH TÚ"],
  ]);
  assert.deepEqual(values("Họ tên: nguyễn hoàng sơn. Ngày 02/10/2026."), [
    ["TEN", "nguyễn hoàng sơn"],
  ]);
  assert.deepEqual(values("Tên trên giấy tờ: Lê Tú-Anh; email: test@example.org."), [
    ["TEN", "Lê Tú-Anh"],
  ]);
  // A government form's label (business registration, decision 0187).
  assert.deepEqual(values("Họ, chữ đệm và tên: LÂM HOÀNG VŨ · Giới tính: Nam"), [
    ["TEN", "LÂM HOÀNG VŨ"],
  ]);
  assert.deepEqual(values("Họ tên:\nLê Tuấn\nĐịa chỉ: Huế."), [["TEN", "Lê Tuấn"]]); // single-word locality intentionally unsupported by the field rule
});

test("field offsets preserve NFD, nonbreaking spaces and leading emoji", () => {
  const name = "Vũ Ngọc Tú";
  const text = "😀 Họ và tên: " + name + ".";
  const fields = detectLabelledFields(text);
  assert.equal(fields.detections.length, 1);
  assert.equal(fields.detections[0].start, text.indexOf(name));
  assert.equal(fields.detections[0].end, text.indexOf(name) + name.length);
  assert.deepEqual(values(text), [["TEN", name]]);
});

test("addresses keep abbreviations and house numbers and stop before the next field or sentence", () => {
  const address = "81/4 Lê Văn Sỹ, P. 13, Q. 3, TP. Hồ Chí Minh";
  assert.deepEqual(
    values("Địa chỉ: " + address + ", Email: test@example.org; số tiền 9.000 đồng."),
    [["DIA_CHI", address]],
  );
  assert.deepEqual(values("Địa chỉ: 23 Nguyễn Du, Hà Nội. Tôi cần kiểm tra phí."), [
    ["DIA_CHI", "23 Nguyễn Du, Hà Nội"],
  ]);
  assert.deepEqual(values("Địa chỉ:\n23 Nguyễn Du, Hà Nội\nSTK: 004477889900"), [
    ["DIA_CHI", "23 Nguyễn Du, Hà Nội"],
  ]);
  assert.deepEqual(values("Địa chỉ: 23 Nguyễn Du, Hà Nội, điện thoại 0912345678."), [
    ["DIA_CHI", "23 Nguyễn Du, Hà Nội"],
  ]);
  assert.deepEqual(values("Địa chỉ: 23 Nguyễn Du, Hà Nội, mã bưu chính 100000."), [
    ["DIA_CHI", "23 Nguyễn Du, Hà Nội"],
  ]);
});

test("empty values, metadata labels, unrelated fields and unbounded prose are not names or addresses", () => {
  for (const text of [
    "Họ tên: chưa cung cấp.",
    "Địa chỉ: đang cập nhật.",
    "Người nhận: cần bổ sung chứng từ.",
    "Khách hàng: đang chờ xử lý.",
    "Tên biểu mẫu: Phiếu yêu cầu.",
    "Địa chỉ trang web: example.org.",
    "Tôi thấy Nguyễn An ngoài đường.",
    "Khách hàng: Công ty Thử Nghiệm.",
    "Họ tên:\n\nLê An",
    "Địa chỉ: Hà Nội số tiền 8.000 đồng.",
    "Họ tên: " + "Nguyễn ".repeat(100),
  ])
    assert.deepEqual(values(text), [], text);
});

test("field meaning overrides wrong model categories before category selection without losing outside evidence", () => {
  const text = "Họ tên: Lê Cẩm Tú; Địa chỉ: 11 Lê Duẩn, Đà Nẵng. Mai An";
  const fields = detectLabelledFields(text);
  const name = fields.detections[0],
    address = fields.detections[1];
  const detections = reconcileLabelledFields(
    text,
    [
      model(name.start, name.end, "TO_CHUC"),
      model(address.start, address.end),
      model(text.indexOf("Mai An"), text.length),
    ],
    fields,
  );
  const nameOnly = analyzeText(text, "12345678", filterDetections(detections, ["name"]));
  const addressOnly = analyzeText(text, "12345678", filterDetections(detections, ["address"]));
  assert.deepEqual(
    nameOnly.spans.map((s) => text.slice(s.start, s.end)),
    ["Lê Cẩm Tú", "Mai An"],
  );
  assert.deepEqual(
    addressOnly.spans.map((s) => text.slice(s.start, s.end)),
    ["11 Lê Duẩn, Đà Nẵng"],
  );
  assert.equal(filterDetections(detections, ["other"]).length, 0);
});

test("suppression is confined to known placeholders and labels; real text outside remains detectable", () => {
  const text = "Họ tên: chưa cung cấp. Lê An";
  const fields = detectLabelledFields(text);
  const detections = reconcileLabelledFields(
    text,
    [model(0, 3), model(8, 12), model(text.indexOf("Lê An"), text.length)],
    fields,
  );
  assert.deepEqual(
    detections.map((d) => text.slice(d.start, d.end)),
    ["Lê An"],
  );
  const mixed = "Họ tên: Lê An; Mai Tú";
  const spanning = reconcileLabelledFields(
    mixed,
    [model(8, mixed.length)],
    detectLabelledFields(mixed),
  );
  assert.ok(spanning.some((d) => mixed.slice(d.start, d.end).includes("Mai Tú")));
});

test("name punctuation joins only adjacent predicted name pieces and does not bridge paragraphs", () => {
  const text = "Mai-Anh H’Lan";
  const spans = [
    { start: 0, end: 3, canonical_label: "FIRST_NAME" },
    { start: 4, end: 7, canonical_label: "FIRST_NAME" },
    { start: 8, end: 9, canonical_label: "FIRST_NAME" },
    { start: 10, end: 13, canonical_label: "FIRST_NAME" },
  ];
  const detections = modelDetections(text, spans);
  assert.equal(detections.length, 1);
  assert.equal(text.slice(detections[0].start, detections[0].end), text);
  assert.equal(
    modelDetections("Mai\nAnh", [
      { start: 0, end: 3, canonical_label: "FIRST_NAME" },
      { start: 4, end: 7, canonical_label: "FIRST_NAME" },
    ]).length,
    2,
  );
});

test("address completion bridges a comma followed by one newline, without swallowing the following sentence", () => {
  const text = "Địa chỉ: 42 Lê Lợi,\r\nphường Minh An, Hội An. Phí 20.000 đồng.";
  const fields = detectLabelledFields(text);
  const seeds = [
    ...fields.detections,
    model(text.indexOf("Minh An"), text.indexOf("Minh An") + 7, "DIA_CHI"),
    model(text.indexOf("Hội An"), text.indexOf("Hội An") + 6, "DIA_CHI"),
  ];
  const completed = reconcileLabelledFields(text, completeAddressBoundaries(text, seeds), fields);
  const analysis = analyzeText(text, "12345678", filterDetections(completed, ["address"]));
  const covered = new Set(
    analysis.spans.flatMap((s) => Array.from({ length: s.end - s.start }, (_, i) => s.start + i)),
  );
  const start = text.indexOf("42"),
    end = text.indexOf(". Phí");
  for (let i = start; i < end; i++)
    if (/[\p{L}\p{N}]/u.test(text[i])) assert.ok(covered.has(i), text.slice(i));
  assert.ok(!analysis.spans.some((s) => s.end > end));
});

test("large input keeps exact tail offsets and field parsing requires no network", (context) => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => assert.fail("Labelled fields must stay offline");
  context.after(() => {
    globalThis.fetch = previous;
  });
  const tail = "Họ tên: Trần Mai Tú; Địa chỉ: 56 Lê Lợi, Hà Nội.";
  const filler = "Nội dung tổng hợp. ";
  const prefixLength = 50000 - tail.length;
  const text =
    filler.repeat(Math.floor(prefixLength / filler.length)).padEnd(prefixLength, " ") + tail;
  assert.equal(text.length, 50000);
  assert.deepEqual(values(text), [
    ["TEN", "Trần Mai Tú"],
    ["DIA_CHI", "56 Lê Lợi, Hà Nội"],
  ]);
  for (const d of detectLabelledFields(text).detections) {
    assert.ok(d.start >= 50000 - tail.length);
    assert.ok(d.end <= 50000);
  }
});
