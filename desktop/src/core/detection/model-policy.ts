import type { DecodedEntitySpan } from "openmed";
import type { Detection } from "./types.ts";
import { isSyllable, looksLikeKnownName, looksLikeName } from "./person-cues.ts";
import { vocabulary } from "./vocabulary.ts";

const labels: Record<string, [string, string]> = {
  PERSON: ["TEN", "Họ và tên"],
  FIRST_NAME: ["TEN", "Họ và tên"],
  MIDDLE_NAME: ["TEN", "Họ và tên"],
  LAST_NAME: ["TEN", "Họ và tên"],
  USERNAME: ["NGUOI_DUNG", "Tên đăng nhập"],
  EMAIL: ["EMAIL", "Email"],
  PHONE: ["SDT", "Số điện thoại"],
  ACCOUNT_NUMBER: ["STK", "Số tài khoản"],
  IBAN: ["STK", "Số tài khoản"],
  ID_NUM: ["GIAY_TO", "Số giấy tờ"],
  SSN: ["GIAY_TO", "Số giấy tờ"],
  CREDIT_CARD: ["THE", "Số thẻ"],
  CVV: ["MA_BAO_MAT", "Mã bảo mật thẻ"],
  PIN: ["MA_BAO_MAT", "Mã PIN"],
  PASSWORD: ["MAT_KHAU", "Mật khẩu"],
  API_KEY: ["KHOA", "Khóa truy cập"],
  STREET_ADDRESS: ["DIA_CHI", "Địa chỉ"],
  BUILDING_NUMBER: ["DIA_CHI", "Địa chỉ"],
  LOCATION: ["DIA_CHI", "Địa chỉ"],
  ZIPCODE: ["DIA_CHI", "Địa chỉ"],
  GPS_COORDINATES: ["TOA_DO", "Tọa độ"],
  IP_ADDRESS: ["IP", "Địa chỉ IP"],
  ORGANIZATION: ["TO_CHUC", "Tổ chức"],
  DATE_OF_BIRTH: ["NGAY_SINH", "Ngày sinh"],
};

/** Provenance of a span built from more than one model before the pack relabels it. */
export const combinedModelSource = "Kết hợp nhiều mô hình";
/** Placeholder provenance; the model runner replaces it with the provider's source. */
export const defaultModelSource = "Mô hình nhận diện";

const contextual = new Set(["TEN", "DIA_CHI", "TO_CHUC"]);
/** A single word is weak evidence of a name, place or organization: a real one scores
 * close to 1 ("Lan", "Hùng", "Huế"), while a model's one-word misreadings of prose sit
 * below this ("Đại", "Hán", "Kinh"). Measured on the pack models (decision 0081). */
export const singleWordMinScore = 0.6;
const word = /[\p{L}\p{M}\p{N}_]/u;
/** A field separator or a line break never sits inside one name, place or organization;
 * a sentence end never sits inside a name or an organization (addresses keep "TP. HCM"). */
const addressSeparators = /[:：\t\r\n]/gu;
const nameSeparators = /[:：\t\r\n]|\.(?=\s|$)/gu;
/** The parties of a Vietnamese contract ("Bên A", "BÊN B", "Bên thuê", "Các Bên"): a role
 * in the text, never a person, place or organization. A closed list, so "bên chị Lan"
 * still keeps the name. */
/** A contract party ("Bên A", "Bên thuê", "các bên"), from the vocabulary. */
const party = vocabulary.wording.party;

/** Contract boilerplate that Title Case makes look like names ("Sự Kiện Bất Khả Kháng",
 * "Phí Dịch Vụ - Thanh Toán", "Bằng chữ: Tám triệu đồng"): a span inside one of these
 * phrases, or inside an amount written in words, is a misreading. Whole phrases only, so
 * "Nguyễn Thanh Toán" or "Công ty Dịch vụ Bình An", which reach past them, are kept. */

const phrase = vocabulary.wording.phraseAlternation;
/** Countries and regions: a span that is only one of these is where something comes
 * from ("Thịt bò Úc"), not anyone's address; an address that ends in one is kept whole. */
const countries = vocabulary.places.countries;
// Longest phrase first, and consecutive phrases form one run ("HỢP ĐỒNG DỊCH VỤ").

const boilerplate = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}])${phrase}(?:[^\\S\\r\\n]+${phrase})*(?![\\p{L}\\p{M}\\p{N}])`,
  "giu",
);
/** Ranges of the boilerplate phrases in one text, for spans to be checked against. */
export function boilerplateRanges(text: string): [number, number][] {
  return [...text.normalize("NFC").matchAll(boilerplate)].map((match) => [
    match.index,
    match.index + match[0].length,
  ]);
}

/** Whether a predicted name, place or organization can be one at all: it needs a letter
 * and two symbols (a place may count digits: "Quận 5"), it is not a contract party, and
 * a place is not only a country. */
/** A province or city, with or without its kind ("Thành phố Hồ Chí Minh", "LÂM ĐỒNG"): a
 * place, never a person ("Lâm" is a family name, "Lâm Đồng" is not anyone) (decision 0160). */
export function isProvince(value: string): boolean {
  const words = value
    .normalize("NFC")
    .toLowerCase()
    .replace(new RegExp(`^${vocabulary.places.kindAlternation}\\.?\\s+`, "iu"), "")
    .replace(/\s+/gu, " ")
    .trim();
  return provinceNames.has(words);
}
const provinceNames = vocabulary.places.provinces;
const organizationKind = vocabulary.organizations.kindAlone;
export function plausibleContextualSpan(type: string, value: string): boolean {
  if (!contextual.has(type)) return true;
  const content = value.normalize("NFC");
  if (type === "TEN" && isProvince(content)) return false;
  // The kind of an organization alone ("của Trường", "Công ty") is not one, nor a name.
  if (organizationKind.test(content.trim())) return false;
  const symbols = content.match(type === "DIA_CHI" ? /[\p{L}\p{N}]/gu : /\p{L}/gu) ?? [];
  if (symbols.length < 2 || !/\p{L}/u.test(content)) return false;
  const words = content
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  // A country alone ("Quốc tịch: Việt Nam") is not a place or an organization; "Anh",
  // "Mỹ", "Đức" and "Nga" are given names, so a name is left to its own evidence.
  if ((type !== "TEN" || /\s/u.test(words)) && countries.has(words.toLowerCase())) return false;
  // A currency code on its own ("Loại tiền: VND") is neither a place nor an organization.
  if (vocabulary.wording.currencies.test(words)) return false;
  return !party.test(words);
}

/** One Vietnamese syllable, without its tone marks: an onset, one to three vowels and a
 * final. "VISSAN", "PACOW", "FPT", "JEMMIA" are not one. */
/** A single word in capitals that no Vietnamese syllable spells is a brand or an acronym
 * ("VISSAN Xúc xích", "WINECO Cải ngọt"), not a person. A Vietnamese name in capitals ("NGUYỄN", "HÀ")
 * is made of syllables and is kept, as is a foreign name in Title Case. */
export function brandInCapitals(value: string): boolean {
  const word = value.normalize("NFC").trim();
  return (
    /^\p{Lu}[\p{Lu}\p{M}]{2,}$/u.test(word) && word === word.toUpperCase() && !isSyllable(word)
  );
}

/** A predicted span cut at the separators its type never contains, trimmed. */
function pieces(text: string, start: number, end: number, type: string) {
  const result: [number, number][] = [];
  const pattern = type === "DIA_CHI" ? addressSeparators : nameSeparators;
  let cursor = start;
  const push = (from: number, to: number) => {
    while (from < to && /\s/u.test(text[from]!)) from++;
    while (to > from && /\s/u.test(text[to - 1]!)) to--;
    if (to > from) result.push([from, to]);
  };
  for (const match of text.slice(start, end).matchAll(pattern)) {
    push(cursor, start + match.index);
    cursor = start + match.index + match[0].length;
  }
  push(cursor, end);
  return result;
}

/** Dates/amounts/currencies stay readable; model scores are review cues, not guarantees. */
export function modelDetections(text: string, spans: readonly DecodedEntitySpan[]): Detection[] {
  const detections: Detection[] = [];
  const typed = [...spans]
    .sort((a, b) => a.start - b.start)
    .flatMap((span) => {
      const label = labels[span.canonical_label];
      if (!label) return [];
      const [type, name] = label;
      // A span never crosses a field separator or a line; each side stands on its own.
      const parts = contextual.has(type)
        ? pieces(text, span.start, span.end, type)
        : [[span.start, span.end] as [number, number]];
      return parts.map(([start, end]) => ({
        start,
        end,
        type,
        name,
        score: span.score ?? undefined,
      }));
    });
  for (const piece of typed) {
    const { type, name, score } = piece;
    let { start, end } = piece;
    // A subword prediction must never leave the rest of the same word exposed.
    // This repairs boundaries only; it does not guess adjacent unlabelled names.
    if (contextual.has(type)) {
      while (start > 0 && word.test(text[start] ?? "") && word.test(text[start - 1] ?? "")) start--;
      while (end < text.length && word.test(text[end - 1] ?? "") && word.test(text[end] ?? ""))
        end++;
    }
    const previous = detections[detections.length - 1];
    // The model labels Vietnamese name/address components separately.
    // A hyphen/apostrophe joins two predicted name pieces, never arbitrary prose, and
    // never a tab: the next cell is another value ("Bố\tNguyễn Văn An").
    const joiner = type === "TEN" ? /^(?:[^\S\r\n\t]*|[-'’])$/u : /^(?:[^\S\r\n\t]|,)*$/u;
    if (
      previous &&
      (type === "TEN" || type === "DIA_CHI") &&
      previous.type === type &&
      start <= previous.end + 5 &&
      (start <= previous.end || joiner.test(text.slice(previous.end, start)))
    ) {
      previous.start = Math.min(previous.start, start);
      previous.end = Math.max(previous.end, end);
      if (score !== undefined) previous.score = Math.max(previous.score ?? 0, score);
      continue;
    }
    detections.push({
      start,
      end,
      type,
      label: name,
      priority: 50,
      source: defaultModelSource,
      reason: "Mô hình nhận diện theo ngữ cảnh. Hãy kiểm tra lại phạm vi thông tin được ẩn.",
      ...(score !== undefined ? { score } : {}),
    });
  }
  return plausibleModelDetections(text, detections);
}

/** State bodies and public services as an official document names them ("Ủy ban nhân
 * dân Thành phố Hồ Chí Minh", "SỞ NỘI VỤ", "Bảo hiểm xã hội", "Trung tâm Dịch vụ việc
 * làm", "Công an phường …"): not anyone's private data, and the place after one is its
 * jurisdiction, not a residence (decision 0159). A body's range is its term, extended
 * over every place or organization a model found touching it, so the city inside
 * "Sở Nội vụ Thành phố Hồ Chí Minh" goes with the body. */
const publicBody = new RegExp(
  `(?<![\\p{L}\\p{M}])${vocabulary.bodies.termAlternation}(?![\\p{L}\\p{M}])`,
  "giu",
);
// Up to two words between a body and the place a model found after it: the unit's kind,
// which a model leaves out or cuts ("Ủy ban nhân dân [Thành phố] Hồ Chí Minh", "Bảo hiểm
// xã hội [Thành] phố Hồ Chí Minh").
const unitGap = /^[^\S\r\n\t]*(?:[\p{L}\p{M}]+\.?[^\S\r\n\t]+){0,3}$/u;
function publicBodyRanges(text: string, detections: readonly Detection[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of text.matchAll(publicBody)) {
    let start = match.index,
      end = match.index + match[0].length;
    for (let grown = true; grown;) {
      grown = false;
      for (const d of detections) {
        if (!contextual.has(d.type)) continue;
        // A "name" that is a piece of the place ("HỒ" then "CHÍ MINH") joins; a real name
        // after a body ("Giám đốc Sở Y tế Nguyễn Văn An") does not.
        const joins =
          (d.start < end || unitGap.test(text.slice(end, d.start))) &&
          (d.type !== "TEN" ||
            isProvince(text.slice(d.start, d.end)) ||
            !looksLikeKnownName(text.slice(d.start, d.end)));
        if (d.end > end && joins) {
          end = d.end;
          grown = true;
        }
        if (d.type === "TO_CHUC" && d.start < start && d.end > start) {
          start = d.start;
          grown = true;
        }
      }
    }
    ranges.push([start, end]);
  }
  return ranges;
}
/** The place of issue before the date of an official document ("Thành phố Hồ Chí Minh,
 * ngày 23 tháng 9 năm 2026"): up to six words without a number at the start of a line or
 * cell, followed by the date, are where the document was signed, not where anyone lives
 * (decision 0159). Read from the text, so every model's pass shields the same range. */
const issuePlace =
  /(?:^|[\t\r\n]|[^\S\r\n]·[^\S\r\n])[^\S\r\n]*((?:[\p{L}\p{M}]+\.?[^\S\r\n]+){0,5}[\p{L}\p{M}]+\.?)[^\S\r\n]*,?[^\S\r\n]*ngày[^\S\r\n]+\d{1,2}[^\S\r\n]+tháng[^\S\r\n]+\d{1,2}[^\S\r\n]+năm[^\S\r\n]+\d{4}(?!\p{N})/giu;
function issuePlaceRanges(text: string): [number, number][] {
  return [...text.matchAll(issuePlace)].map((match) => {
    const start = match.index + match[0].indexOf(match[1]!);
    return [start, start + match[1]!.length];
  });
}

/** Drop the spans no name, place or organization can be. Applied per model window and
 * again on the whole text, where a phrase cut by a window edge is whole. Decomposed
 * text skips the phrase check: ranges are NFC positions, and the window text is NFC. */
export function plausibleModelDetections(text: string, detections: readonly Detection[]) {
  const phrases = text === text.normalize("NFC") ? boilerplateRanges(text) : [];
  const shielded = [...publicBodyRanges(text, detections), ...issuePlaceRanges(text)];
  return detections.flatMap((detection) => {
    const trimmed = withoutUnit(text, detection);
    const d = trimmed && trimmed.type === "TEN" ? withoutBrands(text, trimmed) : trimmed;
    if (!d) return [];
    const value = text.slice(d.start, d.end);
    if (!plausibleContextualSpan(d.type, value)) return [];
    if (!contextual.has(d.type)) return [d];
    if (phrases.some(([start, end]) => start <= d.start && d.end <= end)) return [];
    if (shielded.some(([start, end]) => start <= d.start && d.end <= end)) return [];
    if (productCell(text, d.start, d.end)) return [];
    if (wordingColumn(text, d.start, d.end)) return [];
    if (transactionCell(text, d.start, d.end, d.type, value)) return [];
    if (capitalHeading(text, d.start, d.end, d.type, value)) return [];
    if (departmentCell(text, d.start, d.end) || sexValue(text, d.start, value)) return [];
    if (wordingField(text, d.start)) return [];
    // A role or heading in capitals inside a line of prose ("TL. HIỆU TRƯỞNG TRƯỞNG PHÒNG
    // ĐÀO TẠO" after the date line): a name with tone marks in capitals is made of name
    // syllables, as a span or as its whole cell when a model cut it ("THỊ HỒNG NHUNG").
    // Unaccented capitals (a statement's "LE MINH TUAN") keep the shape test of 0154.
    if (
      d.type === "TEN" &&
      !/\p{Ll}/u.test(value) &&
      /\s/u.test(value.trim()) &&
      /\p{M}|[đĐ]/u.test(value.normalize("NFD")) &&
      !looksLikeName(value) &&
      !looksLikeKnownName(
        cellAround(text, d.start, d.end)
          .replace(/\([^)]*\)/gu, " ")
          .trim(),
      )
    )
      return [];
    // One word on its own (a cell, a short message) is the whole evidence there is.
    const alone = value.trim() === text.trim();
    return alone || /\s/u.test(value.trim()) || (d.score ?? 1) >= singleWordMinScore ? [d] : [];
  });
}

/** A name span without the brands in capitals at its edges ("VISSAN Xúc" → "Xúc"),
 * or nothing when only brands are left. */
function withoutBrands(text: string, detection: Detection): Detection | undefined {
  let { start, end } = detection;
  for (;;) {
    const first = /^[\p{L}\p{M}]+/u.exec(text.slice(start, end))?.[0];
    if (!first || !brandInCapitals(first)) break;
    start += first.length;
    while (start < end && /\s/u.test(text[start]!)) start++;
  }
  for (;;) {
    const last = /[\p{L}\p{M}]+$/u.exec(text.slice(start, end))?.[0];
    if (!last || !brandInCapitals(last)) break;
    end -= last.length;
    while (end > start && /\s/u.test(text[end - 1]!)) end--;
  }
  if (end <= start) return undefined;
  return start === detection.start && end === detection.end
    ? detection
    : { ...detection, start, end };
}

/** A product's measure, pack or unit ("300g", "3kg", "1,5 l", "gói", "hộp", "khay", and
 * an invoice's unit column: "KG", "HOP", "KH", "G1", "cái"). A table
 * cell (text with a tab on at least one side, as the PDF reader writes rows) that has
 * one describes goods: a model's name, place or organization there is product wording
 * ("AN ĐÌNH Gạo Japonica BB-3kg", "OLALA Trứng Gà Sạch hộp", "WINECO Cải ngọt 300g"),
 * whatever its score (decision 0155); so is one anywhere in a row whose unit column holds
 * a unit ("3 | Ốc Hương Thiên Nhiên | Kg | 0,64"). A sentence is not a cell: "Gửi 2 hộp
 * bánh cho anh Nguyễn Văn An" keeps its name. */
const productMeasure = new RegExp(
  `\\d+(?:[.,]\\d+)?[^\\S\\r\\n]?${vocabulary.units.measureAlternation}(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{M}])${vocabulary.units.packAlternation}(?![\\p{L}\\p{M}\\p{N}])`,
  "iu",
);
/** A unit on its own in a cell: the "Đơn vị tính" column of a goods table. */
const unitCell = vocabulary.units.unitCell;
function productCell(text: string, start: number, end: number): boolean {
  const tab = text.lastIndexOf("\t", start - 1);
  const line = text.lastIndexOf("\n", start - 1);
  const nextTab = text.indexOf("\t", end);
  const nextLine = text.indexOf("\n", end);
  const cellStart = Math.max(tab, line) + 1;
  const cellEnd = Math.min(
    nextTab < 0 ? text.length : nextTab,
    nextLine < 0 ? text.length : nextLine,
  );
  const tabbed = (tab > line && tab >= 0) || (nextTab >= 0 && (nextLine < 0 || nextTab < nextLine));
  if (!tabbed) return false;
  if (productMeasure.test(text.slice(cellStart, cellEnd))) return true;
  // A row whose unit column holds a unit ("Kg", "Phần", "Lon") lists goods.
  const row = text.slice(line + 1, nextLine < 0 ? text.length : nextLine);
  return row.split("\t").some((cell) => unitCell.test(cell.trim()));
}

/** The line a span is on and the tabbed cell it is in; `column` counts the cells before. */
function rowAround(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineBreak = text.indexOf("\n", end);
  const lineEnd = lineBreak < 0 ? text.length : lineBreak;
  const tabBefore = text.lastIndexOf("\t", start - 1);
  const tabAfter = text.indexOf("\t", end);
  const cellStart = Math.max(lineStart, tabBefore + 1);
  const cellEnd = tabAfter < 0 || tabAfter > lineEnd ? lineEnd : tabAfter;
  const row = text.slice(lineStart, lineEnd);
  return {
    row,
    cells: row.split("\t"),
    tabbed: row.includes("\t"),
    cell: text.slice(cellStart, cellEnd),
    column: text.slice(lineStart, start).split("\t").length - 1,
    lineStart,
  };
}

/** Column headings under which a cell holds wording, never a person, place or
 * organization: a relation, a job title, goods, a unit, a quantity or a price. */
const wordingHeading = new RegExp(
  `^${vocabulary.wording.headingAlternation}(?![\\p{L}\\p{M}])`,
  "iu",
);
/** Whether a tabbed cell stands in a column whose heading says it holds wording
 * (decision 0156): "Bố" under "Quan hệ", "Trưởng nhóm" under "Chức vụ", goods under "Tên
 * hàng hóa, dịch vụ". The heading is the same cell of the first row of the run of rows
 * with as many cells above this one; rows read as one paragraph each sit a blank line
 * apart. A cell of the heading row itself counts too. */
function wordingColumn(text: string, start: number, end: number): boolean {
  const { tabbed, cells, column, lineStart } = rowAround(text, start, end);
  if (!tabbed) return false;
  let heading = cells[column] ?? "";
  for (let at = lineStart; at > 0;) {
    const previousStart = text.lastIndexOf("\n", at - 2) + 1;
    const line = text.slice(previousStart, at - 1);
    if (line.trim()) {
      const above = line.split("\t");
      if (above.length !== cells.length) break;
      heading = above[column] ?? "";
    }
    at = previousStart;
  }
  return wordingHeading.test(heading.trim().normalize("NFC"));
}

const dateCell =
  /^\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/u;
// Two amounts may share a cell when the reader merged a row's last columns.
const amountCell =
  /^\s*[+-]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?(?:\s+[+-]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)*\s*(?:đ|vnd|vnđ)?\s*$/iu;
/** A transaction row of a bank statement is a tabbed row with a date cell and an amount
 * cell. In a cell of it written without tone marks ("TRA LUONG THANG 9", "Thanh toan QR",
 * "Rut tien ATM"), the models, trained on accented Vietnamese, read the wording as names,
 * places and organizations (decision 0156). A name there is kept only in the shape of one
 * (a family name first, every word a syllable); a company is found by its legal form
 * (context-fields) and a person by their position (detectTransferNames), not by a model. */
function transactionCell(
  text: string,
  start: number,
  end: number,
  type: string,
  value: string,
): boolean {
  const { tabbed, cells, cell } = rowAround(text, start, end);
  if (!tabbed || cells.length < 3) return false;
  if (!cells.some((c) => dateCell.test(c)) || !cells.some((c) => amountCell.test(c))) return false;
  if (/\p{M}|[đĐ]/u.test(cell.normalize("NFD"))) return false;
  return type !== "TEN" || !looksLikeName(value);
}

const addressWord = new RegExp(
  `(?<![\\p{L}\\p{M}])${vocabulary.units.addressWordAlternation}(?![\\p{L}\\p{M}])`,
  "iu",
);
const organizationWord = new RegExp(
  `(?<![\\p{L}\\p{M}])${vocabulary.organizations.kindAlternation}(?![\\p{L}\\p{M}])`,
  "iu",
);
const cellBreak = /\t|\r?\n|[^\S\r\n]·[^\S\r\n]/u;
/** The cell or line around a span: text between tabs, line breaks or the " · " the PDF
 * reader puts between two fields of one line. */
function cellAround(text: string, start: number, end: number): string {
  let from = 0;
  for (const match of text.slice(0, start).matchAll(new RegExp(cellBreak, "gu")))
    from = match.index + match[0].length;
  const next = cellBreak.exec(text.slice(end));
  return text.slice(from, next ? end + next.index : text.length);
}
/** A model's name, place or organization in a line or cell written in capitals ("SAO KÊ
 * TÀI KHOẢN", "ĐẠI DIỆN BÊN A", "I. THÔNG TIN BẢN THÂN", "YÊU CẦU TRA SOÁT GIAO DỊCH") is
 * a heading unless it has the evidence of its type (decision 0156): a name is made of
 * name syllables and starts with a family name (the span, or the whole cell when a model
 * cut a name in two); a place has a digit or an address word in the cell; an organization
 * has its legal form or kind. A parenthesis and a trailing colon are not part of the test
 * ("NGƯỜI LAO ĐỘNG (Bên B):"); a cell of one word is left to the score rule. */
function capitalHeading(
  text: string,
  start: number,
  end: number,
  type: string,
  value: string,
): boolean {
  const head = cellAround(text, start, end)
    .replace(/\([^)]*\)/gu, " ")
    .replace(/[:：]\s*$/u, "")
    .trim();
  if (/\p{Ll}/u.test(head) || (head.match(/[\p{L}\p{M}]+/gu) ?? []).length < 2) return false;
  if (type === "TEN") return !looksLikeKnownName(value) && !looksLikeKnownName(head);
  if (type === "DIA_CHI") return !/\p{N}/u.test(head) && !addressWord.test(head);
  return !organizationWord.test(head);
}

/** A department, ward or team inside an organization ("Phòng Kỹ thuật", "Khoa Nhi", "Ban
 * Giám đốc", "Bộ phận Kho vận"): a short cell or line that starts with the unit's kind is
 * wording, not an organization or a name (decision 0160). A clinic ("Phòng khám …") is an
 * organization and is left to its legal prefix. */
/** The kinds of unit inside an organization ("Phòng", "Khoa", "Ban", "Bộ phận", "Tổ",
 * "Đội") as a regex source, each excluding the words after which it is not a unit
 * ("Phòng khám", "Khoa học", "Ban Mê Thuột"), from the vocabulary. */
function unitKinds(kinds: readonly string[]): string {
  const { notUnits } = vocabulary.organizations;
  const blank = "[^\\S\\r\\n]+";
  return `(?:${kinds
    .map((kind) => {
      const exceptions = notUnits[kind] ?? [];
      const not = exceptions.length
        ? `(?!${blank}(?:${exceptions.map((e) => e.replace(/ /g, blank)).join("|")}))`
        : "";
      return `${kind.replace(/ /g, blank)}${not}`;
    })
    .join("|")})`;
}
const unitKind = unitKinds(vocabulary.organizations.unitKinds);
const department = new RegExp(
  `^${unitKind}[^\\S\\r\\n]+[\\p{L}\\p{M}]+(?:[^\\S\\r\\n]+[\\p{L}\\p{M}]+){0,4}[.:]?$`,
  "iu",
);

const unitKindAlone = new RegExp(`^${unitKind}$`, "iu");
/** The unit's kind and up to two words of its name just before a span, as "Bộ ",
 * "Phòng Kinh " or "Khoa ": the first word of each kind, since a span may start inside
 * a two-word kind ("Bộ [phận …]"). */
const unitLead = new RegExp(
  `(?:^|[^\\p{L}\\p{M}])((?:${vocabulary.organizations.unitKinds.map((k) => k.split(" ")[0]).join("|")})(?:[^\\S\\r\\n]+[\\p{L}\\p{M}]+){0,2})[^\\S\\r\\n]+$`,
  "iu",
);
function departmentCell(text: string, start: number, end: number): boolean {
  const value = text.slice(start, end).trim().normalize("NFC");
  // The unit as written: the span, or the span extended back over its kind and the words
  // between ("Bộ [phận Kho vận]", "Phòng Kinh [doanh]", "Khoa [Nhi]").
  const lead = unitLead.exec(text.slice(Math.max(0, start - 40), start).normalize("NFC"))?.[1];
  return (
    department.test(cellAround(text, start, end).trim().normalize("NFC")) ||
    department.test(lead ? `${lead} ${value}` : value) ||
    (unitKindAlone.test(value) && /^[^\S\r\n]+[\p{L}\p{M}]/u.test(text.slice(end)))
  );
}
/** An organization a model read on into the department line the reader joined to it
 * ("Trường Đại học Kinh tế Quốc dân Phòng Đào tạo"): the span ends before the unit's
 * kind, once the name before it has two words (decision 0160). A clinic, a fire-safety
 * company and a bank's transaction office keep their words. */
const unitStart = new RegExp(`\\s${unitKind}[^\\S\\r\\n]+[\\p{L}\\p{M}]`, "iu");
/** In a place, only a room or a ward can follow: "Tổ 5", "Đội Cấn" and "Ban Mê Thuột" are
 * parts of addresses. */
const unitInPlace = new RegExp(
  `\\s${unitKinds(vocabulary.organizations.unitInPlaces)}[^\\S\\r\\n]+[\\p{L}\\p{M}]`,
  "iu",
);
function withoutUnit(text: string, detection: Detection): Detection | undefined {
  if (!contextual.has(detection.type)) return detection;
  const value = text.slice(detection.start, detection.end);
  // A name with "Khoa" as a middle name ("Nguyễn Khoa Điềm") is whole; a "name" that runs
  // from a hospital's last word into its ward ("Rẫy Khoa Nhi") is not one.
  if (detection.type === "TEN" && looksLikeName(value)) return detection;
  // An organization a model read on into the address after it ("… Đông Á [Số] 337 …",
  // "… Thành Công [95] Lê Lợi"): "Số", or a house number before a capitalized street.
  if (detection.type === "TO_CHUC") {
    const tail =
      /[^\S\r\n]+số$/iu.exec(value) ??
      (/^[^\S\r\n]+(?:\p{Lu}|(?:đường|phố|ngõ|ngách|hẻm|số)[^\S\r\n])/u.test(
        text.slice(detection.end),
      )
        ? /[^\S\r\n]+\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*$/iu.exec(value)
        : null);
    if (tail && (value.slice(0, tail.index).match(/[\p{L}\p{M}]+/gu) ?? []).length >= 2)
      return { ...detection, end: detection.start + tail.index };
  }
  const at = (detection.type === "DIA_CHI" ? unitInPlace : unitStart).exec(value);
  if (!at) return detection;
  const before = (value.slice(0, at.index).match(/[\p{L}\p{M}]+/gu) ?? []).length;
  if (before >= 2) return { ...detection, end: detection.start + at.index };
  return detection.type === "TEN" ? undefined : detection;
}
/** The value of a field whose label says it holds wording ("Chức vụ: Kỹ sư phần mềm",
 * "Lý do nộp: Hoàn tạm ứng", "vị trí Chuyên viên nhân sự"): no person, place or
 * organization (decision 0160), like a cell under such a heading (0156). */
const wordingLabel = new RegExp(
  `${vocabulary.wording.labelAlternation}[^\\S\\r\\n]*[:：][^\\S\\r\\n]*(?:[\\p{L}\\p{M}\\p{N}]+[^\\S\\r\\n]+){0,4}$`,
  "iu",
);
const positionWord = new RegExp(
  `${vocabulary.wording.positionAlternation}[^\\S\\r\\n]+(?:[\\p{L}\\p{M}\\p{N}]+[^\\S\\r\\n]+){0,3}$`,
  "iu",
);
function wordingField(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 60), start).normalize("NFC");
  return (
    wordingLabel.test(before) ||
    // "trúng tuyển vị trí Chuyên viên nhân sự": the position, written with a capital.
    (positionWord.test(before) && /^\p{Lu}/u.test(text.slice(start, start + 2).normalize("NFC")))
  );
}
/** "Giới tính: Nam": a sex, not a given name. */
const sexLabel = new RegExp(
  `${vocabulary.wording.sexLabelAlternation}[^\\S\\r\\n]*[:：][^\\S\\r\\n]*$`,
  "iu",
);
function sexValue(text: string, start: number, value: string): boolean {
  return (
    vocabulary.wording.sexes.has(value.trim().normalize("NFC").toLowerCase()) &&
    sexLabel.test(text.slice(Math.max(0, start - 20), start))
  );
}

/** Combine overlapping evidence across models/windows without dropping exposed tails. */
export function mergeModelDetections(detections: readonly Detection[]): Detection[] {
  const merged: Detection[] = [];
  for (const span of [...detections].sort(
    (a, b) => a.type.localeCompare(b.type) || a.start - b.start,
  )) {
    const previous = merged[merged.length - 1];
    if (previous && previous.type === span.type && span.start < previous.end) {
      previous.end = Math.max(previous.end, span.end);
      if (previous.source !== span.source) previous.source = combinedModelSource;
    } else merged.push({ ...span });
  }
  return merged;
}
