import test from "node:test";
import assert from "node:assert/strict";
import { cardValues } from "../src/core/doc/id-card.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";

// A citizen identity card copied into a document (decision 0176). Invented values.
const page = (texts, part = "page-2") => texts.map((text, id) => ({ id, part, text }));
const hidden = (paragraphs, detections = new Map()) => {
  const { edits } = maskParagraphs(paragraphs, detections, "4aae");
  return paragraphs.map((paragraph) =>
    (edits.paragraphs.get(paragraph.id) ?? []).map((r) => paragraph.text.slice(r.start, r.end)),
  );
};

test("a copied card is hidden from its title to its machine lines, its wording kept", () => {
  const paragraphs = page([
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    // Text recognition joins lines and garbles the small bilingual labels.
    "Độc lập - Tự do - Hạnh phúc CĂN CƯỚC CÔNG DÂN",
    "Số/No: 031068914443",
    "Ngty dm/Dac cbữ: 04/08/1968",
    "Ngày,tháng.mản/bait: 27/04/2022 CỤC TRƯỜNG CỤC CĂNH SÁT QUẢN LÝ HÀNH CHÍNH VỂ TRẬT TỰ XÃ HỘI",
    "IDVNM0689144439031068914443<<6 6808046F2808048VNM<<<<<<<<<<<7",
    "PHAN<<MINH<NHUNG<<<<<<<<<<<<<<",
    "Trang 2/2",
  ]);
  assert.deepEqual(hidden(paragraphs), [
    [],
    [],
    ["Số/No: 031068914443"],
    ["Ngty dm/Dac cbữ: 04/08/1968"],
    ["Ngày,tháng.mản/bait: 27/04/2022"],
    ["IDVNM0689144439031068914443<<6 6808046F2808048VNM<<<<<<<<<<<7"],
    ["PHAN<<MINH<NHUNG<<<<<<<<<<<<<<"],
    [],
  ]);
});

test("the back alone is found by its machine lines; prose about a card is not a card", () => {
  assert.deepEqual(
    hidden(
      page([
        "Huỳnh Quốc Đạt",
        "IDVNM0689144439031068914443<<6",
        "6808046F2808048VNM<<<<<<<<<<<7",
        "Ghi chú",
      ]),
    ),
    [[], ["IDVNM0689144439031068914443<<6"], ["6808046F2808048VNM<<<<<<<<<<<7"], []],
  );
  const prose = page([
    "Bên B: Bà Phan Minh Nhung, căn cước công dân số 031068914443, cấp ngày 27/04/2022.",
    "Căn cước công dân số: 031068914443",
    "Hai bên thống nhất ký hợp đồng.",
  ]);
  assert.equal(cardValues(prose, () => []).size, 0);
});

test("a copier's specks read as dots between the title's words still start a card", () => {
  const paragraphs = page([
    "Độc lập - Tự do - Hạnh phúc CĂN. CƯỚC: CÔNG DÂN",
    "Số/No: 031068914443",
  ]);
  assert.deepEqual(hidden(paragraphs), [[], ["Số/No: 031068914443"]]);
});

test("on a card, another rule's find inside its printed wording is dropped", () => {
  const paragraphs = page([
    "CĂN CƯỚC CÔNG DÂN",
    "CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI",
  ]);
  const text = paragraphs[1].text;
  const start = text.indexOf("CẢNH SÁT");
  const detections = new Map([
    [
      1,
      [
        {
          start,
          end: start + 21,
          type: "TO_CHUC",
          label: "",
          source: "t",
          reason: "t",
          priority: 100,
        },
      ],
    ],
  ]);
  assert.deepEqual(hidden(paragraphs, detections), [[], []]);
});
