import test from "node:test";
import assert from "node:assert/strict";
import { modelDetections, plausibleContextualSpan } from "../src/core/detection/model-policy.ts";
import { applyDetectionPolicy } from "../src/core/detection/policy.ts";
import { scanBatches, splitDetections } from "../src/core/sheet/mask.ts";

const span = (text, value, canonical_label, from = 0) => {
  const start = text.indexOf(value, from);
  assert.ok(start >= 0, value);
  return { start, end: start + value.length, canonical_label, score: 0.9 };
};
const values = (text, detections) => detections.map((d) => [d.type, text.slice(d.start, d.end)]);

test("contract parties are roles, not names, places or organizations", () => {
  for (const party of [
    "Bên A",
    "BÊN B",
    "bên b",
    "Bên",
    "Các Bên",
    "các bên",
    "Hai Bên",
    "Bên thuê",
    "Bên cho thuê",
    "Bên thứ ba",
    "Bên bị vi phạm",
    "Bên còn lại",
    "Bên cung cấp dịch vụ",
    "Bên nhận chuyển nhượng",
    "Các Bên.",
    "“Bên B”",
  ])
    for (const type of ["TEN", "DIA_CHI", "TO_CHUC"])
      assert.equal(plausibleContextualSpan(type, party), false, `${type} ${party}`);
  for (const [type, value] of [
    ["TEN", "bên chị Lan"],
    ["TEN", "Bên Nguyễn Văn An"],
    ["DIA_CHI", "Bến Thành"],
    ["DIA_CHI", "Bến Tre"],
    ["DIA_CHI", "Quận 5"],
    ["TEN", "Hà"],
    ["TO_CHUC", "Vietinbank"],
    ["SDT", "A"],
  ])
    assert.equal(plausibleContextualSpan(type, value), true, `${type} ${value}`);
});

test("a name, place or organization needs letters: single letters and bare numbers are misreadings", () => {
  for (const [type, value] of [
    ["TEN", "B"],
    ["TEN", "163"],
    ["TEN", "4"],
    ["DIA_CHI", "B"],
    ["DIA_CHI", "29"],
    ["TO_CHUC", "A"],
    ["TEN", "."],
  ])
    assert.equal(plausibleContextualSpan(type, value), false, `${type} ${value}`);
});

test("a predicted span never crosses a field separator or a line, and the parties fall away", () => {
  const header = "\tBÊN A\t: CÔNG TY CỔ PHẦN HOA MAI\n\tĐại diện bởi\t: Ông TRẦN VĂN HÙNG";
  assert.deepEqual(
    values(
      header,
      modelDetections(header, [
        span(header, "BÊN A\t: CÔNG", "PERSON"),
        span(header, "Ông TRẦN VĂN HÙNG", "PERSON"),
      ]),
    ),
    [
      ["TEN", "CÔNG"],
      ["TEN", "Ông TRẦN VĂN HÙNG"],
    ],
  );
  const signatures = "Giám Đốc\nTRẦN VĂN HÙNG\n\nLÊ THỊ THU HÀ";
  assert.deepEqual(
    values(
      signatures,
      modelDetections(signatures, [span(signatures, "TRẦN VĂN HÙNG\n\nLÊ THỊ THU HÀ", "PERSON")]),
    ),
    [
      ["TEN", "TRẦN VĂN HÙNG"],
      ["TEN", "LÊ THỊ THU HÀ"],
    ],
  );
  const prose =
    "Bên A yêu cầu và Bên B đồng ý; Các Bên thống nhất. Sự kiện: Bên B gửi cho Lê Thị Thu Hà.";
  const found = modelDetections(prose, [
    span(prose, "Bên A", "PERSON"),
    span(prose, "Bên B", "LOCATION"),
    span(prose, "Các Bên", "ORGANIZATION"),
    span(prose, "Bên B", "PERSON", 40),
    span(prose, "Lê Thị Thu Hà", "PERSON"),
  ]);
  assert.deepEqual(values(prose, found), [["TEN", "Lê Thị Thu Hà"]]);
  // Addresses keep administrative abbreviations; names and organizations end with a sentence.
  const address = "Gửi về 12 Lê Lợi, P. 2, TP. Hồ Chí Minh. Trân trọng";
  assert.deepEqual(
    values(
      address,
      modelDetections(address, [
        span(address, "12 Lê Lợi, P. 2, TP. Hồ Chí Minh", "STREET_ADDRESS"),
      ]),
    ),
    [["DIA_CHI", "12 Lê Lợi, P. 2, TP. Hồ Chí Minh"]],
  );
  const organization = "Cục Cảnh Sát. Nơi cấp";
  assert.deepEqual(
    values(
      organization,
      modelDetections(organization, [span(organization, "Cục Cảnh Sát. Nơi", "ORGANIZATION")]),
    ),
    [
      ["TO_CHUC", "Cục Cảnh Sát"],
      ["TO_CHUC", "Nơi"],
    ],
  );
});

test("a contract party label completes the company name after its legal prefix", () => {
  const text = "\tBÊN A\t: CÔNG TY CỔ PHẦN HOA MAI\n\tMã số thuế\t: 0101234567";
  const company = "CÔNG TY CỔ PHẦN HOA MAI";
  const organizations = (detections) =>
    applyDetectionPolicy(text, detections)
      .complete.filter((d) => d.type === "TO_CHUC")
      .map((d) => text.slice(d.start, d.end));
  assert.deepEqual(organizations([]), [company]);
  const seed = {
    ...span(text, "CÔNG TY", "ORGANIZATION"),
    type: "TEN",
    label: "Họ và tên",
    source: "test",
    reason: "test",
    priority: 50,
  };
  assert.deepEqual(organizations([seed]), [company]);
  const prose = "Theo quy định, công ty cổ phần phải nộp báo cáo.";
  assert.deepEqual(applyDetectionPolicy(prose, []).complete, []);
});

test("a span over the batch separator reaches every paragraph it touches", () => {
  const batches = scanBatches(
    [
      { key: "a", text: "TRẦN VĂN HÙNG" },
      { key: "b", text: "LÊ THỊ THU HÀ" },
    ],
    100,
  );
  const [batch] = batches;
  const whole = {
    start: 0,
    end: batch.text.length,
    type: "TEN",
    label: "x",
    source: "x",
    reason: "x",
    priority: 50,
  };
  const spans = splitDetections(batch, [whole]);
  assert.deepEqual(
    spans.get("a").map((d) => [d.start, d.end]),
    [[0, 13]],
  );
  assert.deepEqual(
    spans.get("b").map((d) => [d.start, d.end]),
    [[0, 13]],
  );
});

test("contract boilerplate in Title Case is never a name, place or organization", () => {
  const text =
    "Điều 3.\tPhí Dịch Vụ - Thanh Toán\nThù lao: 8.800.000 VND (Bằng chữ: Tám triệu tám trăm nghìn đồng)\nSự Kiện Bất Khả Kháng là sự kiện. Mọi Thông Tin Mật sẽ được giữ. Án Phí do Bên thua kiện chịu. Người nhận: Nguyễn Thanh Toán; Công ty Dịch vụ Bình An.";
  const found = modelDetections(text, [
    span(text, "Điều 3", "PERSON"),
    span(text, "Dịch Vụ", "PERSON"),
    span(text, "Thanh Toán", "PERSON"),
    span(text, "Tám", "PERSON"),
    span(text, "Kiện Bất Khả Kháng", "PERSON"),
    span(text, "Sự Kiện Bất", "LOCATION"),
    span(text, "Mọi", "PERSON"),
    span(text, "Thông Tin", "ORGANIZATION"),
    span(text, "Án", "ORGANIZATION"),
    span(text, "Nguyễn Thanh Toán", "PERSON"),
    span(text, "Công ty Dịch vụ Bình An", "ORGANIZATION"),
  ]);
  assert.deepEqual(values(text, found), [
    ["TEN", "Nguyễn Thanh Toán"],
    ["TO_CHUC", "Công ty Dịch vụ Bình An"],
  ]);
  // Decomposed input is left to the review list rather than matched at shifted offsets.
  const decomposed = "Thanh Toán".normalize("NFD");
  assert.equal(modelDetections(decomposed, [span(decomposed, decomposed, "PERSON")]).length, 1);
});

test("boilerplate runs, titles and job titles are checked on the whole text as well as per window", () => {
  const text =
    "HỢP ĐỒNG CỘNG TÁC VIÊN\nMọi Thông Tin Mật sẽ:\nChức vụ: Giám Đốc Tài Chính\nĐiều 5. Phạt vi phạm Hợp đồng";
  const detection = (value, type) => {
    const start = text.indexOf(value);
    return {
      start,
      end: start + value.length,
      type,
      label: type,
      source: "x",
      reason: "x",
      priority: 50,
    };
  };
  const found = applyDetectionPolicy(text, [
    detection("HỢP ĐỒNG CỘNG TÁC VIÊN", "TEN"),
    detection("Mật", "TEN"),
    detection("Giám Đốc Tài Chính", "TO_CHUC"),
    detection("Phạt", "TEN"),
  ]);
  assert.deepEqual(found.modelOnly, []);
  assert.deepEqual(found.complete, []);
  const address = "Chuyển từ 12 Lê Duẩn, Đà Nẵng đến nơi khác.";
  assert.deepEqual(
    values(
      address,
      modelDetections(address, [
        span(address, "12 Lê Duẩn", "STREET_ADDRESS"),
        span(address, "Đà Nẵng", "LOCATION"),
      ]),
    ),
    [["DIA_CHI", "12 Lê Duẩn, Đà Nẵng"]],
  );
});

test("a one-word name, place or organization needs a confident score unless it is the whole text", () => {
  const text = "Chị Lan gửi bản Đại Tạng Kinh về Huế.";
  const found = modelDetections(text, [
    { ...span(text, "Lan", "PERSON"), score: 0.98 },
    { ...span(text, "Đại", "PERSON"), score: 0.35 },
    { ...span(text, "Kinh", "LOCATION"), score: 0.58 },
    { ...span(text, "Huế", "LOCATION"), score: 1 },
  ]);
  assert.deepEqual(values(text, found), [
    ["TEN", "Lan"],
    ["DIA_CHI", "Huế"],
  ]);
  assert.equal(found[0].score, 0.98);
  // Adjacent pieces form one multi-word name, which the rule does not touch.
  const low = "nguyễn văn an cần hỗ trợ";
  const joined = modelDetections(low, [
    { ...span(low, "nguyễn", "LAST_NAME"), score: 0.31 },
    { ...span(low, "văn", "MIDDLE_NAME"), score: 0.3 },
    { ...span(low, "an", "FIRST_NAME"), score: 0.33 },
  ]);
  assert.deepEqual(values(low, joined), [["TEN", "nguyễn văn an"]]);
  // A single word on its own, such as a spreadsheet cell, is all the evidence there is.
  assert.deepEqual(
    values(
      "Trâm",
      modelDetections("Trâm", [{ start: 0, end: 4, canonical_label: "FIRST_NAME", score: 0.4 }]),
    ),
    [["TEN", "Trâm"]],
  );
  // A span without a score (older callers) is kept.
  assert.equal(modelDetections(text, [span(text, "Đại", "PERSON")]).length, 1);
});
