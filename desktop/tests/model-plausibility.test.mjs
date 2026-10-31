import test from "node:test";
import assert from "node:assert/strict";
import {
  modelDetections,
  plausibleContextualSpan,
  plausibleModelDetections,
} from "../src/core/detection/model-policy.ts";
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

test("a currency code on its own is neither a place nor an organization", () => {
  for (const code of ["VND", "vnđ", "USD", "EUR"])
    for (const type of ["DIA_CHI", "TO_CHUC", "TEN"])
      assert.equal(plausibleContextualSpan(type, code), false, `${type} ${code}`);
  assert.equal(plausibleContextualSpan("TO_CHUC", "Ngân hàng VND"), true);
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
    // The piece left in the company's cell is a word in capitals, not a name (decision 0156).
    [["TEN", "Ông TRẦN VĂN HÙNG"]],
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

test("boilerplate read with other tone marks is still boilerplate, unless every word could be a name", () => {
  // Text recognition's misread marks (decision 0188).
  const text =
    "Trong trường hợp xảy ra Sự Kiện Bát Khà Kháng, các bên. Bên đó chịu.\nThủ lao: 5.000.000 đồng.\nNgười nhận: Nguyễn Thanh Toàn; ông Phát.";
  const found = modelDetections(text, [
    span(text, "Sự Kiện Bát Khà", "PERSON"),
    span(text, "Kiện Bát Khà Kháng", "ORGANIZATION"),
    span(text, "Bên đó", "PERSON"),
    span(text, "Thủ lao", "PERSON"),
    span(text, "Thanh Toàn", "PERSON"),
    span(text, "Phát", "PERSON"),
  ]);
  assert.deepEqual(values(text, found), [
    ["TEN", "Thanh Toàn"],
    ["TEN", "Phát"],
  ]);
});

test("a run of wording takes a party and a title with it; a name after it stays a name", () => {
  // Headings as scans read them, joined to the motto (decision 0190).
  const text =
    "Đặc lập - Tự do - Hạnh phúc ĐƠN XIN VIỆC\nĐộc lập - Tự do - Hạnh phúc CĂN CƯỚC CÔNG DÂN\nBIÊN BẢN BÀN GIAO TÀI SẢN\ndoanh thu đạt 92% kế hoạch\nĐẠI DIỆN BÊN A\tĐại diện bên B ông Trần Hạnh Phúc";
  const found = modelDetections(text, [
    span(text, "Hạnh phúc ĐƠN", "PERSON"),
    span(text, "phúc CĂN", "PERSON"),
    span(text, "TÀI SẢN", "PERSON"),
    span(text, "kế hoạch", "LOCATION"),
    span(text, "ĐẠI DIỆN BÊN", "PERSON"),
    span(text, "Trần Hạnh Phúc", "PERSON"),
  ]);
  assert.deepEqual(values(text, found), [["TEN", "Trần Hạnh Phúc"]]);
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

test("invoice wording, a country alone and a brand in capitals are not names or places", () => {
  const text =
    "HÓA ĐƠN GIÁ TRỊ GIA TĂNG\nMã tra cứu: AB12 Trang tra cứu: https://example.vn\nTrang 1/1\n3\tKIMSAN Thịt bò Úc xay\tKG\nKhách hàng: Thu Trang, NGUYỄN VĂN AN, sống tại Úc Châu, Hà Nội, Việt Nam";
  const detections = modelDetections(text, [
    span(text, "HÓA ĐƠN", "PERSON"),
    span(text, "GIÁ TRỊ GIA TĂNG", "PERSON"),
    span(text, "Trang tra cứu", "PERSON"),
    span(text, "Trang 1/1", "PERSON"),
    span(text, "KIMSAN", "PERSON"),
    span(text, "Úc", "LOCATION"),
    span(text, "Thu Trang", "PERSON"),
    span(text, "NGUYỄN VĂN AN", "PERSON"),
    span(text, "Hà Nội, Việt Nam", "LOCATION"),
  ]);
  assert.deepEqual(values(text, detections), [
    ["TEN", "Thu Trang"],
    ["TEN", "NGUYỄN VĂN AN"],
    ["DIA_CHI", "Hà Nội, Việt Nam"],
  ]);
  for (const country of ["Úc", "Việt Nam", "Nhật Bản", "châu Âu"])
    assert.equal(plausibleContextualSpan("DIA_CHI", country), false, country);
  for (const place of ["Huế", "Hà Nội, Việt Nam", "Phường Sài Gòn"])
    assert.equal(plausibleContextualSpan("DIA_CHI", place), true, place);
});

test("an organization a rule completes and a model continues is one organization", () => {
  const text = "Tên đơn vị: Công ty Cổ phần Thương mại Tổng hợp Bình Minh";
  const { complete } = applyDetectionPolicy(text, [
    {
      ...span(text, "hợp Bình Minh", "ORGANIZATION"),
      type: "TO_CHUC",
      label: "Tổ chức",
      source: "m",
      reason: "r",
      priority: 50,
    },
  ]);
  const organizations = complete
    .filter((d) => d.type === "TO_CHUC")
    .map((d) => text.slice(d.start, d.end));
  assert.deepEqual(organizations, ["Công ty Cổ phần Thương mại Tổng hợp Bình Minh"]);
  const separate = applyDetectionPolicy("Bình Minh\tAn Phát", [
    { start: 0, end: 9, type: "TO_CHUC", label: "Tổ chức", source: "m", reason: "r", priority: 50 },
    {
      start: 10,
      end: 17,
      type: "TO_CHUC",
      label: "Tổ chức",
      source: "m",
      reason: "r",
      priority: 50,
    },
  ]).complete;
  assert.equal(separate.length, 2);
});

test("a brand in a product cell is not a name or an organization; a foreign name in capitals is whole", () => {
  // Brands at a name's edges are no longer trimmed (decision 0170): a product cell is
  // vetoed whole by its unit, and a foreign given name in capitals stays with the family name.
  const text =
    "4\tVISSAN Xúc xích bò gói 280g\tG1\n5\tWINECO Cải ngọt L1 300g\tG1\nKhách hàng JOHN NGUYỄN làm việc tại JEMMIA";
  const detections = plausibleModelDetections(text, [
    { ...span(text, "VISSAN Xúc", "PERSON"), type: "TEN", score: 0.38 },
    { ...span(text, "WINECO", "ORGANIZATION"), type: "TO_CHUC", score: 0.98 },
    { ...span(text, "JOHN NGUYỄN", "PERSON"), type: "TEN", score: 0.9 },
    { ...span(text, "JEMMIA", "ORGANIZATION"), type: "TO_CHUC", score: 0.95 },
  ]);
  assert.deepEqual(values(text, detections), [
    ["TEN", "JOHN NGUYỄN"],
    ["TO_CHUC", "JEMMIA"],
  ]);
});

test("in a table cell describing goods, a model's name, place or organization is product wording", () => {
  const text =
    "2\tAN ĐÌNH Gạo Japonica BB-3kg\tG1\n6\tOLALA Trứng Gà Sạch hộp 10\tHOP\n3\tChuối vàng\tKG\t0,612\nGửi 2 hộp bánh cho anh Nguyễn Văn An tại Hà Nội\nNgười nhận\tTrần Thị Mai";
  const detections = plausibleModelDetections(text, [
    { ...span(text, "ĐÌNH Gạo", "PERSON"), type: "TEN", score: 0.54 },
    { ...span(text, "Trứng Gà", "LOCATION"), type: "DIA_CHI", score: 0.83 },
    { ...span(text, "KG", "LOCATION"), type: "DIA_CHI", score: 0.63 },
    { ...span(text, "Nguyễn Văn An", "PERSON"), type: "TEN", score: 0.9 },
    { ...span(text, "Hà Nội", "LOCATION"), type: "DIA_CHI", score: 0.9 },
    { ...span(text, "Trần Thị Mai", "PERSON"), type: "TEN", score: 0.9 },
  ]);
  assert.deepEqual(values(text, detections), [
    ["TEN", "Nguyễn Văn An"],
    ["DIA_CHI", "Hà Nội"],
    ["TEN", "Trần Thị Mai"],
  ]);
});

test("a row whose unit column holds a unit lists goods; a row without one keeps its names", () => {
  const text =
    "3\tỐc Hương Thiên Nhiên\tKg\t0,64\n8\tMì Xào Hải Sản\tPhần\t1,00\nHÓA ĐƠN BÁN HÀNG\nNgười nhận\tLê Văn Dương\tHà Nội";
  const detections = plausibleModelDetections(text, [
    { ...span(text, "Ốc Hương Thiên Nhiên", "PERSON"), type: "TEN", score: 0.99 },
    { ...span(text, "Xào Hải Sản", "LOCATION"), type: "DIA_CHI", score: 0.76 },
    { ...span(text, "BÁN HÀNG", "PERSON"), type: "TEN", score: 0.82 },
    { ...span(text, "Lê Văn Dương", "PERSON"), type: "TEN", score: 0.9 },
    { ...span(text, "Hà Nội", "LOCATION"), type: "DIA_CHI", score: 0.9 },
  ]);
  assert.deepEqual(values(text, detections), [
    ["TEN", "Lê Văn Dương"],
    ["DIA_CHI", "Hà Nội"],
  ]);
});

test("a household business is one organization after its legal prefix", () => {
  const text = "Ký bởi: HỘ KINH DOANH HẢI SẢN BÌNH MINH";
  const { complete } = applyDetectionPolicy(text, [
    {
      start: 11,
      end: text.length,
      type: "TEN",
      label: "Họ và tên",
      source: "m",
      reason: "r",
      priority: 50,
    },
  ]);
  assert.deepEqual(
    complete.filter((d) => d.type === "TO_CHUC").map((d) => text.slice(d.start, d.end)),
    ["HỘ KINH DOANH HẢI SẢN BÌNH MINH"],
  );
});

test("a heading in capitals is not a name, place or organization; a name in capitals is", () => {
  const headings = [
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Độc lập - Tự do - Hạnh phúc",
    "SAO KÊ TÀI KHOẢN",
    "HỢP ĐỒNG THUÊ NHÀ",
    "ĐẠI DIỆN BÊN A · ĐẠI DIỆN BÊN B",
    "NGƯỜI LAO ĐỘNG (Bên B):",
    "NGƯỜI SỬ DỤNG LAO ĐỘNG",
    "I. THÔNG TIN BẢN THÂN",
    "II. QUAN HỆ GIA ĐÌNH",
    "III. QUÁ TRÌNH CÔNG TÁC",
    "SƠ YẾU LÝ LỊCH",
    "YÊU CẦU TRA SOÁT GIAO DỊCH. CHƯA CÓ THÔNG TIN KHÁCH HÀNG.",
  ];
  for (const heading of headings)
    for (const label of ["PERSON", "ORGANIZATION", "LOCATION"]) {
      const whole = modelDetections(heading, [
        span(heading, heading.replace(/^[IVX]+\. |\s*\(.*$|\s·.*$/u, ""), label),
      ]);
      assert.deepEqual(values(heading, whole), [], `${label}: ${heading}`);
    }
  // Two words of a heading, as a model cuts them.
  const cut = "SAO KÊ TÀI KHOẢN";
  assert.deepEqual(
    values(
      cut,
      modelDetections(cut, [span(cut, "KÊ TÀI KHOẢN", "ORGANIZATION"), span(cut, "SAO", "PERSON")]),
    ),
    [],
  );
  const cv = "II. QUAN HỆ GIA ĐÌNH";
  assert.deepEqual(values(cv, modelDetections(cv, [span(cv, "QUAN HỆ GIA ĐÌNH", "PERSON")])), []);
  // Names, places and organizations in capitals keep their evidence.
  const kept = [
    ["NGUYỄN VĂN AN", "PERSON", "NGUYỄN VĂN AN"],
    ["TRẦN THỊ HỒNG NHUNG", "PERSON", "THỊ HỒNG NHUNG"],
    ["GIÁM ĐỐC · LÊ MINH TUẤN", "PERSON", "LÊ MINH TUẤN"],
    ["CÔNG TY TNHH THƯƠNG MẠI SAO MAI", "ORGANIZATION", "CÔNG TY TNHH THƯƠNG MẠI SAO MAI"],
    ["NGÂN HÀNG TMCP Á CHÂU", "ORGANIZATION", "NGÂN HÀNG TMCP Á CHÂU"],
    ["SỐ 12 ĐƯỜNG LÊ LỢI, PHƯỜNG BẾN THÀNH", "LOCATION", "ĐƯỜNG LÊ LỢI, PHƯỜNG BẾN THÀNH"],
    [
      "THÔN ĐÔNG, XÃ TÂN LẬP, HUYỆN ĐAN PHƯỢNG",
      "LOCATION",
      "THÔN ĐÔNG, XÃ TÂN LẬP, HUYỆN ĐAN PHƯỢNG",
    ],
  ];
  for (const [text, label, value] of kept)
    assert.deepEqual(
      values(text, modelDetections(text, [span(text, value, label)])).map(([, v]) => v),
      [value],
      text,
    );
  // A name in capitals after a label is not a heading: the line has lowercase letters.
  const labelled = "Họ và tên: NGUYỄN VĂN AN";
  assert.deepEqual(
    values(labelled, modelDetections(labelled, [span(labelled, "NGUYỄN VĂN AN", "PERSON")])),
    [["TEN", "NGUYỄN VĂN AN"]],
  );
});

test("in a transaction row, a name in the shape of one stands; the wording is the models' to read", () => {
  // The unaccented wording of a statement's rows ("TRA LUONG THANG 9", "Thanh toan QR")
  // is no longer vetoed by a rule (decision 0170): the fine-tuned model does not read it as
  // a name, place or organization, measured on the held-out sets.
  const named =
    "05/10/2026\tFT26001234567\tCT DEN:FT26001234567 LE MINH TUAN chuyen tien thue nha T10\t\t3.500.000\t12.500.000";
  assert.deepEqual(values(named, modelDetections(named, [span(named, "LE MINH TUAN", "PERSON")])), [
    ["TEN", "LE MINH TUAN"],
  ]);
  const prose = "Gửi cho Thanh Toan QR\tghi chú";
  assert.deepEqual(values(prose, modelDetections(prose, [span(prose, "Thanh Toan", "PERSON")])), [
    ["TEN", "Thanh Toan"],
  ]);
  // A tab never joins two name pieces: the next cell is another value.
  const cells = "Bố\tBùi Bảo Trang\t1965";
  assert.deepEqual(
    values(
      cells,
      modelDetections(cells, [span(cells, "Bố", "PERSON"), span(cells, "Bùi Bảo Trang", "PERSON")]),
    ).map(([, v]) => v),
    ["Bố", "Bùi Bảo Trang"],
  );
});

test("a cell under a wording heading (a relation, a job title, goods) is not a name or an organization", () => {
  const table = [
    "Quan hệ\tHọ và tên\tNăm sinh\tNghề nghiệp",
    "",
    "Bố\tBùi Bảo Trang\t1965\tGiáo viên",
    "",
    "Mẹ\tLê Thị Thu Hà\t1968\tKinh doanh",
    "",
    "Thời gian\tĐơn vị công tác\tChức vụ",
    "",
    "2019 - 2022\tCông ty TNHH Hoa Mai\tNhân viên",
  ].join("\n");
  const found = plausibleModelDetections(table, [
    ...["Bố", "Mẹ", "Giáo viên", "Kinh doanh", "Nhân viên"].map((v) => ({
      ...span(table, v, "PERSON"),
      type: "TEN",
      label: "Họ và tên",
      source: "t",
      reason: "t",
      priority: 50,
    })),
    {
      ...span(table, "Bùi Bảo Trang", "PERSON"),
      type: "TEN",
      label: "Họ và tên",
      source: "t",
      reason: "t",
      priority: 50,
    },
    {
      ...span(table, "Công ty TNHH Hoa Mai", "ORGANIZATION"),
      type: "TO_CHUC",
      label: "Tổ chức",
      source: "t",
      reason: "t",
      priority: 50,
    },
  ]);
  assert.deepEqual(
    values(table, found).map(([, v]) => v),
    ["Bùi Bảo Trang", "Công ty TNHH Hoa Mai"],
  );
});

test("an official decision: public bodies and the place of issue stay, the identifier, residence and hospital are hidden", () => {
  const text = [
    "ỦY BAN NHÂN DÂN THÀNH PHỐ HẢI PHÒNG SỞ NỘI VỤ\tCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Số: 2417/QĐ-SNV\tThành phố Hải Phòng, ngày 12 tháng 8 năm 2026",
    "Theo đề nghị của Giám đốc Trung tâm Dịch vụ việc làm Thành phố Hải Phòng và Bảo hiểm xã hội Thành phố Hải Phòng.",
    "Số định danh cá nhân: 031091012345 Ngày cấp: 05/06/2022.",
    "Nơi ở hiện nay: Căn hộ số B12.05 thuộc khu chung cư Hoàng Huy, phường Sở Dầu, Thành phố Hải Phòng. Tổng số tháng: 36 tháng.",
    "Nơi đăng ký khám, chữa bệnh ban đầu: BỆNH VIỆN ĐA KHOA QUỐC TẾ HẢI PHÒNG TP. HP.",
    "Giám đốc Công an phường Sở Dầu chịu trách nhiệm thi hành Quyết định này./.",
    "- Như Điều 4; · PHÓ GIÁM ĐỐC",
    "- Lưu: VT, TTDVVL.",
  ].join("\n");
  const at = (value, after) => text.indexOf(after) + after.length;
  const spans = [
    span(text, "THÀNH PHỐ HẢI PHÒNG", "LOCATION"),
    span(text, "Thành phố Hải Phòng", "LOCATION", at("", "Số: 2417")),
    span(text, "Trung tâm Dịch vụ việc làm Thành phố Hải Phòng", "ORGANIZATION"),
    span(text, "Hải Phòng", "LOCATION", at("", "Trung tâm Dịch vụ việc làm Thành phố")),
    span(text, "Hải Phòng", "LOCATION", at("", "Bảo hiểm xã hội Thành phố")),
    span(text, "số B12.", "LOCATION"),
    span(text, "chung cư Hoàng Huy, phường Sở Dầu, Thành phố Hải Phòng", "LOCATION"),
    span(text, "VIỆN", "PERSON"),
    span(text, "KHOA QUỐC TẾ HẢI PHÒNG TP. HP", "LOCATION"),
    span(text, "Sở Dầu", "LOCATION", at("", "Công an phường")),
    span(text, "Quyết định", "LOCATION"),
    span(text, "Như Điều 4", "PERSON"),
    span(text, "Lưu", "PERSON"),
  ];
  const { complete } = applyDetectionPolicy(text, modelDetections(text, spans));
  assert.deepEqual(
    values(
      text,
      [...complete].sort((a, b) => a.start - b.start),
    ),
    [
      ["CCCD", "031091012345"],
      [
        "DIA_CHI",
        "Căn hộ số B12.05 thuộc khu chung cư Hoàng Huy, phường Sở Dầu, Thành phố Hải Phòng",
      ],
      ["TO_CHUC", "BỆNH VIỆN ĐA KHOA QUỐC TẾ HẢI PHÒNG TP. HP"],
    ],
  );
  // A residence before a date in prose is still an address: it has a number and sits mid-line.
  const signed = "Ký tại 12 Lê Lợi, Quận 1, ngày 3 tháng 4 năm 2026.";
  assert.deepEqual(
    values(signed, modelDetections(signed, [span(signed, "12 Lê Lợi, Quận 1", "LOCATION")])),
    [["DIA_CHI", "12 Lê Lợi, Quận 1"]],
  );
});

test("the wider set (decision 0160): departments, roles, package names, countries and a letterhead", () => {
  // A department or ward is wording, as a cell, a span or the word after the unit's kind.
  // A span that runs from a hospital's last word into its ward ("Rẫy Khoa Nhi") and an
  // organization that runs on into its department line are the models' to get right
  // since decision 0170 retired the unit trim; the fine-tuned model does.
  const dept = "Bệnh viện Chợ Rẫy Khoa Nhi\nPhòng ban: Phòng Kỹ thuật · Chức vụ: Kỹ sư phần mềm";
  assert.deepEqual(
    values(
      dept,
      modelDetections(dept, [
        span(dept, "Nhi", "ORGANIZATION"),
        span(dept, "Phòng Kỹ thuật", "ORGANIZATION"),
        span(dept, "thuật", "ORGANIZATION"),
      ]),
    ),
    [],
  );
  // "Khoa" as a middle name is a name.
  const poet = "Nhà thơ Nguyễn Khoa Điềm";
  assert.deepEqual(
    values(poet, modelDetections(poet, [span(poet, "Nguyễn Khoa Điềm", "PERSON")])),
    [["TEN", "Nguyễn Khoa Điềm"]],
  );
  // A role in capitals after the date line is not a name; a name in capitals after a label is.
  const role = "Cần Thơ, ngày 22 tháng 12 năm 2026 TL. HIỆU TRƯỞNG TRƯỞNG PHÒNG ĐÀO TẠO";
  assert.deepEqual(
    values(role, modelDetections(role, [span(role, "HIỆU TRƯỞNG TRƯỞNG PHÒNG ĐÀO TẠO", "PERSON")])),
    [],
  );
  const patient = "Họ tên người bệnh: HOÀNG KIM VY · Giới tính: Nam";
  assert.deepEqual(
    values(
      patient,
      modelDetections(patient, [
        span(patient, "HOÀNG KIM VY", "PERSON"),
        span(patient, "Nam", "PERSON"),
      ]),
    ),
    [["TEN", "HOÀNG KIM VY"]],
  );
  // A package name under "Gói cước", a title's "THÁNG", a rank and a country.
  const bill =
    "Dịch vụ\tGói cước\tThành tiền\n\nInternet cáp quang\tGiga Home\t280.000\n\nPHIẾU LƯƠNG THÁNG 02/2026\nQuốc tịch: Việt Nam · Thiếu tá";
  assert.deepEqual(
    values(
      bill,
      modelDetections(bill, [
        span(bill, "Giga Home", "ORGANIZATION"),
        span(bill, "THÁNG", "LOCATION"),
        span(bill, "Việt Nam", "ORGANIZATION"),
        span(bill, "Thiếu tá", "PERSON"),
      ]),
    ),
    [],
  );
  // A letterhead the reader joined: the company stops before its address, which the ward
  // after the comma seeds; the policy gives one organization and one address.
  const head =
    "Công ty TNHH MTV Thương mại Tổng hợp Tân Phong 370 Huỳnh Văn Bánh, Phường Hải Châu, Thành phố Đà Nẵng";
  const { complete } = applyDetectionPolicy(
    head,
    modelDetections(head, [
      span(head, "Công ty TNHH MTV Thương mại Tổng hợp Tân Phong", "ORGANIZATION"),
      span(head, "Phường Hải Châu, Thành phố Đà Nẵng", "LOCATION"),
    ]),
  );
  assert.deepEqual(
    values(
      head,
      [...complete].sort((a, b) => a.start - b.start),
    ).filter(([, v]) => v.length > 12),
    [
      ["TO_CHUC", "Công ty TNHH MTV Thương mại Tổng hợp Tân Phong"],
      ["DIA_CHI", "370 Huỳnh Văn Bánh, Phường Hải Châu, Thành phố Đà Nẵng"],
      ["DIA_CHI", "Phường Hải Châu, Thành phố Đà Nẵng"],
    ],
  );
  // Labelled codes of people, a personal tax code, a residence label of a bill, a birth
  // date label of a decision, and an address that the reader joined to the next sentence.
  const record = [
    "Mã nhân viên: NV84521 · Mã số thuế cá nhân: 8053087565",
    "Số thẻ BHYT: GD1481125110612 · Mã bệnh nhân: BN98154667",
    "Mã số sinh viên: 21924580 · Mã thuê bao: SGH5979459",
    "Địa chỉ lắp đặt: 121/15 Lê Lợi, Phường Hoàn Kiếm, Thành phố Hà Nội",
    "Ngày, tháng, năm sinh: 25/11/1996",
    "Nơi ở hiện nay: 312 đường Lý Thường Kiệt, P. Tân Định, TP. Hồ Chí Minh Tổng số tháng đóng: 55 tháng.",
  ].join("\n");
  assert.deepEqual(
    values(
      record,
      [...applyDetectionPolicy(record, []).complete].sort((a, b) => a.start - b.start),
    ),
    [
      ["MA_SO", "NV84521"],
      ["GIAY_TO", "8053087565"],
      ["MA_SO", "GD1481125110612"],
      ["MA_SO", "BN98154667"],
      ["MA_SO", "21924580"],
      ["MA_SO", "SGH5979459"],
      ["DIA_CHI", "121/15 Lê Lợi, Phường Hoàn Kiếm, Thành phố Hà Nội"],
      ["NGAY_SINH", "25/11/1996"],
      ["DIA_CHI", "312 đường Lý Thường Kiệt, P. Tân Định, TP. Hồ Chí Minh"],
    ],
  );
  // A company name ending in "Phong" is whole; a department line after a school is not.
  const firm = "HỘ KINH DOANH TẠP HÓA TÂN PHONG Tôi tên là Lê An";
  assert.deepEqual(
    values(firm, applyDetectionPolicy(firm, []).complete).filter(([t]) => t === "TO_CHUC"),
    [["TO_CHUC", "HỘ KINH DOANH TẠP HÓA TÂN PHONG"]],
  );
});
