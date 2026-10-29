import test from "node:test";
import assert from "node:assert/strict";
import { detectBankingIdentifiers, detectTransferNames } from "../src/core/detection/banking.ts";
import { reconcileContextFields } from "../src/core/detection/context-fields.ts";
import { detectLabelledFields } from "../src/core/detection/labelled-fields.ts";
import { detectPersonCues } from "../src/core/detection/person-cues.ts";
import { openDocument } from "../src/core/doc/document.ts";
import { syntheticDocuments } from "./documents/generate.mjs";

const values = (text, detections) => detections.map((d) => [d.type, text.slice(d.start, d.end)]);

test("account numbers after a bank's TK and after a longer account label", () => {
  const cases = [
    ["VU KIM YEN chuyen tien den TK 84939225698468 PHAN QUOC NAM", "84939225698468"],
    ["Số tài khoản nhận lương: 871287224827 - Sacombank", "871287224827"],
    ["Tài khoản thụ hưởng: 0123456789", "0123456789"],
  ];
  for (const [text, account] of cases)
    assert.deepEqual(values(text, detectBankingIdentifiers(text)), [["STK", account]], text);
  // A ledger account has fewer than six digits.
  assert.deepEqual(detectBankingIdentifiers("Nợ TK 331, Có TK 1111"), []);
  // Transfer wording puts the account after "den"; text recognition may lose the "TK"
  // (decision 0171), and the number is still the account, once.
  for (const text of [
    "NGUYEN QUOC PHUC chuyen tien den T 96873162835 LY HUU KHANG",
    "NGUYEN QUOC PHUC chuyen tien den 96873162835 LY HUU KHANG",
    "NGUYEN QUOC PHUC chuyen tien den TK 96873162835 LY HUU KHANG",
  ])
    assert.deepEqual(values(text, detectBankingIdentifiers(text)), [["STK", "96873162835"]], text);
  assert.deepEqual(detectBankingIdentifiers("chuyen tien den ngay 10/10"), []);
});

test("names in transfer text: the sender before chuyen tien or CK, the recipient after TK", () => {
  const text = [
    "VU KIM YEN chuyen tien den TK 84939225698468 PHAN QUOC NAM",
    "CT DEN:FT26015333275 BUI THANH HANH chuyen tien thue nha T10",
    "HOANG VAN HUNG CK mua hang FT26022835236",
    "TRA LUONG THANG 9 CONG TY TNHH MTV VAN TAI DONG A",
    "Thanh toan QR WINMART 641810",
    "Phi duy tri dich vu SMS Banking",
  ].join("\n");
  assert.deepEqual(
    values(text, detectTransferNames(text))
      .map(([, value]) => value)
      .sort(),
    ["BUI THANH HANH", "HOANG VAN HUNG", "PHAN QUOC NAM", "VU KIM YEN"],
  );
  assert.deepEqual(detectTransferNames("HO CHI MINH\tTHANH PHO"), []);
});

test("account holders are names, and a tab or a dot ends a field", () => {
  const text = "Chủ tài khoản: NGÔ BẢO THẢO · Số tài khoản: 6242608679338";
  assert.deepEqual(values(text, detectLabelledFields(text).detections), [["TEN", "NGÔ BẢO THẢO"]]);
  const word = "Họ và tên: Hoàng Minh Long\tSinh ngày: 08/03/1984";
  assert.deepEqual(values(word, detectLabelledFields(word).detections), [
    ["TEN", "Hoàng Minh Long"],
  ]);
  const place = "Địa điểm làm việc: 15 Võ Văn Tần, Phường Sài Gòn, Thành phố Hồ Chí Minh";
  assert.deepEqual(values(place, detectLabelledFields(place).detections), [
    ["DIA_CHI", "15 Võ Văn Tần, Phường Sài Gòn, Thành phố Hồ Chí Minh"],
  ]);
});

test("names after a form of address and under a signature; headings stay", () => {
  const text =
    "Bà Võ Minh Yến cam kết căn nhà. Khi cần, Bên B gọi cho bà Trang. Anh Văn là môn học.\n\n" +
    "NGƯỜI LAO ĐỘNG · NGƯỜI SỬ DỤNG LAO ĐỘNG\n\n(Ký, ghi rõ họ tên) · (Ký, đóng dấu)\n\n" +
    "Võ Đức Hải · LÊ THANH VY\n\nKý ngày 08/08/2026\n\n(Ký, ghi rõ họ tên)\n\nHỢP ĐỒNG NÀY CÓ HIỆU LỰC";
  assert.deepEqual(
    values(text, detectPersonCues(text)).map(([, value]) => value),
    ["Võ Minh Yến", "Trang", "Võ Đức Hải", "LÊ THANH VY"],
  );
});

test("a contract's party is a person when its value looks like a name (decision 0174)", () => {
  const found = (text) => values(text, detectPersonCues(text)).map(([, value]) => value);
  assert.deepEqual(found("BÊN B: LÝ THU THẢO"), ["LÝ THU THẢO"]);
  assert.deepEqual(found("Bên cho thuê: Lê Phi Long, sinh năm 1988"), ["Lê Phi Long"]);
  // A company, a heading in capitals and a clause are not; a form of address reads its own.
  assert.deepEqual(found("BÊN A: CÔNG TY CỔ PHẦN VIỆT TIẾN"), []);
  assert.deepEqual(found("Bên B: QUAN HỆ GIA ĐÌNH"), []);
  assert.deepEqual(found("Bên B đồng ý: Trần Văn An"), []);
  assert.deepEqual(found("BÊN B: Ông LÊ PHI LONG"), ["LÊ PHI LONG"]);
  // The party's birth date may follow "Sinh năm"; a year alone stays.
  const born = (text) => values(text, reconcileContextFields(text, []));
  assert.deepEqual(born("Sinh năm: 11/04/1988"), [["NGAY_SINH", "11/04/1988"]]);
  assert.deepEqual(born("Sinh năm: 1988"), []);
});

test("a company in capitals needs no label, and never runs into the next cell", () => {
  const text = "TRA LUONG THANG 9 CONG TY TNHH THUONG MAI TONG HOP THANH CONG\t6.000.000";
  assert.deepEqual(values(text, reconcileContextFields(text, [])), [
    ["TO_CHUC", "CONG TY TNHH THUONG MAI TONG HOP THANH CONG"],
  ]);
  assert.deepEqual(reconcileContextFields("công ty chúng tôi cam kết", []), []);
});

test("the reader keeps a statement's wrapped description and a prose label whole", async () => {
  const documents = await syntheticDocuments(2, { variants: 2 });
  for (const { name, bytes, expect } of documents.filter((d) => d.name.endsWith(".pdf"))) {
    const texts = (await openDocument(bytes, name)).paragraphs.map((p) => p.text);
    if (name.startsWith("statement"))
      for (const paragraph of texts)
        assert.doesNotMatch(
          paragraph,
          /^\d{6,} [A-Z]/u,
          `${name}: a wrapped description stands alone`,
        );
    if (name.startsWith("contract-labour"))
      assert.ok(
        texts.some((t) => t.includes("Địa điểm làm việc: ")),
        `${name}: the label is split`,
      );
    assert.ok(expect.hide.length);
  }
});
